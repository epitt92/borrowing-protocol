const queryTokenById = (id) => `
{
    token(id: "${id}") {
      id
      priceAverage
      pricePoint
      mcr
    }
  }
  `;
const queryWalletById = (id) => `
{
    wallet(id: "${id}") {
      id
      stabilityPoolDeposit
      bonqStakingStake
      depositsHistory
    }
  }
  `;
const queryTroveById = (id) => `
{
    trove(id: "${id}") {
      id
      owner
      token
      collateral
      debt
      collateralization
      debtBaseRate
      isRemoved
      isLiquidated
      liquidatedByStabilityPool
      priceAtLiquidation
    }
  }
  `;
const queryTroveDebtHistory = () => `
{
    troveDebtHistories {
      id
      trove
      actor
      amount
      action
      feePaid
    }
  }
  `;
const querySPGlobalsById = (id) => `
{
    stabilityPoolGlobals(id: "${id}") {
      id
      bonqRewardPerMinute
      totalBonqRewards
    }
  }
  `;

const queryTroveRedemption = (id) => `
  {
      troveRedemption(id: "${id}") {
        id
        collateralToken
        stableCoinRedeemed
        collateralRedeemed
        stableCoinLeft
        startBaseRate
        finishBaseRate
        latestTroveRedeemed
        blockTimestamp
      }
    }
    `;

module.exports = {
  queryTokenById,
  queryWalletById,
  queryTroveById,
  querySPGlobalsById,
  queryTroveRedemption,
  queryTroveDebtHistory
};
