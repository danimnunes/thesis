import { task } from "hardhat/config";

import type { ContractTransactionResponse } from "ethers";

import { Settings } from "../utils/settings";

interface TrackAndTraceLike {
  getAddress(): Promise<string>;
  getImplementation(): Promise<string>;
  initializeV2(tprAddress: string): Promise<ContractTransactionResponse>;
}

task("trackAndTrace", "Deploy contract Track And Trace")
  .addParam("admin", "The admin address")
  .addParam("upgrader", "The upgrader address")
  .addParam("tpr", "The TrustedPolicyRegistry Proxy address")
  .addParam("registry", "The address of didRegistry")
  .addParam(
    "suffix",
    "the suffix name of the contract for the deployment",
    "EBSI",
  )
  .setAction(
    async (
      taskArgs: {
        admin: string;
        registry: string;
        suffix: string;
        tpr: string;
        upgrader: string;
      },

      { ethers, network, run, upgrades },
    ) => {
      // compile
      await run("compile", { quiet: true });
      const fileName =
        taskArgs.suffix == "EBSI"
          ? "track-and-trace"
          : `track-and-trace-${taskArgs.suffix}`;

      const settings = new Settings(fileName, network.name);

      // get contract
      const trackAndTraceLibFactory = await ethers.getContractFactory(
        "TrackAndTraceLib",
        {},
      );
      const trackAndTraceLibContract = await trackAndTraceLibFactory.deploy();

      const trackAndTraceFactory = await ethers.getContractFactory(
        "TrackAndTrace",
        {
          libraries: {
            TrackAndTraceLib: await trackAndTraceLibContract.getAddress(),
          },
        },
      );

      // deploy
      const trackAndTrace = (await upgrades.deployProxy(
        trackAndTraceFactory,
        [taskArgs.admin, taskArgs.upgrader, taskArgs.tpr, taskArgs.registry],
        { unsafeAllow: ["external-library-linking"] },
      )) as unknown as TrackAndTraceLike;

      settings.set("trackAndTraceAddress", await trackAndTrace.getAddress());
      settings.set("adminAddress", taskArgs.admin);
      settings.set("upgraderAddress", taskArgs.upgrader);
      settings.set("tprAddress", taskArgs.tpr);
      settings.set("didRegistryAddress", taskArgs.registry);

      console.log(
        `TrackAndTrace contract deployed to ${await trackAndTrace.getAddress()}`,
      );
    },
  );

task("trackAndTraceUpgrade", "Deploy contract Track And Trace")
  .addParam(
    "suffix",
    "the suffix name of the contract for the deployment",
    "EBSI",
  )
  .setAction(
    async (
      taskArgs: {
        suffix: string;
      },
      { ethers, network, run, upgrades },
    ) => {
      // compile
      await run("compile", { force: true });

      const fileName =
        taskArgs.suffix == "EBSI"
          ? "track-and-trace"
          : `track-and-trace-${taskArgs.suffix}`;
      const settings = new Settings(fileName, network.name);
      const proxyAddress = settings.mustGet("trackAndTraceAddress");
      console.log(proxyAddress);

      // get contract
      const trackAndTraceLibFactory = await ethers.getContractFactory(
        "TrackAndTraceLib",
        {},
      );
      const trackAndTraceLibContract = await trackAndTraceLibFactory.deploy();

      // get contract
      const trackAndTraceFactory = await ethers.getContractFactory(
        "TrackAndTrace",
        {
          libraries: {
            TrackAndTraceLib: await trackAndTraceLibContract.getAddress(),
          },
        },
      );

      // forceImport
      await upgrades.forceImport(proxyAddress, trackAndTraceFactory);

      console.log(`factory loaded`);

      // deploy
      const trackAndTrace = (await upgrades.upgradeProxy(
        proxyAddress,
        trackAndTraceFactory,
        {
          redeployImplementation: "always",
          unsafeAllow: ["external-library-linking"],
        },
      )) as unknown as TrackAndTraceLike;

      console.log(
        `TrackAndTrace contract upgraded to ${await trackAndTrace.getImplementation()}`,
      );
    },
  );

task(
  "trackAndTraceUpgradeReinitialize",
  "Deploy contract Track And Trace and reinitialize with v2",
)
  .addParam("tpr", "Tpr Proxy Address")
  .setAction(
    async (taskArgs: { tpr: string }, { ethers, network, run, upgrades }) => {
      // compile
      await run("compile", { force: true });

      const settings = new Settings("track-and-trace", network.name);
      const proxyAddress = settings.mustGet("trackAndTraceAddress");
      settings.set("tprAddress", taskArgs.tpr);
      console.log(proxyAddress);

      // get contract
      const trackAndTraceLibFactory = await ethers.getContractFactory(
        "TrackAndTraceLib",
        {},
      );
      const trackAndTraceLibContract = await trackAndTraceLibFactory.deploy();

      // get contract
      const trackAndTraceFactory = await ethers.getContractFactory(
        "TrackAndTrace",
        {
          libraries: {
            TrackAndTraceLib: await trackAndTraceLibContract.getAddress(),
          },
        },
      );

      // forceImport
      await upgrades.forceImport(proxyAddress, trackAndTraceFactory);

      console.log(`factory loaded`);

      // deploy
      const trackAndTrace = (await upgrades.upgradeProxy(
        proxyAddress,
        trackAndTraceFactory,
        {
          redeployImplementation: "always",
          unsafeAllow: ["external-library-linking"],
        },
      )) as unknown as TrackAndTraceLike;
      console.log(
        `new contract deployed, beginning reinit with tpr address ${taskArgs.tpr}`,
      );
      await (await trackAndTrace.initializeV2(taskArgs.tpr)).wait(1);

      console.log(
        `TrackAndTrace contract upgraded and reinitialized to ${await trackAndTrace.getImplementation()}`,
      );
    },
  );
