//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/IPriceFeed.sol";
import "../interfaces/ITokenPriceFeed.sol";

contract TestPriceFeed is IPriceFeed {
  address public override token;
  uint256 public override price;

  // solhint-disable-next-line func-visibility
  constructor(address _token) {
    token = _token;
    price = 10_000_000_000_000_000_000;
  }

  function setPrice(uint256 _price) public {
    price = _price;
  }

  function update(bool savePrevious) public {}

  function owner() public view returns (address) {
    return address(tx.origin);
  }

  function pricePoint() external view override returns (uint256) {
    return price;
  }

  function emitPriceSignal() public override {
    emit PriceUpdate(token, price, price);
  }
}
