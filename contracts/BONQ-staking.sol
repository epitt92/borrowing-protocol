//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IBONQStaking.sol";
import "./interfaces/IFeeRecipient.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/ITrove.sol";
import "./utils/BONQMath.sol";

/// @title BONQ Staking contract, rewards stakers in StableCoin that is used to pay fee
contract BONQStaking is IBONQStaking, IFeeRecipient, OwnableUpgradeable, UUPSUpgradeable, Constants {
  using BONQMath for uint256;
  // --- Data ---

  string public constant NAME = "BONQStaking";
  // constants

  uint256 public override baseRate;

  uint256 public minuteDecayFactor;
  uint256 public beta;
  uint256 public alpha;
  uint256 public maxFeeCollateralRatio;

  mapping(address => uint256) public stakes;
  uint256 public totalBONQStaked;

  uint256 public F_StableCoin; // Running sum of StableCoin fees per-BONQ-staked
  uint256 public lastFeeOperationTime;

  // User snapshots of F_BONQ and F_StableCoin, taken at the point at which their latest deposit was made
  mapping(address => uint256) public F_StableCoinSnapshots;
  mapping(address => uint256) public stableCoinUserGains;

  ITroveFactory public factory;
  IERC20 public bonqToken;
  IERC20 public stableCoin;

  // --- Events ---

  event FactoryAddressSet(address _factoryAddress);
  event BonqTokenAddressSet(address _bonqTokenAddress);
  event StableCoinAddressSet(address _stableCoinAddress);

  event StakeChanged(address indexed _staker, uint256 _newStake);
  event TotalBONQStakedUpdated(uint256 _totalBONQStaked);
  event RewardRedeemed(address _account, uint256 _stableAmount, address _troveAddress);
  event StakerSnapshotsUpdated(address _staker, uint256 _F_StableCoin, uint256 _stableGains);
  event FeeTaken(uint256 _amount, uint256 _F_StableCoin, bool _redemptionFee);

  constructor() {
    // to prevent contract implementation to be reinitialized by someone else
    _disableInitializers();
  }

  function initialize(address _bonqToken) public initializer {
    __Ownable_init();
    minuteDecayFactor = 999_037_758_833_783_000;
    beta = 25_000_000_000_000_000_000;
    alpha = 56_000_000_000_000_000;
    maxFeeCollateralRatio = 5_100_000_000_000_000_000;
    bonqToken = IERC20(_bonqToken);
  }

  // for UUPS implementation
  function _authorizeUpgrade(address) internal override onlyOwner {}

  function name() public view virtual returns (string memory) {
    return NAME;
  }

  // --- Functions ---

  /// @dev set the new fee decay factor per minute
  /// @param _newMinuteDecayFactor uint256 value
  function setMinuteDecayFactor(uint256 _newMinuteDecayFactor) public onlyOwner {
    minuteDecayFactor = _newMinuteDecayFactor;
  }

  /// @dev set the new alpha value
  /// @param _alpha uint256 value
  function setAlphaValue(uint256 _alpha) public onlyOwner {
    alpha = _alpha;
  }

  /// @dev set the new beta value
  /// @param _beta uint256 value
  function setBetaValue(uint256 _beta) public onlyOwner {
    beta = _beta;
  }

  /// @dev set the maximum Collateral Ratio threshold to return 100% feeRatio
  /// @param _maxFeeCollateralRatio uint256 value
  function setMaxFeeCollateralRatio(uint256 _maxFeeCollateralRatio) public onlyOwner {
    maxFeeCollateralRatio = _maxFeeCollateralRatio;
  }

  /// @dev set timestamp to calculate next decayed rate from
  /// @param _timestamp uint256 in seconds
  function setInitialLastFee(uint256 _timestamp) public onlyOwner {
    lastFeeOperationTime = _timestamp > 0 ? _timestamp : block.timestamp;
  }

  /// @dev calculates the rate dacayed by time passed since last fee, uses `decPow` from BONQMath
  /// @param _currentBaseRate current rate to decay
  /// @return uint256 decayed baseRate in uint256
  function calcDecayedBaseRate(uint256 _currentBaseRate) public view override returns (uint256) {
    if (_currentBaseRate == 0) {
      return 0;
    }
    uint256 minutesPassed = (block.timestamp - lastFeeOperationTime) / (1 minutes);
    // The _decPow function is a custom function
    uint256 decayFactor = BONQMath._decPow(minuteDecayFactor, minutesPassed);
    return (_currentBaseRate * decayFactor) / DECIMAL_PRECISION;
  }

  /// @dev returns fee from borrowing the amount
  /// @param _amount amount to borrow
  /// @return uint256 resulting fee
  function getBorrowingFee(uint256 _amount) public view override returns (uint256) {
    return (_amount * BONQMath.min(MAX_BORROWING_RATE, (PERCENT_05 + calcDecayedBaseRate(baseRate)))) / DECIMAL_PRECISION;
  }

  /// @dev sets the TroveFactory contract, if address was updated
  function setFactory(address _factoryAddress) external onlyOwner {
    factory = ITroveFactory(_factoryAddress);
    stableCoin = IERC20(address(factory.stableCoin()));
    emit FactoryAddressSet(address(factory));
    emit StableCoinAddressSet(address(stableCoin));
  }

  /// @dev sets the StableCoin token contract, if address was updated
  function updateStableCoin() external {
    require(address(factory.stableCoin()) != address(stableCoin), "4e1ea nothing to update");
    stableCoin = IERC20(address(factory.stableCoin()));
    emit StableCoinAddressSet(address(stableCoin));
  }

  /// @dev to stake BONQ
  /// @param _bonqAmount amount of BONQ to stake
  /// @notice If caller has a pre-existing stake, records any accumulated StableCoin gains to them.
  function stake(uint256 _bonqAmount) external override {
    _requireNonZeroAmount(_bonqAmount);

    uint256 currentStake = stakes[msg.sender];

    // Transfer BONQ from caller to this contract
    require(bonqToken.transferFrom(msg.sender, address(this), _bonqAmount), "4e1ea transfer from failed");

    // Grab and record accumulated StableCoin gains from the current stake and update Snapshot
    uint256 currentTotalBONQStaked = totalBONQStaked;
    if (currentTotalBONQStaked == 0) stableCoinUserGains[msg.sender] += F_StableCoin;
    _updateUserSnapshot(msg.sender);

    // Increase user’s stake and total BONQ staked
    uint256 newTotalBONQStaked = currentTotalBONQStaked + _bonqAmount;
    totalBONQStaked = newTotalBONQStaked;
    uint256 newUserStake = currentStake + _bonqAmount;
    stakes[msg.sender] = newUserStake;

    emit TotalBONQStakedUpdated(newTotalBONQStaked);
    emit StakeChanged(msg.sender, newUserStake);
  }

  /// @dev to unstake BONQ
  /// @param _bonqAmount amount of BONQ to unstake
  /// @notice Unstake the BONQ and send the it back to the caller, and record accumulated StableCoin gains.
  /// If requested amount > stake, send their entire stake.
  function unstake(uint256 _bonqAmount) external override {
    _requireNonZeroAmount(_bonqAmount);
    uint256 currentStake = stakes[msg.sender];
    _requireUserHasStake(currentStake);

    // Grab and record accumulated StableCoin gains from the current stake and update Snapshot
    _updateUserSnapshot(msg.sender);

    uint256 BONQToWithdraw = _bonqAmount.min(currentStake);

    uint256 newStake = currentStake - BONQToWithdraw;

    // Decrease user's stake and total BONQ staked
    stakes[msg.sender] = newStake;
    totalBONQStaked = totalBONQStaked - BONQToWithdraw;
    emit TotalBONQStakedUpdated(totalBONQStaked);

    // Transfer unstaked BONQ to user
    bonqToken.transfer(msg.sender, BONQToWithdraw);

    emit StakeChanged(msg.sender, newStake);
  }

  // --- Reward-per-unit-staked increase functions. Called by BONQ core contracts ---

  /// @dev to pay fee in StableCoin, transfer the amount specified
  /// @param _amount amount of StableCoin to pay as fee
  /// @notice Unstake the BONQ and send the it back to the caller, and record accumulated StableCoin gains.
  /// If requested amount > stake, send their entire stake.
  function takeFees(uint256 _amount) external override returns (bool) {
    _requireNonZeroAmount(_amount);
    stableCoin.transferFrom(msg.sender, address(this), _amount);
    uint256 totalBONQStaked_cached = totalBONQStaked;
    uint256 amountPerBONQStaked = _amount;
    if (totalBONQStaked_cached > 0) {
      amountPerBONQStaked = ((_amount) * DECIMAL_PRECISION) / totalBONQStaked_cached;
    }
    uint256 newF_StableCoin = F_StableCoin + amountPerBONQStaked;
    F_StableCoin = newF_StableCoin;

    if (baseRate > 0) {
      lastFeeOperationTime = block.timestamp;
      baseRate = calcDecayedBaseRate(baseRate);
    }
    emit FeeTaken(_amount, newF_StableCoin, msg.sender == address(factory));
    return true;
  }

  /// @dev updates baseRate
  /// @param _increase value to add to baseRate
  /// @notice _increase
  function increaseBaseRate(uint256 _increase) external override returns (uint256) {
    require(msg.sender == address(factory), "10bcb only factory increases baseRate");
    lastFeeOperationTime = block.timestamp;
    baseRate += _increase;
    return baseRate;
  }

  // --- Pending reward functions ---

  /// @dev to redeem StableCoin rewards, transfers the amount only to repay debt of the Trove
  /// @param _amount amount of StableCoin to repay the debt
  /// @param _troveAddress address of the valid trove to repay the debt
  /// @param _newNextTrove hint for the newNextTrove position (next trove)
  /// @notice user can redeem StableCoin rewards only to repay the debt of the troves
  function redeemReward(
    uint256 _amount,
    address _troveAddress,
    address _newNextTrove
  ) external override {
    _requireNonZeroAmount(_amount);
    address account = msg.sender;
    ITrove trove = ITrove(_troveAddress);
    require(factory.containsTrove(address(trove.token()), _troveAddress), "2ff8c must be called for a valid trove");
    _amount = trove.netDebt().min(_amount);
    require((_getUnpaidStableCoinGain(msg.sender)) >= _amount, "2ff8c _amount must fit rewards amount");
    _updateUserSnapshot(account);
    stableCoinUserGains[account] = stableCoinUserGains[account] - _amount;
    // TODO: check how much gas can be saved by storing the approved troves in a mapping
    // TODO: check the gas difference in using transfer instead of transferFrom for repayment
    if (stableCoin.allowance(address(this), address(trove)) < _amount) {
      stableCoin.approve(address(trove), MAX_INT);
    }
    trove.repay(_amount, _newNextTrove);
    emit RewardRedeemed(msg.sender, _amount, _troveAddress);
  }

  /// @dev to get total BONQ stkae amount
  function totalStake() external view override returns (uint256) {
    return totalBONQStaked;
  }

  /// @dev reads the unpaid rewards of the user
  /// @param _user the user to check
  function getUnpaidStableCoinGain(address _user) external view override returns (uint256) {
    return _getUnpaidStableCoinGain(_user);
  }

  /// @dev reads the unpaid rewards of the user
  function getRewardsTotal() external view override returns (uint256) {
    return F_StableCoin;
  }

  // --- Internal helper functions ---

  function _getPendingStableCoinGain(address _user) internal view returns (uint256) {
    uint256 F_StableCoin_Snapshot = F_StableCoinSnapshots[_user];
    uint256 stableCoinGain = (stakes[_user] * (F_StableCoin - F_StableCoin_Snapshot)) / DECIMAL_PRECISION;
    return stableCoinGain;
  }

  function _getUnpaidStableCoinGain(address _user) internal view returns (uint256) {
    return stableCoinUserGains[_user] + _getPendingStableCoinGain(_user);
  }

  function _recordStableCoinGain(address _user) internal {
    uint256 userStake = stakes[_user];
    if (userStake > 0) {
      uint256 F_StableCoin_Snapshot = F_StableCoinSnapshots[_user];
      uint256 stableCoinGain = (userStake * (F_StableCoin - F_StableCoin_Snapshot)) / DECIMAL_PRECISION;
      stableCoinUserGains[_user] += stableCoinGain;
    }
  }

  function _updateUserSnapshot(address _user) internal {
    _recordStableCoinGain(_user);
    uint256 currentF_StableCoin = F_StableCoin;
    F_StableCoinSnapshots[_user] = currentF_StableCoin;
    emit StakerSnapshotsUpdated(_user, currentF_StableCoin, stableCoinUserGains[_user]);
  }

  // --- 'require' functions ---

  function _requireUserHasStake(uint256 currentStake) internal pure {
    require(currentStake > 0, "fcdb3 User must have a non-zero stake");
  }

  function _requireNonZeroAmount(uint256 _amount) internal pure {
    require(_amount > 0, "8c64b Amount must be non-zero");
  }
}
