import { BigInt, ethereum } from "@graphprotocol/graph-ts";

export function getUniqueIdFromEvent(event: ethereum.Event): string {
  return event.transaction.hash.toHex().concat("-").concat(event.logIndex.toString());
}

export function toBigInt(value: BigInt | null): BigInt {
  return value ? value : BigInt.fromI32(0);
}
