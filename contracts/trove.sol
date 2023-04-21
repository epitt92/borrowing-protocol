//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/IArbitragePool.sol";
import "./interfaces/IMintableToken.sol";
import "./utils/constants.sol";
import "./interfaces/IFeeRecipient.sol";
import "./utils/BONQMath.sol";

contract Trove is ITrove, Ownable, Initializable, AccessControlEnumerable, Constants {
  using BONQMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for IERC20Metadata;

  bytes32 public constant override OWNER_ROLE = keccak256("OWNER_ROLE");

  struct ArbitrageState {
    IArbitragePool arbitragePool;
    IMintableToken apToken;
    uint256 lastApPrice;
  }

  ITroveFactory public immutable override factory;
  IERC20 public override token;
  // solhint-disable-next-line var-name-mixedcase
  uint256 public override TOKEN_PRECISION;

  uint256 private _debt;
  uint256 public liquidationReserve;
  uint256 public override recordedCollateral;
  uint256 public liqTokenRateSnapshot;
  bool public arbitrageParticipation;
  ArbitrageState public arbitrageState;
  IERC20 public bonqToken;

  event Liquidated(address trove, uint256 debt, uint256 collateral);

  /**
   * @dev restrict the call to be from the factory contract
   */
  modifier onlyFactory() {
    require(msg.sender == address(factory), "1210a only callable from factory");
    _;
  }

  modifier onlyTroveOwner() {
    require(hasRole(OWNER_ROLE, msg.sender), "cfa3b address is missing OWNER_ROLE");
    _;
  }

  modifier whenFactoryNotPaused() {
    require(!Pausable(address(factory)).paused(), "cfa4b Trove Factory is paused");
    _;
  }

  constructor(address _factory) {
    factory = ITroveFactory(_factory);
  }

  function initialize(address _token, address _troveOwner) public override initializer {
    //    require(_factory != address(0x0), "41fe68 _factory must not be address 0x0");
    require(_token != address(0x0), "41fe68 _token must not be address 0x0");
    require(_troveOwner != address(0x0), "41fe68 _troveOwner must not be address 0x0");
    //    factory = ITroveFactory(_factory);
    _transferOwnership(_troveOwner);
    _initializeMainOwners(_troveOwner, address(factory));
    token = IERC20(_token);
    TOKEN_PRECISION = 10 ** (IERC20Metadata(_token).decimals());
    liqTokenRateSnapshot = factory.liquidationPool(_token).liqTokenRate();
    // allow the fee recipient contract to transfer as many tokens as it wants from the trove
    factory.stableCoin().approve(address(factory.feeRecipient()), MAX_INT);
    bonqToken = factory.bonqToken();
  }

  function owner() public view override(Ownable, IOwnable) returns (address) {
    return Ownable.owner();
  }

  /**
   * @dev the Minimum Collateralisation Ratio for this trove as set in the Token to Price Feed contract.
   */
  function mcr() public view override returns (uint256) {
    return factory.tokenToPriceFeed().mcr(address(token));
  }

  /**
   * @dev the reward in the liquidation pool which has not been claimed yet
   */
  function unclaimedArbitrageReward() public view returns (uint256) {
    uint256 apBalance = arbitrageState.apToken.balanceOf(address(this));
    uint256 newApPrice = arbitrageState.arbitragePool.getAPtokenPrice(address(token));
    uint256 priceChange = newApPrice - arbitrageState.lastApPrice;
    return (apBalance * priceChange) / DECIMAL_PRECISION;
  }

  /**
   * @dev the reward in the liquidation pool which has not been claimed yet
   */
  function unclaimedCollateralRewardAndDebt() public view returns (uint256, uint256) {
    ILiquidationPool pool = factory.liquidationPool(address(token));
    uint256 currentLiqTokenRate = pool.liqTokenRate();
    return _unclaimedCollateralRewardAndDebt(pool, currentLiqTokenRate);
  }

  /**
   * @dev this function will return the actual collateral (balance of the collateral token) including any liquidation rewards from community liquidation
   */
  function collateral() public view override returns (uint256) {
    (uint256 unclaimedCollateral, ) = unclaimedCollateralRewardAndDebt();
    uint256 baseValue = token.balanceOf(address(this)) + unclaimedCollateral;
    if (arbitrageParticipation) {
      uint256 apBalance = arbitrageState.apToken.balanceOf(address(this));
      uint256 newApPrice = arbitrageState.arbitragePool.getAPtokenPrice(address(token));
      return baseValue + (apBalance * newApPrice) / DECIMAL_PRECISION;
    }
    return baseValue;
  }

  /**
   * @dev this function will return the actual debt including any liquidation liabilities from community liquidation
   */
  function debt() public view override returns (uint256) {
    (, uint256 unclaimedDebt) = unclaimedCollateralRewardAndDebt();
    return _debt + unclaimedDebt;
  }

  /**
   * @dev the net debt is the debt minus the liquidation reserve
   */
  function netDebt() public view override returns (uint256) {
    return debt() - liquidationReserve;
  }

  function normalisedDecimals(uint256 tokenAmount) private view returns (uint256) {
    return (tokenAmount * DECIMAL_PRECISION) / TOKEN_PRECISION;
  }

  /**
   * @dev the value of the collateral * the current price as returned by the price feed contract for the collateral token
   */
  function collateralValue() public view override returns (uint256) {
    return (normalisedDecimals(collateral()) * factory.tokenToPriceFeed().tokenPrice(address(token))) / DECIMAL_PRECISION;
  }

  /**
   * @dev the Individual Collateralisation Ratio (ICR) of the trove
   */
  function collateralization() public view override returns (uint256) {
    uint256 troveDebt = debt();
    if (troveDebt > 0) {
      return (DECIMAL_PRECISION * collateralValue()) / troveDebt;
    } else {
      return MAX_INT;
    }
  }

  /**
   * @dev the Individual Collateralisation Ratio (ICR) of the trove. this private function can be used when it is certain
   * that the _debt state variable has been updated correctly beforehand
   */
  function _collateralization() private view returns (uint256) {
    if (_debt > 0) {
      // the token price is multiplied by DECIMAL_PRECISION
      return (normalisedDecimals(recordedCollateral) * factory.tokenToPriceFeed().tokenPrice(address(token))) / _debt;
    } else {
      return MAX_INT;
    }
  }

  /**
   * @dev transfers user's trove ownership after revoking other roles from other addresses
   * @param _newOwner the address of the new owner
   */
  function transferOwnership(address _newOwner) public override(Ownable, IOwnable) {
    Ownable.transferOwnership(_newOwner);
    for (uint256 i = getRoleMemberCount(OWNER_ROLE); i > 0; i--) {
      _revokeRole(OWNER_ROLE, getRoleMember(OWNER_ROLE, i - 1));
    }
    _initializeMainOwners(_newOwner, address(factory));
  }

  /**
   * @dev add an address to the list of owners
   * @param _newOwner the address of the new owner
   */
  function addOwner(address _newOwner) public override onlyTroveOwner {
    _grantRole(OWNER_ROLE, _newOwner);
  }

  /**
   * @dev add an address to the list of owners
   * @param _ownerToRemove the address of the new owner
   */
  function removeOwner(address _ownerToRemove) public override onlyTroveOwner {
    require(owner() != _ownerToRemove && _ownerToRemove != address(factory), "604e3 do not remove main owner");
    _revokeRole(OWNER_ROLE, _ownerToRemove);
  }

  /**
   * @dev used to set the OWNER_ROLE for _troveOwner and _factory
   * @param _troveOwner the address of the new owner
   * @param _factory the address of the factory
   */
  function _initializeMainOwners(address _troveOwner, address _factory) private {
    _grantRole(OWNER_ROLE, _troveOwner);
    _grantRole(OWNER_ROLE, _factory);
  }

  /**
   * @dev insert the trove in the factory contract in the right spot of the list of troves with the same token
   * @param _newNextTrove is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions
   */
  function insertTrove(address _newNextTrove) private {
    // insertTrove is only called after updateCollateral has been invoked and the _debt variable has been updated
    require(_collateralization() >= mcr(), "41670 TCR must be > MCR");
    // only call insertTrove if there are more than one troves in the list
    address tokenAddress = address(token);
    if (factory.troveCount(tokenAddress) > 1) {
      factory.insertTrove(tokenAddress, _newNextTrove);
    }
  }

  /**
   * @dev mint some stable coins and pay the issuance fee. The transaction will fail if the resulting ICR < MCR
   * @param _recipient is the address to which the newly minted tokens will be transferred
   * @param _amount the value of the minting
   * @param _newNextTrove is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions
   */
  function borrow(address _recipient, uint256 _amount, address _newNextTrove) public override onlyTroveOwner whenFactoryNotPaused {
    uint256 feeAmount = _borrow(_amount, _newNextTrove);
    IERC20(factory.stableCoin()).safeTransfer(_recipient, _amount);
    // the event is emitted by the factory so that we don't need to spy on each trove to get the system status in PGSQL
    factory.emitTroveDebtUpdate(address(token), _debt, _collateralization(), feeAmount);
  }

  /**
   * @dev repay a portion of the debt by either sending some stable coins to the trove or allowing the trove to take tokens out of your balance
   * @param _amount the amount of stable coins to reduce the debt with
   * @param _newNextTrove is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions
   */
  function repay(uint256 _amount, address _newNextTrove) public override {
    // updates collateral and debt state variables hence there is no need to call the debt() function later
    _updateCollateral();
    require(_debt > 0, "e37b2 debt must be gt than 0");
    IMintableToken stableCoin = factory.stableCoin();
    uint256 liquidationReserve_cache = liquidationReserve;
    if (_amount > 0) {
      _amount = _amount.min(_debt - liquidationReserve_cache);
      IERC20(stableCoin).safeTransferFrom(msg.sender, address(this), _amount);
    } else {
      _amount = _debt.min(stableCoin.balanceOf(address(this)) - liquidationReserve_cache);
      require(_amount > 0, "e37b2 insufficient funds");
    }

    stableCoin.burn(_amount);
    _debt -= _amount;
    if (_debt == liquidationReserve_cache) {
      stableCoin.burn(liquidationReserve_cache);
      _amount += liquidationReserve_cache;
      _debt = 0;
      liquidationReserve = 0;
    }
    // reduce total debt (false == reduction)
    factory.updateTotalDebt(_amount, false);
    insertTrove(_newNextTrove);

    factory.emitTroveDebtUpdate(address(token), _debt, _collateralization(), 0);
  }

  /**
   * @dev if there have been liquidations since the last time this trove's state was updated, it should fetch the available rewards and debt
   */
  function getLiquidationRewards() internal {
    IERC20 token_cache = token;
    ILiquidationPool pool = factory.liquidationPool(address(token_cache));
    uint256 currentLiqTokenRate = pool.liqTokenRate();
    (uint256 unclaimedCollateral, uint256 unclaimedDebt) = _unclaimedCollateralRewardAndDebt(pool, currentLiqTokenRate);
    if (unclaimedCollateral > 0) {
      pool.claimCollateralAndDebt(unclaimedCollateral, unclaimedDebt);
      recordedCollateral += unclaimedCollateral;
      _debt += unclaimedDebt;
      liqTokenRateSnapshot = currentLiqTokenRate;
      if (arbitrageParticipation) {
        arbitrageState.arbitragePool.deposit(address(token_cache), unclaimedCollateral);
        arbitrageState.lastApPrice = arbitrageState.arbitragePool.getAPtokenPrice(address(token_cache));
      }
    }
  }

  /**
   * @dev mint some stable coins and pay the issuance fee. The transaction will fail if the resulting ICR < MCR
   * @param _amount the value of the minting
   * @param _newNextTrove is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions
   * @param _feeAmount it's the minting fee
   */
  function _borrow(uint256 _amount, address _newNextTrove) private returns (uint256 _feeAmount) {
    require(_amount >= DECIMAL_PRECISION, "cb29c amount must be gt 1 token");
    _updateCollateral();
    IFeeRecipient feeRecipient = factory.feeRecipient();
    _feeAmount = feeRecipient.getBorrowingFee(_amount);
    uint256 amountToMint = _amount + _feeAmount;

    if (liquidationReserve == 0) {
      liquidationReserve = LIQUIDATION_RESERVE;
      amountToMint += LIQUIDATION_RESERVE;
    }
    _debt += amountToMint;
    insertTrove(_newNextTrove);
    factory.tokenOwner().mint(address(this), amountToMint);
    feeRecipient.takeFees(_feeAmount);
    // TODO: add debt to the parameters and call emitTroveDebtUpdate from updateTotalDebt to avoid two calls
    factory.updateTotalDebt(amountToMint, true);
  }

  /**
   * @dev the reward in the liquidation pool which has not been claimed yet
   */
  function _unclaimedCollateralRewardAndDebt(ILiquidationPool _pool, uint256 _currentLiqTokenRate) private view returns (uint256, uint256) {
    uint256 _liqTokenRateSnapshot = liqTokenRateSnapshot;
    // we use the recordedCollateral because the collateralPerStakedToken is computed with the explicitly added collateral only
    uint256 unclaimedCollateral;
    uint256 unclaimedDebt;

    if (_currentLiqTokenRate > _liqTokenRateSnapshot) {
      uint256 poolCollateral = _pool.collateral();
      if (poolCollateral > 0) {
        uint256 recordedCollateralCache = recordedCollateral;

        unclaimedCollateral = ((recordedCollateralCache * _currentLiqTokenRate) / _liqTokenRateSnapshot) - recordedCollateralCache;
        unclaimedDebt = (_pool.debt() * unclaimedCollateral) / _pool.collateral();
      }
    }
    return (unclaimedCollateral, unclaimedDebt);
  }

  /**
   * @dev update the state variables recordedCollateral and rewardRatioSnapshot and get all the collateral into the trove
   */
  function _updateCollateral() private returns (uint256) {
    getLiquidationRewards();
    uint256 startRecordedCollateral = recordedCollateral;
    // make sure all tokens sent to or transferred out of the contract are taken into account
    IERC20 token_cache = token;
    uint256 newRecordedCollateral;
    if (arbitrageParticipation) {
      uint256 tokenBalance = token_cache.balanceOf(address(this));
      if (tokenBalance > 0) arbitrageState.arbitragePool.deposit(address(token_cache), tokenBalance);
      newRecordedCollateral = arbitrageState.apToken.balanceOf(address(this));
      arbitrageState.lastApPrice = arbitrageState.arbitragePool.getAPtokenPrice(address(token_cache));
    } else {
      newRecordedCollateral = token_cache.balanceOf(address(this));
    }
    recordedCollateral = newRecordedCollateral;
    // getLiquidationRewards updates recordedCollateral

    if (newRecordedCollateral != startRecordedCollateral) {
      factory.updateTotalCollateral(
        address(token_cache),
        newRecordedCollateral.max(startRecordedCollateral) - newRecordedCollateral.min(startRecordedCollateral),
        newRecordedCollateral >= startRecordedCollateral
      );
    }
    return newRecordedCollateral;
  }

  /**
   * @dev there are two options to increase the collateral:
   * 1. transfer the tokens to the trove and call increaseCollateral with amount = 0
   * 2. grant the trove permission to transfer from your account and call increaseCollateral with amount > 0
   * @param _amount a positive amount to transfer from the sender's account or zero
   * @param _newNextTrove once the trove is better collateralised, its position in the list will change, the caller
   * should indicate the new position in order to reduce gas consumption
   */
  function increaseCollateral(uint256 _amount, address _newNextTrove) public override {
    IERC20 token_cache = token;
    if (_amount > 0) {
      token_cache.safeTransferFrom(msg.sender, address(this), _amount);
    }
    uint256 newRecordedCollateral = _updateCollateral();

    if (_debt > 0) {
      insertTrove(_newNextTrove);
    }
    factory.emitTroveCollateralUpdate(address(token_cache), newRecordedCollateral, _collateralization());
  }

  /**
   * @dev send some or all of the balance of the trove to an arbitrary address. Only the owner of the trove can do this
   * as long as the debt is Zero, the transfer is performed without further checks.
   * once the debt is not zero, the trove position in the trove list is changed to keep the list ordered by
   * collateralisation ratio
   * @param _recipient the address which will receive the tokens
   * @param _amount amount of collateral
   * @param _newNextTrove hint for next trove after reorder
   */
  function decreaseCollateral(address _recipient, uint256 _amount, address _newNextTrove) public override onlyTroveOwner {
    // make sure all the tokens are held by the trove before attempting to transfer
    getLiquidationRewards();
    IERC20 token_cache = token;
    if (arbitrageParticipation) {
      uint256 withdrawAmount = (_amount * TOKEN_PRECISION) / arbitrageState.arbitragePool.getAPtokenPrice(address(token_cache));
      arbitrageState.arbitragePool.withdraw(address(token_cache), withdrawAmount);
    }
    /* solhint-disable reentrancy */
    // recordedCollateral is updated by calling _updateCollateral() before borrowing, repaying or increasing collateral.
    // Calling this function in a reentrant way would not allow the attacker to get anything more
    token_cache.safeTransfer(_recipient, _amount);
    uint256 newRecordedCollateral = _updateCollateral();
    /* solhint-disable reentrancy */

    if (_debt > 0) {
      // the ICR will be checked in insertTrove
      insertTrove(_newNextTrove);
    }
    factory.emitTroveCollateralUpdate(address(token_cache), newRecordedCollateral, _collateralization());
  }

  /**
   * @dev withdraw some BONQ from trove
   * @param _amount amount of BONQ
   */
  function unstakeBONQ(uint256 _amount) public override onlyTroveOwner {
    require(_amount <= bonqStake(), "e6c7d7 withdraw amount exceeds balance");
    bonqToken.safeTransfer(msg.sender, _amount);
  }

  /**
   * @dev get amount of BONQ staked in the trove
   */
  function bonqStake() public view override returns (uint256) {
    return bonqToken.balanceOf(address(this));
  }

  /**
   * @dev is called to redeem StableCoin for token, called by factory when MCR > ICR,
   * amount of StableCoin is taken from balance and must be <= netDebt.
   * uses priceFeed to calculate collateral amount.
   * returns amount of StableCoin used and collateral received
   * @param _recipient the address which receives redeemed token
   * @param _newNextTrove hint for next trove after reorder, if it's not full redemption
   */
  function redeem(address _recipient, address _newNextTrove) public override onlyFactory returns (uint256 _stableAmount, uint256 _collateralReceived) {
    getLiquidationRewards();
    require(mcr() <= _collateralization(), "e957f TCR must be gte MCR");
    _stableAmount = factory.stableCoin().balanceOf(address(this)) - liquidationReserve;
    require(_newNextTrove == address(0) ? _stableAmount == netDebt() : _stableAmount <= netDebt(), "e957f amount != debt and no hint");

    IERC20 token_cache = token;

    uint256 collateralToTransfer = (((_stableAmount * DECIMAL_PRECISION) / factory.tokenToPriceFeed().tokenPrice(address(token_cache))) * TOKEN_PRECISION) / DECIMAL_PRECISION;

    if (arbitrageParticipation) {
      uint256 withdrawAmount = (collateralToTransfer * TOKEN_PRECISION) / arbitrageState.arbitragePool.getAPtokenPrice(address(token_cache));
      arbitrageState.arbitragePool.withdraw(address(token_cache), withdrawAmount);
    }

    token_cache.safeTransfer(_recipient, collateralToTransfer);
    _collateralReceived = collateralToTransfer;

    repay(0, _newNextTrove); // repays from trove balance transfered before call
    return (_stableAmount, _collateralReceived);
  }

  /**
   * @dev is called to liquidate the trove, if ICR < MCR then all the collateral is sent to the liquidation pool and the debt is forgiven
   * the msg.sender is allowed to transfer the liquidation reserve out of the trove
   */
  function liquidate() public {
    _updateCollateral();
    require(_collateralization() < mcr(), "454f4 CR must lt MCR");
    IERC20 token_cache = token;
    IStabilityPoolBase stabilityPool = factory.stabilityPool();
    // allow the sender to retrieve the liquidationReserve
    factory.stableCoin().approve(msg.sender, liquidationReserve);
    if (arbitrageParticipation) {
      setArbitrageParticipation(false);
    }
    if (!Pausable(address(factory)).paused() && (_collateralization() > DECIMAL_PRECISION) && (stabilityPool.totalDeposit() >= debt())) {
      token_cache.safeApprove(address(stabilityPool), recordedCollateral);
      // the collateral is transferred to the stabilityPool and is not used as collateral anymore
      factory.updateTotalCollateral(address(token_cache), recordedCollateral, false);
      factory.updateTotalDebt(_debt, false);
      stabilityPool.liquidate();
    } else {
      ILiquidationPool pool = factory.liquidationPool(address(token_cache));
      token_cache.safeApprove(address(pool), recordedCollateral);
      pool.liquidate();
      liqTokenRateSnapshot = pool.liqTokenRate();
    }
    _debt -= liquidationReserve;
    emit Liquidated(address(this), _debt, recordedCollateral);
    _debt = 0;
    liquidationReserve = 0;
    recordedCollateral = 0;
    // liquidated troves have no debt and no collateral and should be removed from the list of troves
    factory.removeTrove(address(token_cache), address(this));
  }

  /**
   * @dev security function to make sure that if tokens are sent to the trove by mistake, they're not lost.
   * It will always send the entire balance
   * This function can not be used to transfer the collateral token
   * @param _token the ERC20 to transfer
   * @param _recipient the address the transfer should go to
   */
  function transferToken(address _token, address _recipient) public onlyTroveOwner {
    require(_token != address(token), "7a810 can't transfer collateral");
    require(_token != address(factory.stableCoin()), "7a810 can't transfer stable coin");
    uint256 _amount = IERC20(_token).balanceOf(address(this));
    IERC20(_token).safeTransfer(_recipient, _amount);
  }

  /**
   * @dev configuration function to enable or disable collateral participation in ArbitragePool
   * @param _state true/false to turn the state on/off
   */
  function setArbitrageParticipation(bool _state) public override onlyTroveOwner {
    if (arbitrageParticipation == _state) return;
    _updateCollateral();
    IERC20 tokenCache = token;
    arbitrageParticipation = _state;
    IArbitragePool _arbitragePool = IArbitragePool(factory.arbitragePool());
    if (_state) {
      tokenCache.safeApprove(address(_arbitragePool), MAX_INT);
      IMintableToken _apToken = _arbitragePool.collateralToAPToken(address(tokenCache));
      _apToken.approve(address(_arbitragePool), MAX_INT);
      arbitrageState.arbitragePool = _arbitragePool;
      arbitrageState.apToken = _apToken;
      uint256 tokenBalance = tokenCache.balanceOf(address(this));
      if (tokenBalance > 0) _arbitragePool.deposit(address(tokenCache), tokenBalance);
      arbitrageState.lastApPrice = _arbitragePool.getAPtokenPrice(address(tokenCache));
    } else {
      tokenCache.safeApprove(address(_arbitragePool), 0);
      uint256 arbitrageBalance = arbitrageState.apToken.balanceOf(address(this));
      if (arbitrageBalance > 0) arbitrageState.arbitragePool.withdraw(address(tokenCache), arbitrageBalance);
      delete arbitrageState;
    }
  }
}
