import { task } from "hardhat/config";

import type { ContractTransactionResponse, Signer } from "ethers";

interface HashAlgorithm {
  ianaName: string;
  oid: string;
  outputLength: bigint;
  status: number;
}

interface TimestampLike {
  getHashAlgorithmById(id: number): Promise<HashAlgorithm>;
  insertHashAlgorithm(
    outputLength: number,
    ianaName: string,
    oid: string,
    status: number,
    multihashName: string,
  ): Promise<ContractTransactionResponse>;
  updateHashAlgorithm(
    id: number,
    outputLength: number,
    ianaName: string,
    oid: string,
    status: number,
    multihashName: string,
  ): Promise<ContractTransactionResponse>;
  version(): Promise<bigint>;
}

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
task(
  "addHashAlgo",
  "Add alg hash",
  async (taskArgs: { contract: string; proxy: string }, { ethers }) => {
    const [deployer, admin] = await ethers.getSigners();
    const ts = (await ethers.getContractAt(
      taskArgs.contract,
      taskArgs.proxy,
      admin as unknown as Signer,
    )) as unknown as TimestampLike;

    console.log(
      `deployer:${deployer.address}
     admin:${admin.address}`,
    );
    const initialVersion = await ts.version();
    console.log(initialVersion);
    console.log("initialVersion:", initialVersion.toString());
    /**
     * SHA-256	1	256 bits	SHA-256	2.16.840.1.101.3.4.2.1
     * https://www.iana.org/assignments/named-information/named-information.xhtml
     * http://oid-info.com/cgi-bin/display?oid=2.16.840.1.101.3.4.2.1&action=display
     * SHA-256-12	2	12 bits	SHA-256-12
     *
     * SHA-256-120	3	120 bits	SHA-256-120
     *
     * SHA-256-96	4	96 bits	SHA-256-96
     *
     * SHA-256-64	5	64 bits	SHA-256-64
     *
     * SHA-256-32	6	32 bits	SHA-256-32
     *
     * SHA-384	7
     * 384 bits
     *
     * SHA-384	2.16.840.1.101.3.4.2.2
     * SHA-512	8	512 bits	SHA-512	2.16.840.1.101.3.4.2.3
     * SHA3-224	9	224 bits	SHA3-224	2.16.840.1.101.3.4.2.7
     * SHA3-256	10	256 bits	SHA3-256	2.16.840.1.101.3.4.2.8
     * SHA3-384	11	384 bis	SHA3-384	2.16.840.1.101.3.4.2.9
     * SHA3-512	12	512 bits	SHA3-512	2.16.840.1.101.3.4.2.10
     * https://www.iana.org/assignments/named-information/named-information.xhtml
     * http://oid-info.com/get/2.16.840.1.101.3.4.2.10
     */
    // add hashAlgo
    console.log("alg sha256");
    try {
      await ts.getHashAlgorithmById(1);
      console.log("updating");
      // update version
      await (
        await ts.updateHashAlgorithm(
          1,
          256,
          "sha-256",
          "2.16.840.1.101.3.4.2.1",
          1,
          "sha2-256",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          256,
          "sha-256",
          "2.16.840.1.101.3.4.2.1",
          1,
          "sha2-256",
        )
      ).wait(1);
    }
    console.log("alg sha384");
    try {
      await ts.getHashAlgorithmById(2);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          2,
          384,
          "sha-384",
          "2.16.840.1.101.3.4.2.2",
          1,
          "",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          384,
          "sha-384",
          "2.16.840.1.101.3.4.2.2",
          1,
          "",
        )
      ).wait(1);
    }
    console.log("alg sha512");
    try {
      await ts.getHashAlgorithmById(3);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          3,
          512,
          "sha-512",
          "2.16.840.1.101.3.4.2.3",
          1,
          "sha2-512",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          512,
          "sha-512",
          "2.16.840.1.101.3.4.2.3",
          1,
          "sha2-512",
        )
      ).wait(1);
    }
    console.log("alg sha3224");
    try {
      await ts.getHashAlgorithmById(4);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          4,
          224,
          "sha3-224",
          "2.16.840.1.101.3.4.2.7",
          1,
          "sha3-224",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          224,
          "sha3-224",
          "2.16.840.1.101.3.4.2.7",
          1,
          "sha3-224",
        )
      ).wait(1);
    }
    console.log("alg sha3256");
    try {
      await ts.getHashAlgorithmById(5);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          5,
          256,
          "sha3-256",
          "2.16.840.1.101.3.4.2.8",
          1,
          "sha3-256",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          256,
          "sha3-256",
          "2.16.840.1.101.3.4.2.8",
          1,
          "sha3-256",
        )
      ).wait(1);
    }
    console.log("alg sha3384");
    try {
      await ts.getHashAlgorithmById(6);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          6,
          384,
          "sha3-384",
          "2.16.840.1.101.3.4.2.9",
          1,
          "sha3-384",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          384,
          "sha3-384",
          "2.16.840.1.101.3.4.2.9",
          1,
          "sha3-384",
        )
      ).wait(1);
    }
    console.log("alg sha33512");
    try {
      await ts.getHashAlgorithmById(2);
      console.log("updating");
      await (
        await ts.updateHashAlgorithm(
          7,
          512,
          "sha3-512",
          "2.16.840.1.101.3.4.2.10",
          1,
          "sha3-512",
        )
      ).wait(1);
    } catch {
      console.log("inserting");
      await (
        await ts.insertHashAlgorithm(
          512,
          "sha3-512",
          "2.16.840.1.101.3.4.2.10",
          1,
          "sha3-512",
        )
      ).wait(1);
    }

    for (let i = 1; i <= 7; i += 1) {
      const algo = await ts.getHashAlgorithmById(i);
      console.log(
        `algorithm ${algo.ianaName} oid:${
          algo.oid
        } length:${algo.outputLength.toString()} status:${algo.status}`,
      );
    }
  },
)
  .addParam("proxy", "Proxy Address")
  .addParam("contract", "Contract Tag to which alg should be added");
