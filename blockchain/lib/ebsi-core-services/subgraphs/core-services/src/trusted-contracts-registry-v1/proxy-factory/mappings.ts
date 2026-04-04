import { ProxyDeployed } from "../../../generated/ProxyFactory/ProxyFactory";
import { ContractProxy } from "../../../generated/schema";

export function handleProxyDeployedEvent(event: ProxyDeployed): void {
  const proxy = new ContractProxy(event.params.proxyAddress);

  proxy.deployerAddress = event.params.deployer;
  proxy.deployerDidDocument = event.params.deployerDID;
  proxy.initData = event.params.initData;
  proxy.isActive = true;
  proxy.template = event.params.templateId;
  proxy.timestamp = event.params.timestamp;

  // Check if deployerAddress is another ContractProxy (support recursion)
  const deployerProxy = ContractProxy.load(event.params.deployer);
  if (deployerProxy) {
    proxy.deployerProxy = deployerProxy.id;
  }

  proxy.save();
}
