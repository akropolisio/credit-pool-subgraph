import { BigInt, crypto, ByteArray } from "@graphprotocol/graph-ts";
import { Status } from "../generated/FundsModule/FundsModule";
import {
  Deposit,
  Withdraw
} from "../generated/LiquidityModule/LiquidityModule";
import {
  DebtProposalCreated,
  PledgeAdded,
  PledgeWithdrawn,
  DebtProposalExecuted,
  Repay,
  UnlockedPledgeWithdraw
} from "../generated/LoanModule/LoanModule";
import { User, Debt, Pool, Pledge } from "../generated/schema";
import {concat} from "./utils";

export function handleStatus(event: Status): void {
  let pool = new Pool(new Date().getTime().toString());
  pool.lBalance = event.params.lBalance;
  pool.lDebt = event.params.lDebt;
  pool.pEnterPrice = event.params.pEnterPrice;
  pool.pExitPrice = event.params.pExitPrice;

  pool.save();

  //refresh latest
  let latest_pool = Pool.load("latest");
  if (latest_pool == null) {
    latest_pool = new Pool("latest");
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

  user.address = event.params.sender;
  user.lBalance = user.lBalance.plus(event.params.lAmount);
  user.pBalance = user.lBalance.plus(event.params.pAmount);
  user.save();
}

export function handleWithdraw(event: Withdraw): void {
  let user = User.load(event.params.sender.toHex());
  if (user == null) return;

  user.address = event.params.sender;
  user.lBalance = user.lBalance.minus(event.params.lAmountTotal);
  user.pBalance = user.lBalance.minus(event.params.pAmount);
  user.save();

  let pool = Pool.load("latest");
  pool.lBalance = pool.lBalance.minus(event.params.lAmountTotal);
  pool.save();
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
  proposal.status = "EXECUTED";
  proposal.save();
}

export function handlePledgeAdded(event: PledgeAdded): void {
  let proposal = new Debt(event.params.proposal.toHex());

  let hash = crypto.keccak256(concat(event.params.sender, event.params.borrower)).toHexString()
  let pledge = new Pledge(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  proposal.pledges.push(pledge.toString());
  proposal.save()
}

export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let proposal = new Debt(event.params.proposal.toHex());
  let hash = crypto.keccak256(concat(event.params.sender, event.params.borrower)).toHexString()
  let new_arr = proposal.pledges.filter(p => !p.includes(hash));

  let pledge = Pledge.load(hash);
  pledge.pledger = event.params.sender;
  pledge.lAmount = event.params.lAmount;
  pledge.pAmount = event.params.pAmount;
  pledge.save();

  proposal.pledges = new_arr;
  proposal.save()
}


export function handleRepay(event: Repay): void {

}

export function handleUnlockedPledgeWithdraw(
  event: UnlockedPledgeWithdraw
): void {}
