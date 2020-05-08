import { BigInt } from "@graphprotocol/graph-ts";

import { Pool } from "../../../generated/schema";
import { latest_date } from "..";

export function getLatestPool(): Pool {
  let latest_pool = Pool.load(latest_date.toHex());

  if (latest_pool == null) {
    latest_pool = new Pool(latest_date.toHex());
    latest_pool.lBalance = BigInt.fromI32(0);
    latest_pool.lDebt = BigInt.fromI32(0);
    latest_pool.lProposals = BigInt.fromI32(0);
    latest_pool.pEnterPrice = BigInt.fromI32(0);
    latest_pool.pExitPrice = BigInt.fromI32(0);
    latest_pool.usersLength = BigInt.fromI32(0);
    latest_pool.users = [];
    latest_pool.depositSum = BigInt.fromI32(0);
    latest_pool.withdrawSum = BigInt.fromI32(0);
    latest_pool.proposalsCount = BigInt.fromI32(0);
    latest_pool.debtsCount = BigInt.fromI32(0);
    latest_pool.maxProposalInterest = BigInt.fromI32(0);
  }

  return latest_pool as Pool;
}
