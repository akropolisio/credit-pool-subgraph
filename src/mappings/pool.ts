import { store, Address } from "@graphprotocol/graph-ts";

import {
  ModuleAdded,
  ModuleRemoved,
  ModuleReplaced,
} from "../../generated/PoolContract/PoolContract";
import { PoolModule } from "../../generated/schema";

export function handleAdded(event: ModuleAdded): void {
  createPoolModule(event.params.module, event.params.name);
}

export function handleRemoved(event: ModuleRemoved): void {
  store.remove("PoolModule", event.params.module.toHexString());
}

export function handleReplaced(event: ModuleReplaced): void {
  store.remove("PoolModule", event.params.from.toHexString());
  createPoolModule(event.params.to, event.params.name);
}

function createPoolModule(module: Address, name: string): void {
  let poolModule = getPoolModule(module.toHexString());
  poolModule.name = name;
  poolModule.save();
}

function getPoolModule(id: string): PoolModule {
  let poolModule = PoolModule.load(id);
  if (poolModule == null) {
    poolModule = new PoolModule(id);
  }
  return poolModule as PoolModule;
}
