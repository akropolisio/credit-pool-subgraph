import { BigInt } from "@graphprotocol/graph-ts";
import { FIX, CURVE_A, CURVE_B } from "./constants";

/**
 * Inverse Bonding curve
 * S = g(x)=(x^2+ax)/b, a>0, b>0
 */
export function inverseCurveFunction(x: BigInt): BigInt {
  return x
    .pow(2)
    .plus(FIX.times(CURVE_A).times(x))
    .div(FIX.times(CURVE_B));
}
