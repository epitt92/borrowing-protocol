//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./IOwnable.sol";
import "./ITroveFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControlEnumerable.sol";

interface ITrove is IOwnable, IAccessControlEnumerable {
  function factory() external view returns (ITroveFactory);

  function token() external view returns (IERC20);

  // solhint-disable-next-line func-name-mixedcase
  function OWNER_ROLE() external view returns (bytes32);

  function addOwner(address _newOwner) external;

  function removeOwner(address _ownerToRemove) external;

  // solhint-disable-next-line func-name-mixedcase
  function TOKEN_PRECISION() external view returns (uint256);

  function mcr() external view returns (uint256);

  function collateralization() external view returns (uint256);

  function collateralValue() external view returns (uint256);

  function collateral() external view returns (uint256);

  function recordedCollateral() external view returns (uint256);

  function debt() external view returns (uint256);

  function liquidationReserve() external view returns (uint256);

  function netDebt() external view returns (uint256);

  function bonqStake() external view returns (uint256);

  //  function rewardRatioSnapshot() external view returns (uint256);

  function initialize(
    //    address _factory,
    address _token,
    address _troveOwner
  ) external;

  function increaseCollateral(uint256 _amount, address _newNextTrove) external;

  function decreaseCollateral(
    address _recipient,
    uint256 _amount,
    address _newNextTrove
  ) external;

  function unstakeBONQ(uint256 _amount) external;

  function borrow(
    address _recipient,
    uint256 _amount,
    address _newNextTrove
  ) external;

  function repay(uint256 _amount, address _newNextTrove) external;

  function redeem(address _recipient, address _newNextTrove) external returns (uint256 _stableAmount, uint256 _collateralRecieved);

  function setArbitrageParticipation(bool _state) external;

  function liquidate() external;
}
