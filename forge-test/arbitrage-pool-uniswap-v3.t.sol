// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/fixed-supply-token.sol";
import "../contracts/arbitrage-pool-uniswap.sol";
import "../contracts/bonq-proxy.sol";

contract FixedSupplyTokenTest is Test {
  address[] public addresses;
  uint256[] public amounts;

  // addresses are from Mumbai, this test will only work if the chain is forked or accessed directly
  // the setup is valid as of block 31057364
  IMintableToken public constant usdc = IMintableToken(0x7D4c36c79b89E1f3eA63A38C1DdB16EF8c394bc8);
  IMintableToken public constant beur = IMintableToken(0x397a36aB852f5476fC2c9434a76fB59D9754b21e);
  IMintableToken public constant albt = IMintableToken(0xEeC2266a0ea9d1970Fe692273839dBBB6A9AE598);
  address public constant router = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
  address public constant factory = 0xd782ca37922194eAa172096DD16C8Fec1fBF44fb;

  ArbitragePoolUniswap pool;

  function setUp() public {
    bytes memory _data;
    ArbitragePoolUniswap _pool = new ArbitragePoolUniswap(factory, router);
    pool = ArbitragePoolUniswap(address(new BonqProxy(address(_pool), _data)));
    pool.initialize();
    usdc.mint(address(this), 1e24);
    beur.mint(address(this), 1e24);
    albt.mint(address(this), 1e24);
  }

  function testCheckSetup() public {
    assertEq(usdc.balanceOf(address(this)), 1e24);
    assertEq(beur.balanceOf(address(this)), 1e24);
    assertEq(albt.balanceOf(address(this)), 1e24);
  }

  function testHappyPath() public {

  }

}
