const { request } = require("graphql-request");

const checkIfAllSynced = (subgraphs) => {
  const result = subgraphs.find((el) => el.synced === false);
  return Boolean(!result);
};

const getSubgraphsSyncWaiter = (indexNodeServerGraphqlUrl, timeoutInSeconds) => {
  return async (delay) => {
    console.log("Syncing subgraphs...");
    return new Promise((resolve, reject) => {
      // Wait for 5s
      let deadline = Date.now() + timeoutInSeconds * 1000;

      // Function to check if the subgraph is synced
      const checkSubgraphSynced = async () => {
        try {
          let result = await request(indexNodeServerGraphqlUrl, `{ indexingStatuses { synced } }`);
          console.log("Indexing statuses:", result);
          if (checkIfAllSynced(result.indexingStatuses)) {
            console.log("Subgraphs are synced.");
            resolve({ synced: true });
          } else {
            throw new Error("reject or retry");
          }
        } catch (e) {
          if (Date.now() > deadline) {
            console.log("The error: ", e);
            reject(new Error(`Timed out waiting for the subgraph to sync`));
          } else {
            setTimeout(checkSubgraphSynced, delay);
          }
        }
      };

      // Periodically check whether the subgraph has synced
      setTimeout(checkSubgraphSynced, delay);
    });
  };
};

module.exports = {
  getSubgraphsSyncWaiter
};
