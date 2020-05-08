import { BigInt, EthereumBlock } from "@graphprotocol/graph-ts";

import { Status } from "../../generated/FundsModule/FundsModule";
import { User } from "../../generated/schema";
import {
  getLatestPool,
  addExitBalance,
  addPoolSnapshot,
} from "../utils/entities";

export function handleStatus(event: Status): void {
  let latest_pool = getLatestPool();

  latest_pool.lProposals = event.params.lProposals;
  latest_pool.lBalance = event.params.lBalance;
  latest_pool.lDebt = event.params.lDebts;
  latest_pool.pEnterPrice = event.params.pEnterPrice;
  latest_pool.pExitPrice = event.params.pExitPrice;
  latest_pool.save();

  addPoolSnapshot(event.block.timestamp, latest_pool);
}

// (!) - hight concentration edit only
export function handleBlock(event: EthereumBlock): void {
  // add new balance in history for all users once a day
  if (event.number.mod(BigInt.fromI32(5750)).isZero()) {
    let latest_pool = getLatestPool();

    let users = latest_pool.users as Array<string>;
    for (let i = 0; i < latest_pool.users.length; i++) {
      let user = User.load(users[i]) as User;
      // add exit_balance record
      addExitBalance(event.timestamp, user, latest_pool);
    }
  }
}
