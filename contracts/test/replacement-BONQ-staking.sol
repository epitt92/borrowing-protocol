//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../BONQ-staking.sol";

contract ReplacementBONQStaking is BONQStaking {
  function name() public view override returns (string memory) {
    return "ReplacementBONQStaking";
  }
}
