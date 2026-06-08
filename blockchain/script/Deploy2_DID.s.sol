// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {DidRegistry} from "@ebsi/did/DidRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy2_DID is Script {
    function run() external {
        address registryAddr = vm.envAddress("WELL_REGISTRY_ADDR");
        address tprAddr = vm.envAddress("POLICY_MOCK_ADDR");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        DidRegistry didLogic = new DidRegistry(tprAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(didLogic),
            abi.encodeWithSelector(DidRegistry.initialize.selector, 1)
        );
        
        WELLRegistry(registryAddr).setContract("EBSI_DID_REGISTRY", address(proxy));
        
        // Seed test DID
        DidRegistry(address(proxy)).insertDidDocument(
            "did:ebsi:hospital-test", "{}", "key-1", new bytes(64), true, block.timestamp, block.timestamp + 365 days
        );

        DidRegistry(address(proxy)).insertDidDocument(
            "did:ebsi:hospital-long-identifier-for-economic-scalability-testing", "{}", "key-1", new bytes(64), true, block.timestamp, block.timestamp + 365 days
        );

        DidRegistry(address(proxy)).insertDidDocument(
            "did:ebsi:root-authority", "{}", "key-1", new bytes(64), true, block.timestamp, block.timestamp + 365 days
        );
        
        console.log("DID_REGISTRY_ADDR=", address(proxy));
        vm.stopBroadcast();
    }
}