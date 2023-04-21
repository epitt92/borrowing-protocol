import {
  StabilityPoolGlobals,
  Token,
  Trove,
  TroveDebtHistory,
  TroveLiquidation,
  TroveRedemption,
  Wallet
} from "../generated/schema";
import {
  NewTrove,
  OwnershipTransferred,
  Redemption,
  TroveCollateralUpdate,
  TroveDebtUpdate,
  TroveLiquidated,
  TroveRemoved
} from "../generated/TroveFactory/TroveFactory";
import { newMockEvent } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { getUniqueIdFromEvent, toBigInt } from "./helper";

export function handleTroveCollateralUpdate(event: TroveCollateralUpdate): void {
  const trove = Trove.load(event.params.trove.toHex());
  if(trove !== null) {
    trove.collateral = event.params.newAmount;
    trove.collateralization = event.params.newCollateralization;
    trove.save();
  }
}

export function handleTroveTransferOwnership(event: OwnershipTransferred): void {
  if(event.transaction.to) {
    let troveAddress: Address = (event.transaction.to as Address)
    const trove = Trove.load(troveAddress.toHex());
    if(trove !== null) {
      trove.owner = event.params.newOwner.toHex();
      let wallet = Wallet.load(event.params.newOwner.toHex());
      if (wallet == null) {
        wallet = new Wallet(event.params.newOwner.toHex());
        wallet.save();
      }
      trove.save();
    }
  }
}

export function handleTroveDebtUpdate(event: TroveDebtUpdate): void {
  const trove = Trove.load(event.params.trove.toHex());
  if(trove !== null) {
    let wallet = Wallet.load(event.params.actor.toHex());
    if (wallet == null) {
      wallet = new Wallet(event.params.actor.toHex());
      wallet.save();
    }

    let previousDebt = ( trove.debt ? trove.debt : BigInt.fromString("0") ) as BigInt;

    let troveDebtUpdateHistory = new TroveDebtHistory(getUniqueIdFromEvent(event));
    troveDebtUpdateHistory.actor = event.params.actor.toHex();
    troveDebtUpdateHistory.trove = event.params.trove.toHex();
    troveDebtUpdateHistory.feePaid = event.params.feePaid;

    if (previousDebt >= event.params.newAmount) {
      troveDebtUpdateHistory.amount = previousDebt.minus(event.params.newAmount);
      troveDebtUpdateHistory.action = "repay";
    } else {
      troveDebtUpdateHistory.amount = event.params.newAmount.minus(previousDebt);
      troveDebtUpdateHistory.action = "borrow";
    }
    troveDebtUpdateHistory.debt = event.params.newAmount;
    troveDebtUpdateHistory.save();

    trove.debt = event.params.newAmount;
    trove.debtBaseRate = event.params.baseRate;
    trove.collateralization = event.params.newCollateralization;
    trove.save();
  }
}

export function handleTroveLiquidated(event: TroveLiquidated): void {
  const trove = Trove.load(event.params.trove.toHex());
  if(trove !== null) {
    const id = getUniqueIdFromEvent(event);
    const liquidation = new TroveLiquidation(id);
    liquidation.collateral = event.params.collateral;
    liquidation.price = event.params.priceAtLiquidation;
    liquidation.trove = trove.id;

    const liquidatedBySPbool = event.params.stabilityPoolLiquidation !== Address.zero();

    liquidation.liquidatedByStabilityPool = liquidatedBySPbool;
    liquidation.save();
    trove.isLiquidated = true;
    trove.liquidatedByStabilityPool = liquidatedBySPbool;
    trove.liquidationTimeStamp = event.block.timestamp
    trove.priceAtLiquidation = event.params.priceAtLiquidation;
    trove.save();

    if (liquidatedBySPbool) {
      let spGlobals = StabilityPoolGlobals.load(event.params.stabilityPoolLiquidation.toHex());
      if (spGlobals == null) {
        spGlobals = new StabilityPoolGlobals(event.params.stabilityPoolLiquidation.toHex());
        spGlobals.totalCollateralRedeemedValue = new BigInt(0);
        spGlobals.collateralRewardsValue = new BigInt(0);
      }
      spGlobals.collateralRewardsValue = event.params.collateral.times(event.params.priceAtLiquidation).div(BigInt.fromString("1000000000000000000"))
          .plus(toBigInt(spGlobals.collateralRewardsValue));
      spGlobals.save();
    }
  }
}

export function handleTroveRemoved(event: TroveRemoved): void {
  const trove = Trove.load(event.params.trove.toHex());
  if(trove !== null) {
    trove.isRemoved = true;
    trove.save();
  }
}

export function handleNewTrove(event: NewTrove): void {
  let trove = new Trove(event.params.trove.toHex());
  let owner = Wallet.load(event.params.owner.toHex());
  if (owner == null) {
    owner = new Wallet(event.params.owner.toHex());
    owner.save();
  }
  trove.owner = owner.id;
  let token = Token.load(event.params.token.toHex());
  if (token == null) {
    token = new Token(event.params.token.toHex());
    token.save();
  }
  trove.token = token.id;
  trove.save();
}

export function handleRedemption(event: Redemption): void {
  const id = getUniqueIdFromEvent(event);
  let troveRedemption = TroveRedemption.load(id);
  if (troveRedemption == null) {
    troveRedemption = new TroveRedemption(id);
  }
  troveRedemption.collateralToken = event.params.token.toHex();
  troveRedemption.stableCoinRedeemed = event.params.stableAmount;
  troveRedemption.collateralRedeemed = event.params.tokenAmount;
  troveRedemption.stableCoinLeft = event.params.stableUnspent;
  troveRedemption.startBaseRate = event.params.startBaseRate;
  troveRedemption.finishBaseRate = event.params.finishBaseRate;
  troveRedemption.latestTroveRedeemed = event.params.lastTroveRedeemed.toHex();
  troveRedemption.blockTimestamp = event.block.timestamp;
  troveRedemption.save();
}

// ==============================================================
// Helper functions for tests
// --------------------------------------------------------------

export function createRedemptionEvent(
  tokenAddress: string,
  stableAmount: i32,
  tokenAmount: i32,
  stableUnspent: i32,
  startBaseRate: i32,
  finishBaseRate: i32,
  lastTroveRedeemed: string
): Redemption {
  let newEvent: Redemption = changetype<Redemption>(newMockEvent());
  newEvent.parameters = new Array();
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(tokenAddress)));
  let stableAmountParam = new ethereum.EventParam("stableAmount", ethereum.Value.fromI32(stableAmount));
  let tokenAmountParam = new ethereum.EventParam("tokenAmount", ethereum.Value.fromI32(tokenAmount));
  let stableUnspentParam = new ethereum.EventParam("stableUnspent", ethereum.Value.fromI32(stableUnspent));
  let startBaseRateParam = new ethereum.EventParam("startBaseRate", ethereum.Value.fromI32(startBaseRate));
  let finishBaseRateParam = new ethereum.EventParam("finishBaseRate", ethereum.Value.fromI32(finishBaseRate));
  let latestTroveRedeemedParam = new ethereum.EventParam(
    "lastTroveRedeemed",
    ethereum.Value.fromAddress(Address.fromString(lastTroveRedeemed))
  );

  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(stableAmountParam);
  newEvent.parameters.push(tokenAmountParam);
  newEvent.parameters.push(stableUnspentParam);
  newEvent.parameters.push(startBaseRateParam);
  newEvent.parameters.push(finishBaseRateParam);
  newEvent.parameters.push(latestTroveRedeemedParam);

  return newEvent;
}

export function createNewTroveEvent(troveAddress: string, ownerAddress: string, tokenAddress: string): NewTrove {
  let newEvent = changetype<NewTrove>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("trove", ethereum.Value.fromAddress(Address.fromString(troveAddress)));
  let ownerParam = new ethereum.EventParam("owner", ethereum.Value.fromAddress(Address.fromString(ownerAddress)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(tokenAddress)));

  newEvent.parameters.push(troveParam);
  newEvent.parameters.push(ownerParam);
  newEvent.parameters.push(tokenParam);

  return newEvent;
}

export function createTroveRemovedEvent(troveAddress: string): TroveRemoved {
  let newEvent = changetype<TroveRemoved>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("trove", ethereum.Value.fromAddress(Address.fromString(troveAddress)));

  newEvent.parameters.push(troveParam);

  return newEvent;
}

export function createTroveLiquidatedEvent(
  troveAddress: string,
  collateralTokenAddress: string,
  priceAtLiquidation: i32,
  stabilityPoolLiquidation: string,
  collateral: i32
): TroveLiquidated {
  let newEvent = changetype<TroveLiquidated>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("trove", ethereum.Value.fromAddress(Address.fromString(troveAddress)));
  let collateralTokenParam = new ethereum.EventParam(
    "collateralToken",
    ethereum.Value.fromAddress(Address.fromString(collateralTokenAddress))
  );
  let priceAtLiquidationParam = new ethereum.EventParam(
    "priceAtLiquidation",
    ethereum.Value.fromI32(priceAtLiquidation as i32)
  );
  let stabilityPoolLiquidationParam = new ethereum.EventParam(
    "stabilityPoolLiquidation",
    ethereum.Value.fromAddress(Address.fromString(stabilityPoolLiquidation))
  );
  let collateralParam = new ethereum.EventParam("collateral", ethereum.Value.fromI32(collateral));

  newEvent.parameters.push(troveParam);
  newEvent.parameters.push(collateralTokenParam);
  newEvent.parameters.push(priceAtLiquidationParam);
  newEvent.parameters.push(stabilityPoolLiquidationParam);
  newEvent.parameters.push(collateralParam);

  return newEvent;
}

export function createTroveDebtUpdateEvent(
  troveAddress: string,
  tokenAddress: string,
  actorAddress: string,
  newAmount: i32,
  troveDebtBaseRate: i32,
  newCollateralization: i32,
  feePaid: i32
): TroveDebtUpdate {
  let newEvent = changetype<TroveDebtUpdate>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("trove", ethereum.Value.fromAddress(Address.fromString(troveAddress)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(tokenAddress)));
  let actorParam = new ethereum.EventParam("actor", ethereum.Value.fromAddress(Address.fromString(actorAddress)));
  let newAmountParam = new ethereum.EventParam("newAmount", ethereum.Value.fromI32(newAmount));
  let troveDebtBaseRateParam = new ethereum.EventParam("newAmount", ethereum.Value.fromI32(troveDebtBaseRate));
  let newTroveCollateralizationParam = new ethereum.EventParam(
    "newCollateralization",
    ethereum.Value.fromI32(newCollateralization)
  );
  let feePaidParam = new ethereum.EventParam("feePaid", ethereum.Value.fromI32(feePaid));

  newEvent.parameters.push(troveParam);
  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(actorParam);
  newEvent.parameters.push(newAmountParam);
  newEvent.parameters.push(troveDebtBaseRateParam);
  newEvent.parameters.push(newTroveCollateralizationParam);
  newEvent.parameters.push(feePaidParam);

  return newEvent;
}

export function createTroveCollateralUpdateEvent(
  troveAddress: string,
  tokenAddress: string,
  newAmount: i32,
  newCollateralization: i32
): TroveCollateralUpdate {
  let newEvent = changetype<TroveCollateralUpdate>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("trove", ethereum.Value.fromAddress(Address.fromString(troveAddress)));
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(tokenAddress)));
  let newAmountParam = new ethereum.EventParam("newAmount", ethereum.Value.fromI32(newAmount));
  let newTroveCollateralizationParam = new ethereum.EventParam(
    "newCollateralization",
    ethereum.Value.fromI32(newCollateralization)
  );

  newEvent.parameters.push(troveParam);
  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(newAmountParam);
  newEvent.parameters.push(newTroveCollateralizationParam);

  return newEvent;
}
