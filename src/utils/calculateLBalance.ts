import { BigInt, log } from "@graphprotocol/graph-ts";

import { calculateExitInverseWithFee } from "./calculateExitInverseWithFee";

export function calculateLBalance(
  user: string,
  liquidAssets: BigInt,
  pAmount: BigInt
): BigInt {
  // take negative balance into account
  let isNeg = pAmount.lt(BigInt.fromI32(0));
  let isMint = user == "0x0000000000000000000000000000000000000000"; // Discard mint

  if (isNeg && !isMint) {
    log.debug(`Account {} have less than 0 tokens.`, [user]);
  }

  let withdraw = calculateExitInverseWithFee(liquidAssets, pAmount.abs());

  return isNeg ? BigInt.fromI32(0) : withdraw;
}
