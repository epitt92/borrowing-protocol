import dotenv from "dotenv";

dotenv.config({
  path: __dirname + "/.env"
});

export const goerliRPC = "https://goerli.infura.io/v3/" + process.env.INFURA_API_KEY;
export const mumbaiRPC = "https://polygon-mumbai.g.alchemy.com/v2/" + process.env.ALCHEMY_MUMBAI_API_KEY;
export const polygonRPC = "https://polygon-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_POLYGON_API_KEY;
export const ethereumRPC = "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_ETH_API_KEY;
export const voltaRPC = "https://rpc.bonq.ch/rest-" + process.env.RPC_KEY;
