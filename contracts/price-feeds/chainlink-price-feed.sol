// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/ITokenPriceFeed.sol";
import "../utils/constants.sol";

contract ChainlinkPriceFeed is IPriceFeed, Constants {
  AggregatorV2V3Interface public immutable oracle;
  address public immutable override token;
  uint256 public immutable precision;

  constructor(address _oracle, address _token) {
    require(_oracle != address(0x0), "e2637b _oracle must not be address 0x0");
    require(_token != address(0x0), "e2637b _token must not be address 0x0");
    token = _token;
    oracle = AggregatorV2V3Interface(_oracle);
    uint8 decimals = oracle.decimals();
    require(decimals > 0, "e2637b decimals must be a positive number");
    precision = 10**decimals;
  }

  function price() public view virtual override returns (uint256) {
    return (uint256(oracle.latestAnswer()) * DECIMAL_PRECISION) / precision;
  }

  function pricePoint() public view override returns (uint256) {
    return price();
  }

  function emitPriceSignal() public override {
    emit PriceUpdate(token, price(), price());
  }
}
