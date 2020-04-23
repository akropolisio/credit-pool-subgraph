import { BigInt } from "@graphprotocol/graph-ts";
import { curveFunction } from "./curveFunction";
import { inverseCurveFunction } from "./inverseCurveFunction";

/**
 * @notice Calculates amount of liquid tokens one can withdraw from the pool when pTokens are burned/locked
 * Withdraw = L-g(x-dx)
 * x = f(L)
 * L - L is the volume of liquid assets in Pool
 * dx - amount of pTokens taken from user
 * Withdraw - amount of liquid token which should be sent to user
 * @param liquidAssets Liquid assets in Pool
 * @param pAmount Amount of pTokens to withdraw
 * @return Amount of liquid tokens to withdraw
 */
export function calculateExitInverse(
  liquidAssets: BigInt,
  pAmount: BigInt
): BigInt {
  let x = curveFunction(liquidAssets);
  let pdiff = x.minus(pAmount.abs());
  let ldiff: BigInt = inverseCurveFunction(pdiff);
  return liquidAssets.minus(ldiff);
}
