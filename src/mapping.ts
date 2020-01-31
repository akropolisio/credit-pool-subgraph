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
import { User, Debt, Balance, Pool, Pledge } from "../generated/schema";
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
  let balance = Balance.load(today.toHex());

  // once a day
  if (balance == null) {
    balance = new Balance(today.toHex());
    balance.user = latest_date.toHex();
    balance.date = event.block.timestamp;
    balance.lBalance = BigInt.fromI32(0);
    balance.pBalance = BigInt.fromI32(0);

    let users = pool.users as Array<string>;
    for (let i = 0; i < pool.users.length; i++) {
      let user = User.load(users[i]) as User;

      // add balance record
      let new_history_record = init_balance(event.block.timestamp, user);
      new_history_record.pBalance = user.pBalance;
      new_history_record.lBalance = user.lBalance;
      new_history_record.date = event.block.timestamp;
      new_history_record.save();

      let new_history = user.history;
      new_history.push(new_history_record.id);
      user.history = new_history;
      user.save();
    }
  }
}

export function handleTransfer(event: Transfer): void {
  let from = get_user(event.params.from);
  let to = get_user(event.params.to);
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

  // add balance from
  let from_balance = get_balance(event.block.timestamp, from);
  from_balance.pBalance = from.pBalance.minus(event.params.value);
  let from_lBalanceCalculated = calculate_lBalance(from_balance.pBalance);
  from_balance.lBalance = from_lBalanceCalculated;
  from_balance.date = event.block.timestamp;
  from_balance.save();

  // add balance to
  let to_balance = get_balance(event.block.timestamp, to);
  to_balance.pBalance = to.pBalance.plus(event.params.value);
  let to_lBalanceCalculated = calculate_lBalance(to_balance.pBalance);
  to_balance.lBalance = to_balance.lBalance.plus(to_lBalanceCalculated);
  to_balance.date = event.block.timestamp;
  to_balance.save();
  pool.save();

  // update actual pBalances
  from.pBalance = from_balance.pBalance;
  to.pBalance = to_balance.pBalance;
  from.save();
  to.save();
}

export function handleDeposit(event: Deposit): void {
  let user = get_user(event.params.sender);
  let pool = get_latest_pool();
  if (!pool.users.includes(user.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(user.id);
    pool.users = new_users;
  }

  // add balance
  let balance = get_balance(event.block.timestamp, user);
  balance.pBalance = user.pBalance.plus(event.params.pAmount);
  let calculated = calculate_lBalance(balance.pBalance);
  balance.lBalance = balance.lBalance.plus(calculated);
  balance.date = event.block.timestamp;
  balance.save();

  // update user balance
  user.pBalance = user.pBalance.plus(event.params.pAmount);
  user.lBalance = user.lBalance.plus(event.params.lAmount);
  user.save();

  // update pool balance
  pool.lBalance = event.params.lAmount;
  pool.save();
}

export function handleWithdraw(event: Withdraw): void {
  let pool = get_latest_pool();
  let user = get_user(event.params.sender);
  user.lBalance = user.lBalance.minus(
    lProportional(event.params.pAmount, user)
  );
  user.pBalance = user.pBalance.minus(event.params.pAmount);
  user.save();

  // add balance
  let balance = get_balance(event.block.timestamp, user);
  balance.pBalance = user.pBalance;
  balance.lBalance = user.lBalance;
  balance.date = event.block.timestamp;
  balance.save();

  // update pool balance
  pool.lBalance = pool.lBalance.minus(event.params.lAmountTotal);
  pool.save();
}

export function handleDebtProposalCreated(event: DebtProposalCreated): void {
  let debt_id = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = new Debt(debt_id);
  proposal.proposal_id = event.params.proposal;
  proposal.borrower = event.params.sender;
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
  let user = User.load(proposal.borrower.toHex());
  user.credit = user.credit.plus(proposal.total);
  user.save();

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
  let debt_id = construct_two_part_id(
    event.params.borrower.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;
  let hash = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );

  // decrease balance and increase locked
  let pledger = get_user(event.params.sender);
  let pledge = get_pledge(hash);
  let l_to_add = lProportional(event.params.pAmount, pledger);
  pledge.pledger = event.params.sender;
  pledge.lLocked = pledge.lLocked.plus(l_to_add);
  pledge.pLocked = pledge.pLocked.plus(event.params.pAmount);
  pledge.proposal_id = proposal.id;
  pledge.save();

  // update pledger`s balances & locked
  pledger.lLockedSum = pledger.lLockedSum.plus(l_to_add);
  pledger.pLockedSum = pledger.pLockedSum.plus(pledge.pLocked);
  pledger.lBalance = pledger.lBalance.minus(l_to_add);
  pledger.pBalance = pledger.pBalance.minus(event.params.pAmount);
  pledger.save();

  let new_pledgers = proposal.pledgers;
  let new_pledges = proposal.pledges;
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
  let hash = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );

  // decrease locked and increase balance
  let pledger = get_user(event.params.sender);
  let pledge = get_pledge(hash);
  let p_to_sub = event.params.pAmount;
  let l_to_sub = lProportional(event.params.pAmount, pledger);
  pledge.pledger = event.params.sender;
  pledge.lLocked = pledge.lLocked.minus(l_to_sub);
  pledge.pLocked = pledge.pLocked.minus(p_to_sub);
  pledge.proposal_id = proposal.id;
  pledge.save();

  pledger.lLockedSum = pledger.lLockedSum.minus(l_to_sub);
  pledger.pLockedSum = pledger.pLockedSum.minus(p_to_sub);
  pledger.lBalance = pledger.lBalance.plus(l_to_sub);
  pledger.pBalance = pledger.pBalance.plus(p_to_sub);
  pledger.save();

  proposal.staked = proposal.staked.minus(l_to_sub);
  proposal.stakeProgress = calculate_progress(proposal);

  // remove pledge and pledger from this debt if there is no stake left
  if (pledge.pLocked.le(BigInt.fromI32(0))) {
    let new_pledgers = proposal.pledgers;
    let new_pledges = proposal.pledges;
    new_pledges = filter_pledges(new_pledges, hash);
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

  // update all pledges interests
  update_pledges(debt, event.params.lInterestPaid, event.params.pInterestPaid);

  let user = User.load(debt.borrower.toHex());
  user.credit = user.credit.minus(repayment);
  user.save();

  // update pool
  pool.lBalance = pool.lBalance.plus(event.params.lFullPaymentAmount);
  pool.lDebt = pool.lDebt.minus(event.params.lFullPaymentAmount);
  pool.save();
}

// (!) - hight concentration edit only
export function handleUnlockedPledgeWithdraw(
  event: UnlockedPledgeWithdraw
): void {
  let hash = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let pledge = get_pledge(hash);
  let pledger = get_user(event.params.sender);
  let pWithdrawnInterest = pledge.pInterest;
  let pUnlockedPledge = event.params.pAmount.minus(pledge.pInterest);

  let l_to_unlock = pledge.lLocked
    .times(pUnlockedPledge)
    .div(pledge.pLocked)
    .plus(pledge.lInterest);

  // TODO: not sure its right...
  // in fact the whole mapping is confusing as hell
  pledger.lLockedSum = pledger.lLockedSum.minus(l_to_unlock);
  pledger.pLockedSum = pledger.pLockedSum.minus(event.params.pAmount);

  pledger.pBalance = pledger.pBalance.plus(event.params.pAmount);
  pledger.lBalance = pledger.lBalance.plus(l_to_unlock);
  pledger.save();

  pledge.lLocked = pledge.lLocked.minus(
    pledge.lLocked.times(pUnlockedPledge.div(pledge.pLocked))
  );
  pledge.pLocked = pledge.pLocked.minus(pUnlockedPledge);
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

  // update pool
  pool.lDebt = pool.lDebt.minus(credit_left);
  pool.save();
}

export function get_user(address: Bytes): User {
  let user = User.load(address.toHex());
  if (user == null) {
    user = new User(address.toHex());
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
export function get_pledge(hash: string): Pledge {
  let pledge = Pledge.load(hash);
  if (pledge == null) {
    pledge = new Pledge(hash);
    pledge.lLocked = BigInt.fromI32(0);
    pledge.pLocked = BigInt.fromI32(0);
    pledge.lInterest = BigInt.fromI32(0);
    pledge.pInterest = BigInt.fromI32(0);
    pledge.proposal_id = "";
    pledge.withdrawn = BigInt.fromI32(0);
  }
  return pledge as Pledge;
}

export function get_balance(t: BigInt, sender: User): Balance {
  let balance = Balance.load(construct_two_part_id(t.toHex(), sender.id));
  if (balance == null) {
    balance = init_balance(t, sender);
  }
  return balance as Balance;
}

export function init_balance(t: BigInt, sender: User): Balance {
  let balance = new Balance(construct_two_part_id(t.toHex(), sender.id));
  balance.pBalance = BigInt.fromI32(0);
  balance.lBalance = BigInt.fromI32(0);
  balance.user = sender.id;
  balance.date = t;

  return balance as Balance;
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

export function update_pledges(
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

export function lProportional(pAmount: BigInt, user: User): BigInt {
  // decrease liquidity tokens proportionally with PTK difference
  // lBalance = lBalance * (pAmount/pBalance)
  return user.lBalance.times(pAmount.div(user.pBalance));
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
