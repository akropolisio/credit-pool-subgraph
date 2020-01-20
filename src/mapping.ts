import { BigInt, Bytes, Address, crypto, log } from "@graphprotocol/graph-ts";
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
import { concat, latest_date, DAY } from "./utils";

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
  let today = event.block.timestamp.div(BigInt.fromI32(DAY));
  let balance = Balance.load(today.toHex());

  // once a day
  if (balance == null) {
    balance = new Balance(today.toHex());
    balance.user = latest_date;
    balance.lBalance = BigInt.fromI32(0);
    balance.pBalance = BigInt.fromI32(0);
    
    pool.users.forEach(address => {
      let user = User.load(address);
      let user_lBalance = calculate_lBalance(event.address, user.pBalance);
      
      // add balance record
      let balance = new Balance(event.block.timestamp.toHex());
      balance.pBalance = user.pBalance;
      balance.lBalance = user_lBalance;
      balance.user = user.id;
      balance.save();
    });
  }
}

export function handleTransfer(event: Transfer): void {
  let from = get_user(event.params.from);
  let to = get_user(event.params.to);
  let pool = get_latest_pool();
  if (!pool.users.includes(from.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    pool.users.push(from.id);

    // let balance = init_balance(event.block.timestamp, from);
    // // get current liquid from current PTK
    // let Funds_mod = FundsModule.bind(event.address);
    // let result = Funds_mod.calculatePoolExitInverse(event.params.value);
    // let lBalanceCalculated = result.value1;
    // balance.pBalance = balance.pBalance.plus(event.params.value);
    // balance.lBalance = balance.lBalance.plus(lBalanceCalculated);
    // balance.save();

    pool.save();
  }

  if (!pool.users.includes(to.id)) {
    pool.usersLength = pool.usersLength.plus(BigInt.fromI32(1));
    pool.users.push(to.id);

    // let balance = init_balance(event.block.timestamp, to);
    // // get current liquid from current PTK
    // let Funds_mod = FundsModule.bind(event.address);
    // let result = Funds_mod.calculatePoolExitInverse(event.params.value);
    // let lBalanceCalculated = result.value1;
    // balance.pBalance = balance.pBalance.plus(event.params.value);
    // balance.lBalance = balance.lBalance.plus(lBalanceCalculated);
    // balance.save();

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
    pool.users.push(user.id);
    
    // let balance = init_balance(event.block.timestamp, user);
    // balance.pBalance = user.pBalance.plus(event.params.pAmount);
    // let calculated = calculate_lBalance(event.params.sender, balance.pBalance);
    // balance.lBalance = balance.lBalance.plus(calculated);
    // balance.save();

    pool.save();
  }
}

export function handleDebtProposalCreated(event: DebtProposalCreated): void {
  let proposal = new Debt(event.params.proposal.toHex());
  proposal.borrower = event.params.sender;
  proposal.total = event.params.lAmount;
  proposal.apr = event.params.interest;
  proposal.repayed = BigInt.fromI32(0);
  proposal.staked = BigInt.fromI32(0);
  proposal.pledges = [];
  proposal.status = "PROPOSED";
  proposal.save();
}

export function handleDebtProposalExecuted(event: DebtProposalExecuted): void {
  let proposal = Debt.load(event.params.proposal.toHex());
  let user = User.load(proposal.borrower.toHex());
  user.credit = proposal.total;
  user.save();

  proposal.status = "EXECUTED";
  proposal.debt_id = event.params.debt;
  proposal.save();
}

export function handlePledgeAdded(event: PledgeAdded): void {
  let proposal = Debt.load(event.params.proposal.toHex());
  let hash = crypto
    .keccak256(concat(event.params.sender, event.params.borrower))
    .toHexString();
  let pledge = new Pledge(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.proposal_id = proposal.id;
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.plus(event.params.lAmount);

  proposal.staked = proposal.staked.plus(pledge.lAmount);
  proposal.pledges.push(pledge.id);
  proposal.save();
}

export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let proposal = Debt.load(event.params.proposal.toHex()) as Debt;
  let hashed = crypto
    .keccak256(concat(event.params.sender, event.params.borrower))
    .toHexString();
  let new_arr = filter_pledges(proposal, hashed);

  let pledge = Pledge.load(hashed);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.minus(event.params.lAmount);

  proposal.staked = proposal.staked.minus(pledge.lAmount);
  proposal.pledges = new_arr;
  proposal.save();
}

export function handleRepay(event: Repay): void {
  let loan_mod = LoanModule.bind(event.address);
  let loan_debt = loan_mod.debts(event.params.sender, event.params.debt);

  // Not `loan_debt.proposal` because of graph-cli codegen bug.
  // However, as long as Debt struct on LoanModule has proposal
  // field at the first place, it`ll work
  let debt = Debt.load(loan_debt.value0.toHex());

  let repayment = event.params.lFullPaymentAmount.minus(event.params.lInterestPaid);
  debt.repayed = debt.repayed.plus(repayment);
  debt.status = "PARTIALLY_REPAYED";
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
export function init_balance(t: BigInt, sender: User): Balance {
  let balance = new Balance(t.toHex());
  balance.pBalance = BigInt.fromI32(0);
  balance.lBalance = BigInt.fromI32(0);
  balance.user = sender.id;

  return balance as Balance;
}

export function get_latest_pool(): Pool {
  let latest_pool = Pool.load(latest_date);
  if (latest_pool == null) {
    latest_pool = new Pool(latest_date);
    latest_pool.lBalance = BigInt.fromI32(0);
    latest_pool.lDebt = BigInt.fromI32(0);
    latest_pool.pEnterPrice = BigInt.fromI32(0);
    latest_pool.pExitPrice = BigInt.fromI32(0);
    latest_pool.usersLength = BigInt.fromI32(0);
    latest_pool.users = [];
  }
  return latest_pool as Pool;
}

export function filter_pledges(p: Debt, hashed: string): Array<string> {
  return p.pledges.filter(pledge => !pledge.includes(hashed));
}

export function calculate_lBalance(address: Address, pAmount: BigInt): BigInt {
    // get current liquid from current PTK
    let Funds_mod = FundsModule.bind(address);
    let result = Funds_mod.calculatePoolExitInverse(pAmount);
    return result.value0;
}