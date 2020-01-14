import { ByteArray } from "@graphprotocol/graph-ts";

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
