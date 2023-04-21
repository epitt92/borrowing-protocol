// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/mintable-token.sol";

contract MintableTokenTest is Test {
  MintableToken public token;

  function setUp() public {
    token = new MintableToken("Test Mintable Token", "TMT");
  }

  function testOwner() public {
    assertEq(token.owner(), address(this));
  }

  function testOwnerCanMint() public {
    token.mint(address(1), 1e18);
    assertEq(token.balanceOf(address(1)), 1e18);
  }

  function testNonOwnerCanNotMint() public {
    vm.prank(address(1));
    vm.expectRevert(bytes("Ownable: caller is not the owner"));
    token.mint(address(this), 1e18);
  }

  function testHolderCanBurn() public {
    testOwnerCanMint();
    vm.prank(address(1));
    token.burn(9e17);
    assertEq(token.balanceOf(address(1)), 1e17);
  }

  function testNonHolderCanNotBurn() public {
    vm.expectRevert(bytes("ERC20: burn amount exceeds balance"));
    token.burn(9e17);
  }
}
