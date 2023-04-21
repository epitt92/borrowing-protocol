import { expect, use } from "chai";
import { MockProvider, solidity } from "ethereum-waffle";
import { TestAddressList } from "../src/types";
import { Wallet } from "ethers";
import { deployContract } from "./utils/helpers";

use(solidity);

// Start test block
describe("Bi-directional Linked Address List", function () {
  this.timeout(120000);

  let wallets: Wallet[];
  let addressList: TestAddressList;
  let provider: MockProvider;

  before(async function () {
    provider = new MockProvider();
    wallets = provider.getWallets();
    for (let i = 0; i < 10; i++) {
      wallets.push(provider.createEmptyWallet());
    }
  });

  beforeEach(async function () {
    addressList = (await deployContract(wallets[0], "TestAddressList")) as TestAddressList;
    await addressList.deployed();
  });

  it("returns address 0 for an empty list", async function () {
    const entry = await addressList.addressListElement(wallets[0].address);
    expect(entry.prev).to.equal("0x0000000000000000000000000000000000000000");
    expect(entry.next).to.equal("0x0000000000000000000000000000000000000000");
    expect(await addressList.lastAddressListElement()).to.equal("0x0000000000000000000000000000000000000000");
    expect((await addressList.addressListSize()).toString()).to.equal("0");
  });

  it("adds an element which has itself as prev and next", async function () {
    const testAddress = wallets[1].address;
    await addressList.appendAddress(testAddress, { gasLimit: "1000000" });

    const entry = await addressList.addressListElement(testAddress);
    expect(entry.prev).to.equal(testAddress);
    expect(entry.next).to.equal(testAddress);
    expect(await addressList.lastAddressListElement()).to.equal(testAddress);
    expect((await addressList.addressListSize()).toString()).to.equal("1");
  });

  it("adds the same element only once", async function () {
    const testAddress = wallets[1].address;
    await addressList.appendAddress(testAddress, { gasLimit: "1000000" });
    await expect(addressList.appendAddress(testAddress, { gasLimit: "1000000" })).to.be.revertedWith("adding the list element failed");

    const entry = await addressList.addressListElement(testAddress);
    expect(entry.prev).to.equal(testAddress);
    expect(entry.next).to.equal(testAddress);
    expect(await addressList.lastAddressListElement()).to.equal(testAddress);
    expect(await addressList.firstAddressListElement()).to.equal(testAddress);
    expect((await addressList.addressListSize()).toString()).to.equal("1");
  });

  it("returns address 0 for an empty list after removing the only element", async function () {
    const testAddress = wallets[1].address;
    await addressList.appendAddress(testAddress, { gasLimit: "1000000" });
    await addressList.removeAddress(testAddress, { gasLimit: "1000000" });
    const entry = await addressList.addressListElement(wallets[0].address);
    expect(entry.prev).to.equal("0x0000000000000000000000000000000000000000");
    expect(entry.next).to.equal("0x0000000000000000000000000000000000000000");
    expect(await addressList.lastAddressListElement()).to.equal("0x0000000000000000000000000000000000000000");
    expect(await addressList.firstAddressListElement()).to.equal("0x0000000000000000000000000000000000000000");
    expect((await addressList.addressListSize()).toString()).to.equal("0");
  });

  it("adds multiple elements at the head of the list", async function () {
    for (let i = 0; i < 10; i++) {
      await addressList.addAddress(wallets[i].address, i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[i - 1].address, true, { gasLimit: "1000000" });
      const entry = await addressList.addressListElement(wallets[i].address);
      expect(entry.prev).to.equal(wallets[i].address);
      expect(entry.next).to.equal(wallets[Math.max(i - 1, 0)].address);
      expect(await addressList.lastAddressListElement()).to.equal(wallets[0].address);
      expect(await addressList.firstAddressListElement()).to.equal(wallets[i].address);
      expect((await addressList.addressListSize()).toNumber()).to.equal(i + 1);
    }
  });

  it("adds multiple elements at the queue of the list", async function () {
    for (let i = 0; i < 10; i++) {
      await addressList.addAddress(wallets[i].address, i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[i - 1].address, false, { gasLimit: "1000000" });
      const entry = await addressList.addressListElement(wallets[i].address);
      expect(entry.next).to.equal(wallets[i].address);
      expect(entry.prev).to.equal(wallets[Math.max(i - 1, 0)].address);
      expect(await addressList.lastAddressListElement()).to.equal(wallets[i].address);
      expect(await addressList.firstAddressListElement()).to.equal(wallets[0].address);
      expect((await addressList.addressListSize()).toNumber()).to.equal(i + 1);
    }

    expect(await addressList.lastAddressListElement()).to.equal(wallets[9].address);

    for (let i = 9; i >= 0; i--) {
      const entry = await addressList.addressListElement(wallets[i].address);
      expect(entry.next).to.equal(wallets[Math.min(i + 1, 9)].address);
      expect(entry.prev).to.equal(wallets[Math.max(i - 1, 0)].address);
    }
  });

  it("inserts multiple elements in the middle of the list", async function () {
    // add the first and last elements
    for (let i = 0; i < 2; i++) {
      await addressList.addAddress(wallets[i].address, i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[i - 1].address, false, { gasLimit: "1000000" });
    }

    //target list: [0 1 3 5 7 9 8 6 4 2]
    for (let i = 2; i < 10; i++) {
      await addressList.addAddress(wallets[i].address, wallets[i - 1].address, i % 2 == 1, { gasLimit: "1000000" });
    }

    const expectation = [wallets[0], wallets[1], wallets[3], wallets[5], wallets[7], wallets[9], wallets[8], wallets[6], wallets[4], wallets[2]];
    let element = await addressList.firstAddressListElement();
    for (let i = 0; i < 10; i++) {
      const entry = await addressList.addressListElement(element);
      expect(entry.next).to.equal(expectation[Math.min(i + 1, 9)].address);
      expect(entry.prev).to.equal(expectation[Math.max(i - 1, 0)].address);
      element = entry.next;
    }
  });

  describe("multi element list operations", function () {
    beforeEach(async function () {
      for (let i = 0; i < 10; i++) {
        await addressList.appendAddress(wallets[i].address, { gasLimit: "1000000" });
      }
    });

    it("removes the last element until there are none left", async function () {
      for (let i = 9; i >= 0; i--) {
        expect(await addressList.lastAddressListElement()).to.equal(wallets[i].address);
        await addressList.removeAddress(wallets[i].address, { gasLimit: "1000000" });
        expect(await addressList.lastAddressListElement()).to.equal(i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[i - 1].address);
        expect(await addressList.firstAddressListElement()).to.equal(i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[0].address);
        const entry = await addressList.addressListElement(wallets[Math.max(i - 1, 0)].address);
        expect(entry.prev).to.equal(i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[Math.max(i - 2, 0)].address);
        expect(entry.next).to.equal(i == 0 ? "0x0000000000000000000000000000000000000000" : wallets[Math.max(i - 1, 0)].address);
        expect((await addressList.addressListSize()).toNumber()).to.equal(i);
      }
    });

    it("removes the first element until there are none left", async function () {
      for (let i = 0; i < 10; i++) {
        await addressList.removeAddress(wallets[i].address, { gasLimit: "1000000" });
        const entry = await addressList.addressListElement(wallets[Math.min(i + 1, 9)].address);
        expect(entry.prev).to.equal(i == 9 ? "0x0000000000000000000000000000000000000000" : wallets[i + 1].address);
        expect(entry.next).to.equal(i == 9 ? "0x0000000000000000000000000000000000000000" : wallets[Math.min(i + 2, 9)].address);
        expect(await addressList.lastAddressListElement()).to.equal(i == 9 ? "0x0000000000000000000000000000000000000000" : wallets[9].address);
        expect(await addressList.firstAddressListElement()).to.equal(i == 9 ? "0x0000000000000000000000000000000000000000" : wallets[i + 1].address);
        expect((await addressList.addressListSize()).toNumber()).to.equal(9 - i);
      }
    });

    it("removes the even elements", async function () {
      for (let i = 8; i >= 0; i -= 2) {
        await addressList.removeAddress(wallets[i].address, { gasLimit: "1000000" });
      }

      const expectation = [wallets[1], wallets[3], wallets[5], wallets[7], wallets[9]];
      let element = await addressList.firstAddressListElement();
      for (let i = 0; i < 5; i++) {
        const entry = await addressList.addressListElement(element);
        expect(entry.next).to.equal(expectation[Math.min(i + 1, 4)].address);
        expect(entry.prev).to.equal(expectation[Math.max(i - 1, 0)].address);
        element = entry.next;
      }
    });

    it("removes the odd elements", async function () {
      for (let i = 9; i >= 0; i -= 2) {
        await addressList.removeAddress(wallets[i].address, { gasLimit: "1000000" });
      }

      const expectation = [wallets[0], wallets[2], wallets[4], wallets[6], wallets[8]];
      let element = await addressList.firstAddressListElement();
      for (let i = 0; i < 5; i++) {
        const entry = await addressList.addressListElement(element);
        expect(entry.next).to.equal(expectation[Math.min(i + 1, 4)].address);
        expect(entry.prev).to.equal(expectation[Math.max(i - 1, 0)].address);
        element = entry.next;
      }
    });

    it("fails with an error message when a non existent element is removed", async function () {
      await expect(addressList.removeAddress(provider.createEmptyWallet().address, { gasLimit: "1000000" })).to.be.revertedWith("removing the list element failed");
    });

    it("fails when trying to insert element at non existent reference", async function () {
      try {
        await (await addressList.addAddress(provider.createEmptyWallet().address, provider.createEmptyWallet().address, true, { gasLimit: "5000000" })).wait();
        expect(true).to.be.false; // execution should never reach this line
      } catch (err: any) {
        expect(err.message).to.equal("VM Exception while processing transaction: revert 79d3d _ref neither valid nor 0x");
      }
    });
  });
});
