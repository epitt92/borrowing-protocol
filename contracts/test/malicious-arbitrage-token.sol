// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IArbitragePool.sol";
import "../utils/constants.sol";

/// @title implements minting/burning functionality for owner
contract MaliciousArbitrageToken is ERC20, Ownable, Constants {
  address public arbitrage;
  address public troveToken;
  address public apToken;
  uint8 level;

  event Attack(uint8 step);
  event ArbitrageSet();

  // solhint-disable-next-line func-visibility
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

  function setArbitrage(
    address _arbitrage,
    address _troveToken,
    address _apToken
  ) public {
    arbitrage = _arbitrage;
    troveToken = _troveToken;
    apToken = _apToken;
    ERC20(_troveToken).approve(arbitrage, MAX_INT);
    emit ArbitrageSet();
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    return ERC20.transferFrom(from, to, amount);
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    emit Attack(1);
    if (arbitrage != address(0x0)) {
      emit Attack(2);
      IArbitragePool(arbitrage).deposit(troveToken, 10 * DECIMAL_PRECISION);
      emit Attack(3);
      require(IERC20(apToken).balanceOf(address(this)) > 0, "AP token must have been minted");
    } else {
      emit Attack(0);
    }
    return ERC20.transfer(to, amount);
  }

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
}
