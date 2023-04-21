//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../ITrove.sol";
import "../IServiceFeeGenerator.sol";

interface ILiquidationProtection {
  function initialize(ITrove _trove, IServiceFeeGenerator _serviceFeeGenerator) external;
}
