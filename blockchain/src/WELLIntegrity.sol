// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./interfaces/IEBSITimestamp.sol";
import "./WELLRegistry.sol";

/*
 * @title WELLIntegrity
 * @notice A contract responsible for anchoring EHR hashes using the EBSI Timestamp service.
 * It retrieves the EBSI Timestamp contract address from the WELLRegistry, demonstrating dependency injection to avoid hardcoding addresses.
 */

contract WELLIntegrity {
    WELLRegistry public registry;

    constructor(address _registryAddr) {
        registry = WELLRegistry(_registryAddr);
    }

    function anchorEHR(bytes32 ehrHash) external {
        // 1. Dependency Injection: We retrieve the EBSI Timestamp contract address from the registry instead of hardcoding it
        address ebsiAddr = registry.getContract("EBSI_TIMESTAMP");
        require(ebsiAddr != address(0), "EBSI Timestamp address not set");

        // 2. Prepare the data for the timestamping call
        uint256[] memory algoIds = new uint256[](1);
        algoIds[0] = 1; // Example hash algorithm ID (e.g., SHA-256)

        bytes[] memory hashValues = new bytes[](1);
        hashValues[0] = abi.encodePacked(ehrHash); // Convert the bytes32 hash to bytes for the EBSI Timestamp contract

        bytes[] memory timestampData = new bytes[](1);
        timestampData[0] = ""; // Additional data can be added here if needed by the EBSI Timestamp contract

        // 3. Call the EBSI Timestamp contract to anchor the EHR hash, demonstrating how we can interact with it without hardcoding its address
        IEBSITimestamp(ebsiAddr).timestampHashes(algoIds, hashValues, timestampData);
    }
}
