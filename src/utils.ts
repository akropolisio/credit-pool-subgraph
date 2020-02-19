import { ByteArray, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

export let FIX = BigInt.fromI32(10).pow(18);
export let FIX2 = BigInt.fromI32(10).pow(36);
export let WITHDRAW_FEE = BigInt.fromI32(5);
export let PERCENT_MULTIPLIER = BigInt.fromI32(100);
export let COLLATERAL_TO_DEBT_RATIO_MULTIPLIER = BigInt.fromI32(100);
export let DAY = BigInt.fromI32(86400);
export let latest_date: BigInt = BigInt.fromI32(1287558610000 as i32);
let a = BigInt.fromI32(1);
let b = BigInt.fromI32(1);

export function concat(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i];
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j];
  }
  return out as ByteArray;
}

export function concat_array(...args: Array<ByteArray>): ByteArray {
  let reducer = (acc, cur) => acc + cur.length;
  let len = args.reduce(reducer, 0);

  let out = new Uint8Array(len);
  let offset = 0;

  for (let j = 0; j < args.length; j++) {
    let a = args[j];
    for (let i = 0; i < a.length; i++) {
      out[offset + i] = a[i];
    }
    offset += a.length;
  }

  return out as ByteArray;
}

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
function calculateExitInverse(liquidAssets: BigInt, pAmount: BigInt): BigInt {
  let x = curveFunction(liquidAssets);
  let pdiff = x.minus(pAmount.abs());
  let ldiff: BigInt = inverseCurveFunction(pdiff);
  return liquidAssets.minus(ldiff);
}

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

/**
 * Inverse Bonding curve
 * S = g(x)=(x^2+ax)/b, a>0, b>0
 */
export function inverseCurveFunction(x: BigInt): BigInt {
  return x
    .pow(2)
    .plus(FIX.times(a).times(x))
    .div(FIX.times(b));
}

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
  let d = FIX2.times(a)
    .times(a)
    .plus(
      FIX.times(BigInt.fromI32(4))
        .times(b)
        .times(s)
    );

  return sqrt_babylonian(d)
    .minus(FIX.times(a))
    .div(BigInt.fromI32(2));
}

/**
 * Babylonian method 
 */
function sqrt_babylonian(x: BigInt): BigInt {
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

