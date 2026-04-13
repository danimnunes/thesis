// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {WELLIntegrity} from "../src/WELLIntegrity.sol";

contract Deploy5_WELL is Script {
    function run() external {
        address registryAddr = vm.envAddress("WELL_REGISTRY_ADDR");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        WELLIntegrity well = new WELLIntegrity(registryAddr);

        console.log("WELL_INTEGRITY_ADDR=", address(well));
        console.log("PROTOTYPE READY FOR SEPOLIA");

        vm.stopBroadcast();
    }
}