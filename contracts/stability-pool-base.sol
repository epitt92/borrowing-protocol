//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IStabilityPoolBase.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/ITrove.sol";
import "./interfaces/IMintableToken.sol";
import "./utils/BONQMath.sol";
import "./interfaces/IRouter.sol";

/// @title is used to liquidate troves and reward depositors with collateral redeemed
contract StabilityPoolBase is IStabilityPoolBase, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, Constants {
  using BONQMath for uint256;
  using SafeERC20 for IERC20;

  struct TokenToS {
    address tokenAddress;
    uint256 S_value;
  }

  struct TokenToUint256 {
    address tokenAddress;
    uint256 value;
  }

  struct Snapshots {
    TokenToS[] tokenToSArray;
    uint256 P;
    uint256 G;
    uint128 scale;
    uint128 epoch;
  }

  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  ITroveFactory public immutable override factory;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  IMintableToken public immutable override stableCoin;
  /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
  IERC20 public immutable override bonqToken;

  uint256 public override totalDeposit;

  mapping(address => uint256) public collateralToLastErrorOffset;
  uint256 public lastStableCoinLossErrorOffset;

  mapping(address => uint256) public deposits;
  mapping(address => Snapshots) public depositSnapshots; // depositor address -> snapshots struct

  uint256 public bonqPerMinute;
  uint256 public totalBONQRewardsLeft;
  uint256 public latestBONQRewardTime;
  // Error tracker for the error correction in the BONQ redistribution calculation
  uint256 public lastBONQError;
  /*  Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit,
   * after a series of liquidations have occurred, each of which cancel some StableCoin debt with the deposit.
   *
   * During its lifetime, a deposit's value evolves from d_t to d_t * P / P_t , where P_t
   * is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.
   */
  uint256 public P;

  uint256 public constant SCALE_FACTOR = 1e9;

  uint256 public constant SECONDS_IN_ONE_MINUTE = 60;

  // Each time the scale of P shifts by SCALE_FACTOR, the scale is incremented by 1
  uint128 public currentScale;

  // With each offset that fully empties the Pool, the epoch is incremented by 1
  uint128 public currentEpoch;

  /* Collateral Gain sum 'S': During its lifetime, each deposit d_t earns an Collateral gain of ( d_t * [S - S_t] )/P_t, where S_t
   * is the depositor's snapshot of S taken at the time t when the deposit was made.
   *
   * The 'S' sums are stored in a nested mapping (epoch => scale => sum):
   *
   * - The inner mapping records the sum S at different scales
   * - The outer mapping records the (scale => sum) mappings, for different epochs.
   */
  mapping(uint128 => mapping(uint128 => TokenToS[])) public epochToScaleToTokenToSum;

  /*
   * Similarly, the sum 'G' is used to calculate BONQ gains. During it's lifetime, each deposit d_t earns a BONQ gain of
   *  ( d_t * [G - G_t] )/P_t, where G_t is the depositor's snapshot of G taken at time t when  the deposit was made.
   *
   *  BONQ reward events occur are triggered by depositor operations (new deposit, topup, withdrawal), and liquidations.
   *  In each case, the BONQ reward is issued (i.e. G is updated), before other state changes are made.
   */
  mapping(uint128 => mapping(uint128 => uint256)) public epochToScaleToG;

  event Deposit(address _contributor, uint256 _amount);
  event TotalDepositUpdated(uint256 _newValue);
  event Withdraw(address _contributor, uint256 _amount);
  event Arbitrage(address[] _path, uint256 _amountIn, uint256 _amountOut);

  // solhint-disable-next-line event-name-camelcase
  event BONQRewardRedeemed(address _contributor, uint256 _amount);
  event BONQRewardIssue(uint256 issuance, uint256 _totalBONQRewardsLeft);
  event BONQPerMinuteUpdated(uint256 _newAmount);
  event TotalBONQRewardsUpdated(uint256 _newAmount);
  // solhint-disable-next-line event-name-camelcase
  event CollateralRewardRedeemed(address _contributor, address _tokenAddress, uint256 _amount, uint256 _collateralPrice);
  event DepositSnapshotUpdated(address indexed _depositor, uint256 _P, uint256 _G, uint256 _newDepositValue);

  /* solhint-disable event-name-camelcase */
  event P_Updated(uint256 _P);
  event S_Updated(address _tokenAddress, uint256 _S, uint128 _epoch, uint128 _scale);
  event G_Updated(uint256 _G, uint128 _epoch, uint128 _scale);
  /* solhint-disable event-name-camelcase */
  event EpochUpdated(uint128 _currentEpoch);
  event ScaleUpdated(uint128 _currentScale);

  /// @custom:oz-upgrades-unsafe-allow constructor state-variable-immutable
  constructor(address _factory, address _bonqToken) {
    require(_factory != address(0x0), "3f8955 trove factory must not be address 0x0");
    require(_bonqToken != address(0x0), "3f8955 bonq token must not be address 0x0");
    factory = ITroveFactory(_factory);
    stableCoin = IMintableToken(address(ITroveFactory(_factory).stableCoin()));
    bonqToken = IERC20(_bonqToken);
    // to prevent contract implementation to be reinitialized by someone else
    _disableInitializers();
  }

  function initialize() public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    P = DECIMAL_PRECISION;
  }

  /// @dev make the contract upgradeable by its owner
  function _authorizeUpgrade(address) internal override onlyOwner {}

  /// @dev to deposit StableCoin into StabilityPool this must be protected against a reentrant attack from the arbitrage
  /// @param  _amount amount to deposit
  function deposit(uint256 _amount) public override nonReentrant {
    // address depositor = msg.sender;
    require(_amount > 0, "d87c1 deposit amount must be bigger than zero");

    stableCoin.transferFrom(msg.sender, address(this), _amount);
    uint256 initialDeposit = deposits[msg.sender];
    _redeemReward();

    Snapshots memory snapshots = depositSnapshots[msg.sender];

    uint256 compoundedDeposit = _getCompoundedDepositFromSnapshots(initialDeposit, snapshots);
    // uint256 newValue = compoundedDeposit + _amount;
    uint256 newTotalDeposit = totalDeposit + _amount;
    totalDeposit = newTotalDeposit;

    _updateDepositAndSnapshots(msg.sender, compoundedDeposit + _amount);

    emit Deposit(msg.sender, _amount);
    emit TotalDepositUpdated(newTotalDeposit);
  }

  /// @dev to withdraw StableCoin that was not spent if this function is called in a reentrantway during arbitrage  it
  /// @dev would skew the token allocation and must be protected against
  /// @param  _amount amount to withdraw
  function withdraw(uint256 _amount) public override nonReentrant {
    uint256 contributorDeposit = deposits[msg.sender];
    require(_amount > 0, "f6c8a withdrawal amount must be bigger than 0");
    require(contributorDeposit > 0, "f6c8a user has no deposit");
    _redeemReward();

    Snapshots memory snapshots = depositSnapshots[msg.sender];

    uint256 compoundedDeposit = _getCompoundedDepositFromSnapshots(contributorDeposit, snapshots);
    uint256 calculatedAmount = compoundedDeposit.min(_amount);

    uint256 newValue = compoundedDeposit - calculatedAmount;

    totalDeposit = totalDeposit - calculatedAmount;

    _updateDepositAndSnapshots(msg.sender, newValue);

    stableCoin.transfer(msg.sender, calculatedAmount);
    emit Withdraw(msg.sender, calculatedAmount);
    emit TotalDepositUpdated(totalDeposit);
  }

  /// @dev to withdraw collateral rewards earned after liquidations
  /// @dev this function does not provide an opportunity for a reentrancy attack
  function redeemReward() public override {
    Snapshots memory snapshots = depositSnapshots[msg.sender];
    uint256 contributorDeposit = deposits[msg.sender];

    uint256 compoundedDeposit = _getCompoundedDepositFromSnapshots(contributorDeposit, snapshots);
    _redeemReward();
    _updateDepositAndSnapshots(msg.sender, compoundedDeposit);
  }

  /// @dev liquidates trove, must be called from that trove
  /// @dev this function does not provide an opportunity for a reentrancy attack even though it would make the arbitrage
  /// @dev fail because of the lowering of the stablecoin balance
  /// @notice must be called by the valid trove
  function liquidate() public override {
    ITrove trove = ITrove(msg.sender);
    IERC20 collateralToken = IERC20(trove.token());
    address collateralTokenAddress = address(collateralToken);
    ITroveFactory factory_cached = factory;
    require(factory_cached.containsTrove(address(collateralToken), msg.sender), "StabilityPool:liquidate: must be called from a valid trove");
    uint256 troveDebt = trove.debt();
    uint256 totalStableCoin = totalDeposit; // cached to save an SLOAD
    uint256 troveCollateral = trove.collateral();

    collateralToken.safeTransferFrom(address(trove), address(this), troveCollateral);
    (uint256 collateralGainPerUnitStaked, uint256 stableCoinLossPerUnitStaked) = _computeRewardsPerUnitStaked(collateralTokenAddress, troveCollateral, troveDebt, totalStableCoin);
    _updateRewardSumAndProduct(collateralTokenAddress, collateralGainPerUnitStaked, stableCoinLossPerUnitStaked);
    _triggerBONQdistribution();

    stableCoin.burn(troveDebt);
    uint256 newTotalDeposit = totalStableCoin - troveDebt;
    totalDeposit = newTotalDeposit;
    emit TotalDepositUpdated(newTotalDeposit);
    factory_cached.emitLiquidationEvent(address(collateralToken), msg.sender, address(this), troveCollateral);
  }

  /// @dev gets current deposit of msg.sender
  function getWithdrawableDeposit(address staker) public view override returns (uint256) {
    uint256 initialDeposit = deposits[staker];
    Snapshots memory snapshots = depositSnapshots[staker];
    return _getCompoundedDepositFromSnapshots(initialDeposit, snapshots);
  }

  /// @dev gets collateral reward of msg.sender
  /// @param _token collateral token address
  function getCollateralReward(address _token, address _depositor) external view returns (uint256) {
    Snapshots memory _snapshots = depositSnapshots[_depositor];
    uint256 _initialDeposit = deposits[_depositor];

    uint128 epochSnapshot = _snapshots.epoch;
    uint128 scaleSnapshot = _snapshots.scale;

    TokenToS[] memory tokensToSum_cached = epochToScaleToTokenToSum[epochSnapshot][scaleSnapshot];
    uint256 tokenArrayLength = tokensToSum_cached.length;

    TokenToS memory cachedS;
    for (uint128 i = 0; i < tokenArrayLength; i++) {
      TokenToS memory S = tokensToSum_cached[i];
      if (S.tokenAddress == _token) {
        cachedS = S;
        break;
      }
    }
    if (cachedS.tokenAddress == address(0)) return 0;
    uint256 relatedSValue_snapshot;
    for (uint128 i = 0; i < _snapshots.tokenToSArray.length; i++) {
      TokenToS memory S_snapsot = _snapshots.tokenToSArray[i];
      if (S_snapsot.tokenAddress == _token) {
        relatedSValue_snapshot = S_snapsot.S_value;
        break;
      }
    }
    TokenToS[] memory nextTokensToSum_cached = epochToScaleToTokenToSum[epochSnapshot][scaleSnapshot + 1];
    uint256 nextScaleS;
    for (uint128 i = 0; i < nextTokensToSum_cached.length; i++) {
      TokenToS memory nextScaleTokenToS = nextTokensToSum_cached[i];
      if (nextScaleTokenToS.tokenAddress == _token) {
        nextScaleS = nextScaleTokenToS.S_value;
        break;
      }
    }

    uint256 P_Snapshot = _snapshots.P;

    uint256 collateralGain = _getCollateralGainFromSnapshots(_initialDeposit, cachedS.S_value, nextScaleS, relatedSValue_snapshot, P_Snapshot);

    return collateralGain;
  }

  /// @dev gets BONQ reward of _depositor
  /// @param _depositor user address
  function getDepositorBONQGain(address _depositor) external view override returns (uint256) {
    uint256 totalBONQRewardsLeft_cached = totalBONQRewardsLeft;
    uint256 totalStableCoin = totalDeposit;
    if (totalBONQRewardsLeft_cached == 0 || bonqPerMinute == 0 || totalStableCoin == 0) {
      return 0;
    }

    uint256 _bonqIssuance = bonqPerMinute * ((block.timestamp - latestBONQRewardTime) / SECONDS_IN_ONE_MINUTE);
    if (totalBONQRewardsLeft_cached < _bonqIssuance) {
      _bonqIssuance = totalBONQRewardsLeft_cached;
    }

    uint256 bonqGain = (_bonqIssuance * DECIMAL_PRECISION + lastBONQError) / totalStableCoin;
    uint256 marginalBONQGain = bonqGain * P;

    return _getDepositorBONQGain(_depositor, marginalBONQGain);
  }

  /// @dev sets amount of BONQ per minute for rewards
  function setBONQPerMinute(uint256 _bonqPerMinute) external override onlyOwner {
    _triggerBONQdistribution();
    bonqPerMinute = _bonqPerMinute;
    emit BONQPerMinuteUpdated(bonqPerMinute);
  }

  /// @dev sets total amount of BONQ to be rewarded (pays per minute until reaches the amount rewarded)
  function setBONQAmountForRewards() external override onlyOwner {
    _triggerBONQdistribution();
    totalBONQRewardsLeft = bonqToken.balanceOf(address(this));
    emit TotalBONQRewardsUpdated(totalBONQRewardsLeft);
  }

  function _redeemReward() private {
    _redeemCollateralReward();
    _triggerBONQdistribution();
    _redeemBONQReward();
  }

  function _redeemCollateralReward() internal {
    address depositor = msg.sender;
    TokenToUint256[] memory depositorCollateralGains = _getDepositorCollateralGains(depositor);
    _sendCollateralRewardsToDepositor(depositorCollateralGains);
  }

  function _redeemBONQReward() internal {
    address depositor = msg.sender;
    uint256 depositorBONQGain = _getDepositorBONQGain(depositor, 0);
    _sendBONQRewardsToDepositor(depositorBONQGain);
    emit BONQRewardRedeemed(depositor, depositorBONQGain);
  }

  /// @dev updates user deposit snapshot data for new deposit value
  function _updateDepositAndSnapshots(address _depositor, uint256 _newValue) private {
    deposits[_depositor] = _newValue;
    if (_newValue == 0) {
      delete depositSnapshots[_depositor];
      emit DepositSnapshotUpdated(_depositor, 0, 0, 0);
      return;
    }
    uint128 cachedEpoch = currentEpoch;
    uint128 cachedScale = currentScale;
    TokenToS[] storage cachedTokenToSArray = epochToScaleToTokenToSum[cachedEpoch][cachedScale]; // TODO: maybe remove and read twice?
    uint256 cachedP = P;
    uint256 cachedG = epochToScaleToG[cachedEpoch][cachedScale];

    depositSnapshots[_depositor].tokenToSArray = cachedTokenToSArray; // TODO
    depositSnapshots[_depositor].P = cachedP;
    depositSnapshots[_depositor].G = cachedG;
    depositSnapshots[_depositor].scale = cachedScale;
    depositSnapshots[_depositor].epoch = cachedEpoch;
    emit DepositSnapshotUpdated(_depositor, cachedP, cachedG, _newValue);
  }

  function _updateRewardSumAndProduct(
    address _collateralTokenAddress,
    uint256 _collateralGainPerUnitStaked,
    uint256 _stableCoinLossPerUnitStaked
  ) internal {
    assert(_stableCoinLossPerUnitStaked <= DECIMAL_PRECISION);

    uint128 currentScaleCached = currentScale;
    uint128 currentEpochCached = currentEpoch;
    uint256 currentS;
    uint256 currentSIndex;
    bool _found;
    TokenToS[] memory currentTokenToSArray = epochToScaleToTokenToSum[currentEpochCached][currentScaleCached];
    for (uint128 i = 0; i < currentTokenToSArray.length; i++) {
      if (currentTokenToSArray[i].tokenAddress == _collateralTokenAddress) {
        currentS = currentTokenToSArray[i].S_value;
        currentSIndex = i;
        _found = true;
      }
    }
    /*
     * Calculate the new S first, before we update P.
     * The Collateral gain for any given depositor from a liquidation depends on the value of their deposit
     * (and the value of totalDeposits) prior to the Stability being depleted by the debt in the liquidation.
     *
     * Since S corresponds to Collateral gain, and P to deposit loss, we update S first.
     */
    uint256 marginalCollateralGain = _collateralGainPerUnitStaked * P;
    uint256 newS = currentS + marginalCollateralGain;
    if (currentTokenToSArray.length == 0 || !_found) {
      TokenToS memory tokenToS;
      tokenToS.S_value = newS;
      tokenToS.tokenAddress = _collateralTokenAddress;
      epochToScaleToTokenToSum[currentEpochCached][currentScaleCached].push() = tokenToS;
    } else {
      epochToScaleToTokenToSum[currentEpochCached][currentScaleCached][currentSIndex].S_value = newS;
    }
    emit S_Updated(_collateralTokenAddress, newS, currentEpochCached, currentScaleCached);
    _updateP(_stableCoinLossPerUnitStaked, true);
  }

  function _updateP(uint256 _stableCoinChangePerUnitStaked, bool loss) internal {
    /*
     * The newProductFactor is the factor by which to change all deposits, due to the depletion of Stability Pool StableCoin in the liquidation.
     * We make the product factor 0 if there was a pool-emptying. Otherwise, it is (1 - StableCoinLossPerUnitStaked)
     */
    uint256 newProductFactor;
    if (loss) {
      newProductFactor = uint256(DECIMAL_PRECISION - _stableCoinChangePerUnitStaked);
    } else {
      newProductFactor = uint256(DECIMAL_PRECISION + _stableCoinChangePerUnitStaked);
    }
    uint256 currentP = P;
    uint256 newP;
    // If the Stability Pool was emptied, increment the epoch, and reset the scale and product P
    if (newProductFactor == 0) {
      currentEpoch += 1;
      emit EpochUpdated(currentEpoch);
      currentScale = 0;
      emit ScaleUpdated(0);
      newP = DECIMAL_PRECISION;

      // If multiplying P by a non-zero product factor would reduce P below the scale boundary, increment the scale
    } else if ((currentP * newProductFactor) / DECIMAL_PRECISION < SCALE_FACTOR) {
      newP = (currentP * newProductFactor * SCALE_FACTOR) / DECIMAL_PRECISION;
      currentScale += 1;
      emit ScaleUpdated(currentScale);
    } else {
      newP = (currentP * newProductFactor) / DECIMAL_PRECISION;
    }

    assert(newP > 0);
    P = newP;

    emit P_Updated(newP);
  }

  /// @dev updates G when new BONQ amount is issued
  /// @param _bonqIssuance new BONQ issuance amount
  function _updateG(uint256 _bonqIssuance) internal {
    uint256 totalStableCoin = totalDeposit; // cached to save an SLOAD
    /*
     * When total deposits is 0, G is not updated. In this case, the BONQ issued can not be obtained by later
     * depositors - it is missed out on, and remains in the balanceof the Stability Pool.
     *
     */
    if (totalStableCoin == 0 || _bonqIssuance == 0) {
      return;
    }

    uint256 bonqPerUnitStaked;
    bonqPerUnitStaked = _computeBONQPerUnitStaked(_bonqIssuance, totalStableCoin);

    uint256 marginalBONQGain = bonqPerUnitStaked * P;
    uint128 currentEpoch_cached = currentEpoch;
    uint128 currentScale_cached = currentScale;

    uint256 newEpochToScaleToG = epochToScaleToG[currentEpoch_cached][currentScale_cached] + marginalBONQGain;
    epochToScaleToG[currentEpoch_cached][currentScale_cached] = newEpochToScaleToG;

    emit G_Updated(newEpochToScaleToG, currentEpoch_cached, currentScale_cached);
  }

  function _getDepositorCollateralGains(address _depositor) internal view returns (TokenToUint256[] memory) {
    uint256 initialDeposit = deposits[_depositor];
    if (initialDeposit == 0) {
      TokenToUint256[] memory x;
      return x;
    }

    Snapshots memory snapshots = depositSnapshots[_depositor];

    TokenToUint256[] memory gainPerCollateralArray = _getCollateralGainsArrayFromSnapshots(initialDeposit, snapshots);
    return gainPerCollateralArray;
  }

  function _getCollateralGainsArrayFromSnapshots(uint256 _initialDeposit, Snapshots memory _snapshots) internal view returns (TokenToUint256[] memory) {
    /*
     * Grab the sum 'S' from the epoch at which the stake was made. The Collateral gain may span up to one scale change.
     * If it does, the second portion of the Collateral gain is scaled by 1e9.
     * If the gain spans no scale change, the second portion will be 0.
     */
    uint128 epochSnapshot = _snapshots.epoch;
    uint128 scaleSnapshot = _snapshots.scale;
    TokenToS[] memory tokensToSum_cached = epochToScaleToTokenToSum[epochSnapshot][scaleSnapshot];
    uint256 tokenArrayLength = tokensToSum_cached.length;
    TokenToUint256[] memory CollateralGainsArray = new TokenToUint256[](tokenArrayLength);
    for (uint128 i = 0; i < tokenArrayLength; i++) {
      TokenToS memory S = tokensToSum_cached[i];
      uint256 relatedS_snapshot;
      for (uint128 j = 0; j < _snapshots.tokenToSArray.length; j++) {
        TokenToS memory S_snapsot = _snapshots.tokenToSArray[j];
        if (S_snapsot.tokenAddress == S.tokenAddress) {
          relatedS_snapshot = S_snapsot.S_value;
          break;
        }
      }
      TokenToS[] memory nextTokensToSum_cached = epochToScaleToTokenToSum[epochSnapshot][scaleSnapshot + 1];
      uint256 nextScaleS;
      for (uint128 j = 0; j < nextTokensToSum_cached.length; j++) {
        TokenToS memory nextScaleTokenToS = nextTokensToSum_cached[j];
        if (nextScaleTokenToS.tokenAddress == S.tokenAddress) {
          nextScaleS = nextScaleTokenToS.S_value;
          break;
        }
      }
      uint256 P_Snapshot = _snapshots.P;

      CollateralGainsArray[i].value = _getCollateralGainFromSnapshots(_initialDeposit, S.S_value, nextScaleS, relatedS_snapshot, P_Snapshot);
      CollateralGainsArray[i].tokenAddress = S.tokenAddress;
    }

    return CollateralGainsArray;
  }

  function _getCollateralGainFromSnapshots(
    uint256 initialDeposit,
    uint256 S,
    uint256 nextScaleS,
    uint256 S_Snapshot,
    uint256 P_Snapshot
  ) internal pure returns (uint256) {
    uint256 firstPortion = S - S_Snapshot;
    uint256 secondPortion = nextScaleS / SCALE_FACTOR;
    uint256 collateralGain = (initialDeposit * (firstPortion + secondPortion)) / P_Snapshot / DECIMAL_PRECISION;

    return collateralGain;
  }

  function _getDepositorBONQGain(address _depositor, uint256 _marginalBONQGain) internal view returns (uint256) {
    uint256 initialDeposit = deposits[_depositor];
    if (initialDeposit == 0) {
      return 0;
    }
    Snapshots memory _snapshots = depositSnapshots[_depositor];
    /*
     * Grab the sum 'G' from the epoch at which the stake was made. The BONQ gain may span up to one scale change.
     * If it does, the second portion of the BONQ gain is scaled by 1e9.
     * If the gain spans no scale change, the second portion will be 0.
     */
    uint256 firstEpochPortion = epochToScaleToG[_snapshots.epoch][_snapshots.scale];
    uint256 secondEpochPortion = epochToScaleToG[_snapshots.epoch][_snapshots.scale + 1];
    if (_snapshots.epoch == currentEpoch) {
      if (_snapshots.scale == currentScale) firstEpochPortion += _marginalBONQGain;
      if (_snapshots.scale + 1 == currentScale) secondEpochPortion += _marginalBONQGain;
    }
    uint256 gainPortions = firstEpochPortion - _snapshots.G + secondEpochPortion / SCALE_FACTOR;

    return (initialDeposit * (gainPortions)) / _snapshots.P / DECIMAL_PRECISION;
  }

  /// @dev gets compounded deposit of the user
  function _getCompoundedDepositFromSnapshots(uint256 _initialStake, Snapshots memory _snapshots) internal view returns (uint256) {
    uint256 snapshot_P = _snapshots.P;

    // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
    if (_snapshots.epoch < currentEpoch) {
      return 0;
    }

    uint256 compoundedStake;
    uint128 scaleDiff = currentScale - _snapshots.scale;

    /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime,
     * account for it. If more than one scale change was made, then the stake has decreased by a factor of
     * at least 1e-9 -- so return 0.
     */
    uint256 calculatedSnapshotP = snapshot_P == 0 ? DECIMAL_PRECISION : snapshot_P;
    if (scaleDiff == 0) {
      compoundedStake = (_initialStake * P) / calculatedSnapshotP;
    } else if (scaleDiff == 1) {
      compoundedStake = (_initialStake * P) / calculatedSnapshotP / SCALE_FACTOR;
    } else {
      // if scaleDiff >= 2
      compoundedStake = 0;
    }

    /*
     * If compounded deposit is less than a billionth of the initial deposit, return 0.
     *
     * NOTE: originally, this line was in place to stop rounding errors making the deposit too large. However, the error
     * corrections should ensure the error in P "favors the Pool", i.e. any given compounded deposit should slightly less
     * than it's theoretical value.
     *
     * Thus it's unclear whether this line is still really needed.
     */
    if (compoundedStake < _initialStake / 1e9) {
      return 0;
    }

    return compoundedStake;
  }

  /// @dev Compute the StableCoin and Collateral rewards. Uses a "feedback" error correction, to keep
  /// the cumulative error in the P and S state variables low:s
  function _computeRewardsPerUnitStaked(
    address _collateralTokenAddress,
    uint256 _collToAdd,
    uint256 _debtToOffset,
    uint256 _totalStableCoinDeposits
  ) internal returns (uint256 collateralGainPerUnitStaked, uint256 stableCoinLossPerUnitStaked) {
    /*
     * Compute the StableCoin and Collateral rewards. Uses a "feedback" error correction, to keep
     * the cumulative error in the P and S state variables low:
     *
     * 1) Form numerators which compensate for the floor division errors that occurred the last time this
     * function was called.
     * 2) Calculate "per-unit-staked" ratios.
     * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
     * 4) Store these errors for use in the next correction when this function is called.
     * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
     */
    uint256 collateralNumerator = _collToAdd * DECIMAL_PRECISION + collateralToLastErrorOffset[_collateralTokenAddress];

    assert(_debtToOffset <= _totalStableCoinDeposits);
    if (_debtToOffset == _totalStableCoinDeposits) {
      stableCoinLossPerUnitStaked = DECIMAL_PRECISION; // When the Pool depletes to 0, so does each deposit
      lastStableCoinLossErrorOffset = 0;
    } else {
      uint256 stableCoinLossNumerator = _debtToOffset * DECIMAL_PRECISION - lastStableCoinLossErrorOffset;
      /*
       * Add 1 to make error in quotient positive. We want "slightly too much" StableCoin loss,
       * which ensures the error in any given compoundedStableCoinDeposit favors the Stability Pool.
       */
      stableCoinLossPerUnitStaked = stableCoinLossNumerator / _totalStableCoinDeposits + 1;
      lastStableCoinLossErrorOffset = stableCoinLossPerUnitStaked * _totalStableCoinDeposits - stableCoinLossNumerator;
    }

    collateralGainPerUnitStaked = collateralNumerator / _totalStableCoinDeposits;
    collateralToLastErrorOffset[_collateralTokenAddress] = collateralNumerator - collateralGainPerUnitStaked * _totalStableCoinDeposits;

    return (collateralGainPerUnitStaked, stableCoinLossPerUnitStaked);
  }

  /// @dev distributes BONQ per minutes that was not spent yet
  function _triggerBONQdistribution() internal {
    uint256 issuance = _issueBONQRewards();
    _updateG(issuance);
  }

  function _issueBONQRewards() internal returns (uint256) {
    uint256 newBONQRewardTime = block.timestamp;
    uint256 totalBONQRewardsLeft_cached = totalBONQRewardsLeft;
    if (totalBONQRewardsLeft_cached == 0 || bonqPerMinute == 0 || totalDeposit == 0) {
      latestBONQRewardTime = newBONQRewardTime;
      return 0;
    }

    uint256 timePassedInMinutes = (newBONQRewardTime - latestBONQRewardTime) / SECONDS_IN_ONE_MINUTE;
    uint256 issuance = bonqPerMinute * timePassedInMinutes;
    if (totalBONQRewardsLeft_cached < issuance) {
      issuance = totalBONQRewardsLeft_cached; // event will capture that 0 tokens left
    }
    uint256 newTotalBONQRewardsLeft = totalBONQRewardsLeft_cached - issuance;
    totalBONQRewardsLeft = newTotalBONQRewardsLeft;
    latestBONQRewardTime = newBONQRewardTime;

    emit BONQRewardIssue(issuance, newTotalBONQRewardsLeft);

    return issuance;
  }

  function _computeBONQPerUnitStaked(uint256 _bonqIssuance, uint256 _totalStableCoinDeposits) internal returns (uint256) {
    /*
     * Calculate the BONQ-per-unit staked.  Division uses a "feedback" error correction, to keep the
     * cumulative error low in the running total G:
     *
     * 1) Form a numerator which compensates for the floor division error that occurred the last time this
     * function was called.
     * 2) Calculate "per-unit-staked" ratio.
     * 3) Multiply the ratio back by its denominator, to reveal the current floor division error.
     * 4) Store this error for use in the next correction when this function is called.
     * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
     */
    uint256 bonqNumerator = _bonqIssuance * DECIMAL_PRECISION + lastBONQError;

    uint256 bonqPerUnitStaked = bonqNumerator / _totalStableCoinDeposits;
    lastBONQError = bonqNumerator - (bonqPerUnitStaked * _totalStableCoinDeposits);

    return bonqPerUnitStaked;
  }

  /// @dev transfers collateral rewards tokens precalculated to the depositor
  function _sendCollateralRewardsToDepositor(TokenToUint256[] memory _depositorCollateralGains) internal {
    for (uint256 i = 0; i < _depositorCollateralGains.length; i++) {
      if (_depositorCollateralGains[i].value == 0) {
        continue;
      }
      IERC20 collateralToken = IERC20(_depositorCollateralGains[i].tokenAddress);
      collateralToken.safeTransfer(msg.sender, _depositorCollateralGains[i].value);
      uint256 collateralPrice = factory.tokenToPriceFeed().tokenPrice(address(collateralToken));
      emit CollateralRewardRedeemed(msg.sender, _depositorCollateralGains[i].tokenAddress, _depositorCollateralGains[i].value, collateralPrice);
    }
  }

  /// @dev transfers BONQ amount to the user
  function _sendBONQRewardsToDepositor(uint256 _bonqGain) internal {
    bonqToken.transfer(msg.sender, _bonqGain);
  }
}
