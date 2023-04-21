// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "./chainlink-price-feed.sol";

interface IArrakisVault is IERC20 {
  function getUnderlyingBalances() external view returns (uint256 amount0Current, uint256 amount1Current);

  function token0() external view returns (address);
}

contract ArrakisVaultPriceFeed is IPriceFeed, Constants {
  IArrakisVault public immutable vault;
  // token must be implemented by pricefeed and it will be cheapest as an immutable
  address public immutable override token;
  IPriceFeed public immutable priceFeed;
  bool public immutable isToken0;
  uint256 public immutable precision;

  constructor(address _vault, address _priceFeed) {
    require(_vault != address(0x0), "e2637b vault must not be address 0x0");
    require(_priceFeed != address(0x0), "e2637b priceFeed must not be address 0x0");
    vault = IArrakisVault(_vault);
    address _token = IPriceFeed(_priceFeed).token();
    token = _vault;
    priceFeed = IPriceFeed(_priceFeed);
    isToken0 = IArrakisVault(_vault).token0() == _token;
    precision = 10**IERC20Metadata(_token).decimals();
  }

  function price() public view override returns (uint256) {
    uint256 avTokenSupply = vault.totalSupply();
    (uint256 t0Balance, uint256 t1Balance) = vault.getUnderlyingBalances();
    // normalise balance to 18 decimals
    uint256 tBalance = ((isToken0 ? t0Balance : t1Balance) * DECIMAL_PRECISION) / precision;
    return (priceFeed.price() * tBalance) / avTokenSupply;
  }

  function pricePoint() public view override returns (uint256) {
    return price();
  }

  function emitPriceSignal() public {
    emit PriceUpdate(token, price(), price());
  }
}
