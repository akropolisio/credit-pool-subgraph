import { BigInt } from "@graphprotocol/graph-ts";

import { User, ExitBalance, Pool } from "../../../generated/schema";
import { constructTwoPartId } from "../constructId";
import { calculateLBalanceIncreasing } from "../calculateLBalanceIncreasing";
import { calculateLBalance } from "../calculateLBalance";

export function addExitBalance(
  timestamp: BigInt,
  user: User,
  pool: Pool
): void {
  let exit_balance = new ExitBalance(
    constructTwoPartId(timestamp.toHex(), user.id)
  );

  exit_balance.user = user.id;
  exit_balance.date = timestamp;
  exit_balance.pBalance = user.pBalance;

  let lBalance = calculateLBalance(
    user.id,
    pool.lBalance.minus(pool.lProposals),
    user.pBalance
  );
  let lLocked = calculateLBalanceIncreasing(
    user.id,
    pool.lBalance.minus(pool.lProposals),
    user.unlockLiquiditySum,
    user.pBalance,
    user.pLockedSum.plus(user.pInterestSum)
  );

  exit_balance.lBalance = lBalance.plus(lLocked);
  exit_balance.save();
}
