// @ts-nocheck
import { expect } from "chai";

class TroveFactory {
  private absoluteTroveCount = 0;
  public collateral = 0;
  public debt = 0;
  public troves: Trove[] = [];
  public liquidationPool: CommunityLiquidation = new CommunityLiquidation(this);

  public getTrove(name: string): Trove | undefined {
    for (const trove of this.troves) {
      if (trove.name === name) return trove;
    }
    return undefined;
  }

  public createTrove(): Trove {
    const newTrove = new Trove(`Trove ${this.absoluteTroveCount++}`, 100, 500, this);
    newTrove.position = this.troves.length;
    this.collateral += newTrove.collateral;
    this.troves.push(newTrove);
    this.debt += 500;
    return newTrove;
  }

  public createTroves(count: number) {
    for (let i = 0; i < count; i++) {
      this.createTrove();
    }
  }

  public removeTrove(troveName: string) {
    for (let i = 0; i < this.troves.length; i++) {
      if (this.troves[i].name === troveName) {
        this.troves.splice(i, 1);
        break;
      }
    }
  }

  public trovesLiqTokenBalance(): number {
    let totalLiqTokenBalance = 0;
    for (const trove of this.troves) {
      totalLiqTokenBalance += trove.collateral / trove.liqTokenRatio;
    }
    return totalLiqTokenBalance;
  }

  public trovesLiqTokenValue(): number {
    return this.trovesLiqTokenBalance() * this.liquidationPool.liqTokenRatio;
  }

  public trovesUnclaimedCollateral(): number {
    let totalUnclaimedCollateral = 0;
    for (const trove of this.troves) {
      totalUnclaimedCollateral += trove.unclaimedLiquidationCollateral();
    }
    return totalUnclaimedCollateral;
  }

  public trovesUnclaimedDebt(): number {
    let totalUnclaimedDebt = 0;
    for (const trove of this.troves) {
      totalUnclaimedDebt += trove.unclaimedLiquidationDebt();
    }
    return totalUnclaimedDebt;
  }

  lastTrove(): Trove {
    return this.troves[this.troves.length - 1];
  }
}

class CommunityLiquidation {
  public collateralTokenBalance = 0;
  public liqTokenRatio = 1;
  public debt = 0;

  constructor(public factory: TroveFactory) {}

  private distributeLiquidatedCollateral(liquidatedCollateral: number, liquidatedDebt: number) {
    for (const trove of this.factory.troves) {
      trove.pushedCollateral += (trove.pushedCollateral * liquidatedCollateral) / (this.factory.collateral - liquidatedCollateral);
      trove.pushedDebt += (liquidatedDebt * trove.pushedCollateral) / this.factory.collateral;
    }
  }

  public liquidate(trove: Trove): number {
    trove.claimLiquidationCollateral();
    const liquidatedCollateral = trove.collateral;
    trove.withdraw(liquidatedCollateral);
    this.collateralTokenBalance += liquidatedCollateral;
    this.debt += trove.debt;
    // this.liqTokenRatio += liquidatedCollateral / this.liqTokenSupply;
    this.liqTokenRatio += (liquidatedCollateral * this.liqTokenRatio) / this.factory.collateral;

    this.factory.collateral += liquidatedCollateral;
    this.factory.removeTrove(trove.name);
    this.distributeLiquidatedCollateral(liquidatedCollateral, trove.debt);
    return liquidatedCollateral;
  }
}

class Trove {
  public position = 0;
  public liqTokenRatio = 1;
  public pushedCollateral = 0; // this is for verification purposes only and should not be implemented in the smart-contract
  public pushedDebt = 0; // this is for verification purposes only and should not be implemented in the smart-contract

  constructor(public name: string, public collateral: number, public debt: number, public factory: TroveFactory) {
    this.pushedCollateral = collateral;
    this.pushedDebt = debt;
    this.liqTokenRatio = this.factory.liquidationPool.liqTokenRatio;
  }

  public liqTokenValue(): number {
    return (this.collateral * this.factory.liquidationPool.liqTokenRatio) / this.liqTokenRatio;
  }

  public unclaimedLiquidationCollateral(): number {
    return this.liqTokenValue() - this.collateral;
  }

  public unclaimedLiquidationDebt(): number {
    if (this.factory.liquidationPool.collateralTokenBalance > 0) {
      return (this.factory.liquidationPool.debt * this.unclaimedLiquidationCollateral()) / this.factory.liquidationPool.collateralTokenBalance;
    }
    return 0;
  }

  public deposit(amount: number) {
    this.claimLiquidationCollateral();
    this.collateral += amount;
    this.pushedCollateral += amount;
    this.factory.collateral += amount;
    this.liqTokenRatio = this.factory.liquidationPool.liqTokenRatio;
  }

  public withdraw(amount: number) {
    this.claimLiquidationCollateral();
    this.collateral -= amount;
    this.pushedCollateral -= amount;
    this.factory.collateral -= amount;
    this.liqTokenRatio = this.factory.liquidationPool.liqTokenRatio;
  }

  public claimLiquidationCollateral() {
    const claimCollateral = this.unclaimedLiquidationCollateral();
    const claimDebt = this.unclaimedLiquidationDebt();
    this.factory.liquidationPool.collateralTokenBalance -= claimCollateral;
    this.factory.liquidationPool.debt -= claimDebt;
    this.collateral += claimCollateral;
    this.debt += claimDebt;
    this.liqTokenRatio = this.factory.liquidationPool.liqTokenRatio;
  }

  collateralValue(): number {
    return this.collateral * 10;
  }
}

describe.skip("community liquidation", function () {
  let factory: TroveFactory;

  beforeEach(function () {
    factory = new TroveFactory();
    factory.createTroves(5);
  });

  it("names the trove by index", function () {
    expect(factory.troves[2].name).to.equal("Trove 2");
    expect(factory.troves[4].name).to.equal("Trove 4");
  });

  it("distributes 25% of liquidated collateral when 1 out of 5 troves are liquidated", function () {
    const liquidatedCollateral = factory.liquidationPool.liquidate(factory.troves[2]);
    expect(factory.troves[2].name).to.equal("Trove 3");
    expect(factory.troves.length).to.equal(4);
    expect(factory.liquidationPool.collateralTokenBalance).to.equal(liquidatedCollateral);
    const reward = liquidatedCollateral / 4;
    const debt = factory.liquidationPool.debt / 4;
    for (const trove of factory.troves) {
      const troveCollateral = trove.collateral;
      expect(trove.unclaimedLiquidationCollateral()).to.equal(reward);
      const unclaimedDebt = trove.unclaimedLiquidationDebt();
      expect(trove.unclaimedLiquidationDebt()).to.equal(debt);
      trove.claimLiquidationCollateral();
      expect(trove.unclaimedLiquidationCollateral()).to.equal(0);
      expect(trove.collateral).to.equal(reward + troveCollateral);
    }
  });

  it("distributes the same amount to same troves", function () {
    const firstLiquidation = factory.liquidationPool.liquidate(factory.troves[2]);
    expect(factory.troves[2].name).to.equal("Trove 3");
    factory.troves[0].claimLiquidationCollateral();
    const secondLiquidation = factory.liquidationPool.liquidate(factory.troves[2]);
    expect(factory.troves[2].name).to.equal("Trove 4");
    factory.troves[0].claimLiquidationCollateral();
    factory.troves[1].claimLiquidationCollateral();
    expect(factory.troves[0].collateral).to.equal(factory.troves[1].collateral);
  });

  it("does not distribute rewards from prior liquidations", function () {
    const firstLiquidation = factory.liquidationPool.liquidate(factory.troves[2]);

    const lateTrove = factory.createTrove();
    lateTrove.deposit(factory.troves[0].unclaimedLiquidationCollateral());
    expect(lateTrove.unclaimedLiquidationCollateral()).to.equal(0);

    const secondLiquidation = factory.liquidationPool.liquidate(factory.troves[2]);
    expect(factory.troves.length).to.equal(4);

    expect(lateTrove.unclaimedLiquidationCollateral()).to.equal(secondLiquidation / 4);
    expect(factory.troves[0].unclaimedLiquidationCollateral()).to.equal(secondLiquidation / 4 + firstLiquidation / 4);
  });

  it("distributes rewards correctly", function () {
    this.timeout(5000);
    for (let i = 0; i < 1000; i++) {
      const liquidatedCollateral = factory.liquidationPool.liquidate(factory.troves[2 * i]);
      expect(factory.collateral).to.be.closeTo(factory.trovesLiqTokenValue(), 0.000001);
      expect(factory.lastTrove().unclaimedLiquidationCollateral(), `run ${i}`).to.be.closeTo(
        (liquidatedCollateral * factory.lastTrove().liqTokenValue()) / factory.trovesLiqTokenValue(),
        0.000001
      );
      expect(factory.trovesUnclaimedCollateral()).to.be.closeTo(factory.liquidationPool.collateralTokenBalance, 0.000001);
      factory.troves[2 * i].claimLiquidationCollateral();
      factory.troves[2 * i + 1].claimLiquidationCollateral();
      factory.troves[2 * i + 2].claimLiquidationCollateral();
      factory.createTroves(3);
    }

    expect(factory.trovesUnclaimedCollateral()).to.be.closeTo(factory.liquidationPool.collateralTokenBalance, 0.000001);
    expect(factory.trovesUnclaimedDebt()).to.be.gt(0);
    expect(factory.trovesUnclaimedDebt()).to.be.closeTo(factory.liquidationPool.debt, 0.000001);

    for (const trove of factory.troves) {
      expect(trove.collateral + trove.unclaimedLiquidationCollateral()).to.be.closeTo(trove.pushedCollateral, 0.000001);
    }

    for (const trove of factory.troves) {
      trove.deposit(1);
      expect(trove.collateral).to.be.closeTo(trove.pushedCollateral, 0.000001);
      expect(trove.debt).to.be.closeTo(trove.pushedDebt, 0.000001);
    }
  });
});
