// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IVersionedBeacon.sol";

/**
 * @title VersionedUpgradeableBeacon
 * @dev Implements Ownable and IBeacon; maintains multiple implementations by version.
 *      Proxies pin a version and resolve via implementation(version). Parameterless
 *      implementation() returns the latest version for IBeacon compatibility.
 */
contract VersionedUpgradeableBeacon is IVersionedBeacon, IBeacon, Ownable {
    uint64 private _latestVersion;
    mapping(uint64 => address) private _implementationOfVersion;
    mapping(uint64 => bool) private _deprecated;
    uint64[] private _versions;

    event VersionAdded(uint64 indexed version, address indexed implementation);
    event VersionDeprecated(uint64 indexed version);

    error VersionMustIncrease();
    error ImplementationNotContract();
    error VersionNotAvailable();

    constructor(
        address initialImplementation,
        address ebsiOwner
    ) Ownable(ebsiOwner) {
        _latestVersion = 1;
        _implementationOfVersion[1] = initialImplementation;
        _versions.push(1);
        emit VersionAdded(1, initialImplementation);
    }

    /// @dev IBeacon: returns implementation for latest version.
    function implementation() external view override returns (address) {
        return _implementationOfVersion[_latestVersion];
    }

    function implementation(
        uint64 version
    ) external view override returns (address) {
        return _implementationOfVersion[version];
    }

    function latestVersion() external view override returns (uint64) {
        return _latestVersion;
    }

    function isVersionAvailable(
        uint64 version
    ) external view override returns (bool) {
        return
            _implementationOfVersion[version] != address(0) &&
            !_deprecated[version];
    }

    function getVersions() external view override returns (uint64[] memory) {
        return _versions;
    }

    /// @dev Beacon admin: register a new implementation version (must be strictly greater than latestVersion).
    function addVersion(
        uint64 version,
        address newImplementation
    ) external onlyOwner {
        if (version <= _latestVersion) revert VersionMustIncrease();
        _latestVersion = version;
        _implementationOfVersion[version] = newImplementation;
        _versions.push(version);
        emit VersionAdded(version, newImplementation);
    }

    /// @dev Beacon admin: mark a version as deprecated (existing proxies on that version keep working).
    function deprecateVersion(uint64 version) external onlyOwner {
        if (_implementationOfVersion[version] == address(0))
            revert VersionNotAvailable();
        _deprecated[version] = true;
        emit VersionDeprecated(version);
    }
}
