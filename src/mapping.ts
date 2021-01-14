import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  Transfer,
  DistributionsClaimed,
  DistributionCreated,
} from "../generated/PToken/PToken";
import {
  Deposit,
  Withdraw,
} from "../generated/LiquidityModule/LiquidityModule";
import {
  LoanModule,
  Repay,
  UnlockedPledgeWithdraw,
  DebtDefaultExecuted,
} from "../generated/LoanModule/LoanModule";
import {
  LoanProposalsModule,
  PledgeAdded,
  DebtProposalCreated,
  DebtProposalCanceled,
  PledgeWithdrawn,
  DebtProposalExecuted,
} from "../generated/LoanProposalsModule/LoanProposalsModule";
import {
  User,
  UserSnapshot,
  Debt,
  Pool,
  Pledge,
  Earning,
  BalanceChange,
  DistributionEvent,
} from "../generated/schema";
import {
  PERCENT_MULTIPLIER,
  getDebtProposalId,
  constructTwoPartId,
  getPledgeIdFromRaw,
  constructThreePartId,
  getPledgeId,
  ZERO_ADDRESS,
  isPoolModuleExist,
  calculateLBalanceIncreasing,
} from "./utils";
import {
  getCommonHandlerCash,
  getLatestPool,
  addPoolSnapshot,
  addExitBalance,
} from "./utils/entities";

export function handleTransfer(event: Transfer): void {
  let to = get_user(event.params.to.toHexString());
  let pool = getLatestPool();

  if (
    to.id != ZERO_ADDRESS &&
    !isPoolModuleExist(to.id) &&
    !pool.users.includes(to.id)
  ) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(to.id);
    pool.users = new_users;
    to.save();
  }
  pool.save();

  addPoolSnapshot(event.block.timestamp, pool);
}

export function handleDeposit(event: Deposit): void {
  let pool = getLatestPool();
  pool.depositSum = pool.depositSum.plus(event.params.lAmount);
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);

  // update user balance
  let user = get_user(event.params.sender.toHexString());
  user.pBalance = user.pBalance.plus(event.params.pAmount);
  user.lBalance = user.lBalance.plus(event.params.lAmount);
  user.save();

  // save history
  createNewUserSnapshot(user, event.block.timestamp);
  init_balance_change(
    event.block.timestamp,
    user,
    event.params.lAmount,
    "DEPOSIT"
  ).save();
  addExitBalance(event.block.timestamp, user, pool);
}

export function handleWithdraw(event: Withdraw): void {
  let pool = getLatestPool();
  pool.withdrawSum = pool.withdrawSum.plus(event.params.lAmountTotal);
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);

  let user = get_user(event.params.sender.toHexString());
  user.lBalance = user.lBalance.minus(
    lProportional(event.params.pAmount, user)
  );
  user.pBalance = user.pBalance.minus(event.params.pAmount);
  user.save();

  // save history
  createNewUserSnapshot(user, event.block.timestamp);
  init_balance_change(
    event.block.timestamp,
    user,
    event.params.lAmountUser,
    "WITHDRAW"
  ).save();
  addExitBalance(event.block.timestamp, user, pool);
}

export function handleDebtProposalCreated(event: DebtProposalCreated): void {
  let debt_id = getDebtProposalId(
    event.params.sender.toHexString(),
    event.params.proposal.toHex()
  );

  let proposal = new Debt(debt_id);
  proposal.proposal_id = event.params.proposal.toHex();
  proposal.borrower = event.params.sender.toHexString();
  proposal.supporters = [];
  proposal.description = event.params.descriptionHash;
  proposal.total = event.params.lAmount;
  proposal.apr = event.params.interest;
  proposal.repayed = BigInt.fromI32(0);
  proposal.lStaked = BigInt.fromI32(0);
  proposal.pStaked = BigInt.fromI32(0);
  proposal.stakeProgress = "0";
  proposal.pledges = [];
  proposal.status = "PROPOSED";
  proposal.save();

  let pool = getLatestPool();
  pool.proposalsCount = pool.proposalsCount.plus(BigInt.fromI32(1));
  updateMaxProposalInterest(proposal, pool, true);
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);
}

export function handleDebtProposalCanceled(event: DebtProposalCanceled): void {
  let debt_id = getDebtProposalId(
    event.params.sender.toHexString(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id)!;
  proposal.status = "CLOSED";
  proposal.save();

  let pool = getLatestPool();
  pool.proposalsCount = pool.proposalsCount.minus(BigInt.fromI32(1));
  updateMaxProposalInterest(proposal, pool, false);
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);
}

export function handleDebtProposalExecuted(event: DebtProposalExecuted): void {
  let debt_id = constructTwoPartId(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;

  // update current user credit
  let user = User.load(proposal.borrower)!;
  user.credit = user.credit.plus(proposal.total);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);

  // update debt proposal
  proposal.start_date = event.block.timestamp;
  proposal.last_update = event.block.timestamp;
  proposal.debt_id = event.params.debt;
  proposal.status = "EXECUTED";
  proposal.save();

  update_unlock_liquidities(proposal);

  let pool = getLatestPool();
  pool.proposalsCount = pool.proposalsCount.minus(BigInt.fromI32(1));
  pool.debtsCount = pool.debtsCount.plus(BigInt.fromI32(1));
  updateMaxProposalInterest(proposal, pool, false);
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);
}

// (!) - hight concentration edit only
export function handlePledgeAdded(event: PledgeAdded): void {
  let proposal_id = event.params.proposal.toHex();
  let debt_id = getDebtProposalId(
    event.params.borrower.toHexString(),
    proposal_id
  );
  let proposal = Debt.load(debt_id) as Debt;
  if (proposal == null) {
    log.warning("DebtProposal not found, proposalId: {}. qed", [proposal_id]);
    return;
  }
  let pledge_hash = getPledgeIdFromRaw(
    event.params.sender,
    event.params.borrower,
    event.params.proposal
  );

  // decrease balance and increase locked
  let pledger = get_user(event.params.sender.toHexString());
  let pledge = get_pledge(pledge_hash);
  pledge.pledger = event.params.sender.toHexString();
  pledge.pLocked = pledge.pLocked.plus(event.params.pAmount);
  pledge.lInitialLocked = pledge.lInitialLocked.plus(event.params.lAmount);
  pledge.unlockLiquidity = pledge.unlockLiquidity.plus(event.params.lAmount);
  pledge.pInitialLocked = pledge.pLocked;
  pledge.debt = proposal.id;
  pledge.save();

  // update pledger`s balances & locked
  pledger.pBalance = pledger.pBalance.minus(event.params.pAmount);
  pledger.pLockedSum = pledger.pLockedSum.plus(event.params.pAmount);
  pledger.unlockLiquiditySum = pledger.unlockLiquiditySum.plus(
    event.params.lAmount
  );
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  // add new supporter if he is not in a list already
  let new_supporters = proposal.supporters;
  if (
    pledge.pledger != proposal.borrower &&
    !contains(new_supporters, pledger.id)
  ) {
    new_supporters.push(pledger.id);
    proposal.supporters = new_supporters;
  }

  // same with pledge list
  let new_pledges = proposal.pledges;
  if (!contains(new_pledges, pledge.id)) {
    new_pledges.push(pledge.id);
    proposal.pledges = new_pledges;
  }

  proposal.lStaked = proposal.lStaked.plus(event.params.lAmount);
  proposal.pStaked = proposal.pStaked.plus(event.params.pAmount);
  proposal.stakeProgress = calculate_progress(proposal, event.address);
  proposal.save();
}

// (!) - hight concentration edit only
export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let debt_id = constructTwoPartId(
    event.params.borrower.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;
  let pledge_hash = getPledgeIdFromRaw(
    event.params.sender,
    event.params.borrower,
    event.params.proposal
  );

  // decrease locked and increase balance
  let pledger = get_user(event.params.sender.toHexString());
  let pledge = get_pledge(pledge_hash);
  let p_to_sub = event.params.pAmount;
  pledge.pLocked = pledge.pLocked.minus(p_to_sub);
  pledge.lInitialLocked = pledge.lInitialLocked.minus(event.params.lAmount);
  pledge.unlockLiquidity = pledge.unlockLiquidity.minus(event.params.lAmount);
  pledge.pInitialLocked = pledge.pLocked;
  pledge.save();

  pledger.pBalance = pledger.pBalance.plus(p_to_sub);
  pledger.pLockedSum = pledger.pLockedSum.minus(p_to_sub);
  pledger.unlockLiquiditySum = pledger.unlockLiquiditySum.minus(
    event.params.lAmount
  );
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  proposal.lStaked = proposal.lStaked.minus(event.params.lAmount);
  proposal.pStaked = proposal.pStaked.minus(event.params.pAmount);
  proposal.stakeProgress = calculate_progress(proposal, event.address);

  // remove pledge and supporter from this debt if there is no stake left
  if (pledge.pLocked.le(BigInt.fromI32(0))) {
    let new_pledges = proposal.pledges;
    new_pledges = filter(new_pledges, pledge_hash);
    proposal.pledges = new_pledges;

    if (pledge.pledger != proposal.borrower) {
      let new_supporters = proposal.supporters;
      new_supporters = filter(proposal.supporters, pledger.id);
      proposal.supporters = new_supporters;
    }
  }
  proposal.save();
}

// (!) - hight concentration edit only
export function handleRepay(event: Repay): void {
  let loan = LoanModule.bind(event.address);
  let loan_debt = loan.debts(event.params.sender, event.params.debt);
  // Not `loan_debt.proposal` because of graph-cli codegen bug.
  // However, as long as Debt struct on LoanModule has proposal
  // field at the first place, it`ll work
  let debt_id = constructTwoPartId(
    event.params.sender.toHex(),
    loan_debt.value0.toHex()
  );
  let debt = Debt.load(debt_id) as Debt;

  // update repayed amount
  let repayment = event.params.lFullPaymentAmount.minus(
    event.params.lInterestPaid
  );
  debt.last_update = event.params.newlastPayment;
  debt.repayed = debt.repayed.plus(repayment);

  // change status if repayed
  let isDebtRepaid = debt.repayed.ge(debt.total);
  debt.status = isDebtRepaid ? "CLOSED" : "PARTIALLY_REPAYED";
  debt.save();

  if (isDebtRepaid) {
    let pool = getLatestPool();
    pool.debtsCount = pool.debtsCount.minus(BigInt.fromI32(1));
    pool.save();
    addPoolSnapshot(event.block.timestamp, pool);
  }

  charge_repay_interest(
    debt,
    event.params.pInterestPaid,
    event.block.timestamp
  );

  update_unlock_liquidities(debt);

  let user = User.load(debt.borrower)!;
  user.credit = user.credit.minus(repayment);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);
}

// (!) - hight concentration edit only
export function handleUnlockedPledgeWithdraw(
  event: UnlockedPledgeWithdraw
): void {
  let pledge_hash = getPledgeIdFromRaw(
    event.params.sender,
    event.params.borrower,
    event.params.proposal
  );
  let pledge = get_pledge(pledge_hash);
  let pledger = get_user(event.params.sender.toHexString());
  let pUnlockedPledge = event.params.pAmount.minus(pledge.pInterest);

  // user earnings
  let pool = getLatestPool();
  let earning = init_earning(event.block.timestamp, pledger);
  earning.type = "DEBT_INTEREST";
  earning.pAmount = pledge.pInterest;
  earning.lAmount = calculateLBalanceIncreasing(
    pledger.id,
    pool.lBalance.minus(pool.lProposals),
    BigInt.fromI32(0),
    pledger.pBalance,
    pledge.pInterest
  );
  earning.save();

  pledger.pBalance = pledger.pBalance.plus(event.params.pAmount);
  pledger.pLockedSum = pledger.pLockedSum.minus(pUnlockedPledge);
  pledger.pInterestSum = pledger.pInterestSum.minus(pledge.pInterest);
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  pledge.pLocked = pledge.pLocked.minus(pUnlockedPledge);
  pledge.pInterest = BigInt.fromI32(0);
  pledge.save();
}

export function handleDebtDefaultExecuted(event: DebtDefaultExecuted): void {
  let pool = getLatestPool();
  pool.debtsCount = pool.debtsCount.minus(BigInt.fromI32(1));
  pool.save();
  addPoolSnapshot(event.block.timestamp, pool);

  let loan = LoanModule.bind(event.address);
  let loan_debt = loan.debts(event.params.borrower, event.params.debt);
  let debt_id = constructTwoPartId(
    event.params.borrower.toHex(),
    loan_debt.value0.toHex()
  );
  let debt = Debt.load(debt_id) as Debt;
  debt.status = "CLOSED";
  debt.save();

  default_pledge_interests(debt, event.params.pBurned, event.block.timestamp);

  update_unlock_liquidities(debt);

  // update user credit
  let user = get_user(event.params.borrower.toHex());
  let credit_left = debt.total.minus(debt.repayed);
  user.credit = user.credit.minus(credit_left);
  user.save();
}

export function handleDistributionCreated(event: DistributionCreated): void {
  let cash = getCommonHandlerCash();
  let distribution = getDistributionEvent(
    cash.nextDistributionEventIndex.toString()
  );

  distribution.date = event.block.timestamp;
  distribution.amount = event.params.amount;
  distribution.totalSupply = event.params.totalSupply;
  distribution.poolState = cash.lastPoolSnapshot;
  cash.nextDistributionEventIndex = cash.nextDistributionEventIndex.plus(
    BigInt.fromI32(1)
  );

  distribution.save();
  cash.save();
}

export function handleDistributionsClaimed(event: DistributionsClaimed): void {
  let user = get_user(event.params.account.toHexString());
  let pool = getLatestPool();

  let balance = user.pBalance;

  for (
    let i = event.params.fromDistribution.toI32();
    i < event.params.toDistribution.toI32();
    i++
  ) {
    let distribution = getDistributionEvent(BigInt.fromI32(i).toString());

    let pAmount = balance
      .times(distribution.amount)
      .div(distribution.totalSupply);
    balance = balance.plus(pAmount);

    distribution.claimed = distribution.claimed.plus(pAmount);

    let earning = init_earning(event.block.timestamp, user, i);
    earning.pAmount = event.params.amount;
    earning.lAmount = calculateLBalanceIncreasing(
      user.id,
      pool.lBalance.minus(pool.lProposals),
      BigInt.fromI32(0),
      user.pBalance,
      event.params.amount
    );
    earning.type = "POOL_DISTRIBUTIONS";
    earning.distributionEvent = distribution.id;

    distribution.save();
    earning.save();
  }

  user.pBalance = user.pBalance.plus(event.params.amount);
  user.lastDistributionIndex = event.params.toDistribution;
  user.save();
}

/*            HELPERS           */

export function get_user(address: string): User {
  let user = User.load(address);
  if (user == null) {
    user = new User(address);
    user.lBalance = BigInt.fromI32(0);
    user.pBalance = BigInt.fromI32(0);
    user.pLockedSum = BigInt.fromI32(0);
    user.pInterestSum = BigInt.fromI32(0);
    user.unlockLiquiditySum = BigInt.fromI32(0);
    user.pInterestSum = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
  }
  return user as User;
}
export function get_pledge(hash: string): Pledge {
  let pledge = Pledge.load(hash);
  if (pledge == null) {
    pledge = new Pledge(hash);
    pledge.lInitialLocked = BigInt.fromI32(0);
    pledge.pInitialLocked = BigInt.fromI32(0);
    pledge.pLocked = BigInt.fromI32(0);
    pledge.unlockLiquidity = BigInt.fromI32(0);
    pledge.pInterest = BigInt.fromI32(0);
  }
  return pledge as Pledge;
}

export function init_earning(
  t: BigInt,
  sender: User,
  distributionEventIndex: i32 = 0
): Earning {
  let earning = new Earning(
    constructThreePartId(
      t.toHex(),
      sender.id,
      BigInt.fromI32(distributionEventIndex).toHex()
    )
  );
  earning.pAmount = BigInt.fromI32(0);
  earning.lAmount = BigInt.fromI32(0);
  earning.user = sender.id;
  earning.date = t;

  return earning as Earning;
}
export function init_balance_change(
  t: BigInt,
  sender: User,
  lAmount: BigInt,
  type: string
): BalanceChange {
  let balance_change = new BalanceChange(
    constructTwoPartId(t.toHex(), sender.id)
  );
  balance_change.amount = lAmount;
  balance_change.user = sender.id;
  balance_change.type = type;
  balance_change.date = t;

  return balance_change as BalanceChange;
}

// update unlockLiquidity in pledges and users
export function update_unlock_liquidities(debt: Debt): void {
  let nextUnlockLiquidity =
    debt.status === "CLOSED"
      ? BigInt.fromI32(0)
      : debt.total.minus(debt.repayed);

  for (let i = 0; i < debt.pledges.length; i++) {
    let pledges = debt.pledges;
    let pledge = get_pledge(pledges[i]);
    let user = get_user(pledge.pledger);

    let prevUnlockLiquidity = pledge.unlockLiquidity;

    pledge.unlockLiquidity = nextUnlockLiquidity;
    pledge.save();

    user.unlockLiquiditySum = user.unlockLiquiditySum
      .minus(prevUnlockLiquidity)
      .plus(nextUnlockLiquidity);
    user.save();
  }
}

// update all pledges interests after repay
export function charge_repay_interest(
  debt: Debt,
  pInterest: BigInt,
  timestamp: BigInt
): void {
  for (let i = 0; i < debt.pledges.length; i++) {
    let pledges = debt.pledges;
    let pledge = get_pledge(pledges[i]);
    let user = get_user(pledge.pledger);
    if (!pledge.pledger.includes(debt.borrower)) {
      let p_pledger_interest = pInterest
        .times(pledge.lInitialLocked)
        .div(debt.lStaked);
      pledge.pInterest = pledge.pInterest.plus(p_pledger_interest);
      pledge.save();
      user.pInterestSum = user.pInterestSum.plus(p_pledger_interest);
      user.save();

      createNewUserSnapshot(user, timestamp);
    }
  }
}

// reset interest of pledgers and transfer all interests to balances
// as well as ditribute borrowers locked pTokens among the pledgers
export function default_pledge_interests(
  debt: Debt,
  pBurned: BigInt,
  timestamp: BigInt
): void {
  let borrower_pledge_hash = getPledgeId(
    debt.borrower,
    debt.borrower,
    debt.proposal_id
  );
  let borrower_pledge = get_pledge(borrower_pledge_hash);

  let credit_left = debt.total.minus(debt.repayed);

  let lBorrowerPledge = borrower_pledge.lInitialLocked;
  let pBorrowerPledge = borrower_pledge.pLocked;
  let lInitialDebtPledge = debt.lStaked;
  let pInitialDebtPledge = debt.pStaked;

  let pLockedBorrowerPledge = pBorrowerPledge
    .times(credit_left)
    .div(debt.total);
  let pUnlockedBorrowerPledge = pBorrowerPledge.minus(pLockedBorrowerPledge);

  for (let i = 0; i < debt.pledges.length; i++) {
    let pledges = debt.pledges;
    let pledge = get_pledge(pledges[i]);
    let user = get_user(pledge.pledger);

    if (pledge.pledger.includes(debt.borrower)) {
      let lInitialUserPledge = pledge.lInitialLocked;
      let pInitialUserPledge = pledge.pInitialLocked;

      let pBurnedUserPledge = pBurned
        .times(pInitialUserPledge)
        .div(pInitialDebtPledge);

      let p_to_sub = pBurnedUserPledge;
      let p_to_add = pUnlockedBorrowerPledge
        .times(lInitialUserPledge)
        .div(lInitialDebtPledge.minus(lBorrowerPledge));

      pledge.pLocked = pledge.pLocked.minus(p_to_sub).plus(p_to_add);
      user.pLockedSum = user.pLockedSum.minus(p_to_sub).plus(p_to_add);

      pledge.save();
      user.save();

      createNewUserSnapshot(user, timestamp);
    } else {
      user.pLockedSum = user.pLockedSum.minus(pledge.pLocked);
      user.save();

      createNewUserSnapshot(user, timestamp);
    }
  }

  borrower_pledge.pLocked = BigInt.fromI32(0);
  borrower_pledge.save();
}

export function lProportional(pAmount: BigInt, user: User): BigInt {
  // decrease liquidity tokens proportionally with PTK difference
  // lBalance * pAmount / pBalance
  return user.lBalance.times(pAmount).div(user.pBalance);
}

export function calculate_progress(
  proposal: Debt,
  loanProposalsModuleAddress: Address
): string {
  let loanProposalsModule = LoanProposalsModule.bind(
    loanProposalsModuleAddress
  );

  let COLLATERAL_TO_DEBT_RATIO_MULTIPLIER = loanProposalsModule.COLLATERAL_TO_DEBT_RATIO_MULTIPLIER();
  let COLLATERAL_TO_DEBT_RATIO = loanProposalsModule.COLLATERAL_TO_DEBT_RATIO();

  let progress = proposal.lStaked
    .times(PERCENT_MULTIPLIER)
    .div(
      proposal.total
        .times(COLLATERAL_TO_DEBT_RATIO)
        .div(COLLATERAL_TO_DEBT_RATIO_MULTIPLIER)
    );
  return progress.toHex();
}

// AssemblyScript types workarounds
export function contains(values: string[], s: string): boolean {
  let contains = false;

  for (let i = 0; i < values.length; i++) {
    let p = values[i];

    if (p.includes(s)) {
      contains = true;
      break;
    }
  }

  return contains;
}

// AssemblyScript types workarounds
export function filter(values: Array<string>, s: string): Array<string> {
  let new_array = new Array<string>();

  for (let i = 0; i < values.length; i++) {
    if (!values[i].includes(s)) new_array.push(values[i]);
  }

  return new_array;
}

function createNewUserSnapshot(user: User | null, timestamp: BigInt): void {
  if (user == null) {
    log.warning("User is null. qed", []);
    return;
  }
  let user_snapshot = new UserSnapshot(
    constructTwoPartId(timestamp.toHex(), user.id)
  );
  user_snapshot.date = timestamp;
  user_snapshot.user = user.id;
  user_snapshot.lBalance = user.lBalance;
  user_snapshot.pBalance = user.pBalance;
  user_snapshot.pInterestSum = user.pInterestSum;
  user_snapshot.pLockedSum = user.pLockedSum;
  user_snapshot.unlockLiquiditySum = user.unlockLiquiditySum;
  user_snapshot.credit = user.credit;
  user_snapshot.save();
}

function updateMaxProposalInterest(
  proposal: Debt,
  pool: Pool,
  needToIncrementCounter: boolean
): void {
  let interest = proposal.apr as BigInt;
  let cash = getCommonHandlerCash();

  let counts = cash.proposalInterestCounts;
  let interests = cash.proposalInterests;

  let aprIndex = -1;
  for (let i = 0; i < interests.length; i++) {
    let item = interests[i];
    if (item.toString() == proposal.apr.toString()) {
      aprIndex = i;
      break;
    }
  }

  if (aprIndex < 0) {
    aprIndex = interests.length;
    interests.push(interest);
    counts.push(0);
  }

  counts[aprIndex] = counts[aprIndex] + (needToIncrementCounter ? 1 : -1);

  let maxInterest = 0;
  for (let index = 0; index < interests.length; index++) {
    let cur = interests[index];

    if (counts[index] > 0) {
      maxInterest = Math.max(maxInterest, cur.toI32()) as i32;
    }
  }

  pool.maxProposalInterest = BigInt.fromI32(maxInterest);

  cash.proposalInterests = interests;
  cash.proposalInterestCounts = counts;
  cash.save();
}

function getDistributionEvent(id: string): DistributionEvent {
  let distribution = DistributionEvent.load(id);
  if (distribution == null) {
    distribution = new DistributionEvent(id);
    distribution.date = BigInt.fromI32(0);
    distribution.amount = BigInt.fromI32(0);
    distribution.claimed = BigInt.fromI32(0);
    distribution.totalSupply = BigInt.fromI32(0);
  }
  return distribution as DistributionEvent;
}
