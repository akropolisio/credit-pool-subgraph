import { BigInt } from "@graphprotocol/graph-ts";

export let FIX = BigInt.fromI32(10).pow(18);
export let FIX2 = BigInt.fromI32(10).pow(36);
export let WITHDRAW_FEE = BigInt.fromI32(0);
export let PERCENT_MULTIPLIER = BigInt.fromI32(100);
export let COLLATERAL_TO_DEBT_RATIO_MULTIPLIER = BigInt.fromI32(100);
export let DAY = BigInt.fromI32(86400);
export let latest_date: BigInt = BigInt.fromI32(1287558610000 as i32);
export let CURVE_A = BigInt.fromI32(1);
export let CURVE_B = BigInt.fromI32(1);
