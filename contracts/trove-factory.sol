//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/ITrove.sol";
import "./interfaces/IServiceFeeGenerator.sol";
import "./interfaces/IMintableTokenOwner.sol";
import "./interfaces/ITokenPriceFeed.sol";
import "./interfaces/IMintableToken.sol";
import "./interfaces/IFeeRecipient.sol";
import "./interfaces/IBONQStaking.sol";
import "./interfaces/ILiquidationPool.sol";
import "./interfaces/IStabilityPoolBase.sol";
import "./interfaces/IWETH.sol";
import "./utils/linked-address-list.sol";
import "./utils/BONQMath.sol";
import "./utils/constants.sol";

abstract contract TroveFactory is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, Constants, ITroveFactory {
  using SafeERC20 for IERC20;
  using LinkedAddressList for LinkedAddressList.List;
  using BONQMath for uint256;

  struct TroveList {
    uint256 totalCollateral;
    uint256 totalDebt;
    ILiquidationPool liquidationPool;
    LinkedAddressList.List list;
  }

  struct RedemptionInfo {
    address collateralToken;
    uint256 stableCoinRedeemed;
    uint256 feeAmount;
    uint256 collateralRedeemed;
    uint256 stableCoinLeft;
    address currentTroveAddress;
    address lastTroveRedeemed;
    ITrove currentRedemptionTrove;
  }

  // the trove lists must be separated by token because we want to keep the troves in order of collateralisation
  // ratio and the token prices do not move in tandem
  IStabilityPoolBase public override stabilityPool;
  address public override arbitragePool;
  mapping(address => TroveList) private _troves;
  IMintableTokenOwner public override tokenOwner;
  ITokenPriceFeed public override tokenToPriceFeed;
  IMintableToken public override stableCoin;
  // solhint-disable-next-line var-name-mixedcase
  IWETH public WETHContract;
  IFeeRecipient public override feeRecipient;
  uint256 public override totalDebt;
  address public troveImplementation;
  address public serviceFeeImplementation;
  /**
   * @dev amount of staked BONQ at which trove has 100% refunding of redemption fee
   */
  uint256 public override maxTroveBONQStake;
  IERC20 public override bonqToken;
  uint256 public arbitrageShareRatio;

  event ServiceFeeImplementationSet(address previousImplementation, address newImplementation);
  event NewServiceFee(address serviceFee, address subscriber, address trove);
  event TroveImplementationSet(address previousImplementation, address newImplementation);
  event NewTrove(address trove, address token, address owner);
  event TroveRemoved(address trove);
  event TroveLiquidated(address trove, address collateralToken, uint256 priceAtLiquidation, address stabilityPoolLiquidation, uint256 collateral);
  event TroveInserted(address token, address trove, address referenceTrove, bool before);

  event CollateralUpdate(address token, uint256 totalCollateral);
  event DebtUpdate(address collateral, uint256 totalDebt);
  event Redemption(address token, uint256 stableAmount, uint256 tokenAmount, uint256 stableUnspent, uint256 startBaseRate, uint256 finishBaseRate, address lastTroveRedeemed);
  event TroveCollateralUpdate(address trove, address token, uint256 newAmount, uint256 newCollateralization);
  event TroveDebtUpdate(address trove, address actor, address token, uint256 newAmount, uint256 baseRate, uint256 newCollateralization, uint256 feePaid);

  constructor() {
    // to prevent contract implementation to be reinitialized by someone else
    _disableInitializers();
  }

  modifier troveExists(address _token, address _trove) {
    require(containsTrove(_token, _trove), "f9fac the trove has not been created by the factory");
    _;
  }

  // solhint-disable-next-line func-visibility
  function initialize(address _stableCoin, address _feeRecipient) public initializer {
    __Ownable_init();
    __Pausable_init();
    stableCoin = IMintableToken(_stableCoin);
    feeRecipient = IFeeRecipient(_feeRecipient);
    stableCoin.approve(address(feeRecipient), BONQMath.MAX_INT);
  }

  /// @dev make the contract upgradeable by its owner
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function name() public view virtual returns (string memory);

  /**
   * @dev returns the number of troves for specific token
   */
  function troveCount(address _token) public view override returns (uint256) {
    return _troves[_token].list._size;
  }

  /**
   * @dev returns the last trove by maximum collaterization ratio
   */
  function lastTrove(address _token) public view override returns (address) {
    return _troves[_token].list._last;
  }

  /**
   * @dev returns the first trove by minimal collaterization ratio
   */
  function firstTrove(address _token) public view override returns (address) {
    return _troves[_token].list._first;
  }

  /**
   * @dev returns the next trove by collaterization ratio
   */
  function nextTrove(address _token, address _trove) public view override returns (address) {
    return _troves[_token].list._values[_trove].next;
  }

  /**
   * @dev returns the previous trove by collaterization ratio
   */
  function prevTrove(address _token, address _trove) public view override returns (address) {
    return _troves[_token].list._values[_trove].prev;
  }

  /**
   * @dev returns and checks if such trove exists for this token
   */
  function containsTrove(address _token, address _trove) public view override returns (bool) {
    return _troves[_token].list._values[_trove].next != address(0x0);
  }

  /**
   * @dev returns total collateral among all troves for specific token
   */
  function totalCollateral(address _token) public view override returns (uint256) {
    return _troves[_token].totalCollateral;
  }

  /**
   * @dev returns total debt among all troves for specific token
   */
  function totalDebtForToken(address _token) public view override returns (uint256) {
    return _troves[_token].totalDebt;
  }

  /**
   * @dev returns total collateral ratio averaged between troves for specific token
   */
  function tokenCollateralization(address _token) public view returns (uint256) {
    return (_troves[_token].totalCollateral * DECIMAL_PRECISION) / _troves[_token].totalDebt;
  }

  /**
   * @dev returns contract address of LiquidationPool for specific token
   */
  function liquidationPool(address _token) public view override returns (ILiquidationPool) {
    return _troves[_token].liquidationPool;
  }

  /// @dev calculates redemption fee from CR
  /// @param _collateralRatio collateral ratio of the trove
  /// @param _mcr minimal collateral ratio of the trove
  /// @return uint256 resulting fee
  function _getRedemptionFeeRatio(uint256 _collateralRatio, uint256 _mcr) private pure returns (uint256) {
    uint256 extraCR = (_collateralRatio - _mcr).min(_mcr * 15);
    uint256 a = (((extraCR * extraCR) / _mcr) * DECIMAL_PRECISION) / _mcr;
    uint256 b = _mcr * 45 - DECIMAL_PRECISION * 44;
    uint256 tmpMin = (PERCENT10 * DECIMAL_PRECISION) / b;
    uint256 minFee = tmpMin > PERCENT ? tmpMin - PERCENT_05 : PERCENT_05;

    return (a * DECIMAL_PRECISION) / b + minFee;
  }

  /**
   * @dev returns fee from redeeming the amount
   */
  function getRedemptionFeeRatio(address _trove) public view override returns (uint256) {
    address collateral = address(ITrove(_trove).token());
    ITokenPriceFeed ttpf = tokenToPriceFeed;
    uint256 ratio = _getRedemptionFeeRatio(ITrove(_trove).collateralization(), ttpf.mcr(collateral));
    return ratio.min(ttpf.mrf(collateral));
  }

  /**
   * @dev returns fee from redeeming the amount
   */
  function getRedemptionFee(uint256 _feeRatio, uint256 _amount) public pure override returns (uint256) {
    return (_amount * _feeRatio) / DECIMAL_PRECISION;
  }

  /**
   * @dev returns reduced fee and amount to repay based on trove BONQ stake
   */
  function getReducedFeeAndRefundAmount(uint256 _fee, address _trove) public view override returns (uint256 _reducedFee, uint256 _refundAmount) {
    ITrove trove = ITrove(_trove);
    uint256 _troveBonqStake = trove.bonqStake();
    uint256 _maxTroveBONQStake_cached = maxTroveBONQStake;
    if (_troveBonqStake == 0 || _maxTroveBONQStake_cached == 0) return (_fee, 0);
    if (_troveBonqStake >= _maxTroveBONQStake_cached) return (0, _fee);
    _refundAmount = (_fee * ((_troveBonqStake * DECIMAL_PRECISION) / _maxTroveBONQStake_cached)) / DECIMAL_PRECISION;
    _reducedFee = _fee - _refundAmount;
  }

  /**
   * @dev returns amount to be used in redemption excluding fee,
   */
  function getRedemptionAmount(uint256 _feeRatio, uint256 _amount) public pure returns (uint256) {
    return (_amount * DECIMAL_PRECISION) / (DECIMAL_PRECISION + _feeRatio);
  }

  /**
   * @dev returns fee from borrowing the amount
   */
  function getBorrowingFee(uint256 _amount) public view override returns (uint256) {
    return feeRecipient.getBorrowingFee(_amount);
  }

  /**
   * @dev sets address of the Trove implementation for minimal clones
   */
  function setTroveImplementation(address _troveImplementation) public onlyOwner {
    emit TroveImplementationSet(troveImplementation, _troveImplementation);
    troveImplementation = _troveImplementation;
  }

  /**
   * @dev sets address of the contract for stableCoin issuance
   */
  function setTokenOwner() public onlyOwner {
    IMintableToken stableCoin_cached = stableCoin;
    tokenOwner = IMintableTokenOwner(address(stableCoin_cached.owner()));
    require(tokenOwner.token() == stableCoin_cached, "41642 the StableCoin must be owned by the token owner");
    require(tokenOwner.owner() == address(this), "41642 this contract must be the owner of the token owner");
  }

  /**
   * @dev sets address of the service-fee-generator implementation for minimal clones
   */
  function setServiceFeeImplementation(address _serviceFeeImplementation) public onlyOwner {
    emit ServiceFeeImplementationSet(serviceFeeImplementation, _serviceFeeImplementation);
    serviceFeeImplementation = _serviceFeeImplementation;
  }

  /**
   * @dev sets contract address of FeeRecipient
   */
  function setFeeRecipient(address _feeRecipient) public onlyOwner {
    feeRecipient = IFeeRecipient(_feeRecipient);
    stableCoin.approve(address(feeRecipient), BONQMath.MAX_INT);
  }

  /**
   * @dev sets contract address of TokenPriceFeed
   */
  function setTokenPriceFeed(address _tokenPriceFeed) public onlyOwner {
    tokenToPriceFeed = ITokenPriceFeed(_tokenPriceFeed);
  }

  /**
   * @dev sets contract address of LiquidationPool for specific token
   */
  function setLiquidationPool(address _token, address _liquidationPool) public onlyOwner {
    _troves[_token].liquidationPool = ILiquidationPool(_liquidationPool);
  }

  /**
   * @dev sets contract address of StabilityPool
   */
  function setStabilityPool(address _stabilityPool) external override onlyOwner {
    IStabilityPoolBase _stabilityPoolInstance = IStabilityPoolBase(_stabilityPool);
    stabilityPool = _stabilityPoolInstance;
    bonqToken = _stabilityPoolInstance.bonqToken();
  }

  /**
   * @dev sets contract address of ArbitragePool
   */
  function setArbitragePool(address _arbitragePool) external override onlyOwner {
    arbitragePool = _arbitragePool;
  }

  /// @dev set the ratio of the arbitrage gains which should go to the sender of the message
  /// @param _arbitrageShareRatio the ratio by which the arbitrage gains will be multiplied
  function setArbitrageShareRatio(uint256 _arbitrageShareRatio) public onlyOwner {
    require(_arbitrageShareRatio <= 100, "d7dc8 the share can not be over 100%");
    arbitrageShareRatio = (_arbitrageShareRatio * DECIMAL_PRECISION) / 100;
  }

  /**
   * @dev sets contract address of Wrapped native token, along with liquidationPool
   */
  // solhint-disable-next-line var-name-mixedcase
  function setWETH(address _WETH, address _liquidationPool) external override onlyOwner {
    require(address(WETHContract) == address(0x0), "cd9f3 WETH can only be set once");
    WETHContract = IWETH(_WETH);
    setLiquidationPool(_WETH, _liquidationPool);
  }

  /**
   * @dev sets new amount for trove BONQ state at which redemption fee refunding equals to 100%
   */
  // solhint-disable-next-line var-name-mixedcase
  function setMaxTroveBONQStake(uint256 _newAmount) external override onlyOwner {
    maxTroveBONQStake = _newAmount;
  }

  /**
   * @dev transfers contract ownership
   * this function is used when a new TroveFactory version is deployed and the same tokens are used. We transfer the
   * ownership of the TokenOwner contract and the new TroveFactory is able to add minters
   */
  function transferTokenOwnership(address _newOwner) public onlyOwner {
    tokenOwner.transferTokenOwnership(_newOwner);
  }

  /**
   * @dev transfers contract ownership
   * this function is used when a new TroveFactory version is deployed and the same tokens are used. We transfer the
   * ownership of the TokenOwner contract and the new TroveFactory is able to add minters
   */
  function transferTokenOwnerOwnership(address _newOwner) public onlyOwner {
    tokenOwner.transferOwnership(_newOwner);
  }

  /**
   * @dev toggles the pause state of the contract
   * if the contract is paused borrowing is disabled
   * and liquidation with Stability Pool is impossible (Community liquidations still allowed)
   */
  function togglePause() public onlyOwner {
    if (paused()) {
      _unpause();
    } else {
      _pause();
    }
  }

  /**
   * @dev function to be called from trove to update total collateral value of all troves of this tokens
   * @param _increase bool that indicates "+" or "-" operation
   */
  function updateTotalCollateral(address _token, uint256 _amount, bool _increase) public override troveExists(_token, msg.sender) {
    if (_increase) {
      _troves[_token].totalCollateral += _amount;
    } else {
      _troves[_token].totalCollateral -= _amount;
    }
    emit CollateralUpdate(_token, _troves[_token].totalCollateral);
  }

  /**
   * @dev deposits native token into trove after wrapping the ETH (EWT, AVAX, etc) into WETH (WEWT, WAVAX, etc)
   * @param _trove tove to be deposited in
   * @param _newNextTrove hint for next trove position
   */
  function increaseCollateralNative(address _trove, address _newNextTrove) public payable override {
    ITrove targetTrove = ITrove(_trove);
    IWETH WETHContract_cached = WETHContract;
    require(address(targetTrove.token()) == address(WETHContract_cached), "b8282 not a valid trove");
    WETHContract_cached.deposit{value: msg.value}();
    require(WETHContract.transfer(_trove, msg.value), "b8282 could not transfer the requested amount");
    targetTrove.increaseCollateral(0, _newNextTrove);
  }

  /**
   * @dev creates a minimal clone from the implementation address
   * @param _implementation any supported implementation
   */
  function cloneImplementation(address _implementation) internal returns (address clone) {
    assembly {
      let ptr := mload(0x40)
      mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(ptr, 0x14), shl(0x60, _implementation))
      mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
      clone := create(0, ptr, 0x37)
    }
  }

  /**
   * @dev creates new ServiceFeeGenerator for user
   * @param _trove any valid trove that user owns
   * @param _feeAmount amount of fee to take (must be >= minimal borrow)
   * @param _feeInterval interval required for payments
   */
  function createNewServiceFee(ITrove _trove, uint256 _feeAmount, uint256 _feeInterval) public virtual override returns (IServiceFeeGenerator newServiceFee) {
    // TODO add a mechanism to identify Service Fee contracts which were created by the trove Factory
    require(containsTrove(address(_trove.token()), address(_trove)), "daa708 not a valid trove");
    require(_trove.owner() == msg.sender, "daa708 msg.sender must be trove owner");

    address serviceFeeAddress = cloneImplementation(serviceFeeImplementation);
    require(serviceFeeAddress != address(0), "ERC1167: create failed");

    _trove.addOwner(serviceFeeAddress);

    newServiceFee = IServiceFeeGenerator(serviceFeeAddress);
    newServiceFee.initialize(_trove, _feeAmount, _feeInterval);
    emit NewServiceFee(serviceFeeAddress, msg.sender, address(_trove));
  }

  /**
   * @dev creates a trove if the token is supported
   * @param _token any supported token address
   */
  function createTrove(address _token) public override returns (ITrove trove) {
    IMintableTokenOwner tokenOwner_cached = tokenOwner;
    // troves can only be created after the token owner has been set. This is a safety check not security
    require(address(tokenOwner_cached) != address(0x0), "66c10 the token owner must be set");
    require(tokenOwner_cached.owner() == address(this), "66c10 the token owner's owner must be the trove factory");
    // a token without a price feed has a CR of zero and is useless
    require(tokenToPriceFeed.tokenPriceFeed(_token) != address(0x0), "66c10 the token price feed must be set");

    address troveAddress = cloneImplementation(troveImplementation);
    require(troveAddress != address(0), "ERC1167: create failed");

    trove = ITrove(troveAddress);
    //    trove.initialize(address(this), _token, msg.sender);
    trove.initialize(_token, msg.sender);

    require(_troves[_token].list.add(troveAddress, address(0x0), false), "66c10 trove could not be added to the list");
    //allow the trove to transfer from the liquidation pool
    _troves[_token].liquidationPool.approveTrove(troveAddress);
    // allow the trove to mint stableCoin
    tokenOwner_cached.addMinter(troveAddress);

    emit NewTrove(troveAddress, _token, msg.sender);
  }

  /**
   * @dev creates a trove with collateral and borrows from it
   * @param _token any supported token address
   * @param _collateralAmount a positive amount of collateral to transfer from the sender's account or zero
   * @param _recipient is the address to which the newly minted tokens will be transferred
   * @param _borrowAmount the value of the minting
   * @param _nextTrove is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions
   */
  function createTroveAndBorrow(address _token, uint256 _collateralAmount, address _recipient, uint256 _borrowAmount, address _nextTrove) public override {
    ITrove trove = createTrove(_token);
    IERC20(_token).safeTransferFrom(msg.sender, address(trove), _collateralAmount);
    trove.increaseCollateral(0, address(0));
    if (_borrowAmount >= DECIMAL_PRECISION) trove.borrow(_recipient, _borrowAmount, _nextTrove);
  }

  function liquidateTrove(address _trove, address _token) public troveExists(_token, _trove) {
    ITrove trove = ITrove(_trove);
    uint256 liquidationReserve = trove.liquidationReserve();
    trove.liquidate();
    stableCoin.transferFrom(_trove, msg.sender, liquidationReserve);
  }

  /**
   * @dev remove a trove from the list and send any remaining token balance to the owner
   * @param _trove is the trove which will be removed
   */
  function removeTrove(address _token, address _trove) public override troveExists(_token, _trove) {
    ITrove trove = ITrove(_trove);
    require(trove.owner() == msg.sender || _trove == msg.sender, "173fa only the owner can remove the trove from the list");
    require(trove.debt() == 0, "173fa repay the debt before removing the trove");
    IERC20 token = IERC20(trove.token());
    trove.setArbitrageParticipation(false);
    uint256 tokenBalance = token.balanceOf(_trove);

    if (tokenBalance > 0) {
      // we can safely decrease the balance to zero with a newNextTrove of 0x0 because the debt is zero and
      // insertTrove will not be called
      // the collateral should be sent to the owner
      // TODO: add test for this case
      trove.decreaseCollateral(trove.owner(), tokenBalance, address(0x0));
    }
    require(_troves[_token].list.remove(_trove), "173fa trove could not be removed from the list");
    tokenOwner.revokeMinter(_trove);
    _troves[_token].liquidationPool.unapproveTrove(_trove);
    emit TroveRemoved(_trove);
  }

  /**
   * @dev insert a trove in the sorted list of troves. the troves must be sorted by collateralisation ratio CR
   * the sender must be the trove which will be inserted in the list
   * @param _newNextTrove is the trove before which the trove will be added
   */
  function insertTrove(address _token, address _newNextTrove) public override troveExists(_token, msg.sender) {
    require(containsTrove(_token, _newNextTrove) || _newNextTrove == address(0), "3a669 the trove hint must exist in the list or be 0x0");

    // if now hint is provided we start by trying the last trove in the list
    if (_newNextTrove == address(0)) {
      _newNextTrove = lastTrove(_token);
    }

    // if the NewNextTrove is the same as the trove being changed, then it should be changed to the trove's nextTrove
    // unless the trove is the lastTrove in which case it is changed to the previousTrove
    // insertTrove is never called if there is only one trove in the list
    if (_newNextTrove == msg.sender) {
      address nextTroveAddress = nextTrove(_token, _newNextTrove);
      // the lastTrove has itself as the nextTrove
      _newNextTrove = _newNextTrove != nextTroveAddress ? nextTroveAddress : prevTrove(_token, _newNextTrove);
    }

    ITrove trove = ITrove(msg.sender);
    ITrove ref = ITrove(_newNextTrove);
    bool insertBefore = true;

    // first remove the trove from the list to avoid trying to insert it before or after itself
    require(_troves[_token].list.remove(address(trove)), "3a669 trove could not be removed from the list");
    if (trove.debt() == 0) {
      // troves with zero debt have infinite collateralisation and can be put safely at the end of the list
      require(_troves[_token].list.add(address(trove), address(0x0), false), "3a669 trove could not be inserted in the list");
      emit TroveInserted(_token, address(trove), address(0x0), false);
    } else {
      uint256 icr = trove.collateralization();
      uint256 refIcr = ref.collateralization();

      if (refIcr >= icr) {
        // if the first trove in the list has a bigger CR then this trove becomes the new first trove. No loop required
        if (_newNextTrove != firstTrove(_token)) {
          do {
            // the previous trove of the new next trove should have a smaller or equal CR to the inserted trove
            // it is cheaper (in gas) to assign the reference to the previous trove and insert after than to check twice for the CR
            // this is why the loop is a "do while" instead of a "while do"
            ref = ITrove(prevTrove(_token, address(ref)));
            refIcr = ref.collateralization();
          } while (refIcr > icr && address(ref) != _troves[_token].list._first);
        }
      }
      // the ICR of the newNextTrove is smaller than the inserted trove's
      else {
        // only loop through the troves if the newNextTrove is not the last
        if (_newNextTrove != lastTrove(_token)) {
          do {
            // the previous trove of the new next trove should have a smaller or equal CR to the inserted trove
            ref = ITrove(nextTrove(_token, address(ref)));
            refIcr = ref.collateralization();
          } while (refIcr < icr && address(ref) != _troves[_token].list._last);
        }
      }

      insertBefore = refIcr > icr;

      require(_troves[_token].list.add(address(trove), address(ref), insertBefore), "3a669 trove could not be inserted in the list");
      emit TroveInserted(_token, address(trove), address(ref), insertBefore);
    }
  }

  /**
   * @dev redeem all collateral the trove can provide
   * @param _recipient is the trove _recipient to redeem colateral to and take stableCoin from
   */
  function _redeemFullTrove(address _recipient, address _trove) internal returns (uint256 _stableAmount, uint256 _collateralRecieved) {
    return _redeemPartTrove(_recipient, _trove, ITrove(_trove).netDebt(), address(0));
  }

  /**
   * @dev redeem collateral from the tove to fit desired stableCoin amount
   * @param _recipient is the trove _recipient to redeem colateral to and take stableCoin from
   * @param _stableAmount the desired amount of StableCoin to pay for redemption
   * @param _newNextTrove hint for the of the nextNewTrove after redemption
   */
  function _redeemPartTrove(address _recipient, address _trove, uint256 _stableAmount, address _newNextTrove) internal returns (uint256 stableAmount, uint256 collateralRecieved) {
    ITrove trove = ITrove(_trove);
    stableCoin.transferFrom(_recipient, _trove, _stableAmount);
    return trove.redeem(_recipient, _newNextTrove);
  }

  /**
   * @dev commits full redemptions until troves liquidity is less
   */
  function commitFullRedemptions(RedemptionInfo memory _redInfo, uint256 _maxRate) internal returns (RedemptionInfo memory) {
    ITrove currentRedemptionTrove = ITrove(_redInfo.currentTroveAddress);
    uint256 currentFeeRatio = getRedemptionFeeRatio(_redInfo.currentTroveAddress) + feeRecipient.baseRate();
    uint256 amountStableLeft = getRedemptionAmount(currentFeeRatio, _redInfo.stableCoinLeft);
    while (0 < currentRedemptionTrove.netDebt() && currentRedemptionTrove.netDebt() <= amountStableLeft && currentFeeRatio < _maxRate) {
      _redInfo = commitFullRedeem(_redInfo, currentFeeRatio);
      currentFeeRatio = getRedemptionFeeRatio(_redInfo.currentTroveAddress);
      amountStableLeft = getRedemptionAmount(currentFeeRatio, _redInfo.stableCoinLeft);
      currentRedemptionTrove = ITrove(_redInfo.currentTroveAddress);
    }
    return _redInfo;
  }

  /**
   * @dev commits full redemption for the current trove, should be called after checks
   */
  function commitFullRedeem(RedemptionInfo memory _redInfo, uint256 _currentFeeRatio) internal returns (RedemptionInfo memory) {
    address nextTroveAddress = nextTrove(_redInfo.collateralToken, _redInfo.currentTroveAddress);
    (uint256 stblRed, uint256 colRed) = _redeemFullTrove(msg.sender, _redInfo.currentTroveAddress);

    _redInfo.stableCoinRedeemed += stblRed;
    uint256 newFee = getRedemptionFee(_currentFeeRatio, stblRed);
    (uint256 reducedFee, uint256 refundAmount) = getReducedFeeAndRefundAmount(newFee, _redInfo.currentTroveAddress);
    _redInfo.feeAmount += reducedFee;
    _redInfo.stableCoinLeft -= stblRed + reducedFee;
    _redInfo.collateralRedeemed += colRed;
    _redInfo.lastTroveRedeemed = _redInfo.currentTroveAddress;
    _redInfo.currentTroveAddress = nextTroveAddress;

    _refundFeeToTrove(_redInfo.currentTroveAddress, refundAmount);
    return _redInfo;
  }

  /**
   * @dev check if the Trove guessed ICR matches and commits partial redemptios
   */
  function commitPartRedeem(
    RedemptionInfo memory _redInfo,
    uint256 _maxRate,
    uint256 _lastTroveCurrentICR,
    address _lastTroveNewPositionHint
  ) internal returns (RedemptionInfo memory) {
    ITrove currentRedemptionTrove = ITrove(_redInfo.currentTroveAddress);
    uint256 currentFeeRatio = getRedemptionFeeRatio(_redInfo.currentTroveAddress) + feeRecipient.baseRate();
    if (currentRedemptionTrove.collateralization() == _lastTroveCurrentICR && currentFeeRatio < _maxRate) {
      uint256 maxLastRedeem = BONQMath.min(getRedemptionAmount(currentFeeRatio, _redInfo.stableCoinLeft), currentRedemptionTrove.netDebt());
      (uint256 stblRed, uint256 colRed) = _redeemPartTrove(msg.sender, _redInfo.currentTroveAddress, maxLastRedeem, _lastTroveNewPositionHint);
      _redInfo.stableCoinRedeemed += stblRed;
      uint256 newFee = getRedemptionFee(currentFeeRatio, stblRed);
      (uint256 reducedFee, uint256 refundAmount) = getReducedFeeAndRefundAmount(newFee, _redInfo.currentTroveAddress);
      _redInfo.feeAmount += reducedFee;
      _redInfo.stableCoinLeft -= stblRed + reducedFee;
      _redInfo.collateralRedeemed += colRed;
      _redInfo.lastTroveRedeemed = _redInfo.currentTroveAddress;

      _refundFeeToTrove(_redInfo.currentTroveAddress, refundAmount);
    }
    return _redInfo;
  }

  /**
   * @dev redeem desired StableCoin amount for desired collateral tokens
   * @param _stableAmount the desired amount of StableCoin to pay for redemption
   * @param _maxRate is max fee (in % with 1e18 precision) allowed to pay
   * @param _lastTroveCurrentICR ICR of the last trove to be redeemed, if matches then the hint is working and it redeems
   * @param _lastTroveNewPositionHint hint for the of the nextNewTrove after redemption for the latest trove
   */
  function redeemStableCoinForCollateral(
    address _collateralToken,
    uint256 _stableAmount,
    uint256 _maxRate,
    uint256 _lastTroveCurrentICR,
    address _lastTroveNewPositionHint
  ) public {
    IMintableToken stableCoin_cached = stableCoin;
    require(ITrove(firstTrove(_collateralToken)).collateralization() > DECIMAL_PRECISION, "a7f99 first trove is undercollateralised and must be liquidated");
    require(stableCoin_cached.balanceOf(msg.sender) >= _stableAmount, "a7f99 insufficient Fiat balance");
    require(stableCoin_cached.allowance(msg.sender, address(this)) >= _stableAmount, "a7f99 StableCoin is not approved for factory");

    IFeeRecipient feeRecipient_cache = feeRecipient;
    RedemptionInfo memory redInfo;
    redInfo.collateralToken = _collateralToken;
    redInfo.stableCoinLeft = _stableAmount;

    redInfo.currentTroveAddress = firstTrove(_collateralToken);
    redInfo = commitFullRedemptions(redInfo, _maxRate);
    redInfo = commitPartRedeem(redInfo, _maxRate, _lastTroveCurrentICR, _lastTroveNewPositionHint);
    if (redInfo.collateralRedeemed > 0) {
      stableCoin_cached.transferFrom(msg.sender, address(this), redInfo.feeAmount);
      feeRecipient_cache.takeFees(redInfo.feeAmount);

      // TODO: increase base rate after each trove redemption
      uint256 startBaseRate = feeRecipient_cache.baseRate();
      uint256 finishBaseRate = feeRecipient_cache.increaseBaseRate((redInfo.stableCoinRedeemed * DECIMAL_PRECISION) / stableCoin_cached.totalSupply());
      emit Redemption(_collateralToken, redInfo.stableCoinRedeemed, redInfo.collateralRedeemed, redInfo.stableCoinLeft, startBaseRate, finishBaseRate, redInfo.lastTroveRedeemed);
    }
  }

  function _refundFeeToTrove(address _troveAddress, uint256 _refundAmount) private {
    if (_refundAmount > 0) {
      stableCoin.transferFrom(msg.sender, _troveAddress, _refundAmount);
      ITrove(_troveAddress).repay(0, _troveAddress);
    }
  }

  /**
   * @dev function to be called from trove to change totalDebt
   * @param _borrow indicates if it is borrow or repay/liquidatin
   */
  function updateTotalDebt(uint256 _amount, bool _borrow) public override {
    ITrove trove = ITrove(msg.sender);
    address token = address(trove.token());
    require(containsTrove(token, msg.sender), "fbfd5 not a valid trove");
    if (_borrow) {
      totalDebt += _amount;
      _troves[token].totalDebt += _amount;
    } else {
      totalDebt -= _amount;
      _troves[token].totalDebt -= _amount;
    }
    emit DebtUpdate(token, totalDebt);
  }

  /// @dev to emit Liquidation event, to be called from a trove after liquidation.
  /// @param  _token address of token
  /// @param  _trove address of the Trove
  /// @param  stabilityPoolLiquidation address of StabilityPool, 0x0 if Community LiquidationPool
  /// @param  collateral uint256 amount of collateral
  function emitLiquidationEvent(address _token, address _trove, address stabilityPoolLiquidation, uint256 collateral) public override {
    emit TroveLiquidated(_trove, _token, tokenToPriceFeed.tokenPrice(_token), stabilityPoolLiquidation, collateral);
  }

  /// @dev to emit Trove's debt update event, to be called from trove
  /// @param  _token address of token
  /// @param  _newAmount new trove's debt value
  /// @param  _newCollateralization new trove's collateralization value
  function emitTroveDebtUpdate(address _token, uint256 _newAmount, uint256 _newCollateralization, uint256 _feePaid) external override {
    emit TroveDebtUpdate(
      address(msg.sender), // solhint-disable-next-line avoid-tx-origin
      address(tx.origin),
      _token,
      _newAmount,
      feeRecipient.baseRate(),
      _newCollateralization,
      _feePaid
    );
  }

  /// @dev to emit Collateral update event, to be called from trove
  /// @param  _token address of token
  /// @param  _newAmount new trove's Collateral value
  /// @param  _newCollateralization new trove's collateralization value
  function emitTroveCollateralUpdate(address _token, uint256 _newAmount, uint256 _newCollateralization) external override {
    emit TroveCollateralUpdate(address(msg.sender), _token, _newAmount, _newCollateralization);
  }
}
