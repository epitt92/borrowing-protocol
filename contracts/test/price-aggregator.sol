// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";

contract PriceAggregator is AggregatorV2V3Interface {
  int256 public s_answer;
  uint8 public override decimals;
  string public override description = "Test Price Aggregator";
  uint256 public override version = 12;

  function setLatestAnswer(int256 answer) public {
    s_answer = answer;
  }

  function setDecimals(uint8 _decimals) public {
    decimals = _decimals;
  }

  function latestAnswer() public view override returns (int256) {
    return s_answer;
  }

  function latestTimestamp() public view override returns (uint256) {
    return block.timestamp;
  }

  function latestRound() public view override returns (uint256) {
    return block.number;
  }

  function getAnswer(uint256 roundId) public view override returns (int256) {
    return s_answer;
  }

  function getTimestamp(uint256 roundId) public view override returns (uint256) {
    return block.timestamp;
  }

  function getRoundData(uint80 _roundId)
    public
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    answer = latestAnswer();
    roundId = 1;
    startedAt = 1;
    updatedAt = 2;
    answeredInRound = 1;
  }

  function latestRoundData()
    public
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return getRoundData(1);
  }
}
