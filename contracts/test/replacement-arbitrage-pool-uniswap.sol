//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../arbitrage-pool-uniswap.sol";

contract ReplacementArbitragePoolUniswap is ArbitragePoolUniswap {
  constructor(address _factory, address _router) ArbitragePoolUniswap(_factory, _router) {}

  function name() public view override returns (string memory) {
    return "ReplacementArbitragePoolUniswap";
  }
}
