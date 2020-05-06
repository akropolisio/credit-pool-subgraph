import { PoolModule } from "../../generated/schema";

export function isPoolModuleExist(address: string): boolean {
  let poolModule = PoolModule.load(address);
  return poolModule != null;
}
