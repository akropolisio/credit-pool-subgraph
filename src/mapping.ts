import { BigInt, Bytes, crypto, log } from "@graphprotocol/graph-ts";
import { Status, FundsModule } from "../generated/FundsModule/FundsModule";
import { PToken, Transfer } from "../generated/PToken/PToken";
import {
  Deposit,
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

const DAY = 86400000;

export function handleStatus(event: Status): void {
  let pool = new Pool(event.block.timestamp.toHex());
  pool.lBalance = event.params.lBalance;
  pool.lDebt = event.params.lDebt;
  pool.pEnterPrice = event.params.pEnterPrice;
  pool.pExitPrice = event.params.pExitPrice;
  pool.users = [];
  
  //refresh latest
  let latest_pool = pool;
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
  if(balance == null){  
    balance = new Balance(today.toHex());
    balance.user = "daily";
    balance.lBalance = BigInt.fromI32(0);
    balance.pBalance = BigInt.fromI32(0);


    pool.users.forEach(address => {
      let user = User.load(address);
      
      // get current liquid from current PTK
      let Funds_mod = FundsModule.bind(event.address);
      let result = Funds_mod.calculatePoolExitInverse(user.pBalance)
      let user_lBalance = result.value1;

      // add balance record
      let balance = new Balance(event.block.timestamp.toHex());
      balance.pBalance = user.pBalance;
      balance.lBalance = user_lBalance;
      balance.user = user.id;
      balance.save();

      //push record to user history
      user.history.push(balance.id);
      user.save();
    })
  }
}

export function handleTransfer(event: Transfer): void {
  let from = get_user(event.params.from);
  let to = get_user(event.params.to);
  let pool = get_latest_pool();
  if(!pool.users.includes(from.id)){
    pool.users.push(from.id);
    pool.save()  
  }
  if(!pool.users.includes(to.id)){
    pool.users.push(to.id);
    pool.save()  
  }
  from.pBalance = from.pBalance.minus(event.params.value);
  to.pBalance = to.pBalance.plus(event.params.value);
  from.save();
  to.save();
}

export function handleDeposit(event: Deposit): void {
  let user = get_user(event.params.sender);
  let pool = get_latest_pool();
  if(!pool.users.includes(user.id)){
    pool.users.push(user.id);
    pool.save()  
  }
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
  proposal.debt_id = event.params.debt;
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

  proposal.pledges.push(pledge.id);
  proposal.save();
}

export function handlePledgeWithdrawn(event: PledgeWithdrawn): void {
  let proposal = new Debt(event.params.proposal.toHex());
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
    user.pBalance = BigInt.fromI32(0);
    user.locked = BigInt.fromI32(0);
    user.credit = BigInt.fromI32(0);
    user.history = [];
  }
  return user as User;
}

function get_latest_pool(): Pool {
  let latest_pool = Pool.load("latest");
  if (latest_pool == null) {
    latest_pool = new Pool("latest");
    latest_pool.lBalance = BigInt.fromI32(0);
    latest_pool.lDebt = BigInt.fromI32(0);
    latest_pool.pEnterPrice = BigInt.fromI32(0);
    latest_pool.pExitPrice = BigInt.fromI32(0);
    latest_pool.users = [];
  }
  return latest_pool as Pool;
}

function filter_pledges(p: Debt, hashed: string): Array<string> {
  return p.pledges.filter(pledge => !pledge.includes(hashed));
}
