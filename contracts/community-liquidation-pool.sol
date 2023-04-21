//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ILiquidationPool.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/ITrove.sol";
import "./interfaces/IMintableToken.sol";

/// @title is used in case when stabilityPool is empty or not enough to liquidate trove
contract CommunityLiquidationPool is ILiquidationPool, Constants {
  using SafeERC20 for IERC20;

  ITroveFactory public immutable factory;
  uint256 public override liqTokenRate = DECIMAL_PRECISION;
  uint256 public override collateral;
  uint256 public override debt;
  IERC20 public immutable collateralToken;

  // solhint-disable-next-line func-visibility
  constructor(address _factory, address _token) {
    require(_factory != address(0x0) && _token != address(0x0), "65151f no zero addresses");
    factory = ITroveFactory(_factory);
    collateralToken = IERC20(_token);
  }

  /// @dev to approve trove, and let it liquidate itself further
  /// @param _trove address of the trove
  function approveTrove(address _trove) public override {
    require(msg.sender == address(factory), "1b023 only the factory is allowed to call");
    collateralToken.approve(_trove, MAX_INT);
  }

  /// @dev to unapprove trove, forbid it to liquidate itself further
  /// @param _trove address of the trove
  function unapproveTrove(address _trove) public override {
    require(msg.sender == address(factory), "cfec3 only the factory is allowed to call");
    collateralToken.approve(_trove, 0);
  }

  /// @dev to transfer collateral and decrease collateral and debt in the pool
  /// @param _unclaimedCollateral unclaimed collateral calculated in the trove
  /// @param _unclaimedDebt the unclaimed debt calculated in the trove
  function claimCollateralAndDebt(uint256 _unclaimedCollateral, uint256 _unclaimedDebt) external override {
    IERC20 tokenCache = collateralToken;
    require(factory.containsTrove(address(tokenCache), msg.sender), "c0e31 must be called from a valid trove");
    collateral -= _unclaimedCollateral;
    debt -= _unclaimedDebt;

    tokenCache.safeTransfer(msg.sender, _unclaimedCollateral);
  }

  /// @dev liquidates the trove that called it
  function liquidate() external override {
    ITroveFactory factoryCache = factory;
    IERC20 tokenCache = collateralToken;
    require(factoryCache.troveCount(address(tokenCache)) > 1, "c0e35 the last trove can not be liquidated");
    require(factoryCache.containsTrove(address(tokenCache), msg.sender), "c0e35 must be called from a valid trove");
    ITrove trove = ITrove(msg.sender);
    uint256 troveCollateral = trove.recordedCollateral();
    collateral += troveCollateral;
    debt += trove.debt();
    uint256 factoryCollateral = factoryCache.totalCollateral(address(tokenCache));
    liqTokenRate += (troveCollateral * liqTokenRate) / (factoryCollateral - troveCollateral); // = (FactoryCollateral / prevLiqCollateral)

    tokenCache.safeTransferFrom(msg.sender, address(this), troveCollateral);

    factoryCache.emitLiquidationEvent(address(tokenCache), msg.sender, address(0), troveCollateral);
  }
}
