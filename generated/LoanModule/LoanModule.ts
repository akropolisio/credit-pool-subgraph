// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  EthereumCall,
  EthereumEvent,
  SmartContract,
  EthereumValue,
  JSONValue,
  TypedMap,
  Entity,
  EthereumTuple,
  Bytes,
  Address,
  BigInt,
  CallResult
} from "@graphprotocol/graph-ts";

export class DebtProposalCreated extends EthereumEvent {
  get params(): DebtProposalCreated__Params {
    return new DebtProposalCreated__Params(this);
  }
}

export class DebtProposalCreated__Params {
  _event: DebtProposalCreated;

  constructor(event: DebtProposalCreated) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get proposal(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get lAmount(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get interest(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }
}

export class DebtProposalExecuted extends EthereumEvent {
  get params(): DebtProposalExecuted__Params {
    return new DebtProposalExecuted__Params(this);
  }
}

export class DebtProposalExecuted__Params {
  _event: DebtProposalExecuted;

  constructor(event: DebtProposalExecuted) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get proposal(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get debt(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get lAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }
}

export class OwnershipTransferred extends EthereumEvent {
  get params(): OwnershipTransferred__Params {
    return new OwnershipTransferred__Params(this);
  }
}

export class OwnershipTransferred__Params {
  _event: OwnershipTransferred;

  constructor(event: OwnershipTransferred) {
    this._event = event;
  }

  get previousOwner(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get newOwner(): Address {
    return this._event.parameters[1].value.toAddress();
  }
}

export class PledgeAdded extends EthereumEvent {
  get params(): PledgeAdded__Params {
    return new PledgeAdded__Params(this);
  }
}

export class PledgeAdded__Params {
  _event: PledgeAdded;

  constructor(event: PledgeAdded) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get borrower(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get proposal(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get lAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._event.parameters[4].value.toBigInt();
  }
}

export class PledgeWithdrawn extends EthereumEvent {
  get params(): PledgeWithdrawn__Params {
    return new PledgeWithdrawn__Params(this);
  }
}

export class PledgeWithdrawn__Params {
  _event: PledgeWithdrawn;

  constructor(event: PledgeWithdrawn) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get borrower(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get proposal(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get lAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._event.parameters[4].value.toBigInt();
  }
}

export class Repay extends EthereumEvent {
  get params(): Repay__Params {
    return new Repay__Params(this);
  }
}

export class Repay__Params {
  _event: Repay;

  constructor(event: Repay) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get debt(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get lDebtLeft(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get lFullPaymentAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get lInterestPaid(): BigInt {
    return this._event.parameters[4].value.toBigInt();
  }

  get newlastPayment(): BigInt {
    return this._event.parameters[5].value.toBigInt();
  }
}

export class UnlockedPledgeWithdraw extends EthereumEvent {
  get params(): UnlockedPledgeWithdraw__Params {
    return new UnlockedPledgeWithdraw__Params(this);
  }
}

export class UnlockedPledgeWithdraw__Params {
  _event: UnlockedPledgeWithdraw;

  constructor(event: UnlockedPledgeWithdraw) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get borrower(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get debt(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }
}

export class LoanModule__debtProposalsResult {
  value0: BigInt;
  value1: BigInt;
  value2: boolean;

  constructor(value0: BigInt, value1: BigInt, value2: boolean) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromBoolean(this.value2));
    return map;
  }
}

export class LoanModule__debtsResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;

  constructor(value0: BigInt, value1: BigInt, value2: BigInt, value3: BigInt) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromUnsignedBigInt(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    return map;
  }
}

export class LoanModule__calculatePledgeInfoResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;

  constructor(value0: BigInt, value1: BigInt, value2: BigInt, value3: BigInt) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromUnsignedBigInt(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    return map;
  }
}

export class LoanModule__getDebtRequiredPaymentsResult {
  value0: BigInt;
  value1: BigInt;

  constructor(value0: BigInt, value1: BigInt) {
    this.value0 = value0;
    this.value1 = value1;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    return map;
  }
}

export class LoanModule extends SmartContract {
  static bind(address: Address): LoanModule {
    return new LoanModule("LoanModule", address);
  }

  ANNUAL_SECONDS(): BigInt {
    let result = super.call("ANNUAL_SECONDS", []);

    return result[0].toBigInt();
  }

  try_ANNUAL_SECONDS(): CallResult<BigInt> {
    let result = super.tryCall("ANNUAL_SECONDS", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  INTEREST_MULTIPLIER(): BigInt {
    let result = super.call("INTEREST_MULTIPLIER", []);

    return result[0].toBigInt();
  }

  try_INTEREST_MULTIPLIER(): CallResult<BigInt> {
    let result = super.tryCall("INTEREST_MULTIPLIER", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  MODULE_CURVE(): string {
    let result = super.call("MODULE_CURVE", []);

    return result[0].toString();
  }

  try_MODULE_CURVE(): CallResult<string> {
    let result = super.tryCall("MODULE_CURVE", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toString());
  }

  MODULE_FUNDS(): string {
    let result = super.call("MODULE_FUNDS", []);

    return result[0].toString();
  }

  try_MODULE_FUNDS(): CallResult<string> {
    let result = super.tryCall("MODULE_FUNDS", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toString());
  }

  MODULE_LIQUIDITY(): string {
    let result = super.call("MODULE_LIQUIDITY", []);

    return result[0].toString();
  }

  try_MODULE_LIQUIDITY(): CallResult<string> {
    let result = super.tryCall("MODULE_LIQUIDITY", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toString());
  }

  MODULE_LOAN(): string {
    let result = super.call("MODULE_LOAN", []);

    return result[0].toString();
  }

  try_MODULE_LOAN(): CallResult<string> {
    let result = super.tryCall("MODULE_LOAN", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toString());
  }

  debtProposals(
    param0: Address,
    param1: BigInt
  ): LoanModule__debtProposalsResult {
    let result = super.call("debtProposals", [
      EthereumValue.fromAddress(param0),
      EthereumValue.fromUnsignedBigInt(param1)
    ]);

    return new LoanModule__debtProposalsResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBoolean()
    );
  }

  try_debtProposals(
    param0: Address,
    param1: BigInt
  ): CallResult<LoanModule__debtProposalsResult> {
    let result = super.tryCall("debtProposals", [
      EthereumValue.fromAddress(param0),
      EthereumValue.fromUnsignedBigInt(param1)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(
      new LoanModule__debtProposalsResult(
        value[0].toBigInt(),
        value[1].toBigInt(),
        value[2].toBoolean()
      )
    );
  }

  debts(param0: Address, param1: BigInt): LoanModule__debtsResult {
    let result = super.call("debts", [
      EthereumValue.fromAddress(param0),
      EthereumValue.fromUnsignedBigInt(param1)
    ]);

    return new LoanModule__debtsResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt()
    );
  }

  try_debts(
    param0: Address,
    param1: BigInt
  ): CallResult<LoanModule__debtsResult> {
    let result = super.tryCall("debts", [
      EthereumValue.fromAddress(param0),
      EthereumValue.fromUnsignedBigInt(param1)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(
      new LoanModule__debtsResult(
        value[0].toBigInt(),
        value[1].toBigInt(),
        value[2].toBigInt(),
        value[3].toBigInt()
      )
    );
  }

  getModuleAddress(module: string): Address {
    let result = super.call("getModuleAddress", [
      EthereumValue.fromString(module)
    ]);

    return result[0].toAddress();
  }

  try_getModuleAddress(module: string): CallResult<Address> {
    let result = super.tryCall("getModuleAddress", [
      EthereumValue.fromString(module)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toAddress());
  }

  isOwner(): boolean {
    let result = super.call("isOwner", []);

    return result[0].toBoolean();
  }

  try_isOwner(): CallResult<boolean> {
    let result = super.tryCall("isOwner", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBoolean());
  }

  owner(): Address {
    let result = super.call("owner", []);

    return result[0].toAddress();
  }

  try_owner(): CallResult<Address> {
    let result = super.tryCall("owner", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toAddress());
  }

  pool(): Address {
    let result = super.call("pool", []);

    return result[0].toAddress();
  }

  try_pool(): CallResult<Address> {
    let result = super.tryCall("pool", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toAddress());
  }

  createDebtProposal(
    debtLAmount: BigInt,
    interest: BigInt,
    pAmount: BigInt,
    lAmountMin: BigInt
  ): BigInt {
    let result = super.call("createDebtProposal", [
      EthereumValue.fromUnsignedBigInt(debtLAmount),
      EthereumValue.fromUnsignedBigInt(interest),
      EthereumValue.fromUnsignedBigInt(pAmount),
      EthereumValue.fromUnsignedBigInt(lAmountMin)
    ]);

    return result[0].toBigInt();
  }

  try_createDebtProposal(
    debtLAmount: BigInt,
    interest: BigInt,
    pAmount: BigInt,
    lAmountMin: BigInt
  ): CallResult<BigInt> {
    let result = super.tryCall("createDebtProposal", [
      EthereumValue.fromUnsignedBigInt(debtLAmount),
      EthereumValue.fromUnsignedBigInt(interest),
      EthereumValue.fromUnsignedBigInt(pAmount),
      EthereumValue.fromUnsignedBigInt(lAmountMin)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  executeDebtProposal(proposal: BigInt): BigInt {
    let result = super.call("executeDebtProposal", [
      EthereumValue.fromUnsignedBigInt(proposal)
    ]);

    return result[0].toBigInt();
  }

  try_executeDebtProposal(proposal: BigInt): CallResult<BigInt> {
    let result = super.tryCall("executeDebtProposal", [
      EthereumValue.fromUnsignedBigInt(proposal)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  calculatePledgeInfo(
    borrower: Address,
    debt: BigInt,
    supporter: Address
  ): LoanModule__calculatePledgeInfoResult {
    let result = super.call("calculatePledgeInfo", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(debt),
      EthereumValue.fromAddress(supporter)
    ]);

    return new LoanModule__calculatePledgeInfoResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt()
    );
  }

  try_calculatePledgeInfo(
    borrower: Address,
    debt: BigInt,
    supporter: Address
  ): CallResult<LoanModule__calculatePledgeInfoResult> {
    let result = super.tryCall("calculatePledgeInfo", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(debt),
      EthereumValue.fromAddress(supporter)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(
      new LoanModule__calculatePledgeInfoResult(
        value[0].toBigInt(),
        value[1].toBigInt(),
        value[2].toBigInt(),
        value[3].toBigInt()
      )
    );
  }

  getRequiredPledge(borrower: Address, proposal: BigInt): BigInt {
    let result = super.call("getRequiredPledge", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(proposal)
    ]);

    return result[0].toBigInt();
  }

  try_getRequiredPledge(
    borrower: Address,
    proposal: BigInt
  ): CallResult<BigInt> {
    let result = super.tryCall("getRequiredPledge", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(proposal)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  getDebtRequiredPayments(
    borrower: Address,
    debt: BigInt
  ): LoanModule__getDebtRequiredPaymentsResult {
    let result = super.call("getDebtRequiredPayments", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(debt)
    ]);

    return new LoanModule__getDebtRequiredPaymentsResult(
      result[0].toBigInt(),
      result[1].toBigInt()
    );
  }

  try_getDebtRequiredPayments(
    borrower: Address,
    debt: BigInt
  ): CallResult<LoanModule__getDebtRequiredPaymentsResult> {
    let result = super.tryCall("getDebtRequiredPayments", [
      EthereumValue.fromAddress(borrower),
      EthereumValue.fromUnsignedBigInt(debt)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(
      new LoanModule__getDebtRequiredPaymentsResult(
        value[0].toBigInt(),
        value[1].toBigInt()
      )
    );
  }

  hasActiveDebts(sender: Address): boolean {
    let result = super.call("hasActiveDebts", [
      EthereumValue.fromAddress(sender)
    ]);

    return result[0].toBoolean();
  }

  try_hasActiveDebts(sender: Address): CallResult<boolean> {
    let result = super.tryCall("hasActiveDebts", [
      EthereumValue.fromAddress(sender)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBoolean());
  }

  totalLDebts(): BigInt {
    let result = super.call("totalLDebts", []);

    return result[0].toBigInt();
  }

  try_totalLDebts(): CallResult<BigInt> {
    let result = super.tryCall("totalLDebts", []);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }

  calculateInterestPayment(
    debtLAmount: BigInt,
    interest: BigInt,
    prevPayment: BigInt,
    currentPayment: BigInt
  ): BigInt {
    let result = super.call("calculateInterestPayment", [
      EthereumValue.fromUnsignedBigInt(debtLAmount),
      EthereumValue.fromUnsignedBigInt(interest),
      EthereumValue.fromUnsignedBigInt(prevPayment),
      EthereumValue.fromUnsignedBigInt(currentPayment)
    ]);

    return result[0].toBigInt();
  }

  try_calculateInterestPayment(
    debtLAmount: BigInt,
    interest: BigInt,
    prevPayment: BigInt,
    currentPayment: BigInt
  ): CallResult<BigInt> {
    let result = super.tryCall("calculateInterestPayment", [
      EthereumValue.fromUnsignedBigInt(debtLAmount),
      EthereumValue.fromUnsignedBigInt(interest),
      EthereumValue.fromUnsignedBigInt(prevPayment),
      EthereumValue.fromUnsignedBigInt(currentPayment)
    ]);
    if (result.reverted) {
      return new CallResult();
    }
    let value = result.value;
    return CallResult.fromValue(value[0].toBigInt());
  }
}

export class RenounceOwnershipCall extends EthereumCall {
  get inputs(): RenounceOwnershipCall__Inputs {
    return new RenounceOwnershipCall__Inputs(this);
  }

  get outputs(): RenounceOwnershipCall__Outputs {
    return new RenounceOwnershipCall__Outputs(this);
  }
}

export class RenounceOwnershipCall__Inputs {
  _call: RenounceOwnershipCall;

  constructor(call: RenounceOwnershipCall) {
    this._call = call;
  }
}

export class RenounceOwnershipCall__Outputs {
  _call: RenounceOwnershipCall;

  constructor(call: RenounceOwnershipCall) {
    this._call = call;
  }
}

export class SetPoolCall extends EthereumCall {
  get inputs(): SetPoolCall__Inputs {
    return new SetPoolCall__Inputs(this);
  }

  get outputs(): SetPoolCall__Outputs {
    return new SetPoolCall__Outputs(this);
  }
}

export class SetPoolCall__Inputs {
  _call: SetPoolCall;

  constructor(call: SetPoolCall) {
    this._call = call;
  }

  get _pool(): Address {
    return this._call.inputValues[0].value.toAddress();
  }
}

export class SetPoolCall__Outputs {
  _call: SetPoolCall;

  constructor(call: SetPoolCall) {
    this._call = call;
  }
}

export class TransferOwnershipCall extends EthereumCall {
  get inputs(): TransferOwnershipCall__Inputs {
    return new TransferOwnershipCall__Inputs(this);
  }

  get outputs(): TransferOwnershipCall__Outputs {
    return new TransferOwnershipCall__Outputs(this);
  }
}

export class TransferOwnershipCall__Inputs {
  _call: TransferOwnershipCall;

  constructor(call: TransferOwnershipCall) {
    this._call = call;
  }

  get newOwner(): Address {
    return this._call.inputValues[0].value.toAddress();
  }
}

export class TransferOwnershipCall__Outputs {
  _call: TransferOwnershipCall;

  constructor(call: TransferOwnershipCall) {
    this._call = call;
  }
}

export class InitializeCall extends EthereumCall {
  get inputs(): InitializeCall__Inputs {
    return new InitializeCall__Inputs(this);
  }

  get outputs(): InitializeCall__Outputs {
    return new InitializeCall__Outputs(this);
  }
}

export class InitializeCall__Inputs {
  _call: InitializeCall;

  constructor(call: InitializeCall) {
    this._call = call;
  }

  get _pool(): Address {
    return this._call.inputValues[0].value.toAddress();
  }
}

export class InitializeCall__Outputs {
  _call: InitializeCall;

  constructor(call: InitializeCall) {
    this._call = call;
  }
}

export class Initialize1Call extends EthereumCall {
  get inputs(): Initialize1Call__Inputs {
    return new Initialize1Call__Inputs(this);
  }

  get outputs(): Initialize1Call__Outputs {
    return new Initialize1Call__Outputs(this);
  }
}

export class Initialize1Call__Inputs {
  _call: Initialize1Call;

  constructor(call: Initialize1Call) {
    this._call = call;
  }
}

export class Initialize1Call__Outputs {
  _call: Initialize1Call;

  constructor(call: Initialize1Call) {
    this._call = call;
  }
}

export class CreateDebtProposalCall extends EthereumCall {
  get inputs(): CreateDebtProposalCall__Inputs {
    return new CreateDebtProposalCall__Inputs(this);
  }

  get outputs(): CreateDebtProposalCall__Outputs {
    return new CreateDebtProposalCall__Outputs(this);
  }
}

export class CreateDebtProposalCall__Inputs {
  _call: CreateDebtProposalCall;

  constructor(call: CreateDebtProposalCall) {
    this._call = call;
  }

  get debtLAmount(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get interest(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }

  get lAmountMin(): BigInt {
    return this._call.inputValues[3].value.toBigInt();
  }
}

export class CreateDebtProposalCall__Outputs {
  _call: CreateDebtProposalCall;

  constructor(call: CreateDebtProposalCall) {
    this._call = call;
  }

  get value0(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }
}

export class AddPledgeCall extends EthereumCall {
  get inputs(): AddPledgeCall__Inputs {
    return new AddPledgeCall__Inputs(this);
  }

  get outputs(): AddPledgeCall__Outputs {
    return new AddPledgeCall__Outputs(this);
  }
}

export class AddPledgeCall__Inputs {
  _call: AddPledgeCall;

  constructor(call: AddPledgeCall) {
    this._call = call;
  }

  get borrower(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get proposal(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }

  get lAmountMin(): BigInt {
    return this._call.inputValues[3].value.toBigInt();
  }
}

export class AddPledgeCall__Outputs {
  _call: AddPledgeCall;

  constructor(call: AddPledgeCall) {
    this._call = call;
  }
}

export class WithdrawPledgeCall extends EthereumCall {
  get inputs(): WithdrawPledgeCall__Inputs {
    return new WithdrawPledgeCall__Inputs(this);
  }

  get outputs(): WithdrawPledgeCall__Outputs {
    return new WithdrawPledgeCall__Outputs(this);
  }
}

export class WithdrawPledgeCall__Inputs {
  _call: WithdrawPledgeCall;

  constructor(call: WithdrawPledgeCall) {
    this._call = call;
  }

  get borrower(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get proposal(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }

  get pAmount(): BigInt {
    return this._call.inputValues[2].value.toBigInt();
  }
}

export class WithdrawPledgeCall__Outputs {
  _call: WithdrawPledgeCall;

  constructor(call: WithdrawPledgeCall) {
    this._call = call;
  }
}

export class ExecuteDebtProposalCall extends EthereumCall {
  get inputs(): ExecuteDebtProposalCall__Inputs {
    return new ExecuteDebtProposalCall__Inputs(this);
  }

  get outputs(): ExecuteDebtProposalCall__Outputs {
    return new ExecuteDebtProposalCall__Outputs(this);
  }
}

export class ExecuteDebtProposalCall__Inputs {
  _call: ExecuteDebtProposalCall;

  constructor(call: ExecuteDebtProposalCall) {
    this._call = call;
  }

  get proposal(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }
}

export class ExecuteDebtProposalCall__Outputs {
  _call: ExecuteDebtProposalCall;

  constructor(call: ExecuteDebtProposalCall) {
    this._call = call;
  }

  get value0(): BigInt {
    return this._call.outputValues[0].value.toBigInt();
  }
}

export class RepayCall extends EthereumCall {
  get inputs(): RepayCall__Inputs {
    return new RepayCall__Inputs(this);
  }

  get outputs(): RepayCall__Outputs {
    return new RepayCall__Outputs(this);
  }
}

export class RepayCall__Inputs {
  _call: RepayCall;

  constructor(call: RepayCall) {
    this._call = call;
  }

  get debt(): BigInt {
    return this._call.inputValues[0].value.toBigInt();
  }

  get lAmount(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class RepayCall__Outputs {
  _call: RepayCall;

  constructor(call: RepayCall) {
    this._call = call;
  }
}

export class WithdrawUnlockedPledgeCall extends EthereumCall {
  get inputs(): WithdrawUnlockedPledgeCall__Inputs {
    return new WithdrawUnlockedPledgeCall__Inputs(this);
  }

  get outputs(): WithdrawUnlockedPledgeCall__Outputs {
    return new WithdrawUnlockedPledgeCall__Outputs(this);
  }
}

export class WithdrawUnlockedPledgeCall__Inputs {
  _call: WithdrawUnlockedPledgeCall;

  constructor(call: WithdrawUnlockedPledgeCall) {
    this._call = call;
  }

  get borrower(): Address {
    return this._call.inputValues[0].value.toAddress();
  }

  get debt(): BigInt {
    return this._call.inputValues[1].value.toBigInt();
  }
}

export class WithdrawUnlockedPledgeCall__Outputs {
  _call: WithdrawUnlockedPledgeCall;

  constructor(call: WithdrawUnlockedPledgeCall) {
    this._call = call;
  }
}