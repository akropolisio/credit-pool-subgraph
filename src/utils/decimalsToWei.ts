import { BigInt } from "@graphprotocol/graph-ts";

export function decimalsToWei(decimals: u8): BigInt {
  return BigInt.fromI32(10).pow(decimals);
}
