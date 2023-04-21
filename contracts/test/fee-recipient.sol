//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/constants.sol";
import "../interfaces/IFeeRecipient.sol";

contract TestFeeRecipient is IFeeRecipient, Constants {
  IERC20 public feeToken;
  uint256 public override baseRate;

  // solhint-disable-next-line func-visibility
  constructor(address _feeToken) {
    feeToken = IERC20(_feeToken);
  }

  function calcDecayedBaseRate(uint256 _amount) public pure override returns (uint256) {
    return (_amount * ((DECIMAL_PRECISION * 5) / 1000)) / DECIMAL_PRECISION;
  }

  function getBorrowingFee(uint256 _amount) external view override returns (uint256) {
    return (_amount * (baseRate + ((DECIMAL_PRECISION * 5) / 1000))) / DECIMAL_PRECISION;
  }

  function takeFees(uint256 _amount) public override returns (bool) {
    return feeToken.transferFrom(msg.sender, address(this), _amount);
  }

  function increaseBaseRate(uint256 _increase) external override returns (uint256) {
    baseRate += _increase;
    return baseRate;
  }
}
