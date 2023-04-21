// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title implements minting/burning functionality for owner
contract SplittableToken is ERC20, Ownable {
  uint256 public initialSupply;
  uint256 private _precision = 1e18;
  uint256 public multiplier = 1e18;
  mapping(address => uint256) public userMultipliers;

  event IncreaseSupply(uint256 multiplier, uint256 increase);

  // solhint-disable-next-line func-visibility
  constructor(
    string memory name,
    string memory symbol,
    uint256 _initialSupply
  ) ERC20(name, symbol) {
    _mint(msg.sender, _initialSupply);
    initialSupply = _initialSupply;
  }

  function totalSupply() public view override returns (uint256) {
    return (initialSupply * multiplier) / _precision;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    _checkBalance(from);
    _checkBalance(to);
    return super.transferFrom(from, to, amount);
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    _checkBalance(msg.sender);
    _checkBalance(to);
    return super.transfer(to, amount);
  }

  function _checkBalance(address _account) private {
    uint256 _multiplier = multiplier - userMultipliers[_account] - _precision;
    if (_multiplier > 0) {
      uint256 _amount = (super.balanceOf(_account) * _multiplier) / _precision;
      _mint(_account, _amount);
      userMultipliers[_account] += _multiplier;
    }
  }

  function balanceOf(address _account) public view override returns (uint256) {
    uint256 _multiplier = multiplier - userMultipliers[_account];
    return (super.balanceOf(_account) * _multiplier) / _precision;
  }

  function increaseSupply(uint256 _multiplier) public onlyOwner {
    multiplier += _multiplier;
    emit IncreaseSupply(multiplier, _multiplier);
  }
}
