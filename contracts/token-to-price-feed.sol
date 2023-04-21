//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "./interfaces/IPriceFeed.sol";
import "./utils/constants.sol";
import "./interfaces/ITokenPriceFeed.sol";

contract TokenToPriceFeed is Ownable, Constants, ITokenPriceFeed {
  // the token list is a mapping from Token address to Price Feed address
  mapping(address => TokenInfo) public tokens;

  function owner() public view override(Ownable, IOwnable) returns (address) {
    return Ownable.owner();
  }

  /// @dev to get token price
  /// @param  _token address of the token
  function tokenPrice(address _token) public view override returns (uint256) {
    return IPriceFeed(tokens[_token].priceFeed).price();
  }

  function tokenPriceFeed(address _token) public view override returns (address) {
    return tokens[_token].priceFeed;
  }

  function mcr(address _token) public view override returns (uint256) {
    return tokens[_token].mcr;
  }

  function mrf(address _token) public view override returns (uint256) {
    return tokens[_token].mrf;
  }

  /// @dev to set or change priceFeed contract for token
  /// @param  _token address of the token
  /// @param  _priceFeed address of the PriceFeed contract for token
  /// @param  _mcr minimal collateral ratio of the token
  /// @param  _maxRedemptionFeeBasisPoints maximum redemption fee in Basis Points or 100th of percent
  function setTokenPriceFeed(
    address _token,
    address _priceFeed,
    uint256 _mcr,
    uint256 _maxRedemptionFeeBasisPoints
  ) public override onlyOwner {
    require(_mcr >= 100, "f0925e MCR < 100");
    TokenInfo memory token = tokens[_token];
    token.priceFeed = _priceFeed;
    IERC20Metadata erc20 = IERC20Metadata(_token);
    token.mcr = (DECIMAL_PRECISION * _mcr) / 100;
    token.mrf = (_maxRedemptionFeeBasisPoints * DECIMAL_PRECISION) / 10_000;
    emit NewTokenPriceFeed(_token, _priceFeed, erc20.name(), erc20.symbol(), token.mcr, token.mrf);
    tokens[_token] = token;
  }

  /**
   * @dev transfers user's trove ownership after revoking other roles from other addresses
   * @param _newOwner the address of the new owner
   */
  function transferOwnership(address _newOwner) public override(Ownable, IOwnable) {
    Ownable.transferOwnership(_newOwner);
  }

  /// @dev to set or change priceFeed contract for token
  /// @param  _token address of the token
  /// @param  _priceAverage time weighed price average
  /// @param  _pricePoint last price recorded to moving average
  function emitPriceUpdate(
    address _token,
    uint256 _priceAverage,
    uint256 _pricePoint
  ) external override {
    require(tokens[_token].priceFeed == msg.sender, "e2b188 price feed not found in the list");
    emit PriceUpdate(_token, _priceAverage, _pricePoint);
  }
}
