import { BigInt } from "@graphprotocol/graph-ts";

import { calculateLBalance } from "./calculateLBalance";

//POOL FEE EXTRACTED HERE
export function calculateLBalanceIncreasing(
  user: string,
  currentLiquidity: BigInt,
  additionalLiquidity: BigInt,
  current_pAmount: BigInt,
  additional_pAmount: BigInt
): BigInt {
  let current_lAmount = calculateLBalance(
    user,
    currentLiquidity,
    current_pAmount
  );

  let next_lAmount = calculateLBalance(
    user,
    currentLiquidity.plus(additionalLiquidity),
    current_pAmount.plus(additional_pAmount)
  );

  return next_lAmount.minus(current_lAmount);
}
