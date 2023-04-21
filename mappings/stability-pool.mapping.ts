import {
  StabilityPool,
  StabilityPoolBONQRewardRedemption,
  StabilityPoolDepositHistory,
  StabilityPoolGlobals,
  StabilityPoolRewardRedemption,
  Token,
  Wallet
} from "../generated/schema";
import {
  BONQPerMinuteUpdated,
  BONQRewardRedeemed,
  CollateralRewardRedeemed,
  Deposit,
  DepositSnapshotUpdated,
  TotalBONQRewardsUpdated,
  Withdraw,
} from "../generated/StabilityPool/StabilityPool";
import { newMockEvent } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { getUniqueIdFromEvent, toBigInt } from "./helper";
import { STABILITY_POOL_GLOBALS_ID } from "./constants";

function getSPGlobals(event: ethereum.Event): StabilityPoolGlobals {
  const id = STABILITY_POOL_GLOBALS_ID;
  let spGlobals = StabilityPoolGlobals.load(id);

  if (spGlobals == null) {
    spGlobals = new StabilityPoolGlobals(id);
    spGlobals.totalCollateralRedeemedValue = BigInt.fromI32(0);
    spGlobals.totalStake = BigInt.fromI32(0);
  }

  return spGlobals;
}

function getWallet(walletId: string): Wallet {
  let wallet = Wallet.load(walletId);
  if (wallet == null) {
    wallet = new Wallet(walletId);
  }
  return wallet;
}

export function handleStabilityPoolDeposit(event: Deposit): void {
  const wallet = getWallet(event.params._contributor.toHex());
  const spGlobals = getSPGlobals(event);
  const beurStake = toBigInt(wallet.beurStake);
  if (beurStake.equals(BigInt.fromI32(0))) {
    wallet.beurStake = event.params._amount;
    spGlobals.stakers = toBigInt(spGlobals.stakers).plus(BigInt.fromI32(1));
  } else {
    wallet.beurStake = event.params._amount.plus(beurStake);
  }
  // record the event for later listing
  const depositHistoryRecord = new StabilityPoolDepositHistory(getUniqueIdFromEvent(event));
  depositHistoryRecord.deposit = event.params._amount;
  depositHistoryRecord.blockTimestamp = event.block.timestamp;
  depositHistoryRecord.wallet = wallet.id;
  depositHistoryRecord.save();

  spGlobals.totalStake = toBigInt(spGlobals.totalStake).plus(event.params._amount);
  wallet.save();
  spGlobals.save();
}

export function handleStabilityPoolWithdrawal(event: Withdraw): void {
  const wallet = getWallet(event.params._contributor.toHex());
  const spGlobals = getSPGlobals(event);
  if (wallet.beurStake !== null) {
    wallet.beurStake = toBigInt(wallet.beurStake).minus(event.params._amount);
  }
  if (toBigInt(wallet.beurStake).equals(BigInt.fromI32(0))) {
    spGlobals.stakers = toBigInt(spGlobals.stakers).minus(BigInt.fromI32(1));
  }
  spGlobals.totalStake = toBigInt(spGlobals.totalStake).minus(event.params._amount);
  wallet.save();
  spGlobals.save();
}

export function handleTotalBONQRewardsUpdate(event: TotalBONQRewardsUpdated): void {
  const spGlobals = getSPGlobals(event);
  spGlobals.totalBonqRewards = event.params._newAmount;
  spGlobals.save();
}

export function handleBONQRewardsPerMinuteUpdate(event: BONQPerMinuteUpdated): void {
  const spGlobals = getSPGlobals(event);
  spGlobals.bonqRewardPerMinute = event.params._newAmount;
  spGlobals.save();
}

export function handleBONQRewardRedemption(event: BONQRewardRedeemed): void {
  const id = getUniqueIdFromEvent(event);
  let bonqRedemption = StabilityPoolBONQRewardRedemption.load(id);
  if (bonqRedemption == null) {
    bonqRedemption = new StabilityPoolBONQRewardRedemption(id);
  }
  const wallet = getWallet(event.params._contributor.toHex());
  bonqRedemption.wallet = wallet.id;
  bonqRedemption.amount = event.params._amount;
  bonqRedemption.blockTimestamp = event.block.timestamp;
  bonqRedemption.save();
}

export function handleSPRewardRedemption(event: CollateralRewardRedeemed): void {
  const id = getUniqueIdFromEvent(event);
  let spRedemption = StabilityPoolRewardRedemption.load(id);
  if (spRedemption == null) {
    spRedemption = new StabilityPoolRewardRedemption(id);
  }
  const wallet = getWallet(event.params._contributor.toHex());
  const tokenId = event.params._tokenAddress.toHex();
  let token = Token.load(tokenId);
  if (token == null) {
    token = new Token(tokenId);
  }
  const spGlobals = getSPGlobals(event);
  spGlobals.totalCollateralRedeemedValue = event.params._amount.times(event.params._collateralPrice)
      .plus(toBigInt(spGlobals.totalCollateralRedeemedValue));
  spRedemption.wallet = wallet.id;
  spRedemption.amount = event.params._amount;
  spRedemption.price = event.params._collateralPrice;
  spRedemption.token = token.id;
  spRedemption.blockTimestamp = event.block.timestamp;
  spRedemption.save();
  spGlobals.save();
}

// ==============================================================
// Helper functions for tests
// --------------------------------------------------------------

export function createSPRewardRedeemedEvent(
    contributor: string,
    tokenAddr: string,
    amount: i32,
    price: i32
): CollateralRewardRedeemed {
  let newEvent = changetype<CollateralRewardRedeemed>(newMockEvent());
  newEvent.parameters = new Array();
  let contributorParam = new ethereum.EventParam(
      "_contributor",
      ethereum.Value.fromAddress(Address.fromString(contributor))
  );
  let tokenParam = new ethereum.EventParam("_tokenAddress", ethereum.Value.fromAddress(Address.fromString(tokenAddr)));
  let amountParam = new ethereum.EventParam("_amount", ethereum.Value.fromI32(amount));
  let priceParam = new ethereum.EventParam("_collateralPrice", ethereum.Value.fromI32(price));

  newEvent.parameters.push(contributorParam);
  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(amountParam);
  newEvent.parameters.push(priceParam);
  return newEvent;
}

export function createBONQRewardRedeemedEvent(contributor: string, amount: i32): BONQRewardRedeemed {
  let newEvent = changetype<BONQRewardRedeemed>(newMockEvent());
  newEvent.parameters = new Array();
  let contributorParam = new ethereum.EventParam(
      "_contributor",
      ethereum.Value.fromAddress(Address.fromString(contributor))
  );
  let amountParam = new ethereum.EventParam("_amount", ethereum.Value.fromI32(amount));

  newEvent.parameters.push(contributorParam);
  newEvent.parameters.push(amountParam);
  return newEvent;
}

export function createBONQRewardsPerMinuteUpdateEvent(newAmount: i32): BONQPerMinuteUpdated {
  let newEvent = changetype<BONQPerMinuteUpdated>(newMockEvent());
  newEvent.parameters = new Array();
  let newAmountParam = new ethereum.EventParam("_newAmount", ethereum.Value.fromI32(newAmount));

  newEvent.parameters.push(newAmountParam);
  return newEvent;
}

export function createTotalBONQRewardsUpdateEvent(newAmount: i32): TotalBONQRewardsUpdated {
  let newEvent = changetype<TotalBONQRewardsUpdated>(newMockEvent());
  newEvent.parameters = new Array();
  let newAmountParam = new ethereum.EventParam("_newAmount", ethereum.Value.fromI32(newAmount));

  newEvent.parameters.push(newAmountParam);
  return newEvent;
}

export function createDepositSnapshotUpdatedEvent(
    depositor: string,
    P: i32,
    G: i32,
    newDepositValue: i32
): DepositSnapshotUpdated {
  let newEvent = changetype<DepositSnapshotUpdated>(newMockEvent());
  newEvent.parameters = new Array();
  let depositorParam = new ethereum.EventParam("_depositor", ethereum.Value.fromAddress(Address.fromString(depositor)));
  let pParam = new ethereum.EventParam("_P", ethereum.Value.fromI32(P));
  let gParam = new ethereum.EventParam("_G", ethereum.Value.fromI32(G));
  let newDepositValueParam = new ethereum.EventParam("_newDepositValue", ethereum.Value.fromI32(newDepositValue));

  newEvent.parameters.push(depositorParam);
  newEvent.parameters.push(pParam);
  newEvent.parameters.push(gParam);
  newEvent.parameters.push(newDepositValueParam);
  return newEvent;
}
