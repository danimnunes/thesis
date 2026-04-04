// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/*
 * @title IEBSITimestamp
 * @notice Interface for the EBSI Timestamp contract.
 * Dependency injection is used to allow the WELL contract to interact with the EBSI Timestamp contract without hardcoding its address.
 */

interface IEBSITimestamp {
    function timestampHashes(
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData
    ) external returns (bytes32[] memory);
}