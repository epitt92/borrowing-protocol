//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../stability-pool-uniswap.sol";

contract ReplacementStabilityPoolUniswap is StabilityPoolUniswap {
  event NewReplacementEvent(string); // this

  constructor(address _factory, address _bonqToken) StabilityPoolUniswap(_factory, _bonqToken) {}

  /// test that we can update method
  function setRouterNew(address _router) public onlyOwner {
    router = IUniswapV3Router(_router);
    stableCoin.approve(_router, MAX_INT);
    emit NewReplacementEvent("Replacement test"); // this
  }
}
