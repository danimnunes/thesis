// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {WELLIntegrity} from "../src/WELLIntegrity.sol";
// Import the EBSI Timestamp contract from the lib folder
import "@ebsi/timestamp/Timestamp.sol";

/*
 * @title DeployWELL
 * @notice A script to deploy the WELLRegistry, EBSI Timestamp, and WELLIntegrity contracts.
 * This script demonstrates the use of dependency injection by first deploying the EBSI Timestamp contract,
 * then registering its address in the WELLRegistry, and finally deploying the WELLIntegrity contract that
 * depends on the registry to access the EBSI Timestamp functionality.
 */

contract DeployWELL is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        vm.startBroadcast(deployerPrivateKey);

        // 1. Create the registry that will hold the addresses of our contracts
        WELLRegistry registry = new WELLRegistry();

        // 2. Deploy the EBSI Timestamp contract and initialize it (using a dummy address for the constructor since it's not relevant for this example)
        Timestamp ebsiTs = new Timestamp(address(1));
        ebsiTs.initialize(1);

        // 3. Inject the EBSI Timestamp contract address into the registry so that the WELLIntegrity contract can find it
        registry.setContract("EBSI_TIMESTAMP", address(ebsiTs));

        // 4. Create our system by passing the registry address to the WELLIntegrity contract, which will use it to access the EBSI Timestamp contract
        WELLIntegrity well = new WELLIntegrity(address(registry));

        console.log("WELLRegistry deployed at:", address(registry));
        console.log("WELLIntegrity system deployed at:", address(well));
        console.log("Current EBSI Timestamp version at:", address(ebsiTs));

        vm.stopBroadcast();
    }
}
