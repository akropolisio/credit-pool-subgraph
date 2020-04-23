import { ByteArray, crypto, Address, BigInt } from "@graphprotocol/graph-ts";

export function getDebtProposalId(address: string, proposalId: string): string {
  return constructTwoPartId(address, proposalId);
}

export function getPledgeIdFromRaw(
  supporter: Address,
  borrower: Address,
  proposalId: BigInt
): string {
  return getPledgeId(
    supporter.toHexString(),
    borrower.toHexString(),
    proposalId.toHex()
  );
}

export function getPledgeId(
  supporter: string,
  borrower: string,
  proposalId: string
): string {
  return constructThreePartId(supporter, borrower, proposalId);
}

export function constructThreePartId(a: string, b: string, c: string): string {
  return constructId([a, b, c]);
}

export function constructTwoPartId(s: string, p: string): string {
  return constructId([s, p]);
}

export function constructId(hexes: string[]): string {
  let str = "";
  for (let i = 0; i < hexes.length; i++) {
    str = str.concat(normalizeLength(hexes[i]));
  }
  return crypto.keccak256(ByteArray.fromHexString(str)).toHexString();
}

export function normalizeLength(str: string): string {
  let s = str.startsWith('0x') ? str.slice(2) : str;
  if (s.length % 2 == 1) {
    return "0".concat(s);
  }
  return s;
}
