// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {Tir} from "@ebsi/tir/Tir.sol";
import {IEBSITrustedIssuers} from "../src/interfaces/IEBSITrustedIssuers.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy3_TIR is Script {
    function run() external {
        address registryAddr = vm.envAddress("WELL_REGISTRY_ADDR");
        address tprAddr = vm.envAddress("POLICY_MOCK_ADDR");
        address didAddr = vm.envAddress("DID_REGISTRY_ADDR");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy the Logic and Proxy for TIR
        Tir tirLogic = new Tir(tprAddr, didAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(tirLogic),
            abi.encodeWithSelector(Tir.initialize.selector, 1)
        );

        // 2. Register TIR in the WELLRegistry
        WELLRegistry(registryAddr).setContract("EBSI_TIR", address(proxy));
        
        // 3. SEEDING: Authorize the test hospital
        bytes32 rootAttrId = bytes32(uint256(100));
        bytes32 hospAttrId = bytes32(uint256(1)); 

        // first we need to create the RootTAO (Type 1) that represents a trusted authority (e.g., EBSI Root Authority)
        IEBSITrustedIssuers(address(proxy)).setAttributeMetadata(
            "did:ebsi:root-authority", 
            rootAttrId,
            1,                         // 1 = RootTAO
            "did:ebsi:root-authority", 
            bytes32(0)
        );

        // then we create the TI (Type 3) for the hospital, linking it to the RootTAO created above. This is what authorizes the hospital as a trusted issuer in the EBSI ecosystem.
        IEBSITrustedIssuers(address(proxy)).setAttributeMetadata(
            "did:ebsi:hospital-test", 
            hospAttrId,
            3,                         
            "did:ebsi:root-authority", 
            rootAttrId                
        );

        console.log("TIR_REGISTRY_ADDR=", address(proxy));
        vm.stopBroadcast();
    }
}