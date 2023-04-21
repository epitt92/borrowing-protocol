// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../price-feeds/tellor-price-feed.sol";

contract TellorDataFeed is ITellorFeed {
  function getCurrentValue(bytes32 _queryId) external view returns (bytes memory _value) {
    return abi.encode(uint256(500_000_000_000_000_000));
  }
}
