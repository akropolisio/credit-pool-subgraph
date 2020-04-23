import { BigInt } from "@graphprotocol/graph-ts";
/**
 * Babylonian method
 */
export function sqrtBabylonian(x: BigInt): BigInt {
  let z = x.plus(BigInt.fromI32(1)).div(BigInt.fromI32(2));
  let y = x;
  while (z < y) {
    y = z;
    z = x
      .div(z)
      .plus(z)
      .div(BigInt.fromI32(2));
  }
  return y;
}
