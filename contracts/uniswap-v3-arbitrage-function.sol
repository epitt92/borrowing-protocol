//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./interfaces/uniswap/IUniswapV3Router.sol";

abstract contract UniswapV3Arbitrage {
  /// @dev use the DEX router to trigger a swap that starts and ends with the stable coin and yields more coins than it
  /// @dev requied as input. This function could be subject to a reentrant attack from a malicious token in the DEX
  /// @param  _amountIn start amount
  /// @param  _path calldata[]
  /// @param  _fees calldata[] fees array in correct order
  function _arbitrage(
    IUniswapV3Router router,
    uint256 _amountIn,
    address[] calldata _path,
    uint24[] calldata _fees,
    uint256 _deadline
  ) internal returns (uint256) {
    require(_path[0] == _path[_path.length - 1], "eafe9 must start and end with same coin");
    require(block.timestamp < _deadline || _deadline == 0, "eafe9 too late");

    IERC20 token = IERC20(_path[0]);
    // if the deadline was not set it is set to NOW - as the swap will happen in the same block it will be soon enough
    uint256 startBalance = token.balanceOf(address(this));
    // the swap must yield at least 1 coin (in ETH parlance: 1 Wei) more than what was put in and the TX has 10 minutes to execute
    IUniswapV3Router.ExactInputParams memory swapParams = IUniswapV3Router.ExactInputParams(_constructUniswapPath(_path, _fees), address(this), _amountIn, _amountIn + 1);
    router.exactInput(swapParams);
    uint256 amountOut = token.balanceOf(address(this)) - startBalance;
    return amountOut;
  }

  /// @dev constructs uniswap swap path from arrays of tokens and pool fees
  /// @param  _path address[] of tokens
  /// @param  _fees uint24[] of pool fees
  function _constructUniswapPath(address[] memory _path, uint24[] memory _fees) private pure returns (bytes memory pathBytesString) {
    pathBytesString = abi.encodePacked(_path[0]);
    for (uint256 i = 0; i < _fees.length; i++) {
      pathBytesString = abi.encodePacked(pathBytesString, _fees[i], _path[i + 1]);
    }
  }
}
