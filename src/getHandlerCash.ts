import { BigInt } from "@graphprotocol/graph-ts";

import { HandlerCash } from "../generated/schema";
import { get_latest_pool } from "./mapping";

export function getHandlerCash(): HandlerCash {
  const id = "1";
  let cash = HandlerCash.load(id);
  if (cash == null) {
    cash = new HandlerCash(id);
    cash.lastPoolSnapshot = get_latest_pool().id;
    cash.nextDistributionEventIndex = BigInt.fromI32(0);
    cash.proposalInterests = [];
    cash.proposalInterestCounts = [];
  }
  return cash as HandlerCash;
}
