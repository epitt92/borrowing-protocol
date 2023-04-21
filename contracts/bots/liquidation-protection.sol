//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IServiceFeeGenerator.sol";
import "../interfaces/ITrove.sol";
import "../interfaces/IFeeRecipient.sol";
import "../interfaces/IServiceFeeGenerator.sol";
import "../utils/constants.sol";
import "../utils/BONQMath.sol";

abstract contract LiquidataionProtection is Ownable, Initializable, Constants {
  using BONQMath for uint256;

  ITrove public trove;
  IServiceFeeGenerator public serviceFeeGenerator;

  uint256 private floor = PERCENT124;
  uint256 private target = PERCENT125;

  constructor() {}

  function initialize(ITrove _trove, IServiceFeeGenerator _serviceFeeGenerator, uint _target) public initializer {
    trove = _trove;
    serviceFeeGenerator = _serviceFeeGenerator;
    target = _target;
  }

  /**
   * @dev sets the TCR for liquidation protection
   */
  function setTarget(uint _target) public onlyOwner {
    require(_target > floor, "evan407 target must be bigger than floor");
    target = _target;
  }
}
