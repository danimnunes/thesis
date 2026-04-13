// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {WELLRegistry} from "../src/WELLRegistry.sol";
import {WELLIntegrity} from "../src/WELLIntegrity.sol";
import {Timestamp, TimestampStorage, HashAlgoStorage} from "@ebsi/timestamp/Timestamp.sol";
import {DidRegistry} from "@ebsi/did/DidRegistry.sol";
import {Tir} from "@ebsi/tir/Tir.sol";
import {PolicyRegistryMock} from "@ebsi/mock-policies/PolicyRegistryMock.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IEBSITrustedIssuers} from "../src/interfaces/IEBSITrustedIssuers.sol";

contract WELLIntegrityTest is Test {
    WELLRegistry registry;
    WELLIntegrity integrity;
    Timestamp ebsiTimestamp;
    DidRegistry ebsiDidRegistry;
    Tir ebsiTir;
    PolicyRegistryMock tpr;

    string constant TEST_DID = "did:ebsi:hospital-test";
    // EBSI v5 Enum IssuerType: 0:Undefined, 1:RootTAO, 2:TAO, 3:TI
    uint8 constant ISSUER_TYPE_TI = 3; 

    function setUp() public {
        registry = new WELLRegistry();
        tpr = new PolicyRegistryMock();
        tpr.setPolicyResult(true);

        // 1. Setup EBSI DID Registry
        DidRegistry didImplementation = new DidRegistry(address(tpr));
        ERC1967Proxy didProxy = new ERC1967Proxy(
            address(didImplementation),
            abi.encodeWithSelector(DidRegistry.initialize.selector, 1)
        );
        ebsiDidRegistry = DidRegistry(address(didProxy));
        registry.setContract("EBSI_DID_REGISTRY", address(ebsiDidRegistry));

        bytes memory dummyPublicKey = new bytes(64);
        for(uint i=0; i<64; i++) { 
            // forge-lint: disable-next-line(unsafe-typecast)
            dummyPublicKey[i] = bytes1(uint8(i)); 
        }

        ebsiDidRegistry.insertDidDocument(
            TEST_DID,
            "{'id': 'did:ebsi:test'}",
            "key-1",
            dummyPublicKey,
            true,
            block.timestamp,
            block.timestamp + 1 days
        );

        // 2. Setup EBSI Trusted Issuers Registry
        Tir tirImplementation = new Tir(address(tpr), address(ebsiDidRegistry));
        ERC1967Proxy tirProxy = new ERC1967Proxy(
            address(tirImplementation),
            abi.encodeWithSelector(Tir.initialize.selector, 1)
        );
        ebsiTir = Tir(address(tirProxy));
        registry.setContract("EBSI_TIR", address(ebsiTir));

        // ACCREDITATION: Register the test DID as a Trusted Issuer
        // Note: The second parameter must be bytes32
        IEBSITrustedIssuers(address(ebsiTir)).setAttributeMetadata(
            TEST_DID, 
            bytes32(uint256(1)),       // revisionId
            ISSUER_TYPE_TI,            // issuerType (uint8 3)
            "did:ebsi:root-authority", 
            bytes32(0)
        );

        // 3. Setup EBSI Timestamp
        Timestamp tsImplementation = new Timestamp(address(tpr));
        ERC1967Proxy tsProxy = new ERC1967Proxy(
            address(tsImplementation),
            abi.encodeWithSelector(Timestamp.initialize.selector, 1)
        );
        ebsiTimestamp = Timestamp(address(tsProxy));
        
        ebsiTimestamp.insertHashAlgorithm(32, "sha-256", "2.1", HashAlgoStorage.Status.active, "0x12");
        registry.setContract("EBSI_TIMESTAMP", address(ebsiTimestamp));

        integrity = new WELLIntegrity(address(registry));
    }

    // TEST 1: Success case - Full trust chain validation
    function test_SuccessfulAnchoring() public {
        bytes32 testValue = keccak256("EHR_DATA_SAMPLE");
        
        // This should succeed as the DID exists, is active, and is authorized in the TIR.
        integrity.anchorEhr(testValue, TEST_DID);
        
        // Verify that the timestamp was anchored correctly in EBSI Timestamping
        bytes32 expectedEbsiId = sha256(abi.encodePacked(testValue));
        (TimestampStorage.Hash memory h, , , ) = ebsiTimestamp.getTimestampById(expectedEbsiId);

        assertEq(h.algorithm, 0); 
        assertEq(h.value, abi.encodePacked(testValue)); 
    }

    // TEST 2: Fail case - Issuer has a DID but is NOT authorized in TIR
    function test_FailNonAuthorizedIssuer() public {
        bytes32 testValue = keccak256("EHR_DATA");
        string memory unauthorizedDid = "did:ebsi:unauthorized-hosp";

        // Register the unauthorized DID in the DID Registry but NOT in the TIR. It should fail at the authorization step.
        bytes memory dummyPublicKey = new bytes(64);
        ebsiDidRegistry.insertDidDocument(
            unauthorizedDid,
            "{'id': 'unauthorized'}",
            "key-1",
            dummyPublicKey,
            true,
            block.timestamp,
            block.timestamp + 1 days
        );

        // Attempting to anchor with a DID that exists but is not authorized in the TIR should revert with the appropriate error message.
        vm.expectRevert("Issuer is not a Trusted Health Institution authorized by the EU");
        integrity.anchorEhr(testValue, unauthorizedDid);
    }

    // TEST 3: Fail case - Attempting to anchor with a non-existent DID
    function test_FailWithoutValidDID() public {
        bytes32 testValue = keccak256("EHR_DATA");
        
        vm.expectRevert("Issuer DID not found or inactive");
        integrity.anchorEhr(testValue, "did:ebsi:non-existent");
    }

    // TEST 4: Fail when registry is not set (Dependency Injection Fail)
    function test_FailWhenRegistryNotSet() public {
        WELLRegistry emptyRegistry = new WELLRegistry();
        WELLIntegrity faultyIntegrity = new WELLIntegrity(address(emptyRegistry));
        
        vm.expectRevert("EBSI DID Registry address not set");
        faultyIntegrity.anchorEhr(keccak256("DATA"), TEST_DID);
    }
}