import { BigNumber, Contract, providers, Signer } from "ethers";
import { ethers } from "hardhat";
import { toBN } from "./helpers";
import { Interface } from "ethers/lib/utils";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { LogDescription } from "@ethersproject/abi/src.ts/interface";

export class SystemUnderTest {
  public ONE = toBN(1e18);
  public DECIMAL_PRECISION = toBN(1e18);
  public accounts: string[] = [];
  public wallets: Signer[] = [];
  public provider?: providers.JsonRpcProvider;
  public ready: Promise<boolean>;

  constructor(public eth: typeof ethers) {
    this.ready = this.init();
  }

  private async init(): Promise<boolean> {
    this.provider = this.eth.provider;
    this.accounts = await this.provider.listAccounts();
    for (const account of this.accounts) {
      this.wallets.push(this.provider.getSigner(account));
    }
    return true;
  }

  public async setup(): Promise<boolean> {
    return true;
  }

  public async deployContract(signer: Signer, name: string, args?: any): Promise<Contract> {
    const factory = await this.eth.getContractFactory(name);
    args = args ? args : [];
    const contract = await factory.connect(signer).deploy(...args);

    await contract.deployed();

    return contract;
  }

  public getContractAt(name: string, address: string, signer: Signer = this.wallets[0]): Promise<Contract> {
    return this.eth.getContractAt(name, address, signer);
  }

  public findTransferEvent(events: any[], fromAddress: string, toAddress: string, amount: BigNumber): any {
    return events.find((t) => {
      return t.args.from == fromAddress && t.args.to == toAddress && (amount.eq(t.args.value) || amount.lt(0));
    });
  }

  public getEventsFromReceipt(contractInterface: Interface, receipt: TransactionReceipt, eventName = ""): LogDescription[] {
    const events: LogDescription[] = [];
    for (const log of receipt.logs)
      try {
        const event = contractInterface.parseLog(log);
        if (event.name === eventName || eventName == "") {
          events.push(event);
        }
      } catch (err) {
        // do nothing
      }
    return events;
  }

  public async increaseTime(interval: number) {
    await this.eth.provider.send("evm_increaseTime", [interval]); // 0.5h (half of interval)
    await this.eth.provider.send("evm_mine", []); // to create new block
  }
}
