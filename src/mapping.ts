import { BigInt, ByteArray, Bytes, crypto, log } from "@graphprotocol/graph-ts";
import { Status, FundsModule } from "../generated/FundsModule/FundsModule";
import { Transfer } from "../generated/PToken/PToken";
import {
  Deposit,
  Withdraw
} from "../generated/LiquidityModule/LiquidityModule";
import {
  LoanModule,
  DebtProposalCreated,
  PledgeAdded,
  PledgeWithdrawn,
  DebtProposalExecuted,
  Repay,
  UnlockedPledgeWithdraw,
  DebtDefaultExecuted
} from "../generated/LoanModule/LoanModule";
import { User, UserSnapshot, Debt, ExitBalance, Pool, Pledge } from "../generated/schema";
import {
  concat,
  latest_date,
  inverseCurveFunction,
  DAY,
  COLLATERAL_TO_DEBT_RATIO_MULTIPLIER
} from "./utils";

// (!) - hight concentration edit only
export function handleStatus(event: Status): void {
  let latest_pool = get_latest_pool();
  let pool = new Pool(event.block.timestamp.toHex());
  pool.lBalance = event.params.lBalance;
  pool.lDebt = event.params.lDebt;
  pool.pEnterPrice = event.params.pEnterPrice;
  pool.pExitPrice = event.params.pExitPrice;
  pool.usersLength = latest_pool.usersLength;
  pool.users = latest_pool.users;

  //refresh latest
  latest_pool.lBalance = pool.lBalance;
  latest_pool.lDebt = pool.lDebt;
  latest_pool.pEnterPrice = pool.pEnterPrice;
  latest_pool.pExitPrice = pool.pExitPrice;
  latest_pool.save();
  pool.save();

  // add new balance in history for all users once a day
  // TEST: will only work if timestamp returned in ms
  let today = event.block.timestamp.div(DAY);
  let exit_balance = ExitBalance.load(today.toHex());

  // once a day
  if (exit_balance == null) {
    exit_balance = new ExitBalance(today.toHex());
    exit_balance.user = latest_date.toHex();
    exit_balance.date = event.block.timestamp;
    exit_balance.lBalance = BigInt.fromI32(0);
    exit_balance.pBalance = BigInt.fromI32(0);

    let users = pool.users as Array<string>;
    for (let i = 0; i < pool.users.length; i++) {
      let user = User.load(users[i]) as User;

      // add exit_balance record
      let new_history_record = init_exit_balance(event.block.timestamp, user);
      new_history_record.pBalance = user.pBalance;
      new_history_record.lBalance = user.lBalance;
      new_history_record.date = event.block.timestamp;
      new_history_record.save();

      let new_history = user.history;
      new_history.push(new_history_record.id);
      user.history = new_history;
      user.save();

      // createNewUserSnapshot(user, event.block.timestamp); // don't need, because updated in handleTransfer
    }
  }
}

export function handleTransfer(event: Transfer): void {
  let from = get_user(event.params.from.toHexString());
  let to = get_user(event.params.to.toHexString());
  let pool = get_latest_pool();

  // update pool users if necessary
  if (!pool.users.includes(from.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(from.id);
    pool.users = new_users;
  }
  if (!pool.users.includes(to.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(to.id);
    pool.users = new_users;
  }
  pool.save();

  // add exit_balance from
  let from_exit_balance = get_exit_balance(event.block.timestamp, from);
  from_exit_balance.pBalance = from.pBalance.minus(event.params.value);
  let from_exit_lBalanceCalculated = calculate_lBalance(from_exit_balance.pBalance);
  from_exit_balance.lBalance = from_exit_lBalanceCalculated;
  from_exit_balance.date = event.block.timestamp;
  from_exit_balance.save();

  // add exit_balance to
  let to_exit_balance = get_exit_balance(event.block.timestamp, to);
  to_exit_balance.pBalance = to.pBalance.plus(event.params.value);
  let to_exit_lBalanceCalculated = calculate_lBalance(to_exit_balance.pBalance);
  to_exit_balance.lBalance = to_exit_balance.lBalance.plus(to_exit_lBalanceCalculated);
  to_exit_balance.date = event.block.timestamp;
  to_exit_balance.save();

  // update actual Users pBalances
  from.pBalance = from_exit_balance.pBalance;
  to.pBalance = to_exit_balance.pBalance;
  from.save();
  to.save();

  createNewUserSnapshot(from, event.block.timestamp);
  createNewUserSnapshot(to, event.block.timestamp);
}

export function handleDeposit(event: Deposit): void {
  let user = get_user(event.params.sender.toHexString());
  let pool = get_latest_pool();
  if (!pool.users.includes(user.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(user.id);
    pool.users = new_users;
  }

  // update user balance
  user.pBalance = user.pBalance.plus(event.params.pAmount);
  user.lBalance = user.lBalance.plus(event.params.lAmount);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);

  // update pool balance
  pool.lBalance = event.params.lAmount;
  pool.save();
}

export function handleWithdraw(event: Withdraw): void {
  let pool = get_latest_pool();
  let user = get_user(event.params.sender.toHexString());
  user.lBalance = user.lBalance.minus(
    lProportional(event.params.pAmount, user)
  );
  user.pBalance = user.pBalance.minus(event.params.pAmount);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);

  // update pool balance
  pool.lBalance = pool.lBalance.minus(event.params.lAmountTotal);
  pool.save();
}

export function handleDebtProposalCreated(event: DebtProposalCreated): void {
    let debt_id = debtProposalId(
      event.params.sender.toHexString(),
      event.params.proposal.toHex()
  );

  let proposal = new Debt(debt_id);
  proposal.proposal_id = event.params.proposal.toHex();
  proposal.borrower = event.params.sender.toHexString();
  proposal.description = event.params.descriptionHash;
  proposal.total = event.params.lAmount;
  proposal.apr = event.params.interest;
  proposal.repayed = BigInt.fromI32(0);
  proposal.staked = BigInt.fromI32(0);
  proposal.stakeProgress = "0";
  proposal.pledgers = [];
  proposal.pledges = [];
  proposal.status = "PROPOSED";
  proposal.save();
}


export function handleDebtProposalExecuted(event: DebtProposalExecuted): void {
  let pool = get_latest_pool();
  let debt_id = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;

  // update current user credit
  let user = User.load(proposal.borrower);
  user.credit = user.credit.plus(proposal.total);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);

  // update debt proposal
  proposal.start_date = event.block.timestamp;
  proposal.last_update = event.block.timestamp;
  proposal.debt_id = event.params.debt;
  proposal.status = "EXECUTED";
  proposal.save();

  // update pool
  pool.lBalance = pool.lBalance.minus(proposal.total);
  pool.lDebt = pool.lDebt.plus(proposal.total);
  pool.save();
}

// (!) - hight concentration edit only
export function handlePledgeAdded(event: PledgeAdded): void {
  let proposal_id = event.params.proposal.toHex();
  let debt_id = debtProposalId(
    event.params.borrower.toHexString(),
    proposal_id
  );
  let proposal = Debt.load(debt_id) as Debt;
  if (proposal == null) {
    log.warning("DebtProposal not found, proposalId: {}. qed", [proposal_id]);
    return;
  }
  let pledge_hash = construct_two_part_id(
    event.params.sender.toHexString(),
    event.params.borrower.toHexString().slice(2).concat(event.params.proposal.toHex().slice(2))
  );

  // decrease balance and increase locked
  let pledger = get_user(event.params.sender.toHexString());
  let pledge = get_pledge(pledge_hash);
  let l_to_add = lProportional(event.params.pAmount, pledger);
  pledge.pledger = event.params.sender.toHexString();
  pledge.lLocked = pledge.lLocked.plus(l_to_add);
  pledge.pLocked = pledge.pLocked.plus(event.params.pAmount);
  pledge.lInitialLocked = pledge.lLocked;
  pledge.pInitialLocked = pledge.pLocked;
  pledge.proposal_id = proposal.id;
  pledge.save();

  // update pledger`s balances & locked
  pledger.lLockedSum = pledger.lLockedSum.plus(l_to_add);
  pledger.pLockedSum = pledger.pLockedSum.plus(pledge.pLocked);
  pledger.lBalance = pledger.lBalance.minus(l_to_add);
  pledger.pBalance = pledger.pBalance.minus(event.params.pAmount);
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  var new_pledgers = proposal.pledgers;
  var new_pledges = proposal.pledges;
  // add new pledger if he is not in a list already
  if (!contains_pledger(new_pledgers, pledger.id)) {
    new_pledgers.push(pledger.id);
    proposal.pledgers = new_pledgers;
  }

  // same with pledge list
  if (!contains_pledge(new_pledges, pledge.id)) {
    new_pledges.push(pledge.id);
    proposal.pledges = new_pledges;
  }

  proposal.staked = proposal.staked.plus(l_to_add);
  proposal.stakeProgress = calculate_progress(proposal);
  proposal.save();
}

// (!) - hight concentration edit only
export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let debt_id = construct_two_part_id(
    event.params.borrower.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;
  let pledge_hash = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.borrower.toHex().concat(event.params.proposal.toHex())
  );

  // decrease locked and increase balance
  let pledger = get_user(event.params.sender.toHexString());
  let pledge = get_pledge(pledge_hash);
  let p_to_sub = event.params.pAmount;
  let l_to_sub = lProportional_out(event.params.pAmount, pledge);
  pledge.pledger = event.params.sender.toHexString();
  pledge.lLocked = pledge.lLocked.minus(l_to_sub);
  pledge.pLocked = pledge.pLocked.minus(p_to_sub);
  pledge.proposal_id = proposal.id;
  pledge.save();

  pledger.lLockedSum = pledger.lLockedSum.minus(l_to_sub);
  pledger.pLockedSum = pledger.pLockedSum.minus(p_to_sub);
  pledger.lBalance = pledger.lBalance.plus(l_to_sub);
  pledger.pBalance = pledger.pBalance.plus(p_to_sub);
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  proposal.staked = proposal.staked.minus(l_to_sub);
  proposal.stakeProgress = calculate_progress(proposal);

  // remove pledge and pledger from this debt if there is no stake left
  if (pledge.pLocked.le(BigInt.fromI32(0))) {
    let new_pledgers = proposal.pledgers;
    let new_pledges = proposal.pledges;
    new_pledges = filter_pledges(new_pledges, pledge_hash);
    new_pledgers = filter_pledgers(proposal.pledgers, pledger.id);
    proposal.pledgers = new_pledgers;
    proposal.pledges = new_pledges;
  }
  proposal.save();
}

// (!) - hight concentration edit only
export function handleRepay(event: Repay): void {
  let pool = get_latest_pool();
  let loan = LoanModule.bind(event.address);
  let loan_debt = loan.debts(event.params.sender, event.params.debt);
  // Not `loan_debt.proposal` because of graph-cli codegen bug.
  // However, as long as Debt struct on LoanModule has proposal
  // field at the first place, it`ll work
  let debt_id = construct_two_part_id(
    event.params.sender.toHex(),
    loan_debt.value0.toHex()
  );
  let debt = Debt.load(debt_id) as Debt;

  // update repayed amount
  let repayment = event.params.lFullPaymentAmount.minus(
    event.params.lInterestPaid
  );
  debt.last_update = event.block.timestamp;
  debt.repayed = debt.repayed.plus(repayment);

  // change status if repayed
  let isDebtRepayed = debt.repayed.ge(debt.total);
  debt.status = isDebtRepayed ? "CLOSED" : "PARTIALLY_REPAYED";
  debt.save();

  charge_repay_interest(
    debt,
    event.params.lInterestPaid,
    event.params.pInterestPaid
  );

  let user = User.load(debt.borrower);
  user.credit = user.credit.minus(repayment);
  user.save();

  createNewUserSnapshot(user, event.block.timestamp);

  // update pool
  pool.lBalance = pool.lBalance.plus(event.params.lFullPaymentAmount);
  pool.lDebt = pool.lDebt.minus(event.params.lFullPaymentAmount);
  pool.save();
}

// (!) - hight concentration edit only
export function handleUnlockedPledgeWithdraw(
  event: UnlockedPledgeWithdraw
): void {
  let pledge_hash = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.borrower.toHex().concat(event.params.proposal.toHex())
  );
  let pledge = get_pledge(pledge_hash);
  let pledger = get_user(event.params.sender.toHexString());
  let pUnlockedPledge = event.params.pAmount.minus(pledge.pInterest);

  let l_to_unlock = pledge.lLocked.times(pUnlockedPledge).div(pledge.pLocked);

  pledger.pBalance = pledger.pBalance
    .plus(pUnlockedPledge)
    .plus(pledge.pInterest);
  pledger.lBalance = pledger.lBalance.plus(l_to_unlock.plus(pledge.lInterest));
  pledger.lLockedSum = pledger.lLockedSum.minus(l_to_unlock);
  pledger.pLockedSum = pledger.pLockedSum.minus(pUnlockedPledge);
  pledger.save();

  createNewUserSnapshot(pledger, event.block.timestamp);

  pledge.lLocked = pledge.lLocked.minus(l_to_unlock);
  pledge.pLocked = pledge.pLocked.minus(pUnlockedPledge);
  pledge.lInterest = BigInt.fromI32(0);
  pledge.pInterest = BigInt.fromI32(0);
  pledge.withdrawn = pledge.withdrawn.plus(event.params.pAmount);
  pledge.save();

  //remove user from pledgers on a debt if he withdtraw his part entirely
  if (pledge.withdrawn == pledge.pLocked) {
    let debt_id = construct_two_part_id(
      event.params.borrower.toHex(),
      event.params.proposal.toHex()
    );
    let debt = Debt.load(debt_id) as Debt;
    debt.pledgers = filter_pledgers(debt.pledgers, pledger.id);
    debt.pledges = filter_pledges(debt.pledges, pledge.id);
    debt.save();
  }
}

export function handleDebtDefaultExecuted(event: DebtDefaultExecuted): void {
  let pool = get_latest_pool();
  let loan = LoanModule.bind(event.address);
  let loan_debt = loan.debts(event.params.borrower, event.params.debt);
  let debt_id = construct_two_part_id(
    event.params.borrower.toHex(),
    loan_debt.value0.toHex()
  );
  let debt = Debt.load(debt_id) as Debt;
  let credit_left = debt.total.minus(debt.repayed);

  default_pledge_interests(debt, event.params.pBurned);

  // update pool
  pool.lDebt = pool.lDebt.minus(credit_left);
  pool.save();
}

export function get_user(address: String): User {
  let user = User.load(address);
  if (user == null) {
    user = new User(address);
    user.lBalance = BigInt.fromI32(0);
    user.pBalance = BigInt.fromI32(0);
    user.lLockedSum = BigInt.fromI32(0);
    user.pLockedSum = BigInt.fromI32(0);
    user.lInterestSum = BigInt.fromI32(0);
    user.pInterestSum = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
    user.history = [];
  }
  return user as User;
}
export function get_pledge(hash: String): Pledge {
  let pledge = Pledge.load(hash);
  if (pledge == null) {
    pledge = new Pledge(hash);
    pledge.lInitialLocked = BigInt.fromI32(0);
    pledge.pInitialLocked = BigInt.fromI32(0);
    pledge.lLocked = BigInt.fromI32(0);
    pledge.pLocked = BigInt.fromI32(0);
    pledge.lInterest = BigInt.fromI32(0);
    pledge.pInterest = BigInt.fromI32(0);
    pledge.proposal_id = "";
    pledge.withdrawn = BigInt.fromI32(0);
  }
  return pledge as Pledge;
}

export function get_exit_balance(t: BigInt, sender: User): ExitBalance {
  let exit_balance = ExitBalance.load(construct_two_part_id(t.toHex(), sender.id));
  if (exit_balance == null) {
    exit_balance = init_exit_balance(t, sender);
  }
  return exit_balance as ExitBalance;
}

export function init_exit_balance(t: BigInt, sender: User): ExitBalance {
  let exit_balance = new ExitBalance(construct_two_part_id(t.toHex(), sender.id));
  exit_balance.pBalance = BigInt.fromI32(0);
  exit_balance.lBalance = BigInt.fromI32(0);
  exit_balance.user = sender.id;
  exit_balance.date = t;

  return exit_balance as ExitBalance;
}

export function get_latest_pool(): Pool {
  let latest_pool = Pool.load(latest_date.toHex());
  if (latest_pool == null) {
    latest_pool = new Pool(latest_date.toHex());
    latest_pool.lBalance = BigInt.fromI32(0);
    latest_pool.lDebt = BigInt.fromI32(0);
    latest_pool.pEnterPrice = BigInt.fromI32(0);
    latest_pool.pExitPrice = BigInt.fromI32(0);
    latest_pool.usersLength = BigInt.fromI32(0);
    latest_pool.users = [];
  }
  return latest_pool as Pool;
}

export function calculate_lBalance(pAmount: BigInt): BigInt {
  // get current liquid from current PTK (contract)
  // TODO: deal with graph node timeouts
  // let Funds_mod = FundsModule.bind(address);
  // let result = Funds_mod.calculatePoolExitInverse(pAmount);

  //use local substitute for now
  let result = inverseCurveFunction(pAmount);
  return result;
}

// update all pledges interests after repay
export function charge_repay_interest(
  debt: Debt,
  lInterest: BigInt,
  pInterest: BigInt
): void {
  for (let i = 0; i < debt.pledges.length; i++) {
    let pledges = debt.pledges;
    let pledge = get_pledge(pledges[i]);
    let user = get_user(pledge.pledger);
    if (pledge.pledger !== debt.borrower) {
      let pledger_rate = pledge.lLocked.div(debt.total);
      pledge.pInterest = pledge.pInterest.plus(pInterest.times(pledger_rate));
      pledge.lInterest = pledge.lInterest.plus(lInterest.times(pledger_rate));
      pledge.save();
      user.lInterestSum = user.lInterestSum.plus(lInterest.times(pledger_rate));
      user.pInterestSum = user.pInterestSum.plus(pInterest.times(pledger_rate));
      user.save();
    }
  }
}

// reset interest of pledgers and transfer all interests to balances
// as well as ditribute borrowers locked pTokens among the pledgers
export function default_pledge_interests(debt: Debt, pBurned: BigInt): void {
  for (let i = 0; i < debt.pledges.length; i++) {
    let pledges = debt.pledges;
    let pledge = get_pledge(pledges[i]);
    let user = get_user(pledge.pledger);
    if (pledge.pledger !== debt.borrower) {
      let borrower_pledge = get_borrower_pledge(debt);
      let lBorrowerPledge = borrower_pledge.lLocked;
      let pBorrowerPledge = borrower_pledge.pLocked;
      let lInitialDebtPledge = get_total_lInitialLocked(debt.pledges);
      let pInitialDebtPledge = get_total_pInitialLocked(debt.pledges);
      let lInitialUserPledge = pledge.lInitialLocked;
      let pInitialUserPledge = pledge.pInitialLocked;

      let pBurnedUserPledge = pBurned
        .times(pInitialUserPledge)
        .div(pInitialDebtPledge);
      let lUnlockedBorrowerPledge = lBorrowerPledge
        .times(pInitialDebtPledge.minus(pBurned))
        .div(pInitialDebtPledge);

      let pUnlockedBorrowerPledge = pBorrowerPledge
        .times(pInitialDebtPledge.minus(pBurned))
        .div(pInitialDebtPledge);

      let l_to_sub = pledge.lLocked
        .times(pBurnedUserPledge)
        .div(pledge.pLocked);
      let l_to_add = lUnlockedBorrowerPledge.times(
        lInitialUserPledge.div(lInitialDebtPledge.minus(lBorrowerPledge))
      );
      let p_to_sub = pBurnedUserPledge.plus(
        pUnlockedBorrowerPledge
          .times(lInitialUserPledge)
          .div(lInitialDebtPledge.minus(lBorrowerPledge))
      );
      pledge.lLocked = pledge.lLocked.minus(l_to_sub).plus(l_to_add);
      pledge.pLocked = pledge.pLocked.minus(p_to_sub);

      user.lLockedSum = user.lLockedSum.minus(l_to_sub).plus(l_to_add);
      user.pLockedSum = user.pLockedSum.minus(p_to_sub);

      pledge.save();
      user.save();
    } else {
      user.lInterestSum = user.lInterestSum.minus(pledge.lInterest);
      user.pInterestSum = user.pInterestSum.minus(pledge.pInterest);
      pledge.pInterest = BigInt.fromI32(0);
      pledge.lInterest = BigInt.fromI32(0);
      pledge.save();
      user.save();
    }
  }
}

export function lProportional(pAmount: BigInt, user: User): BigInt {
  // decrease liquidity tokens proportionally with PTK difference
  // lBalance * pAmount / pBalance
  return user.lBalance.times(pAmount).div(user.pBalance);
}
export function lProportional_out(pAmount: BigInt, pledge: Pledge): BigInt {
  // decrease liquidity tokens proportionally with PTK difference
  // lBalance * pAmount / pBalance
  return pledge.lLocked.times(pAmount).div(pledge.pLocked);
}

export function get_borrower_pledge(proposal: Debt): Pledge {
  let pledge_hash = construct_two_part_id(
    proposal.borrower,
    proposal.borrower.concat(proposal.id)
  );
  return get_pledge(pledge_hash);
}

export function calculate_progress(proposal: Debt): string {
  let progress = proposal.staked
    .times(COLLATERAL_TO_DEBT_RATIO_MULTIPLIER)
    .div(proposal.total);
  return progress.toHex();
}

export function construct_three_part_id(
  s: string,
  b: string,
  d: string
): string {
  return crypto
    .keccak256(
      concat(
        concat(
          ByteArray.fromHexString(normalizeLength(s)),
          ByteArray.fromHexString(normalizeLength(b))
        ),
        ByteArray.fromHexString(normalizeLength(d))
      )
    )
    .toHexString();
}

export function construct_two_part_id(s: string, p: string): string {
  p = normalizeLength(p);
  s = normalizeLength(s);
  return crypto
    .keccak256(concat(ByteArray.fromHexString(s), ByteArray.fromHexString(p)))
    .toHexString();
}

// function reducer(acc: BigInt, value: string, i: number, a: string[]): BigInt {
//   let n = value as i32;
//   return acc.plus(BigInt.fromI32(n));
// }
// return d.pledges.reduce(reducer, BigInt.fromI32(0));

export function get_total_lInitialLocked(pledges: string[]): BigInt {
  let sum = BigInt.fromI32(0);
  for (let i = 0; i < pledges.length; i++) {
    let pledge = get_pledge(pledges[i]);
    let value = pledge.lInitialLocked;
    sum.plus(value);
  }

  return sum;
}

export function get_total_pInitialLocked(pledges: string[]): BigInt {
  let sum = BigInt.fromI32(0);
  for (let i = 0; i < pledges.length; i++) {
    let pledge = get_pledge(pledges[i]);
    let value = pledge.pInitialLocked;
    sum.plus(value);
  }

  return sum;
}

// AssemblyScript types workarounds
export function contains_pledger(pledgers: Array<string>, s: string): boolean {
  return pledgers.some(p => p === s);
}
// AssemblyScript types workarounds
export function contains_pledge(pledges: Array<string>, s: string): boolean {
  return pledges.some(p => p === s);
}
// AssemblyScript types workarounds
export function filter_pledges(p: Array<string>, s: string): Array<string> {
  return p.filter(pledge => !pledge.includes(s));
}
// AssemblyScript types workarounds
export function filter_pledgers(p: Array<string>, s: string): Array<string> {
  return p.filter(address => address !== s);
}

function normalizeLength(str: string): string {
  let s = str.slice(2);
  if (s.length % 2 == 1) {
    return "0".concat(s);
  }
  return s;
}

function debtProposalId(address: String, proposalId: String): String {
  return construct_two_part_id(address, proposalId)
}

function createNewUserSnapshot(user: User | null, timestamp: BigInt): void {
  if (user == null) {
    log.warning("User is null. qed", []);
    return;
  }
  let user_snapshot = new UserSnapshot(construct_two_part_id(timestamp.toHex(), user.id));
  user_snapshot.date = timestamp;
  user_snapshot.user = user.id;
  user_snapshot.lBalance = user.lBalance;
  user_snapshot.pBalance = user.pBalance;
  user_snapshot.lLockedSum = user.lLockedSum;
  user_snapshot.pLockedSum = user.pLockedSum;
  user_snapshot.lInterestSum = user.lInterestSum;
  user_snapshot.pInterestSum = user.pInterestSum;
  user_snapshot.credit = user.credit;
  user_snapshot.save();
}
