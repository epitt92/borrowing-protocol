// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/constants.sol";
import "../interfaces/IRouter.sol";

contract TestRouter is Constants {
  event SwapToken(address token, uint256 balance, address thisAddress);

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
  ) public {
    for (uint256 i = 0; i < path.length - 1; i++) {
      IERC20 token = IERC20(path[i]);
      token.transfer(msg.sender, DECIMAL_PRECISION);
      emit SwapToken(path[i], token.balanceOf(address(this)), address(this));
    }
  }
}
