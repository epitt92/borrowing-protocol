import { setWorldConstructor, setDefaultTimeout } from '@cucumber/cucumber'
import {MockProvider, solidity} from 'ethereum-waffle';
import {use} from "chai";
import {Wallet} from "ethers";

use(solidity);

setDefaultTimeout(20 * 1000);

class KycTokenWorld {
  public owner: string
  public wallets: Wallet[]
  public ready: boolean = false
  private _initialized: Promise<boolean>

  constructor() {
    this.wallets = new MockProvider().getWallets();
    this.owner = this.wallets[0].address

    const that = this
    this._initialized = new Promise(async (resolve, reject) => {
      try {
        that.ready = true
        resolve(true)
      }catch (err) {
        reject(err)
      }
    })
  }

}

setWorldConstructor(KycTokenWorld);
