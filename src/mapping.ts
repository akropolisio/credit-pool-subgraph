import { BigInt, Bytes, crypto, Address } from "@graphprotocol/graph-ts";
import { Status } from "../generated/FundsModule/FundsModule";
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
  UnlockedPledgeWithdraw
} from "../generated/LoanModule/LoanModule";
import { User, Debt, Balance, Pool, Pledge } from "../generated/schema";
import { concat } from "./utils";

export function handleStatus(event: Status): void {
  let pool = new Pool(event.block.timestamp.toHex());
  pool.lBalance = event.params.lBalance;
  pool.lDebt = event.params.lDebt;
  pool.pEnterPrice = event.params.pEnterPrice.toI32();
  pool.pExitPrice = event.params.pExitPrice.toI32();

  pool.save();

  //refresh latest
  let latest_pool = Pool.load("latest");
  if (latest_pool == null) {
    latest_pool = new Pool("latest");
    latest_pool.lBalance = BigInt.fromI32(0);
    latest_pool.lDebt = BigInt.fromI32(0);
    latest_pool.pEnterPrice = BigInt.fromI32(0);
    latest_pool.pExitPrice = BigInt.fromI32(0);
  }
  latest_pool = pool;
  latest_pool.save();
}

export function handleDeposit(event: Deposit): void {
  let user = User.load(event.params.sender.toHex());

  if (user == null) {
    user = new User(event.params.sender.toHex());
    user.lBalance = BigInt.fromI32(0);
    user.pBalance = BigInt.fromI32(0);
    user.locked = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
  }

  let balance = new Balance(event.block.timestamp.toHex());
  let new_l_balance = user.lBalance.plus(event.params.lAmount);
  let new_p_balance = user.pBalance.plus(event.params.pAmount);

  balance.lBalance = new_l_balance;
  balance.pBalance = new_p_balance;
  balance.user = Bytes.fromHexString(user.id);
  balance.save();

  user.lBalance = new_l_balance;
  user.pBalance = new_p_balance;
  user.history.push(balance.id);
  user.save();
}

export function handleWithdraw(event: Withdraw): void {
  let user = User.load(event.params.sender.toHex());
  if (user == null) return;

  let balance = new Balance(event.block.timestamp.toHex());
  let new_l_balance = user.lBalance.minus(event.params.lAmountTotal);
  let new_p_balance = user.pBalance.minus(event.params.pAmount);

  balance.lBalance = new_l_balance;
  balance.pBalance = new_p_balance;
  balance.user = Bytes.fromHexString(user.id);
  balance.save();

  user.lBalance = new_l_balance;
  user.pBalance = new_p_balance;
  user.history.push(balance.id);
  user.save();
}

export function handleDebtPoposalCreated(event: DebtProposalCreated): void {
  let proposal = new Debt(event.params.proposal.toHex());
  proposal.borrower = event.params.sender;
  proposal.total = event.params.lAmount;
  proposal.repayed = BigInt.fromI32(0);
  proposal.pledges = [];
  proposal.status = "PROPOSED";
  proposal.save();
}

export function handleDebtPoposalExecuted(event: DebtProposalExecuted): void {
  let proposal = Debt.load(event.params.proposal.toHex());
  let user = User.load(proposal.borrower.toHex());
  user.credit = proposal.total;
  user.save();

  proposal.status = "EXECUTED";
  proposal.debt_id = event.params.debt.toI32();
  proposal.save();
}

export function handlePledgeAdded(event: PledgeAdded): void {
  let proposal = new Debt(event.params.proposal.toHex());
  let hash = crypto
    .keccak256(concat(event.params.sender, event.params.borrower))
    .toHexString();
  let pledge = new Pledge(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.plus(event.params.lAmount);

  proposal.pledges.push(pledge.toString());
  proposal.save();
}

export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let proposal = new Debt(event.params.proposal.toHex());
  let hash = crypto
    .keccak256(concat(event.params.sender, event.params.borrower))
    .toHexString();
  let new_arr = proposal.pledges.filter(p => !p.includes(hash));

  let pledge = Pledge.load(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  let pledger = get_user(pledge.pledger);
  pledger.locked = pledger.locked.minus(event.params.lAmount);

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

  let repayment = event.params.lFullPaymentAmount.minus(
    event.params.lInterestPaid
  );
  debt.repayed = debt.repayed.plus(repayment);
  debt.status = "PARTIALLY_REPAYED";
  debt.save();

  let user = User.load(debt.borrower.toHex());
  user.credit = user.credit.minus(repayment);
  user.save();
}

export function handleUnlockedPledgeWithdraw(
  event: UnlockedPledgeWithdraw
): void {
  let pledger = get_user(event.params.sender);
  pledger.locked = pledger.locked.minus(event.params.pAmount);
  pledger.pBalance = pledger.pBalance.plus(event.params.pAmount);
  pledger.save();
}


function get_user(address: Bytes): User {
  let user = User.load(address.toHex());
  if (user == null) {
    user = new User(address.toHex());
    user.lBalance = BigInt.fromI32(0);
    user.pBalance = BigInt.fromI32(0);
    user.locked = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
  }
  return user;
}
