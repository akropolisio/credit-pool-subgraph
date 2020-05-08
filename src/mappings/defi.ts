import {
  BigInt,
  EthereumEvent,
  log,
  EthereumBlock,
  dataSource,
} from "@graphprotocol/graph-ts";

import { DefiAPR } from "../../generated/schema";
import {
  Withdraw,
  Deposit,
  WithdrawInterest,
  DeFiModule,
} from "../../generated/DeFiModule/DeFiModule";
import { PERCENT_MULTIPLIER, decimalsToWei, isPoolModuleExist } from "../utils";
import { getDefiHandlerCash } from "../utils/entities";

export function handleWithdraw(event: Withdraw): void {
  handleDefiAPREvent(event, event.params.amount);
}

export function handleDeposit(event: Deposit): void {
  handleDefiAPREvent(event, event.params.amount.times(BigInt.fromI32(-1)));
}

export function handleWithdrawInterest(event: WithdrawInterest): void {
  handleDefiAPREvent(event, event.params.amount);
}

export function handleBlock(event: EthereumBlock): void {
  if (event.number.mod(BigInt.fromI32(2000)).isZero()) {
    handleDefiAPREvent(event);
  }
}

// T extends EthereumEvent | EthereumBlock
function handleDefiAPREvent<T>(
  event: T,
  amountCorrection: BigInt = BigInt.fromI32(0)
): void {
  let defiModuleAddress = dataSource.address();
  if (!isPoolModuleExist(defiModuleAddress.toHexString())) {
    return;
  }

  let cash = getDefiHandlerCash();
  let lastAPR: DefiAPR | null =
    cash.lastDefiAPR == null ? null : getDefiAPR(cash.lastDefiAPR);
  let defiModule = DeFiModule.bind(defiModuleAddress);

  let id: string;
  let timestamp: BigInt;
  if (event instanceof EthereumBlock) {
    id = event.hash.toHex();
    timestamp = event.timestamp;
  } else if (event instanceof EthereumEvent) {
    id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
    timestamp = event.block.timestamp;
  } else {
    throw new Error(
      'Invalid "event" argument. "event" can be EthereumEvent or EthereumBlock.'
    );
  }

  let newAPR = getDefiAPR(id);

  newAPR.dateFrom = lastAPR == null ? BigInt.fromI32(0) : lastAPR.dateTo;
  newAPR.dateTo = timestamp;
  newAPR.duration = newAPR.dateTo.minus(newAPR.dateFrom);

  newAPR.amountFrom = lastAPR == null ? BigInt.fromI32(0) : lastAPR.amountTo;

  let poolBalance = defiModule.try_poolBalance();
  if (poolBalance.reverted) {
    log.warning("poolBalance getting is reverted", []);
  }
  newAPR.amountTo = poolBalance.reverted
    ? newAPR.amountFrom.minus(amountCorrection)
    : poolBalance.value;

  let calcAprResult = calcApr(
    newAPR.duration,
    newAPR.amountFrom,
    newAPR.amountTo.plus(amountCorrection)
  );
  newAPR.apr = calcAprResult.apr;
  newAPR.aprDecimals = calcAprResult.aprDecimals;
  newAPR.save();

  cash.lastDefiAPR = newAPR.id;
  cash.save();
}

function getDefiAPR(id: string): DefiAPR {
  let defiAPR = DefiAPR.load(id);
  if (defiAPR == null) {
    defiAPR = new DefiAPR(id);
  }
  return defiAPR as DefiAPR;
}

function calcApr(
  duration: BigInt,
  fromAmount: BigInt,
  toAmount: BigInt
): AprCalcResult {
  let secondsInYear = 365 * 24 * 60 * 60;
  let aprDecimals: u8 = 2;

  let apr =
    fromAmount.isZero() || duration.isZero()
      ? BigInt.fromI32(0)
      : toAmount
          .minus(fromAmount)
          .times(PERCENT_MULTIPLIER)
          .times(decimalsToWei(aprDecimals))
          .times(BigInt.fromI32(secondsInYear))
          .div(fromAmount)
          .div(duration);

  return new AprCalcResult(apr, aprDecimals);
}

class AprCalcResult {
  constructor(public apr: BigInt, public aprDecimals: u8) {}
}
