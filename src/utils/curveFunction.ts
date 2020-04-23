import { BigInt } from "@graphprotocol/graph-ts";
import { sqrtBabylonian } from "./sqrtBabylonian";
import { FIX2, CURVE_A, FIX, CURVE_B } from "./constants";

/**
 * @notice Bonding Curve function
 * Defined as: f(S) = [-a+sqrt(a^2+4bS)]/2, a>0, b>0
 * Fixed for Solidity as: curve(S) = (-(10^18) * a + sqrt((10^36) * (a^2) + 4 * (10^18) * b * S)) / 2
 * @param a Constant which defines curve
 * @param b Constant which defines curve
 * @param s Point used to calculate curve (liquid assets)
 * @return Value of curve at point s
 */
export function curveFunction(s: BigInt): BigInt {
  //uint256 d = FIX2 * (a*a) + 4 * FIX * b * s;
  //return (d.sqrt() - FIX*a)/2;
  let d = FIX2.times(CURVE_A)
    .times(CURVE_A)
    .plus(
      FIX.times(BigInt.fromI32(4))
        .times(CURVE_B)
        .times(s)
    );
  return sqrtBabylonian(d)
    .minus(FIX.times(CURVE_A))
    .div(BigInt.fromI32(2));
}
