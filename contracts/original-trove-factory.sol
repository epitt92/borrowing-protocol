//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./trove-factory.sol";
import "./interfaces/bots/ILiquidationProtection.sol";

contract OriginalTroveFactory is TroveFactory {
  mapping(address => IServiceFeeGenerator) private premiumUsers; // address: trove
  mapping(address => bool) private isCreatedBots; // address: serviceFee address

  address public botImplementation;

  event BotImplementationSet(address previousImplementation, address newImplementation);
  event NewBot(address bot, address subscriber, address trove);

  function name() public view override returns (string memory) {
    return "Original Factory";
  }

  /**
   * @dev sets address of the liquidation protection bot implementation for minimal clones
   */
  function setBotImplementation(address _botImplementation) public onlyOwner {
    emit BotImplementationSet(botImplementation, _botImplementation);
    botImplementation = _botImplementation;
  }

  /**
   * @dev creates new ServiceFeeGenerator for user
   * @param _trove any valid trove that user owns
   * @param _feeAmount amount of fee to take (must be >= minimal borrow)
   * @param _feeInterval interval required for payments
   */
  function createNewServiceFee(ITrove _trove, uint256 _feeAmount, uint256 _feeInterval) public override returns (IServiceFeeGenerator newServiceFee) {
    // TODO add a mechanism to identify Service Fee contracts which were created by the trove Factory
    require(containsTrove(address(_trove.token()), address(_trove)), "daa708 not a valid trove");
    require(_trove.owner() == msg.sender, "daa708 msg.sender must be trove owner");

    address serviceFeeAddress = cloneImplementation(serviceFeeImplementation);
    require(serviceFeeAddress != address(0), "ERC1167: create failed");

    _trove.addOwner(serviceFeeAddress);

    newServiceFee = IServiceFeeGenerator(serviceFeeAddress);
    newServiceFee.initialize(_trove, _feeAmount, _feeInterval);
    premiumUsers[address(_trove)] = newServiceFee;

    emit NewServiceFee(serviceFeeAddress, msg.sender, address(_trove));
  }

  function addLpBot(ITrove _trove) public returns (ILiquidationProtection bot) {
    require(_trove.owner() == msg.sender, "evan407 msg.sender must be trove owner");

    IServiceFeeGenerator serviceFeeGenerator = premiumUsers[address(_trove)];
    address serviceFeeAddress = address(serviceFeeGenerator);
    require(serviceFeeAddress != address(0), "evan407 msg.sender must be premium user"); // missed checking (insufficient fee)
    require(isCreatedBots[serviceFeeAddress] == false, "evan407 already created a bot");

    address botAddress = cloneImplementation(botImplementation);
    require(botAddress != address(0), "ERC1167: create failed");

    bot = ILiquidationProtection(botAddress);
    bot.initialize(_trove, serviceFeeGenerator);
    isCreatedBots[serviceFeeAddress] = true;

    emit NewBot(botAddress, msg.sender, address(_trove));
  }

  function removeLpBot() public {}
}
