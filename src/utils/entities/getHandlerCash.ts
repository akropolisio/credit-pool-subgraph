import { BigInt } from "@graphprotocol/graph-ts";

import { CommonHandlerCash, DefiHandlerCash } from "../../../generated/schema";
import { getLatestPool } from "./getLatestPool";

const ID = "1";

export function getCommonHandlerCash(): CommonHandlerCash {
  let cash = CommonHandlerCash.load(ID);

  if (cash == null) {
    cash = new CommonHandlerCash(ID);
    cash.lastPoolSnapshot = getLatestPool().id;
    cash.nextDistributionEventIndex = BigInt.fromI32(0);
    cash.proposalInterests = [];
    cash.proposalInterestCounts = [];
  }

  return cash as CommonHandlerCash;
}

export function getDefiHandlerCash(): DefiHandlerCash {
  let cash = DefiHandlerCash.load(ID);

  if (cash == null) {
    cash = new DefiHandlerCash(ID);
  }

  return cash as DefiHandlerCash;
}
