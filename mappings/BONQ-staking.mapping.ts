import { newMockEvent } from "matchstick-as/assembly/index";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { getUniqueIdFromEvent, toBigInt } from "./helper";
import { StakeChanged, TotalBONQStakedUpdated, FeeTaken, RewardRedeemed } from "../generated/BONQStaking/BONQStaking";
import {
  Wallet,
  BonqStakingGlobals,
  FeesTakenHistory,
  BonqStakingDepositHistory,
  BonqStakingRewardRedemption,
  Trove
} from "../generated/schema";
import { BONQ_STAKING_GLOBALS_ID } from "./constants";

function getBonqGlobals(): BonqStakingGlobals {
  let bonqGlobals = BonqStakingGlobals.load(BONQ_STAKING_GLOBALS_ID);
  if (bonqGlobals == null) {
    bonqGlobals = new BonqStakingGlobals(BONQ_STAKING_GLOBALS_ID);
  }
  return bonqGlobals;
}

export function handleStakeChanged(event: StakeChanged): void {
  const bonqGlobals = getBonqGlobals();
  const id = event.params._staker.toHex();
  let wallet = Wallet.load(id);
  if (wallet == null) {
    wallet = new Wallet(id);
  }

  if(toBigInt(wallet.bonqStake).equals(BigInt.fromI32(0)) && event.params._newStake.gt(BigInt.fromI32(0))) {
    bonqGlobals.stakers = toBigInt(bonqGlobals.stakers).plus(BigInt.fromI32(1))
  }

  if(toBigInt(wallet.bonqStake).gt(BigInt.fromI32(0)) && event.params._newStake.equals(BigInt.fromI32(0))) {
    bonqGlobals.stakers = toBigInt(bonqGlobals.stakers).minus(BigInt.fromI32(1))
  }

  wallet.bonqStake = event.params._newStake;

  const depositHistoryRecord = new BonqStakingDepositHistory(getUniqueIdFromEvent(event));
  depositHistoryRecord.deposit = event.params._newStake;
  depositHistoryRecord.blockTimestamp = event.block.timestamp;
  depositHistoryRecord.wallet = wallet.id;
  depositHistoryRecord.save();

  wallet.save();
  bonqGlobals.save();
}

export function handleTotalBONQStakedUpdated(event: TotalBONQStakedUpdated): void {
  const bonqGlobals = getBonqGlobals();
  bonqGlobals.totalStake = event.params._totalBONQStaked;
  bonqGlobals.save();
}

export function handleFeeTaken(event: FeeTaken): void {
  const id = getUniqueIdFromEvent(event);
  const feeTakenHistory = new FeesTakenHistory(id);
  feeTakenHistory.amount = event.params._amount;
  feeTakenHistory.fStableCoin = event.params._F_StableCoin;
  feeTakenHistory.isRedemptionFee = event.params._redemptionFee;
  feeTakenHistory.blockTimestamp = event.block.timestamp;
  feeTakenHistory.save();

  let bonqGlobals = BonqStakingGlobals.load(BONQ_STAKING_GLOBALS_ID);
  if (bonqGlobals == null) {
    bonqGlobals = new BonqStakingGlobals(BONQ_STAKING_GLOBALS_ID);
  }
  bonqGlobals.totalRewards = toBigInt(bonqGlobals.totalRewards).plus(event.params._amount);
  bonqGlobals.save();
}

export function handleRewardRedeemed(event: RewardRedeemed): void {
  const id = getUniqueIdFromEvent(event);
  const walletId = event.params._account.toHex();
  const troveId = event.params._troveAddress.toHex();
  const rewardRedemptionRecord = new BonqStakingRewardRedemption(id);
  let wallet = Wallet.load(walletId);
  if (wallet == null) {
    wallet = new Wallet(walletId);
    wallet.save();
  }
  let trove = Trove.load(troveId);
  if (trove == null) {
    trove = new Trove(troveId);
    trove.save();
  }
  rewardRedemptionRecord.amount = event.params._stableAmount;
  rewardRedemptionRecord.wallet = wallet.id;
  rewardRedemptionRecord.trove = trove.id;
  rewardRedemptionRecord.blockTimestamp = event.block.timestamp;
  rewardRedemptionRecord.save();

  let bonqGlobals = BonqStakingGlobals.load(BONQ_STAKING_GLOBALS_ID);
  if (bonqGlobals == null) {
    bonqGlobals = new BonqStakingGlobals(BONQ_STAKING_GLOBALS_ID);
  }
  bonqGlobals.totalHarvested = toBigInt(bonqGlobals.totalHarvested).plus(event.params._stableAmount);
  bonqGlobals.save();
}

// ==============================================================
// Helper functions for tests
// --------------------------------------------------------------

export function createTotalBONQStakedUpdatedEvent(newTotalStake: i32): TotalBONQStakedUpdated {
  let newEvent = changetype<TotalBONQStakedUpdated>(newMockEvent());
  newEvent.parameters = new Array();
  let newTotalStakeParam = new ethereum.EventParam("_totalBONQStaked", ethereum.Value.fromI32(newTotalStake));

  newEvent.parameters.push(newTotalStakeParam);
  return newEvent;
}

export function createStakeChangedEvent(staker: string, newStake: i32): StakeChanged {
  let newEvent = changetype<StakeChanged>(newMockEvent());
  newEvent.parameters = new Array();
  let stakerParam = new ethereum.EventParam("_staker", ethereum.Value.fromAddress(Address.fromString(staker)));
  let newStakeParam = new ethereum.EventParam("_newStake", ethereum.Value.fromI32(newStake));

  newEvent.parameters.push(stakerParam);
  newEvent.parameters.push(newStakeParam);
  return newEvent;
}

export function createFeeTakenEvent(amount: i32, fStableAmount: i32, isRedemptionFee: boolean): FeeTaken {
  let newEvent = changetype<FeeTaken>(newMockEvent());
  newEvent.parameters = new Array();
  let amountParam = new ethereum.EventParam("_amount", ethereum.Value.fromI32(amount));
  let fStableParam = new ethereum.EventParam("_F_StableCoin", ethereum.Value.fromI32(fStableAmount));
  let isRedemptionFeeParam = new ethereum.EventParam("_redemptionFee", ethereum.Value.fromBoolean(isRedemptionFee));

  newEvent.parameters.push(amountParam);
  newEvent.parameters.push(fStableParam);
  newEvent.parameters.push(isRedemptionFeeParam);
  return newEvent;
}

export function createRewardRedeemedEvent(account: string, trove: string, stableAmount: i32): RewardRedeemed {
  let newEvent = changetype<RewardRedeemed>(newMockEvent());
  newEvent.parameters = new Array();
  let troveParam = new ethereum.EventParam("_troveAddress", ethereum.Value.fromAddress(Address.fromString(trove)));
  let accountParam = new ethereum.EventParam("_account", ethereum.Value.fromAddress(Address.fromString(account)));
  let stableAmountParam = new ethereum.EventParam("_stableAmount", ethereum.Value.fromI32(stableAmount));

  newEvent.parameters.push(accountParam);
  newEvent.parameters.push(stableAmountParam);
  newEvent.parameters.push(troveParam);
  return newEvent;
}
