import { assert, clearStore, test } from "matchstick-as";
import { Token } from "../../generated/schema";
import {
  createNewTokenPriceFeedEvent,
  handleNewTokenPriceFeed,
  handlePriceUpdate,
  createPriceUpdateEvent
} from "../token-to-price-feed.mapping";

const TOKEN_ENTITY_TYPE = "Token";

test("Can call stake changed mapping with custom events", () => {
  // Initialise
  const token = "0xa5f61c4a800c681d86f435466264079ade0fe1f5";
  const name = "token";
  const symbol = "TT";
  const mcr = 100000000000 as i32;
  // Call mappings
  let stakeChangedEvent = createNewTokenPriceFeedEvent(token, name, symbol, mcr);

  handleNewTokenPriceFeed(stakeChangedEvent);

  assert.fieldEquals(TOKEN_ENTITY_TYPE, token, "id", token);
  assert.fieldEquals(TOKEN_ENTITY_TYPE, token, "name", name);
  assert.fieldEquals(TOKEN_ENTITY_TYPE, token, "symbol", symbol);
  assert.fieldEquals(TOKEN_ENTITY_TYPE, token, "mcr", mcr.toString());

  clearStore();
});

test("Can call token price update mapping with custom events", () => {
  // Initialise
  let token = new Token("0xa5f61c4a800c681d86f435466264079ade0fe1f5");
  token.save();

  const priceAverage = 10000000000000 as i32;
  const pricePoint = 99999999988899 as i32;
  // Call mappings
  let troveLiquidatedEvent = createPriceUpdateEvent(
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    priceAverage,
    pricePoint
  );

  handlePriceUpdate(troveLiquidatedEvent);

  assert.fieldEquals(
    TOKEN_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "id",
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5"
  );
  assert.fieldEquals(
    TOKEN_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "priceAverage",
    priceAverage.toString()
  );
  assert.fieldEquals(
    TOKEN_ENTITY_TYPE,
    "0xa5f61c4a800c681d86f435466264079ade0fe1f5",
    "pricePoint",
    pricePoint.toString()
  );
  clearStore();
});
