import { task } from "hardhat/config";

/**
 * Scans an existing ProxyTemplateRegistry for addTemplate transactions in a block range,
 * decodes the template data, and replays them into a new ProxyTemplateRegistry deployment.
 *
 * Usage:
 *   npx hardhat --network <network> migrateProxyTemplateRegistry \
 *     --fromproxytemplateregistry <source ProxyTemplateRegistry to scan> \
 *     --toproxytemplateregistry <target ProxyTemplateRegistry to insert into> \
 *     --fromblock <block number> \
 *     [--toblock <block number, default: latest>] \
 *     [--chunksize <blocks per chunk, default 2000>]
 *
 * Blocks are processed in chunks. After each chunk the last processed block is printed;
 * if the run fails, resume with --fromblock <last+1> (same other args).
 * If toproxytemplateregistry is omitted, a new ProxyTemplateRegistry is deployed (requires --policyregistry).
 */
task(
  "migrateProxyTemplateRegistry",
  "Scan addTemplate txs from a ProxyTemplateRegistry and replay into another",
)
  .addParam(
    "fromproxytemplateregistry",
    "Address of the ProxyTemplateRegistry to scan for addTemplate txs",
  )
  .addOptionalParam(
    "toproxytemplateregistry",
    "Address of the ProxyTemplateRegistry to insert templates into (if omitted, a new one is deployed)",
  )
  .addParam(
    "fromblock",
    "Start block (inclusive) to scan for addTemplate transactions",
  )
  .addOptionalParam(
    "policyregistry",
    "Policy Registry address (required when not providing toproxytemplateregistry)",
  )
  .addOptionalParam("toblock", "End block (inclusive). Omit for latest")
  .addOptionalParam(
    "chunksize",
    "Block range size per chunk (default 2000, within typical RPC getLogs limit). After each chunk, the last processed block is printed so you can resume with --fromblock <last+1> if it fails.",
    "2000",
  )
  .setAction(
    async (
      taskArgs: {
        chunksize?: string;
        fromblock: string;
        fromproxytemplateregistry: string;
        policyregistry?: string;
        toblock?: string;
        toproxytemplateregistry?: string;
      },
      { ethers, run, upgrades },
    ) => {
      await run("compile", { quiet: true });

      const provider = ethers.provider;
      const fromAddress = ethers.getAddress(taskArgs.fromproxytemplateregistry);
      const fromBlock = BigInt(taskArgs.fromblock);
      const toBlock = taskArgs.toblock
        ? BigInt(taskArgs.toblock)
        : await provider.getBlockNumber().then(BigInt);
      const chunkSize = BigInt(taskArgs.chunksize ?? "2000");

      console.log(
        `Scanning ${fromAddress} from block ${fromBlock} to ${toBlock} (chunk size: ${chunkSize})...`,
      );

      const ProxyTemplateRegistry = await ethers.getContractFactory(
        "ProxyTemplateRegistry",
      );
      const iface = ProxyTemplateRegistry.interface;

      let proxyTemplateRegistry;
      let newAddress: string;

      if (taskArgs.toproxytemplateregistry) {
        newAddress = ethers.getAddress(taskArgs.toproxytemplateregistry);
        console.log(`Using existing ProxyTemplateRegistry: ${newAddress}`);
        proxyTemplateRegistry = await ethers.getContractAt(
          "ProxyTemplateRegistry",
          newAddress,
        );
      } else {
        if (!taskArgs.policyregistry) {
          throw new Error(
            "policyregistry is required when not providing toproxytemplateregistry",
          );
        }
        console.log(
          `Deploying new ProxyTemplateRegistry (policy: ${taskArgs.policyregistry})...`,
        );
        proxyTemplateRegistry = await upgrades.deployProxy(
          ProxyTemplateRegistry,
          [taskArgs.policyregistry],
        );
        await proxyTemplateRegistry.waitForDeployment();
        newAddress = await proxyTemplateRegistry.getAddress();
        console.log(`New ProxyTemplateRegistry: ${newAddress}`);
      }

      // TemplateAdded(bytes32 indexed templateId, string name, string version)
      const templateAddedTopic = ethers.id(
        "TemplateAdded(bytes32,string,string)",
      );

      let totalTemplates = 0;
      let lastProcessedBlock = fromBlock - 1n;

      for (
        let chunkStart = fromBlock;
        chunkStart <= toBlock;
        chunkStart += chunkSize
      ) {
        const chunkEnd = BigInt(
          Math.min(Number(chunkStart + chunkSize - 1n), Number(toBlock)),
        );

        const logs = await provider.getLogs({
          address: fromAddress,
          fromBlock: chunkStart,
          toBlock: chunkEnd,
          topics: [templateAddedTopic],
        });

        const txHashes = [...new Set(logs.map((l) => l.transactionHash))];
        const templates: {
          auditURI: string;
          beaconAddress: string;
          contractHash: string;
          initSelector: string;
          isActive: boolean;
          name: string;
          repoURI: string;
          storageLayoutHash: string;
          version: string;
        }[] = [];

        for (const txHash of txHashes) {
          const tx = await provider.getTransaction(txHash);
          if (!tx?.to || ethers.getAddress(tx.to) !== fromAddress) continue;
          if (tx.data.length < 10) continue;
          const selector = tx.data.slice(0, 10);
          const addTemplateFragment = iface.getFunction("addTemplate");
          if (!addTemplateFragment) continue;
          if (
            selector.toLowerCase() !==
            addTemplateFragment.selector.toLowerCase()
          )
            continue;

          const decoded = iface.parseTransaction({ data: tx.data });
          if (decoded?.name !== "addTemplate") continue;
          const newTemplate = decoded.args[0] as {
            auditURI: string;
            beaconAddress: string;
            contractHash: string;
            initSelector: string;
            isActive: boolean;
            name: string;
            repoURI: string;
            storageLayoutHash: string;
            version: string;
          };
          templates.push({
            auditURI: newTemplate.auditURI,
            beaconAddress: newTemplate.beaconAddress,
            contractHash: newTemplate.contractHash,
            initSelector: newTemplate.initSelector,
            isActive: true,
            name: newTemplate.name,
            repoURI: newTemplate.repoURI,
            storageLayoutHash: newTemplate.storageLayoutHash,
            version: newTemplate.version,
          });
        }

        for (const t of templates) {
          console.log(
            `  Adding template (chunk ${chunkStart}-${chunkEnd}): ${t.name}@${t.version}`,
          );
          const tx = await proxyTemplateRegistry.addTemplate(t);
          await tx.wait();
        }

        totalTemplates += templates.length;
        lastProcessedBlock = chunkEnd;

        const nextBlock: bigint = chunkEnd + 1n;
        console.log(
          `  Chunk ${chunkStart}-${chunkEnd} done (${templates.length} template(s)). To resume from next block if run fails later: --fromblock ${nextBlock}`,
        );
      }

      const resumeFrom = lastProcessedBlock + 1n;
      console.log(
        `\nMigrated ${totalTemplates} template(s) to ${newAddress}. Last processed block: ${lastProcessedBlock}. To continue from next block: --fromblock ${resumeFrom}`,
      );
    },
  );
