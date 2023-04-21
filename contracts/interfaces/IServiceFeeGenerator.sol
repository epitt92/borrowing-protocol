//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ITrove.sol";
import "./IFeeRecipient.sol";

interface IServiceFeeGenerator {
  function trove() external view returns (ITrove);

  function feeRecipient() external view returns (IFeeRecipient);

  function feeAmount() external view returns (uint256);

  function feeInterval() external view returns (uint256);

  function lastPayTime() external view returns (uint256);

  function isPaid() external view returns (bool);

  function initialized() external view returns (bool);

  function initialize(
    ITrove _trove,
    uint256 _feeAmount,
    uint256 _feeInterval
  ) external;

  /**
   * @dev is called to check if the interval passed and pay fee in that case
   * takes fees as debt from the trove set
   */
  function withdrawFee(address _newNextTrove) external;

  event Activated(address indexed activator, address indexed trove, uint256 feeAmount, uint256 feeInterval);
  event FeeCollected(uint256 indexed periodStart, uint256 indexed periodEnd);
  event Deactivated(address indexed deactivator, uint256 indexed timestamp);
}
