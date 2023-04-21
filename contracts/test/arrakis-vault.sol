// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../price-feeds/arrakis-vault-price-feed.sol";
import "../utils/constants.sol";
import "./test-mintable-token.sol";

contract ArrakisVaultUSDC is IArrakisVault, TestMintableToken, Constants {
  address public override token0;

  constructor(address _token0) TestMintableToken("Arrakis AP Token BEUR/USDC", "ALBU") {
    mint(msg.sender, DECIMAL_PRECISION * 1000);
    token0 = _token0;
  }

  function getUnderlyingBalances() public view override returns (uint256 amount0Current, uint256 amount1Current) {
    // USDC has 6 decimals
    amount0Current = 10**6 * 800;
    amount1Current = DECIMAL_PRECISION * 1000;
  }
}

contract ArrakisVaultWETH is IArrakisVault, TestMintableToken, Constants {
  address public override token0;

  constructor(address _token0) TestMintableToken("Arrakis AP Token BEUR/WETH", "ALBE") {
    mint(msg.sender, DECIMAL_PRECISION * 1000);
    token0 = _token0;
  }

  function getUnderlyingBalances() public view returns (uint256 amount0Current, uint256 amount1Current) {
    amount0Current = DECIMAL_PRECISION * 1000;
    amount1Current = DECIMAL_PRECISION * 80;
  }
}
