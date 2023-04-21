import { newMockEvent } from "matchstick-as/assembly/index";
import { ethereum, Address } from "@graphprotocol/graph-ts";
import { NewTokenPriceFeed, PriceUpdate } from "../generated/TokenToPriceFeed/TokenToPriceFeed";
import { Token } from "../generated/schema";

export function handleNewTokenPriceFeed(event: NewTokenPriceFeed): void {
  const id = event.params._token.toHex();
  let token = Token.load(id);
  if (token == null) {
    token = new Token(id);
  }
  token.name = event.params._name;
  token.symbol = event.params._symbol;
  token.mcr = event.params._mcr;
  token.save();
}

export function handlePriceUpdate(event: PriceUpdate): void {
  let token = Token.load(event.params.token.toHex());
  if (token !== null) {
    token.priceAverage = event.params.priceAverage;
    token.pricePoint = event.params.pricePoint;
    token.save();
  }
}

// ==============================================================
// Helper functions for tests
// --------------------------------------------------------------

export function createNewTokenPriceFeedEvent(token: string, name: string, symbol: string, mcr: i32): NewTokenPriceFeed {
  let newEvent = changetype<NewTokenPriceFeed>(newMockEvent());
  newEvent.parameters = new Array();
  let tokenParam = new ethereum.EventParam("_token", ethereum.Value.fromAddress(Address.fromString(token)));
  let priceFeedParam = new ethereum.EventParam("_priceFeed", ethereum.Value.fromAddress(Address.fromString(token)));
  let nameParam = new ethereum.EventParam("_name", ethereum.Value.fromString(name));
  let symbolParam = new ethereum.EventParam("_symbol", ethereum.Value.fromString(symbol));
  let mcrParam = new ethereum.EventParam("_mcr", ethereum.Value.fromI32(mcr));

  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(priceFeedParam);
  newEvent.parameters.push(nameParam);
  newEvent.parameters.push(symbolParam);
  newEvent.parameters.push(mcrParam);
  return newEvent;
}

export function createPriceUpdateEvent(tokenAddress: string, priceAverage: i32, pricePoint: i32): PriceUpdate {
  let newEvent = changetype<PriceUpdate>(newMockEvent());
  newEvent.parameters = new Array();
  let tokenParam = new ethereum.EventParam("token", ethereum.Value.fromAddress(Address.fromString(tokenAddress)));
  let priceAverageParam = new ethereum.EventParam("priceAverage", ethereum.Value.fromI32(priceAverage));
  let pricePointParam = new ethereum.EventParam("pricePoint", ethereum.Value.fromI32(pricePoint));

  newEvent.parameters.push(tokenParam);
  newEvent.parameters.push(priceAverageParam);
  newEvent.parameters.push(pricePointParam);

  return newEvent;
}
