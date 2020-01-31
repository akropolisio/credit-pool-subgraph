import { ByteArray, BigInt } from "@graphprotocol/graph-ts";

export let FIX = BigInt.fromI32(10).pow(18);
export let COLLATERAL_TO_DEBT_RATIO_MULTIPLIER = BigInt.fromI32(100);
export let DAY = BigInt.fromI32(86400000);
export let latest_date: BigInt = BigInt.fromI32(1287558610000 as i32);

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
 * Inverse Bonding curve
 * S = g(x)=(x^2+ax)/b, a>0, b>0
 */
export function inverseCurveFunction(x: BigInt): BigInt {
  let a = BigInt.fromI32(1);
  let b = BigInt.fromI32(1);
  return x.pow(2).plus(FIX.times(a).times(x)).div(FIX.times(b));
}
