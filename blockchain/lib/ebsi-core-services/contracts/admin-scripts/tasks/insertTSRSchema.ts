import { task } from "hardhat/config";

import type { ContractTransactionResponse, Signer } from "ethers";

import canonicalize from "canonicalize";
import { readdir, readFile } from "node:fs/promises";

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
interface SchemaSCRegistryLike {
  insertSchema(
    schemaId: string,
    schemaHex: string,
    metadata: Uint8Array,
  ): Promise<ContractTransactionResponse>;
  version(): Promise<bigint>;
}

task(
  "insertSchema",
  "Insert new schemas in TSR Contract ",
  async (taskArgs: { proxy: string }, { ethers }) => {
    const [deployer, admin] = await ethers.getSigners();
    const tsr = (await ethers.getContractAt(
      "SchemaSCRegistry",
      taskArgs.proxy,
      admin as unknown as Signer,
    )) as unknown as SchemaSCRegistryLike;

    console.log(
      `deployer:${deployer.address}
     admin:${admin.address}`,
    );
    const initialVersion = await tsr.version();
    console.log(initialVersion);
    console.log("initialVersion:", initialVersion.toString());

    // TODO: fix JSON schemas import logic (can't use git submodules anymore)
    const files = await readdir(`${__dirname}/../schemas/json-schemas`);

    const network = await ethers.provider.getNetwork();

    for (const file of files) {
      if (file === ".git") continue;

      const jsonFile = await readFile(
        `${__dirname}/../schemas/json-schemas/${file}`,
      );
      const json = canonicalize(JSON.parse(jsonFile.toString()));

      const schema = ethers.toUtf8Bytes(json!);
      const schemaId = ethers.sha256(schema);
      const schemaHex = `0x${Buffer.from(JSON.stringify(json), "utf8").toString(
        "hex",
      )}`;

      try {
        await (await tsr.insertSchema(schemaId, schemaHex, schema)).wait(1);
        console.log(
          `Schema ${file} registered on networkId ${network.chainId} at id: ${schemaId}`,
        );
      } catch {
        console.log(
          `Schema ${file} already registered on networkId ${network.chainId} at id: ${schemaId}`,
        );
      }
    }
  },
).addParam("proxy", "Proxy Address");
