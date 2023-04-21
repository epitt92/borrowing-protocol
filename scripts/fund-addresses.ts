import {ethers} from "hardhat";
import { BigNumber } from "ethers";
import { DECIMAL_PRECISION } from "../test/utils/helpers";

const recipients = [
    "0xe214114980D7fa9098630CcB2B0ddbD8059EBa05",
    "0x5b9DEA6888edF4bf8aAE14154F0f3eA3C9b62e8D",
    "0x6eb9201D61e3D33A5C1b532a011E409183e97C3B",
    "0x2BE4cd7A5dca20AE907Dc8A62910B7e38A957180",
    "0x5C715B982F7Ff996Aa83650F825e96A9D60F4dD5",
    "0x985f8C84655Cadf4D245E2D075DAa4cE8C0c4A93",
    "0xafb8ccb4f9C7698F802fd10564388A58Dc11eb19",
    "0xe1c3d62154810651C22802064159cfc5BD23159d",
    "0xf8dda9a12EADbBd4CF98Da27BeBa8c69AF866966",
    "0x33B37fa5C7eC986FDfd52EDD16597d287eF0D88a",
    "0xbB55D9d0378b1B68787aE63bD64A46Db02d36081",
    "0x4B47052498D469AC9521606A67d6F02AFeB0985A",
    "0xedf1a05618d011d7E12E943F9FD64545670CD87f",
    "0x41C422D2879000b27f489b693e327eeb548d3B4E",
    "0x8b8c00F835436A8a2EA618f8805191c72f0a51F5",
    "0x61068AbfB8349f90bd0bAb12347ec10e0C55C20f",
    "0xE318db2940C5250292b631fc4102349417468cD4",
    "0xa9c5F5c8a2439b59094f7c599642bEBC10EE77d3",
    "0x165481239cc2827f92F738571b2cE1E532C900cA",
    "0x7614951B6e50161aaD977aEBfc7b5Eec15832447",
    "0xCeAB1D16AAff2931126a9e69D4c9a93758276D441",
    "0x425D0718eDeeFC613da64E8D776Ed316A40F3ce4",
    "0x3b41659E9975e4CA85acA2bc935c92A93c158E65",
    "0x3b41659E9975e4CA85acA2bc935c92A93c158E65",
    "0xb206db84883C32AD40F50231091447669806607D",
    "0xa2Fe76EBc8C4c49323Fa37149BD7944067047A3e",
    "0xdbE981a0E21a536Caecf8c56b00D890e9a1613AE",
    "0x7CeCe36b2d8fa74087445A826c492bA76AD650e0",
    "0x5bf7DF04e86422cE85c9591B4186A575208BF033",
    "0xc79C28991864cc3253ba3DbFe272fEAc3CB888d8",
    "0x85f56F55F74fB1944a95D53760d28995745E8625",
]

async function main() {
    const ONE = BigNumber.from(1e9).mul(1e9)
    const accounts = await ethers.provider.listAccounts();
    const deployer = ethers.provider.getSigner(accounts[0])

    const weth = await ethers.getContractAt("MintableToken", "0x79dfd67064c0a4a2ea04c8e5f73f64e1991b42e4", deployer)
    const albt = await ethers.getContractAt("MintableToken", "0x1feb4a11c1d64b165621ca1075dcac2f8eb3696e", deployer)

    for( const recipient of recipients) {
        let attempts = 0
        do {
            try {
                const wethBalance = ( await weth.balanceOf(recipient) ).div(DECIMAL_PRECISION)
                console.log(`weth balance for ${recipient} is ${wethBalance.toString()}`)
                if (wethBalance.toNumber() == 0) {
                    const tx = await weth.mint(recipient, ONE.mul(1e6))
                    console.log(`minted some WETH for ${recipient} in tx ${tx.hash}`)
                }
                const albtBalance = ( await albt.balanceOf(recipient) ).div(DECIMAL_PRECISION)
                console.log(`albt balance for ${recipient} is ${albtBalance.toString()}`)
                if (albtBalance.toNumber() == 0) {
                    const tx = await albt.mint(recipient, ONE.mul(1e6))
                    console.log(`minted some ALBT for ${recipient} in tx ${tx.hash}`)
                }
                attempts = 5
            } catch (err: any) {
                console.log(`tried ${attempts + 1} times`)
            }
        } while (attempts++ < 5)
    }
}

main().then(console.log).catch(console.error);
