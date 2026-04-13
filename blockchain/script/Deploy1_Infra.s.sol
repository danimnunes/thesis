// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {PolicyRegistryMock} from "@ebsi/mock-policies/PolicyRegistryMock.sol";

contract Deploy1_Infra is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        WELLRegistry registry = new WELLRegistry();
        PolicyRegistryMock tpr = new PolicyRegistryMock();
        tpr.setPolicyResult(true);

        console.log("WELL_REGISTRY_ADDR=", address(registry));
        console.log("POLICY_MOCK_ADDR=", address(tpr));

        vm.stopBroadcast();
    }
}