import { assert, clearStore, test } from "matchstick-as";
import {
  createDepositSnapshotUpdatedEvent,
  handleDepositSnapshotUpdated,
  createTotalBONQRewardsUpdateEvent,
  handleTotalBONQRewardsUpdate,
  createBONQRewardsPerMinuteUpdateEvent,
  handleBONQRewardsPerMinuteUpdate,
  createBONQRewardRedeemedEvent,
  handleBONQRewardRedemption
} from "../stability-pool.mapping";
import { getUniqueIdFromEvent } from "../helper";
import { Address } from "@graphprotocol/graph-ts";
import { createSPRewardRedeemedEvent, handleSPRewardRedemption } from "../stability-pool.mapping";

const WALLET_ENTITY_TYPE = "Wallet";
const DEPOSIT_HISTORY_ENTITY_TYPE = "StabilityPoolDepositHistory";
const STABILITY_POOL_GLOBALS_ENTITY_TYPE = "StabilityPoolGlobals";
const BONQ_REWARD_REDEMPTION_ENTITY_TYPE = "StabilityPoolBONQRewardRedemption";
const SP_REWARD_REDEMPTION_ENTITY_TYPE = "StabilityPoolRewardRedemption";

test("Can call deposit snapshot updated mapping with custom events", () => {
  // Initialise
  const depositor = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const newDepositValue = 100000000000 as i32;
  // Call mappings
  let depositSnapshotUpdatedEvent = createDepositSnapshotUpdatedEvent(depositor, 1 as i32, 1 as i32, newDepositValue);

  handleDepositSnapshotUpdated(depositSnapshotUpdatedEvent);

  assert.fieldEquals(WALLET_ENTITY_TYPE, depositor, "id", depositor);
  assert.fieldEquals(WALLET_ENTITY_TYPE, depositor, "stabilityPoolDeposit", newDepositValue.toString());

  handleDepositSnapshotUpdated(depositSnapshotUpdatedEvent);

  const id = getUniqueIdFromEvent(depositSnapshotUpdatedEvent);

  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "deposit", newDepositValue.toString());
  assert.fieldEquals(DEPOSIT_HISTORY_ENTITY_TYPE, id, "wallet", depositor);
  assert.fieldEquals(
    DEPOSIT_HISTORY_ENTITY_TYPE,
    id,
    "blockTimestamp",
    depositSnapshotUpdatedEvent.block.timestamp.toString()
  );

  clearStore();
});

test("Can call total bonq rewards update mapping with custom events", () => {
  // Initialise
  const newValue = 100000000000 as i32;
  // Call mappings
  let depositSnapshotUpdatedEvent = createTotalBONQRewardsUpdateEvent(newValue);

  const id = (depositSnapshotUpdatedEvent.transaction.to as Address).toHex();

  handleTotalBONQRewardsUpdate(depositSnapshotUpdatedEvent);

  assert.fieldEquals(STABILITY_POOL_GLOBALS_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(STABILITY_POOL_GLOBALS_ENTITY_TYPE, id, "totalBonqRewards", newValue.toString());

  clearStore();
});

test("Can call bonq reward per minute update mapping with custom events", () => {
  // Initialise
  const newValue = 100000000000 as i32;
  // Call mappings
  let BONQRewardsPerMinuteUpdatedEvent = createBONQRewardsPerMinuteUpdateEvent(newValue);

  const id = (BONQRewardsPerMinuteUpdatedEvent.transaction.to as Address).toHex();

  handleBONQRewardsPerMinuteUpdate(BONQRewardsPerMinuteUpdatedEvent);

  assert.fieldEquals(STABILITY_POOL_GLOBALS_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(STABILITY_POOL_GLOBALS_ENTITY_TYPE, id, "bonqRewardPerMinute", newValue.toString());

  clearStore();
});

test("Can call bonq reward redeemed mapping with custom events", () => {
  // Initialise
  const contributor = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const amount = 100000000000 as i32;
  // Call mappings
  let BONQRewardRedeemedEvent = createBONQRewardRedeemedEvent(contributor, amount);

  const id = getUniqueIdFromEvent(BONQRewardRedeemedEvent);

  handleBONQRewardRedemption(BONQRewardRedeemedEvent);

  assert.fieldEquals(BONQ_REWARD_REDEMPTION_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(BONQ_REWARD_REDEMPTION_ENTITY_TYPE, id, "wallet", contributor);
  assert.fieldEquals(BONQ_REWARD_REDEMPTION_ENTITY_TYPE, id, "amount", amount.toString());
  assert.fieldEquals(
    BONQ_REWARD_REDEMPTION_ENTITY_TYPE,
    id,
    "blockTimestamp",
    BONQRewardRedeemedEvent.block.timestamp.toString()
  );

  clearStore();
});

test("Can call sp reward redeemed mapping with custom events", () => {
  // Initialise
  const contributor = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const token = "0x2a71dc1247c1b70b053fe65189f5cd06a9654908";
  const amount = 100000000000 as i32;
  const price = 100000000000 as i32;
  // Call mappings
  let SPRewardRedeemedEvent = createSPRewardRedeemedEvent(contributor, token, amount, price);

  const id = getUniqueIdFromEvent(SPRewardRedeemedEvent);

  handleSPRewardRedemption(SPRewardRedeemedEvent);

  assert.fieldEquals(SP_REWARD_REDEMPTION_ENTITY_TYPE, id, "id", id);
  assert.fieldEquals(SP_REWARD_REDEMPTION_ENTITY_TYPE, id, "wallet", contributor);
  assert.fieldEquals(SP_REWARD_REDEMPTION_ENTITY_TYPE, id, "amount", amount.toString());
  assert.fieldEquals(SP_REWARD_REDEMPTION_ENTITY_TYPE, id, "price", price.toString());
  assert.fieldEquals(SP_REWARD_REDEMPTION_ENTITY_TYPE, id, "token", token);
  assert.fieldEquals(
    SP_REWARD_REDEMPTION_ENTITY_TYPE,
    id,
    "blockTimestamp",
    SPRewardRedeemedEvent.block.timestamp.toString()
  );

  clearStore();
});
