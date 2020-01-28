import { BigInt, ByteArray, Bytes, crypto, log } from "@graphprotocol/graph-ts";
import { Status, FundsModule } from "../generated/FundsModule/FundsModule";
import { Transfer } from "../generated/PToken/PToken";
import { Deposit } from "../generated/LiquidityModule/LiquidityModule";
import {
  LoanModule,
  DebtProposalCreated,
  PledgeAdded,
  PledgeWithdrawn,
  DebtProposalExecuted,
  Repay,
  UnlockedPledgeWithdraw
} from "../generated/LoanModule/LoanModule";
import { User, Debt, Balance, Pool, Pledge } from "../generated/schema";
import { concat, latest_date, inverseCurveFunction, DAY } from "./utils";

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
      let user_lBalance = calculate_lBalance(user.pBalance);

      // add balance record
      let new_history_record = init_balance(event.block.timestamp, user);
      new_history_record.pBalance = user.pBalance;
      new_history_record.lBalance = user_lBalance;
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
  if (!pool.users.includes(from.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(from.id);
    pool.users = new_users;

    // add balance
    let balance = get_balance(event.block.timestamp, from);
    balance.pBalance = from.pBalance.minus(event.params.value);
    let lBalanceCalculated = calculate_lBalance(balance.pBalance);
    balance.lBalance = lBalanceCalculated;
    balance.date = event.block.timestamp;
    balance.save();
    pool.save();
  }

  if (!pool.users.includes(to.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    let new_users = pool.users;
    new_users.push(to.id);
    pool.users = new_users;

    // add balance
    let balance = get_balance(event.block.timestamp, to);
    balance.pBalance = to.pBalance.plus(event.params.value);
    let lBalanceCalculated = calculate_lBalance(balance.pBalance);
    balance.lBalance = balance.lBalance.plus(lBalanceCalculated);
    balance.date = event.block.timestamp;
    balance.save();
    pool.save();
  }
  from.pBalance = from.pBalance.minus(event.params.value);
  to.pBalance = to.pBalance.plus(event.params.value);
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

    // add balance
    let balance = get_balance(event.block.timestamp, user);
    balance.pBalance = user.pBalance.plus(event.params.pAmount);
    let calculated = calculate_lBalance(balance.pBalance);

    balance.lBalance = balance.lBalance.plus(calculated);
    balance.date = event.block.timestamp;
    balance.save();

    pool.save();
  }
}

export function handleDebtProposalCreated(event: DebtProposalCreated): void {
  let debt_id = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = new Debt(debt_id);
  proposal.proposal_id = event.params.proposal;
  proposal.borrower = event.params.sender;
  proposal.total = event.params.lAmount;
  proposal.apr = event.params.interest;
  proposal.repayed = BigInt.fromI32(0);
  proposal.staked = BigInt.fromI32(0);
  proposal.pledgers = [];
  proposal.pledges = [];
  proposal.status = "PROPOSED";
  proposal.save();
}

export function handleDebtProposalExecuted(event: DebtProposalExecuted): void {
  let debt_id = construct_two_part_id(
    event.params.sender.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id);
  let user = User.load(proposal.borrower.toHex());
  proposal.start_date = event.block.timestamp;
  user.credit = user.credit.plus(proposal.total);
  user.save();

  proposal.last_update = event.block.timestamp;
  proposal.debt_id = event.params.debt;
  proposal.status = "EXECUTED";
  proposal.save();
}

export function handlePledgeAdded(event: PledgeAdded): void {
  let debt_id = construct_two_part_id(
    event.params.borrower.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id);
  let hash = construct_three_part_id(
    event.params.sender.toHex(),
    event.params.borrower.toHex(),
    event.params.pAmount.toHex()
  );

  let pledge = new Pledge(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.proposal_id = proposal.id;
  pledge.withdrawn = BigInt.fromI32(0);
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.plus(event.params.pAmount);
  pledger.save();

  proposal.staked = proposal.staked.plus(pledge.lAmount);
  let new_pledgers = proposal.pledgers;
  let new_pledges = proposal.pledges;
  new_pledgers.push(pledge.pledger.toHex());
  new_pledges.push(pledge.id);
  proposal.pledgers = new_pledgers;
  proposal.pledges = new_pledges;

  proposal.save();
}

export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let debt_id = construct_two_part_id(
    event.params.borrower.toHex(),
    event.params.proposal.toHex()
  );
  let proposal = Debt.load(debt_id) as Debt;
  let hashed = construct_three_part_id(
    event.params.sender.toHex(),
    event.params.borrower.toHex(),
    event.params.pAmount.toHex()
  );

  let new_arr = filter_pledges(proposal.pledges, hashed);

  let pledge = Pledge.load(hashed) as Pledge;
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.minus(event.params.pAmount);

  proposal.staked = proposal.staked.minus(pledge.lAmount);
  proposal.pledges = new_arr;
  proposal.save();
}

export function handleRepay(event: Repay): void {
  let loan = LoanModule.bind(event.address);
  let loan_debt = loan.debts(event.params.sender, event.params.debt);
  // Not `loan_debt.proposal` because of graph-cli codegen bug.
  // However, as long as Debt struct on LoanModule has proposal
  // field at the first place, it`ll work
  let debt_id = construct_two_part_id(event.params.sender.toHex(), loan_debt.value0.toHex());
  let debt = Debt.load(debt_id);

  let repayment = event.params.lFullPaymentAmount.minus(event.params.lInterestPaid);
  let isDebtRepayed = repayment.ge(debt.total);
  debt.repayed = debt.repayed.plus(repayment);
  debt.last_update = event.block.timestamp;
  debt.status = isDebtRepayed ? "CLOSED" : "PARTIALLY_REPAYED";
  debt.save();

  let user = User.load(debt.borrower.toHex());
  user.credit = user.credit.minus(repayment);
  user.save();
}

export function handleUnlockedPledgeWithdraw(event: UnlockedPledgeWithdraw): void {
  let pledger = get_user(event.params.sender);
  pledger.locked = pledger.locked.minus(event.params.pAmount);
  pledger.pBalance = pledger.pBalance.plus(event.params.pAmount);
  pledger.save();

  let hashed = construct_three_part_id(
    event.params.sender.toHex(),
    event.params.borrower.toHex(),
    event.params.pAmount.toHex()
  );

  let pledge = Pledge.load(hashed) as Pledge;
  pledge.withdrawn = pledge.withdrawn.plus(event.params.pAmount);
  pledge.save();

  //remove user from pledgers on a debt if he withdtraw his part entirely
  if (pledge.withdrawn == pledge.pAmount) {
    let debt_id = construct_two_part_id(
      event.params.sender.toHex(),
      event.params.proposal.toHex()
    );
    let debt = Debt.load(debt_id) as Debt;
    debt.pledgers = filter_pledgers(debt.pledgers, pledger.id);
    debt.save();
  }
}

export function get_user(address: Bytes): User {
  let user = User.load(address.toHex());
  if (user == null) {
    user = new User(address.toHex());
    user.pBalance = BigInt.fromI32(0);
    user.locked = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
    user.history = [];
  }
  return user as User;
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

  //possible mapping graph node timout hit
  let result = inverseCurveFunction(pAmount);
  return result;
}

export function construct_three_part_id(s: string, b: string, d: string): string {
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
export function filter_pledges(p: Array<string>, s: string): Array<string> {
  return p.filter(pledge => !pledge.includes(s));
}
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
