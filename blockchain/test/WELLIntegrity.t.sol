// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/WELLRegistry.sol";
import "../src/WELLIntegrity.sol";
import "@ebsi/timestamp/Timestamp.sol";
import "@ebsi/mock-policies/PolicyRegistryMock.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract WELLIntegrityTest is Test {
    WELLRegistry registry;
    WELLIntegrity integrity;
    Timestamp ebsiTimestamp;
    PolicyRegistryMock tpr;

    function setUp() public {
        registry = new WELLRegistry();
        tpr = new PolicyRegistryMock();
        tpr.setPolicyResult(true);

        // Proxy deploy for EBSI Timestamp to demonstrate dependency injection without hardcoding addresses
        Timestamp implementation = new Timestamp(address(tpr));
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeWithSelector(Timestamp.initialize.selector, 1)
        );
        ebsiTimestamp = Timestamp(address(proxy));

        // Algorithm configuration for the EBSI Timestamp contract
        ebsiTimestamp.insertHashAlgorithm(32, "sha-256", "2.1", HashAlgoStorage.Status.active, "0x12");

        // Register the EBSI Timestamp contract address in the WELLRegistry, demonstrating dependency injection to avoid hardcoding addresses
        registry.setContract("EBSI_TIMESTAMP", address(ebsiTimestamp));

        integrity = new WELLIntegrity(address(registry));
    }

    // TEST 1: Success case for anchoring an EHR hash, demonstrating successful interaction with the EBSI Timestamp contract through the registry without hardcoding its address
    function test_SuccessfulAnchoring() public {
        bytes32 testValue = keccak256("EHR_DATA_SAMPLE");
        
        integrity.anchorEHR(testValue);
        bytes32 expectedEbsiId = sha256(abi.encodePacked(testValue));

        // Verify that the hash was anchored in the EBSI Timestamp contract by retrieving it through the registry and checking its properties
        (TimestampStorage.Hash memory h, , , ) = ebsiTimestamp.getTimestampById(expectedEbsiId);

        assertEq(h.algorithm, 0); // SHA-256 algorithm ID
        assertEq(h.value, abi.encodePacked(testValue)); 
    }

    // TEST 2: Fail when registry is not set (Dependency Injection Fail)
    function test_FailWhenRegistryNotSet() public {
        // Create a new empty registry
        WELLRegistry emptyRegistry = new WELLRegistry();
        WELLIntegrity faultyIntegrity = new WELLIntegrity(address(emptyRegistry));
        
        vm.expectRevert("EBSI Timestamp address not set");
        faultyIntegrity.anchorEHR(keccak256("DATA"));
    }
}