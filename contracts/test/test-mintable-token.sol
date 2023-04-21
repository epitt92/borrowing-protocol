// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title implements minting/burning functionality for owner
contract TestMintableToken is ERC20, Ownable {
  uint8 private _decimals = 18;

  // solhint-disable-next-line func-visibility
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

  /// @dev mints tokens to the recipient, to be called from owner
  /// @param recipient address to mint
  /// @param amount amount to be minted
  function mint(address recipient, uint256 amount) public {
    _mint(recipient, amount);
  }

  /// @dev burns token of specified amount from msg.sender
  /// @param amount to burn
  function burn(uint256 amount) public {
    _burn(msg.sender, amount);
  }

  function setDecimals(uint8 _newDecimals) public {
    _decimals = _newDecimals;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }
}
