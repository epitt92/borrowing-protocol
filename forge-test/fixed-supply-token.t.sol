// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/fixed-supply-token.sol";

contract FixedSupplyTokenTest is Test {
  address[] public addresses;
  uint256[] public amounts;

  function setUp() public { }

  function testHappyPath() public {
    addresses.push(address(1));
    addresses.push(address(2));
    amounts.push(1e21);
    amounts.push(1e22);
    FixSupplyToken token = new FixSupplyToken("Test Fix Supply Token", "TFST", addresses, amounts);

    assertEq(token.balanceOf(address(1)), 1e21);
    assertEq(token.balanceOf(address(2)), 1e22);
  }

  function testMoreAddressesThanAmounts() public {
    addresses.push(address(1));
    amounts.push(1e21);
    amounts.push(1e22);
    vm.expectRevert(bytes("arrays must have same lenght"));
    new FixSupplyToken("Test Fix Supply Token", "TFST", addresses, amounts);
  }

  function testMoreAmountsThanAddresses() public {
    addresses.push(address(1));
    addresses.push(address(2));
    amounts.push(1e21);
    vm.expectRevert(bytes("arrays must have same lenght"));
    new FixSupplyToken("Test Fix Supply Token", "TFST", addresses, amounts);
  }
}
