import { BigInt } from "@graphprotocol/graph-ts";
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
import { Staker, User, Debt, Pool } from "../generated/schema";

export function handleStatus(event: Status): void {
  let pool = new Pool(new Date().getTime().toString());
  pool.lBalance = event.params.lBalance;
  pool.lDebt = event.params.lDebt;
  pool.pEnterPrice = event.params.pEnterPrice;
  pool.pExitPrice = event.params.pExitPrice;

  pool.save();
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
  user.save()
}

export function handleWithdraw(event: Withdraw): void {
  let user = User.load(event.params.sender.toHex());

  user.address = event.params.sender;
  user.lBalance = user.lBalance.minus(event.params.lAmountTotal);
  user.pBalance = user.lBalance.minus(event.params.pAmount);
  user.save()

  // let pool = new Pool(new Date().getTime().toString());
  // pool.lBalance = event.params.lBalance;
  // pool.lDebt = event.params.lDebt;
  // pool.pEnterPrice = event.params.pEnterPrice;
  // pool.pExitPrice = event.params.pExitPrice;

  // pool.save();
}


