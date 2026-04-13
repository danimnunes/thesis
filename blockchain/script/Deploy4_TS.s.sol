// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {Timestamp, HashAlgoStorage} from "@ebsi/timestamp/Timestamp.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy4_TS is Script {
    function run() external {
        address registryAddr = vm.envAddress("WELL_REGISTRY_ADDR");
        address tprAddr = vm.envAddress("POLICY_MOCK_ADDR");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        Timestamp tsLogic = new Timestamp(tprAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(tsLogic),
            abi.encodeWithSelector(Timestamp.initialize.selector, 1)
        );

        WELLRegistry(registryAddr).setContract("EBSI_TIMESTAMP", address(proxy));
        
        // Config SHA-256
        Timestamp(address(proxy)).insertHashAlgorithm(32, "sha-256", "2.1", HashAlgoStorage.Status.active, "0x12");

        console.log("TIMESTAMP_ADDR=", address(proxy));
        vm.stopBroadcast();
    }
}