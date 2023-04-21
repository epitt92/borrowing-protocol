// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./chainlink-price-feed.sol";

contract ConvertedPriceFeed is IPriceFeed, Constants {
  IPriceFeed public immutable priceFeed;
  IPriceFeed public immutable conversionPriceFeed;
  address public immutable override token;

  constructor(
    address _priceFeed,
    address _conversionPriceFeed,
    address _token
  ) {
    require(_priceFeed != address(0x0), "e2637b _priceFeed must not be address 0x0");
    require(_conversionPriceFeed != address(0x0), "e2637b _conversionPriceFeed must not be address 0x0");
    priceFeed = IPriceFeed(_priceFeed);
    conversionPriceFeed = IPriceFeed(_conversionPriceFeed);
    token = _token;
  }

  function price() public view override returns (uint256) {
    return (priceFeed.price() * DECIMAL_PRECISION) / conversionPriceFeed.price();
  }

  function pricePoint() public view override returns (uint256) {
    return price();
  }

  function emitPriceSignal() public {
    emit PriceUpdate(token, price(), price());
  }
}
