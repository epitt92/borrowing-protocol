import { assert, clearStore, test } from "matchstick-as";
import { getUniqueIdFromEvent } from "../helper";
import { Address } from "@graphprotocol/graph-ts";
import {
  createTotalBONQStakedUpdatedEvent,
  handleTotalBONQStakedUpdated,
  createStakeChangedEvent,
  handleStakeChanged,
  createFeeTakenEvent,
  handleFeeTaken,
  createRewardRedeemedEvent,
  handleRewardRedeemed
} from "../BONQ-staking.mapping";
import { BONQ_STAKING_GLOBALS_ID } from "../../constants";

const BONQ_STAKING_GLOBALS_TYPE = "BonqStakingGlobals";
const WALLET_ENTITY_TYPE = "Wallet";
const DEPOSIT_HISTORY_ENTITY_TYPE = "BonqStakingDepositHistory";
const FEES_TAKEN_HISTORY_ENTITY_TYPE = "FeesTakenHistory";
const BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE = "BonqStakingRewardRedemption";

test("Can call totalStake changed mapping with custom events", () => {
  // Initialise
  const newValue = 100000000000 as i32;
  // Call mappings
  let totalStakeChangedEvent = createTotalBONQStakedUpdatedEvent(newValue);

  handleTotalBONQStakedUpdated(totalStakeChangedEvent);

  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "id", BONQ_STAKING_GLOBALS_ID);
  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "totalStake", newValue.toString());

  clearStore();
});

test("Can call stake changed mapping with custom events", () => {
  // Initialise
  const staker = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const newValue = 100000000000 as i32;
  // Call mappings
  let stakeChangedEvent = createStakeChangedEvent(staker, newValue);

  handleStakeChanged(stakeChangedEvent);

  assert.fieldEquals(WALLET_ENTITY_TYPE, staker, "id", staker);
  assert.fieldEquals(WALLET_ENTITY_TYPE, staker, "bonqStakingStake", newValue.toString());

  handleStakeChanged(stakeChangedEvent);

  const id = getUniqueIdFromEvent(stakeChangedEvent);

  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "deposit", newValue.toString());
  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "wallet", staker);
  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "blockTimestamp", stakeChangedEvent.block.timestamp.toString());

  clearStore();
});

test("Can call fees taken mapping with custom events", () => {
  // Initialise
  const isRedemptionFee = true;
  const amount = 100000000000 as i32;
  // Call mappings
  let feeTakenEvent = createFeeTakenEvent(amount, amount * 2, isRedemptionFee);

  const id = getUniqueIdFromEvent(feeTakenEvent);

  handleFeeTaken(feeTakenEvent);

  assert.fieldEquals(FEES_TAKEN_HISTORY_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(FEES_TAKEN_HISTORY_ENTITY_TYPE, id, "amount", amount.toString());
  assert.fieldEquals(FEES_TAKEN_HISTORY_ENTITY_TYPE, id, "fStableCoin", (amount * 2).toString());
  assert.fieldEquals(FEES_TAKEN_HISTORY_ENTITY_TYPE, id, "isRedemptionFee", isRedemptionFee.toString());
  assert.fieldEquals(FEES_TAKEN_HISTORY_ENTITY_TYPE, id, "blockTimestamp", feeTakenEvent.block.timestamp.toString());

  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "id", BONQ_STAKING_GLOBALS_ID);
  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "totalRewards", amount.toString());

  clearStore();
});

test("Can call reward taken mapping with custom events", () => {
  // Initialise
  const staker = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const trove = "0x2a71dc1247c1b70b053fe65189f5cd06a9654908";
  const amount = 100000000000 as i32;
  // Call mappings
  let feeTakenEvent = createRewardRedeemedEvent(staker, trove, amount);

  const id = getUniqueIdFromEvent(feeTakenEvent);

  handleRewardRedeemed(feeTakenEvent);

  assert.fieldEquals(BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE, id, "amount", amount.toString());
  assert.fieldEquals(BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE, id, "trove", trove.toString());
  assert.fieldEquals(BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE, id, "wallet", staker.toString());
  assert.fieldEquals(
    BONQ_STAKING_REWARD_REDEMPTION_ENTITY_TYPE,
    id,
    "blockTimestamp",
    feeTakenEvent.block.timestamp.toString()
  );

  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "id", BONQ_STAKING_GLOBALS_ID);
  assert.fieldEquals(BONQ_STAKING_GLOBALS_TYPE, BONQ_STAKING_GLOBALS_ID, "totalHarvested", amount.toString());

  clearStore();
});
