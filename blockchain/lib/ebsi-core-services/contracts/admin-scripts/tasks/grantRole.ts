import { task } from "hardhat/config";

import type { ContractTransactionResponse } from "ethers";

interface PolicyRegistryLike {
  grantRole(
    role: string,
    account: string,
  ): Promise<ContractTransactionResponse>;
  hasRole(role: string, account: string): Promise<boolean>;
  OPERATOR_ROLE(): Promise<string>;
}

task("grantRole", "add new operator on Trusted Policy Registry")
  .addParam("proxy", "The proxy address of tpr")
  .addParam("operator", "The address of the operator")
  .setAction(
    async (taskArgs: { operator: string; proxy: string }, { ethers }) => {
      const proxyDeployedAddr = taskArgs.proxy;
      // get contract
      const trustedPolicyRegistry = (await ethers.getContractAt(
        "PolicyRegistry",
        proxyDeployedAddr,
      )) as unknown as PolicyRegistryLike;
      const operatorRole = await trustedPolicyRegistry.OPERATOR_ROLE();
      // grant role
      await (
        await trustedPolicyRegistry.grantRole(operatorRole, taskArgs.operator)
      ).wait(1);
      // check role
      const hasRoleOperator = await trustedPolicyRegistry.hasRole(
        operatorRole,
        taskArgs.operator,
      );
      if (hasRoleOperator) {
        console.log(
          `Operator Role with id ${operatorRole} granted to ${taskArgs.operator}`,
        );
      }
    },
  );
