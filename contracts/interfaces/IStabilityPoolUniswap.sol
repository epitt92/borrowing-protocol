//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./IStabilityPoolBase.sol";

interface IStabilityPoolUniswap is IStabilityPoolBase {
  function arbitrage(
    uint256 _amountIn,
    address[] calldata _path,
    uint24[] calldata _fees,
    uint256 expiry
  ) external returns (uint256);

  function setRouter(address _router) external;
}
