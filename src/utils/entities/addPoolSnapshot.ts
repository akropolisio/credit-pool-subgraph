import { BigInt } from "@graphprotocol/graph-ts";

import { Pool } from "../../../generated/schema";
import { getCommonHandlerCash } from "./getHandlerCash";

export function addPoolSnapshot(timestamp: BigInt, latestPool: Pool): void {
  let cash = getCommonHandlerCash();
  let id = timestamp.toHex();

  let pool = new Pool(id);
  pool.merge([latestPool]);
  pool.id = id;
  pool.save();

  cash.lastPoolSnapshot = pool.id;
  cash.save();
}
