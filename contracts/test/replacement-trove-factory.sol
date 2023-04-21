//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../trove-factory.sol";

contract ReplacementTroveFactory is TroveFactory {
  function name() public view override returns (string memory) {
    return "Replacement Factory";
  }
}
