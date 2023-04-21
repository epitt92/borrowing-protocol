//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/constants.sol";

interface ILiquidationPool {
  function collateral() external view returns (uint256);

  function debt() external view returns (uint256);

  function liqTokenRate() external view returns (uint256);

  function claimCollateralAndDebt(uint256 _unclaimedCollateral, uint256 _unclaimedDebt) external;

  function approveTrove(address _trove) external;

  function unapproveTrove(address _trove) external;

  function liquidate() external;
}
