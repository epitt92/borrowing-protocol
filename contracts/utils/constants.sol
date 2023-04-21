//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract Constants {
  uint256 public constant DECIMAL_PRECISION = 1e18;
  uint256 public constant LIQUIDATION_RESERVE = 1e18;
  uint256 public constant MAX_INT = 2 ** 256 - 1;

  uint256 public constant PERCENT = (DECIMAL_PRECISION * 1) / 100; // 1%
  uint256 public constant PERCENT124 = PERCENT * 124; // 124%
  uint256 public constant PERCENT125 = PERCENT * 125; // 125%
  uint256 public constant PERCENT10 = PERCENT * 10; // 10%
  uint256 public constant PERCENT_05 = PERCENT / 2; // 0.5%
  uint256 public constant BORROWING_RATE = PERCENT_05;
  uint256 public constant MAX_BORROWING_RATE = (DECIMAL_PRECISION * 5) / 100; // 5%
}
