// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IEBSITimestamp} from "./interfaces/IEBSITimestamp.sol";
import {IEBSIDidRegistry} from "./interfaces/IEBSIDidRegistry.sol";
import {IEBSITrustedIssuers} from "./interfaces/IEBSITrustedIssuers.sol";
import {WELLRegistry} from "./WELLRegistry.sol";

/**
 * @title WELLIntegrity
 * @notice Core contract of the WELL Repository responsible for verifying the issuer's 
 * identity and authorization before anchoring EHR hashes in the EBSI infrastructure.
 * @dev This contract implements dynamic service discovery via the WELLRegistry (Dependency Injection).
 */
contract WELLIntegrity {
    WELLRegistry public registry;

    constructor(address _registryAddr) {
        registry = WELLRegistry(_registryAddr);
    }

    /**
     * @notice Anchors an EHR hash into the EBSI blockchain after verifying the issuer.
     * @param ehrHash The SHA-256 hash representing the medical record metadata.
     * @param issuerDid The Decentralized Identifier (DID) string of the health institution.
     */
    function anchorEhr(bytes32 ehrHash, string calldata issuerDid) external {
        // --- STEP 1: IDENTITY VERIFICATION (EBSI DID Registry v5) ---
        
        address didRegistryAddr = registry.getContract("EBSI_DID_REGISTRY");
        require(didRegistryAddr != address(0), "EBSI DID Registry address not set");

        // We verify if the DID exists and is active in the official EU registry.
        // EBSI v5 returns a tuple; we only need the baseDocument to confirm existence.
        (string memory baseDoc, , , , ) = IEBSIDidRegistry(didRegistryAddr).getDidDocument(issuerDid);
        require(bytes(baseDoc).length > 0, "Issuer DID not found or inactive");

        // --- STEP 2: AUTHORIZATION VERIFICATION (EBSI Trusted Issuers Registry v5) ---

        address tirAddr = registry.getContract("EBSI_TIR");
        require(tirAddr != address(0), "EBSI TIR address not set");

        // We check if the issuer has an active attribute (authorization) in the TIR.
        (, uint256 totalAttributes) = IEBSITrustedIssuers(tirAddr).getIssuer(issuerDid);
        require(totalAttributes > 0, "Issuer is not a Trusted Health Institution authorized by the EU");

        // --- STEP 3: INTEGRITY ANCHORING (EBSI Timestamping v4) ---

        address ebsiAddr = registry.getContract("EBSI_TIMESTAMP");
        require(ebsiAddr != address(0), "EBSI Timestamp address not set");

        // Prepare dynamic arrays for the official cross-contract call.
        uint256[] memory algoIds = new uint256[](1);
        algoIds[0] = 0; // SHA-256 is registered at index 0 in our setup.

        bytes[] memory hashValues = new bytes[](1);
        hashValues[0] = abi.encodePacked(ehrHash);

        bytes[] memory timestampData = new bytes[](1);
        timestampData[0] = ""; 

        // Execute the notarization on the European infrastructure.
        IEBSITimestamp(ebsiAddr).timestampHashes(algoIds, hashValues, timestampData);
    }
}