//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/constants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ITroveFactory.sol";
import "./IMintableToken.sol";

interface IStabilityPoolBase {
  function factory() external view returns (ITroveFactory);

  function stableCoin() external view returns (IMintableToken);

  function bonqToken() external view returns (IERC20);

  function totalDeposit() external view returns (uint256);

  function withdraw(uint256 _amount) external;

  function deposit(uint256 _amount) external;

  function redeemReward() external;

  function liquidate() external;

  function setBONQPerMinute(uint256 _bonqPerMinute) external;

  function setBONQAmountForRewards() external;

  function getDepositorBONQGain(address _depositor) external view returns (uint256);

  function getWithdrawableDeposit(address staker) external view returns (uint256);
}
