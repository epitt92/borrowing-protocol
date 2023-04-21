//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IOwnable.sol";
import "./IMintableToken.sol";

interface IArbitragePool is IOwnable {
  function collateralToAPToken(address) external returns (IMintableToken);

  function getAPtokenPrice(address _collateralToken) external view returns (uint256);

  function deposit(address _collateralToken, uint256 _amount) external;

  function withdraw(address _collateralToken, uint256 _amount) external;
}
