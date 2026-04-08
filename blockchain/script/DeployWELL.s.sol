// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {WELLIntegrity} from "../src/WELLIntegrity.sol";
// Import the EBSI Timestamp contract from the lib folder
import "@ebsi/timestamp/Timestamp.sol";
import "@ebsi/mock-policies/PolicyRegistryMock.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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

        // Create the registry that will hold the addresses of our contracts
        WELLRegistry registry = new WELLRegistry();

        // Deploy a mock PolicyRegistry and set it to return true for any policy check,
        PolicyRegistryMock tpr = new PolicyRegistryMock();
        tpr.setPolicyResult(true);

        // Deploy the EBSI Timestamp contract, passing the address of the mock PolicyRegistry to satisfy its dependency
        Timestamp timestampLogic = new Timestamp(address(tpr));

        // Deploy a Transparent Upgradeable Proxy for the EBSI Timestamp contract, initializing it with the desired parameters
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(timestampLogic),
            abi.encodeWithSelector(Timestamp.initialize.selector, 1)
        );

        // Create an instance of the EBSI Timestamp contract pointing to the proxy address, demonstrating how we can interact with it through the proxy without hardcoding the implementation address
        Timestamp ts = Timestamp(address(proxy));

        // Register the EBSI Timestamp contract address in the WELLRegistry, demonstrating dependency injection to avoid hardcoding addresses
        registry.setContract("EBSI_TIMESTAMP", address(ts));

        // Deploy the WELLIntegrity contract, passing the address of the registry to its constructor, demonstrating how it can retrieve the EBSI Timestamp address from the registry without hardcoding it
        WELLIntegrity well = new WELLIntegrity(address(registry));

        // Insert a hash algorithm into the EBSI Timestamp contract to ensure it's properly set up for our use case
        ts.insertHashAlgorithm(
            32,
            "sha-256",
            "2.16.840.1.101.3.4.2.1",
            HashAlgoStorage.Status.active,
            "0x12"
        );

        console.log("-------------------------------------------");
        console.log("WELLRegistry at:", address(registry));
        console.log("WELLIntegrity at:", address(well));
        console.log("EBSI Service (talking through Proxy) at:", address(ts));
        console.log("Implementation Logic at:", address(timestampLogic));
        console.log("-------------------------------------------");

        vm.stopBroadcast();
    }
}