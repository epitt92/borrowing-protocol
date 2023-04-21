import { BigInt } from "@graphprotocol/graph-ts";
import { assert, clearStore, test } from "matchstick-as";
import { Trove, Token } from "../../generated/schema";
import { getUniqueIdFromEvent } from "../helper";
import {
  handleTroveLiquidated,
  createTroveDebtUpdateEvent,
  handleTroveDebtUpdate,
  createTroveCollateralUpdateEvent,
  handleTroveCollateralUpdate,
  createNewTroveEvent,
  handleNewTrove,
  createTroveRemovedEvent,
  handleTroveRemoved,
  createTroveLiquidatedEvent,
  createRedemptionEvent,
  handleRedemption
} from "../trove-factory.mapping";

const TROVE_ENTITY_TYPE = "Trove";
const TROVE_DEBT_HISTORY_ENTITY_TYPE = "TroveDebtHistory";
const TOKEN_ENTITY_TYPE = "Token";
const TROVE_REDEMPTION_ENTITY_TYPE = "TroveRedemption";
const TROVE_LIQUIDATION_ENTITY_TYPE = "TroveLiquidation";

test("Can call new trove mapping with custom events", () => {
  // Initialise
  let trove = new Trove("troveId0");
  trove.save();
  let token = new Token("tokenId0");
  token.save();

  // Call mappings
  let newTroveEvent = createNewTroveEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    "0x5e402475e04bc56ef92816d93e58845c9ba40d0e"
  );

  let anotherTroveEvent = createNewTroveEvent(
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    "0x4b36de7d627846e8155337182325189391319136"
  );

  handleNewTrove(newTroveEvent);
  handleNewTrove(anotherTroveEvent);

  assert.fieldEquals(TROVE_ENTITY_TYPE, "troveId0", "id", "troveId0");
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    "id",
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908"
  );

  assert.fieldEquals(TOKEN_ENTITY_TYPE, "tokenId0", "id", "tokenId0");
  clearStore();
});

test("Can call remove trove mapping with custom events", () => {
  // Initialise
  let trove = new Trove("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  trove.save();

  // Call mappings
  let troveRemovedEvent = createTroveRemovedEvent("0xa5f61c4a800c681d86f435466264079ade0fe1f5");

  handleTroveRemoved(troveRemovedEvent);

  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(TROVE_ENTITY_TYPE, "0xa5f61c4a800c681d86f435466264079ade0fe1f5", "isRemoved", "true");
  clearStore();
});

test("Can call trove liquidated mapping with custom events", () => {
  // Initialise
  let trove = new Trove("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  trove.save();
  const priceAtLiquidation = 50000000000000 as i32;
  const collateral = 50000000000000 as i32;
  // Call mappings
  let troveLiquidatedEvent = createTroveLiquidatedEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    priceAtLiquidation,
    "0x2a71dc1247c1b70b053fe65189f5cd06a9650000",
    collateral
  );

  const id = getUniqueIdFromEvent(troveLiquidatedEvent);

  handleTroveLiquidated(troveLiquidatedEvent);

  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(TROVE_ENTITY_TYPE, "0xa5f61c4a800c681d86f435466264079ade0fe1f5", "isLiquidated", "true");
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "liquidatedByStabilityPool",
    "true"
  );
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "priceAtLiquidation",
    priceAtLiquidation.toString()
  );
  assert.fieldEquals(TROVE_LIQUIDATION_ENTITY_TYPE, id, "price", priceAtLiquidation.toString());
  assert.fieldEquals(TROVE_LIQUIDATION_ENTITY_TYPE, id, "collateral", collateral.toString());
  assert.fieldEquals(TROVE_LIQUIDATION_ENTITY_TYPE, id, "liquidatedByStabilityPool", "true");
  assert.fieldEquals(TROVE_LIQUIDATION_ENTITY_TYPE, id, "trove", trove.id);
  clearStore();
});

test("Can call trove debt update mapping with custom events", () => {
  // Initialise
  let trove = new Trove("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  trove.debt = BigInt.fromI32(5000000000000 as i32);
  trove.save();
  let troveDebt = 10000000000000 as i32;
  let troveDebtBaseRate = 100000000 as i32;
  let troveCollateralization = 1300000000000000000 as i32;
  let feePaid = 1300000000 as i32;
  // Call mappings
  let troveDebtUpdatedEvent = createTroveDebtUpdateEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "0x11996ee3f83a2123d52126ab70db78c5967f7744",
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    troveDebt,
    troveDebtBaseRate,
    troveCollateralization,
    feePaid
  );

  handleTroveDebtUpdate(troveDebtUpdatedEvent);

  const firstEventUniqueId = getUniqueIdFromEvent(troveDebtUpdatedEvent);

  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(TROVE_ENTITY_TYPE, "0xa5f61c4a800c681d86f435466264079ade0fe1f5", "debt", troveDebt.toString());
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "debtBaseRate",
    troveDebtBaseRate.toString()
  );
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "collateralization",
    troveCollateralization.toString()
  );

  assert.fieldEquals(TROVE_DEBT_HISTORY_ENTITY_TYPE, firstEventUniqueId, "action", "borrow");
  assert.fieldEquals(
    TROVE_DEBT_HISTORY_ENTITY_TYPE,
    firstEventUniqueId,
    "amount",
    (troveDebt - (trove.debt as BigInt).toI32()).toString()
  );
  assert.fieldEquals(TROVE_DEBT_HISTORY_ENTITY_TYPE, firstEventUniqueId, "debt", troveDebt.toString());
  assert.fieldEquals(
    TROVE_DEBT_HISTORY_ENTITY_TYPE,
    firstEventUniqueId,
    "actor",
    "0x11996ee3f83a2123d52126ab70db78c5967f7744"
  );
  assert.fieldEquals(
    TROVE_DEBT_HISTORY_ENTITY_TYPE,
    firstEventUniqueId,
    "trove",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );

  const newTroveDebt = 5000000000000 as i32;
  troveDebtBaseRate = 100000000 as i32;
  troveCollateralization = 1300000000000000000 as i32;
  feePaid = 1300000000 as i32;
  // Call mappings
  troveDebtUpdatedEvent = createTroveDebtUpdateEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    "0x11996ee3f83a2123d52126ab70db78c5967f7744",
    newTroveDebt,
    troveDebtBaseRate,
    troveCollateralization,
    feePaid
  );

  handleTroveDebtUpdate(troveDebtUpdatedEvent);

  const secondEventUniqueId = getUniqueIdFromEvent(troveDebtUpdatedEvent);

  assert.fieldEquals(TROVE_DEBT_HISTORY_ENTITY_TYPE, secondEventUniqueId, "action", "repay");
  assert.fieldEquals(
    TROVE_DEBT_HISTORY_ENTITY_TYPE,
    secondEventUniqueId,
    "amount",
    (troveDebt - newTroveDebt).toString()
  );
  assert.fieldEquals(TROVE_DEBT_HISTORY_ENTITY_TYPE, secondEventUniqueId, "debt", newTroveDebt.toString());
  clearStore();
});

test("Can call trove collateral update mapping with custom events", () => {
  // Initialise
  let trove = new Trove("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  trove.save();
  let token = new Token("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  token.save();
  const troveCollateral = 10000000000000 as i32;
  const troveCollateralization = 1300000000000000000 as i32;
  // Call mappings
  let troveLiquidatedEvent = createTroveCollateralUpdateEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    troveCollateral,
    troveCollateralization
  );

  handleTroveCollateralUpdate(troveLiquidatedEvent);

  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "collateral",
    troveCollateral.toString()
  );
  assert.fieldEquals(
    TROVE_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "collateralization",
    troveCollateralization.toString()
  );
  clearStore();
});

test("Can call redemption mapping with custom events", () => {
  // Initialise
  const stableAmount = 10000000000000 as i32;
  const tokenAmount = 99999999988899 as i32;
  const stableUnspent = 99999999988899 as i32;
  const startBaseRate = 99999999988899 as i32;
  const finishBaseRate = 99999999988899 as i32;

  // Call mappings
  let redemptionEvent = createRedemptionEvent(
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908",
    stableAmount,
    tokenAmount,
    stableUnspent,
    startBaseRate,
    finishBaseRate,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  const blockTimestamp = redemptionEvent.block.timestamp;

  const generatedId = redemptionEvent.transaction.hash.toHex().concat("-").concat(redemptionEvent.logIndex.toString());

  handleRedemption(redemptionEvent);

  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "id", generatedId);
  assert.fieldEquals(
    TROVE_REDEMPTION_ENTITY_TYPE,
    generatedId,
    "collateralToken",
    "0x2a71dc1247c1b70b053fe65189f5cd06a9654908"
  );
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "stableCoinRedeemed", stableAmount.toString());
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "collateralRedeemed", tokenAmount.toString());
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "stableCoinLeft", stableUnspent.toString());
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "startBaseRate", startBaseRate.toString());
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "finishBaseRate", finishBaseRate.toString());
  assert.fieldEquals(
    TROVE_REDEMPTION_ENTITY_TYPE,
    generatedId,
    "latestTroveRedeemed",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(TROVE_REDEMPTION_ENTITY_TYPE, generatedId, "blockTimestamp", blockTimestamp.toString());
  clearStore();
});
