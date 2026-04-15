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

/**
 * @title WELLIntegrityTest
 * @notice Automated test suite for validating the Identity, Authorization, and Integrity modules.
 * @dev Implements a hierarchical EBSI trust chain simulation.
 */
contract WELLIntegrityTest is Test {
    WELLRegistry registry;
    WELLIntegrity integrity;
    Timestamp ebsiTimestamp;
    DidRegistry ebsiDidRegistry;
    Tir ebsiTir;
    PolicyRegistryMock tpr;

    // DIDs used for the trust chain
    string constant TEST_DID = "did:ebsi:hospital-test";
    string constant ROOT_DAO_DID = "did:ebsi:root-authority";

    // EBSI v5 Issuer Types: 1 = RootTAO (Authority), 3 = TI (Trusted Issuer)
    uint8 constant ISSUER_TYPE_ROOT = 1;
    uint8 constant ISSUER_TYPE_TI = 3;

    function setUp() public {
        registry = new WELLRegistry();
        tpr = new PolicyRegistryMock();
        tpr.setPolicyResult(true);

        // --- 1. SETUP DID REGISTRY (IDENTITY) ---
        DidRegistry didImplementation = new DidRegistry(address(tpr));
        ERC1967Proxy didProxy = new ERC1967Proxy(
            address(didImplementation),
            abi.encodeWithSelector(DidRegistry.initialize.selector, 1)
        );
        ebsiDidRegistry = DidRegistry(address(didProxy));
        registry.setContract("EBSI_DID_REGISTRY", address(ebsiDidRegistry));

        // Create a compliant 64-byte public key
        bytes memory dummyPublicKey = new bytes(64);
        for(uint i=0; i<64; i++) { 
            // forge-lint: disable-next-line(unsafe-typecast)
            dummyPublicKey[i] = bytes1(uint8(i)); 
        }

        // Register both Hospital and Root Authority identities
        ebsiDidRegistry.insertDidDocument(TEST_DID, "{}", "k1", dummyPublicKey, true, block.timestamp, block.timestamp + 1 days);
        ebsiDidRegistry.insertDidDocument(ROOT_DAO_DID, "{}", "k1", dummyPublicKey, true, block.timestamp, block.timestamp + 1 days);

        // --- 2. SETUP TRUSTED ISSUERS REGISTRY (AUTHORIZATION) ---
        Tir tirImplementation = new Tir(address(tpr), address(ebsiDidRegistry));
        ERC1967Proxy tirProxy = new ERC1967Proxy(
            address(tirImplementation),
            abi.encodeWithSelector(Tir.initialize.selector, 1)
        );
        ebsiTir = Tir(address(tirProxy));
        registry.setContract("EBSI_TIR", address(ebsiTir));

        // Define Attribute IDs for the trust chain
        bytes32 rootAttrId = bytes32(uint256(100));
        bytes32 hospAttrId = bytes32(uint256(1));

        // STEP A: Register Root Authority (Self-authorized)
        IEBSITrustedIssuers(address(ebsiTir)).setAttributeMetadata(
            ROOT_DAO_DID,
            rootAttrId,
            ISSUER_TYPE_ROOT,
            ROOT_DAO_DID,
            bytes32(0)
        );

        // STEP B: Register Hospital authorized by the Root Authority
        IEBSITrustedIssuers(address(ebsiTir)).setAttributeMetadata(
            TEST_DID, 
            hospAttrId,
            ISSUER_TYPE_TI,
            ROOT_DAO_DID,
            rootAttrId
        );

        // --- 3. SETUP TIMESTAMPING (INTEGRITY) ---
        Timestamp tsImplementation = new Timestamp(address(tpr));
        ERC1967Proxy tsProxy = new ERC1967Proxy(
            address(tsImplementation),
            abi.encodeWithSelector(Timestamp.initialize.selector, 1)
        );
        ebsiTimestamp = Timestamp(address(tsProxy));
        
        // Register SHA-256 algorithm (ID 0)
        ebsiTimestamp.insertHashAlgorithm(32, "sha-256", "2.1", HashAlgoStorage.Status.active, "0x12");
        registry.setContract("EBSI_TIMESTAMP", address(ebsiTimestamp));

        // --- 4. SETUP WELL CORE SYSTEM ---
        integrity = new WELLIntegrity(address(registry));
    }

    /**
     * @notice Validates successful anchoring with a valid DID and authorization.
     */
    function test_SuccessfulAnchoring() public {
        bytes32 testValue = keccak256("EHR_DATA_SAMPLE");
        
        integrity.anchorEhr(testValue, TEST_DID);
        
        // EBSI generates the internal ID based on the sha256 of the payload
        bytes32 expectedEbsiId = sha256(abi.encodePacked(testValue));
        (TimestampStorage.Hash memory h, , , ) = ebsiTimestamp.getTimestampById(expectedEbsiId);

        assertEq(h.algorithm, 0); 
        assertEq(h.value, abi.encodePacked(testValue)); 
    }

    /**
     * @notice Ensures that DIDs not present in the TIR are blocked.
     */
    function test_FailNonAuthorizedIssuer() public {
        bytes32 testValue = keccak256("EHR_DATA");
        string memory unauthorizedDid = "did:ebsi:unauthorized-hosp";

        // Register identity but bypass accreditation (TIR)
        bytes memory dummyPublicKey = new bytes(64);
        ebsiDidRegistry.insertDidDocument(unauthorizedDid, "{}", "k1", dummyPublicKey, true, block.timestamp, block.timestamp + 1 days);

        vm.expectRevert("issuer does not exist"); 
        integrity.anchorEhr(testValue, unauthorizedDid);
    }

    /**
     * @notice Ensures that non-existent DIDs are blocked.
     */
    function test_FailWithoutValidDID() public {
        bytes32 testValue = keccak256("EHR_DATA");
        
        vm.expectRevert("Issuer DID not found or inactive");
        integrity.anchorEhr(testValue, "did:ebsi:non-existent");
    }

    /**
     * @notice Validates that the system reverts if Dependency Injection fails.
     */
    function test_FailWhenRegistryNotSet() public {
        WELLRegistry emptyRegistry = new WELLRegistry();
        WELLIntegrity faultyIntegrity = new WELLIntegrity(address(emptyRegistry));
        
        vm.expectRevert("EBSI DID Registry address not set");
        faultyIntegrity.anchorEhr(keccak256("DATA"), TEST_DID);
    }
}