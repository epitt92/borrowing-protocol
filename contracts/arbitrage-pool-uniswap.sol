//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/uniswap/IUniswapV3Router.sol";
import "./interfaces/IStabilityPoolUniswap.sol";
import "./interfaces/ITroveFactory.sol";
import "./interfaces/IMintableToken.sol";
import "./APToken.sol";
import "./utils/BONQMath.sol";
import "./utils/constants.sol";
import "./uniswap-v3-arbitrage-function.sol";

/// @title is used to liquidate troves and reward depositors with collateral redeemed
contract ArbitragePoolUniswap is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, Constants, UniswapV3Arbitrage {
  using BONQMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for IERC20Metadata;

  /// @dev stores APtoken address for each token
  mapping(address => IMintableToken) public collateralToAPToken;
  /// @dev stores totalDeposit + rewards value for each collateral
  mapping(address => uint256) public depositsAndRewards;

  ITroveFactory public immutable factory;
  IUniswapV3Router public immutable router;

  event Deposit(address _collateralToken, address _contributor, uint256 _amount, uint256 _apAmount);
  event Withdraw(address _collateralToken, address _contributor, uint256 _amount, uint256 _apAmount);
  event Arbitrage(address _collateralToken, address[] _path, uint256 _amountIn, uint256 _amountOut);
  event APtokenDeployed(address _collateralToken, address _apToken);

  // solhint-disable-next-line func-visibility
  constructor(address _factory, address _router) {
    require(_factory != address(0x0), "55115b trove factory must not be address 0x0");
    require(_router != address(0x0), "55115b router address must not be address 0x0");
    factory = ITroveFactory(_factory);
    router = IUniswapV3Router(_router);
    // to prevent contract implementation to be reinitialized by someone else
    _disableInitializers();
  }

  function initialize() public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
  }

  /// @dev make the contract upgradeable by its owner
  function _authorizeUpgrade(address) internal override onlyOwner {}

  function name() public view virtual returns (string memory) {
    return "ArbitragePoolUniswap";
  }

  /// @dev calculates the price of APtoken by baseToken/apToken.supply()
  /// @param  _collateralToken IERC20 address of base token
  /// @param  _apToken IMintableToken address of AP token
  function _apTokenPrice(address _collateralToken, IMintableToken _apToken) internal view returns (uint256) {
    uint256 colDepositAndRewards = depositsAndRewards[_collateralToken];
    uint256 apSupply = _apToken.totalSupply();
    if (colDepositAndRewards == 0 || apSupply == 0) return DECIMAL_PRECISION;
    return (colDepositAndRewards * DECIMAL_PRECISION) / _apToken.totalSupply();
  }

  /// @dev calculates the price of APtoken by baseToken/apToken.supply()
  /// @param  _collateralToken IERC20 address of base token
  function getAPtokenPrice(address _collateralToken) external view returns (uint256) {
    IMintableToken apToken = collateralToAPToken[_collateralToken];
    return _apTokenPrice(_collateralToken, apToken);
  }

  /// @dev to deposit collateral into ArbitragePool and get APtoken
  /// @param  _collateralToken amount to deposit
  /// @param  _amount amount to deposit
  function deposit(address _collateralToken, uint256 _amount) public nonReentrant {
    IMintableToken apToken = collateralToAPToken[_collateralToken];
    require(address(apToken) != address(0), "d7db9 token must have APtoken");
    require(_amount > 0, "d7db9 deposit amount must be bigger than zero");

    uint256 startPrice = _apTokenPrice(_collateralToken, apToken);
    require(IERC20(_collateralToken).transferFrom(msg.sender, address(this), _amount), "150aa0 transfer from failed");
    uint256 amountToMint = (_amount * DECIMAL_PRECISION) / startPrice;
    apToken.mint(msg.sender, amountToMint);
    depositsAndRewards[_collateralToken] += _amount;

    emit Deposit(_collateralToken, msg.sender, _amount, amountToMint);
  }

  /// @dev to withdraw collateral from ArbitragePool by redeeming APtoken
  /// @param  _collateralToken amount to withdraw
  /// @param  _amount amount of APtoken to give
  function withdraw(address _collateralToken, uint256 _amount) public nonReentrant {
    IMintableToken apToken = collateralToAPToken[_collateralToken];
    require(_amount > 0, "3b329 withdrawal amount must be bigger than 0");
    // firstly transfer AP token, then calculating collateral amount
    apToken.transferFrom(msg.sender, address(this), _amount);
    uint256 amountOut = (_amount * _apTokenPrice(_collateralToken, apToken)) / DECIMAL_PRECISION;
    // firstly burn AP token, decrease totalDeposit then transfer collateral
    apToken.burn(_amount);
    depositsAndRewards[_collateralToken] -= amountOut;
    IERC20(_collateralToken).safeTransfer(msg.sender, amountOut);

    emit Withdraw(_collateralToken, msg.sender, amountOut, _amount);
  }

  /// @dev to do arbitrage
  /// @param  _amountIn start amount
  /// @param  _path the path for the swap
  /// @param  _fees the fees for the swap
  /// @param  expiry the timeout for the swap
  function arbitrage(
    uint256 _amountIn,
    address[] calldata _path,
    uint24[] calldata _fees,
    uint256 expiry
  ) public nonReentrant {
    uint256 amountOut;

    if (_path[0] == address(factory.stableCoin())) {
      IMintableToken stableCoin = factory.stableCoin();
      uint256 startBalance = stableCoin.balanceOf(address(this));
      IStabilityPoolUniswap(address(factory.stabilityPool())).arbitrage(_amountIn, _path, _fees, expiry);
      stableCoin.transfer(msg.sender, stableCoin.balanceOf(address(this)) - startBalance);
    } else {
      amountOut = _arbitrage(router, _amountIn, _path, _fees, expiry);
      uint256 senderShare = (amountOut * factory.arbitrageShareRatio()) / DECIMAL_PRECISION;
      amountOut -= senderShare;
      IERC20(_path[0]).transfer(msg.sender, senderShare);
      depositsAndRewards[_path[0]] += amountOut;
      emit Arbitrage(_path[0], _path, _amountIn, amountOut);
    }
  }

  /// @dev to add new supported collateral by deploying APtoken for it
  /// @param  _collateralToken collateral to be added
  function addToken(address _collateralToken) public {
    require(address(collateralToAPToken[_collateralToken]) == address(0x0), "ac342 the token has already been added");
    IERC20Metadata collateralToken = IERC20Metadata(_collateralToken);
    string memory apTokenName = string(abi.encodePacked("APToken for ", collateralToken.name()));
    string memory apTokenSymbol = string(abi.encodePacked("AP", collateralToken.symbol()));
    APToken newAPtoken = new APToken(apTokenName, apTokenSymbol, _collateralToken);
    address newAPtokenAddress = address(newAPtoken);
    collateralToAPToken[_collateralToken] = IMintableToken(newAPtokenAddress);
    collateralToken.safeApprove(address(router), MAX_INT);

    emit APtokenDeployed(_collateralToken, newAPtokenAddress);
  }

  /// @dev approves the list collateral tokens on Router to enable arbitrage,
  /// should be called when the router was changed.
  /// @param  _collateralTokens list of collateralToken addresses
  function batchApproveRouter(address[] calldata _collateralTokens) public {
    address routerAddress = address(router);
    uint256 i;
    for (i; i < _collateralTokens.length; i++) {
      IERC20 collateralToken = IERC20(_collateralTokens[i]);
      collateralToken.approve(routerAddress, MAX_INT);
    }
  }

  /// @dev moves extra collateral that was sent by mistake to the contract from the balance
  /// @param  _collateralToken collateralToken addresses
  function transferExtraCollateral(address _collateralToken, address _recipient) public onlyOwner {
    IERC20 collateralToken = IERC20(_collateralToken);
    uint256 colBalance = collateralToken.balanceOf(address(this));
    uint256 colDepositAndRewards = depositsAndRewards[_collateralToken];
    collateralToken.safeTransfer(_recipient, colBalance - colDepositAndRewards);
  }
}
