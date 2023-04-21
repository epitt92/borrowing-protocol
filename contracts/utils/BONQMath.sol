//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "hardhat/console.sol";

library BONQMath {
  uint256 public constant DECIMAL_PRECISION = 1e18;
  uint256 public constant MAX_INT = 2**256 - 1;

  uint256 public constant MINUTE_DECAY_FACTOR = 999_037_758_833_783_000;

  /// @dev return the smaller of two numbers
  function min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  /// @dev return the bigger of two numbers
  function max(uint256 a, uint256 b) internal pure returns (uint256) {
    return a > b ? a : b;
  }

  /**
   * @dev Multiply two decimal numbers and use normal rounding rules:
   *  -round product up if 19'th mantissa digit >= 5
   *  -round product down if 19'th mantissa digit < 5
   *
   * Used only inside the exponentiation, _decPow().
   */
  function decMul(uint256 x, uint256 y) internal pure returns (uint256 decProd) {
    uint256 prod_xy = x * y;

    decProd = (prod_xy + (DECIMAL_PRECISION / 2)) / DECIMAL_PRECISION;
  }

  /**
   * @dev Exponentiation function for 18-digit decimal base, and integer exponent n.
   *
   * Uses the efficient "exponentiation by squaring" algorithm. O(log(n)) complexity.
   *
   * Called by function that represent time in units of minutes:
   * 1) IFeeRecipient.calcDecayedBaseRate
   *
   * The exponent is capped to avoid reverting due to overflow. The cap 525600000 equals
   * "minutes in 1000 years": 60 * 24 * 365 * 1000
   *
   * If a period of > 1000 years is ever used as an exponent in either of the above functions, the result will be
   * negligibly different from just passing the cap, since:
   * @param _base number to exponentially increase
   * @param _minutes power in minutes passed
   */
  function _decPow(uint256 _base, uint256 _minutes) internal pure returns (uint256) {
    if (_minutes > 525_600_000) {
      _minutes = 525_600_000;
    } // cap to avoid overflow

    if (_minutes == 0) {
      return DECIMAL_PRECISION;
    }

    uint256 y = DECIMAL_PRECISION;
    uint256 x = _base;
    uint256 n = _minutes;

    // Exponentiation-by-squaring
    while (n > 1) {
      if (n % 2 == 0) {
        x = decMul(x, x);
        n = n / 2;
      } else {
        // if (n % 2 != 0)
        y = decMul(x, y);
        x = decMul(x, x);
        n = (n - 1) / 2;
      }
    }

    return decMul(x, y);
  }
}
