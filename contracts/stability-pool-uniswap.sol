//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./interfaces/IStabilityPoolUniswap.sol";
import "./interfaces/uniswap/IUniswapV3Router.sol";
import "./stability-pool-base.sol";
import "./uniswap-v3-arbitrage-function.sol";

/// @title is used to liquidate troves and reward depositors with collateral redeemed
contract StabilityPoolUniswap is StabilityPoolBase, IStabilityPoolUniswap, UniswapV3Arbitrage {
  IUniswapV3Router public router;

  constructor(address _factory, address _bonqToken) StabilityPoolBase(_factory, _bonqToken) {}

  /// @dev use the DEX router to trigger a swap that starts and ends with the stable coin and yields more coins than it
  /// @dev requied as input. This function could be subject to a reentrant attack from a malicious token in the DEX
  /// @param  _amountIn start amount
  /// @param  _path calldata[]
  /// @param  _fees calldata[] fees array in correct order
  function arbitrage(
    uint256 _amountIn,
    address[] calldata _path,
    uint24[] calldata _fees,
    uint256 _deadline
  ) public override nonReentrant returns (uint256) {
    uint256 amountOut;
    amountOut = _arbitrage(router, _amountIn, _path, _fees, _deadline);
    uint256 senderShare = (amountOut * factory.arbitrageShareRatio()) / DECIMAL_PRECISION;
    amountOut -= senderShare;
    stableCoin.transfer(msg.sender, senderShare);
    totalDeposit += amountOut;
    // increase P by the arbitrage gain / total deposit
    _updateP((amountOut * DECIMAL_PRECISION) / totalDeposit, false);
    emit Arbitrage(_path, _amountIn, amountOut);
    emit TotalDepositUpdated(totalDeposit);
    return amountOut;
  }

  /// @dev set the DEX router to be used for arbitrage functions
  function setRouter(address _router) public override onlyOwner {
    router = IUniswapV3Router(_router);
    stableCoin.approve(_router, MAX_INT);
  }
}
