import { task } from "hardhat/config";

import type { ContractTransactionResponse, Signer } from "ethers";

import canonicalize from "canonicalize";
import { readFile } from "node:fs/promises";

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
interface SchemaSCRegistryLike {
  updateSchema(
    schemaId: string,
    schemaHex: string,
    metadata: Uint8Array,
  ): Promise<ContractTransactionResponse>;
  version(): Promise<bigint>;
}

task(
  "updateSchema",
  "Update existing schema in TSR Contract ",
  async (
    taskArgs: { file: string; proxy: string; schema: string },
    { ethers },
  ) => {
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

    const network = await ethers.provider.getNetwork();

    // TODO: fix JSON schemas import logic (can't use git submodules anymore)
    const jsonFile = await readFile(
      `${__dirname}/../schemas/json-schemas/${taskArgs.file}`,
    );
    const json = canonicalize(JSON.parse(jsonFile.toString()));
    const schema = ethers.toUtf8Bytes(json!);
    const schemaHex = `0x${Buffer.from(JSON.stringify(json), "utf8").toString(
      "hex",
    )}`;

    try {
      await (
        await tsr.updateSchema(taskArgs.schema, schemaHex, schema)
      ).wait(1);
      console.log(
        `Schema ${taskArgs.file} updated on networkId ${network.chainId} at id: ${taskArgs.schema}`,
      );
    } catch {
      console.log(
        `There is no schema ${taskArgs.file} registered on networkId ${network.chainId} at id: ${taskArgs.schema}`,
      );
    }
  },
)
  .addParam("proxy", "Proxy Address")
  .addParam("schema", "Schema Address Hash")
  .addParam("file", "file name from schemas/json-schemas");
