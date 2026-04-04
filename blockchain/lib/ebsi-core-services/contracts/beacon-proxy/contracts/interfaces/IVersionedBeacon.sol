// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

/**
 * @title IVersionedBeacon
 * @dev Beacon that stores multiple implementations by version; proxies opt-in to a version.
 */
interface IVersionedBeacon {
    function latestVersion() external view returns (uint64);

    function implementation(uint64 version) external view returns (address);

    function isVersionAvailable(uint64 version) external view returns (bool);

    /// @dev Optional: returns all registered version numbers (may be expensive).
    function getVersions() external view returns (uint64[] memory);
}
