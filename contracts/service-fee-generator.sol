//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IServiceFeeGenerator.sol";
import "./interfaces/ITrove.sol";
import "./interfaces/IFeeRecipient.sol";
import "./utils/constants.sol";

contract ServiceFeeGenerator is IServiceFeeGenerator, Initializable, Constants {
  ITroveFactory public immutable factory;
  ITrove public override trove;
  IFeeRecipient public override feeRecipient;
  uint256 public override feeAmount;
  uint256 public override feeInterval;
  bool public override initialized;

  uint256 public override lastPayTime;

  constructor(address _factory) {
    factory = ITroveFactory(_factory);
  }

  function initialize(
    ITrove _trove,
    uint256 _feeAmount,
    uint256 _feeInterval
  ) public override initializer {
    require(_feeAmount >= DECIMAL_PRECISION, "da69e0 fee amount must be gte 1 BEUR");
    require(_trove.hasRole(_trove.OWNER_ROLE(), address(this)), "da69e0 ownership is not granted");
    trove = _trove;
    feeAmount = _feeAmount;
    feeInterval = _feeInterval;
    initialized = true;
    feeRecipient = factory.feeRecipient();
    factory.stableCoin().approve(address(feeRecipient), MAX_INT);
    lastPayTime = block.timestamp - _feeInterval;
    emit Activated(_trove.owner(), address(_trove), _feeAmount, _feeInterval);
  }

  function isPaid() external view override returns (bool) {
    return lastPayTime + feeInterval > block.timestamp;
  }

  /**
   * @dev is called to transfer the fees to FeeRecipient when the interval time has passed. It will borrow on the trove to get the
   * fees from the msg.sender
   * The withdrawFee function must be called for each period. There is no compounding of fees
   * @param _newNextTrove hint for next position (same as for borrowing on trove)
   */
  function withdrawFee(address _newNextTrove) external override {
    require(initialized, "c93e1f contract must be initialized");
    require(this.isPaid() == false, "c93e1f fee is paid for current period");
    lastPayTime += feeInterval;
    trove.borrow(address(this), feeAmount, _newNextTrove);
    feeRecipient.takeFees(feeAmount);

    emit FeeCollected(lastPayTime - feeInterval, lastPayTime);
  }
}
