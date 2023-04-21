//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./IStabilityPoolBase.sol";

interface IStabilityPool is IStabilityPoolBase {
  function arbitrage(
    uint256 _amountIn,
    address[] calldata _path,
    uint256 _deadline
  ) external;

  function setRouter(address _router) external;
}
