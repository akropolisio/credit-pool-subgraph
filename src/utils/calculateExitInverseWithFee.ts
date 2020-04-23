import { BigInt } from "@graphprotocol/graph-ts";
import { WITHDRAW_FEE, PERCENT_MULTIPLIER } from "./constants";
import { calculateExitInverse } from "./calculateExitInverse";

/**
 * @notice Calculates amount of liquid tokens one can withdraw from the pool when pTokens are burned/locked
 * Withdraw = L-g(x-dx)
 * x = f(L)
 * dx - amount of pTokens taken from user
 * WithdrawU = Withdraw*(1-d)
 * WithdrawP = Withdraw*d
 * Withdraw - amount of liquid token which should be sent to user
 * @param liquidAssets Liquid assets in Pool
 * @param pAmount Amount of pTokens to withdraw
 * @return Amount of liquid tokens to withdraw: total, for user, for pool
 */
export function calculateExitInverseWithFee(
  liquidAssets: BigInt,
  pAmount: BigInt
): BigInt {
  let withdraw = calculateExitInverse(liquidAssets, pAmount);
  let withdrawP = withdraw.times(WITHDRAW_FEE).div(PERCENT_MULTIPLIER);
  withdraw = withdraw.minus(withdrawP);
  return withdraw;
}
