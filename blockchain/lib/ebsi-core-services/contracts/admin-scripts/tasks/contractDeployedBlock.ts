import { task } from "hardhat/config";

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
task("contract_deployed", "get contract deployed block")
  .addParam("address", "The address of the contract")
  .setAction(async (_taskArgs: { address: string }, { ethers }) => {
    const contractAddress = _taskArgs.address;
    const blockNumber = await ethers.provider.getBlockNumber();
    const code = await ethers.provider.getCode(contractAddress, blockNumber);
    if (code === "0x") {
      console.log("Contract not deployed");
      return;
    }

    let startBlock = 0;
    let endBlock = blockNumber;

    let deployedBlock = -1;

    while (startBlock <= endBlock) {
      const midBlock = Math.floor((startBlock + endBlock) / 2);
      const code = await ethers.provider.getCode(contractAddress, midBlock);

      if (code && code !== "0x") {
        // Contract exists, search lower blocks
        deployedBlock = midBlock;
        endBlock = midBlock - 1;
      } else {
        // No contract yet, search higher blocks
        startBlock = midBlock + 1;
      }
    }
    console.log(`contract was deployed at: ${deployedBlock}`);
  });
