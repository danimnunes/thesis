// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./interfaces/IVersionedBeacon.sol";
import "./interfaces/IVersionedBeaconProxy.sol";

/**
 * @title VersionedBeaconProxy
 * @dev Same as OpenZeppelin BeaconProxy plus: a version slot (pinned per proxy), _implementation()
 *      resolved via IVersionedBeacon(beacon).implementation(version), and upgradeToVersion(newVersion, data)
 *      to switch version and optionally run init (upgradeToAndCall-style). Uses a dedicated slot for
 *      proxy owner to avoid storage conflicts with implementation and Ownable's slot 0.
 */
contract VersionedBeaconProxy is BeaconProxy, IVersionedBeaconProxy {
    bytes32 private constant _VERSION_SLOT = bytes32(
        uint256(keccak256("eip1967.versionedbeaconproxy.version")) - 1
    );
    bytes32 private constant _PROXY_OWNER_SLOT = bytes32(
        uint256(keccak256("eip1967.versionedbeaconproxy.owner")) - 1
    );

    error VersionNotAvailable();

    constructor(
        address beacon_,
        bytes memory data_
    ) BeaconProxy(beacon_, data_) {
        StorageSlot.getUint256Slot(_VERSION_SLOT).value = IVersionedBeacon(
            beacon_
        ).latestVersion();
        StorageSlot.getAddressSlot(_PROXY_OWNER_SLOT).value = msg.sender;
    }

    function _getVersion() internal view returns (uint64) {
        return uint64(StorageSlot.getUint256Slot(_VERSION_SLOT).value);
    }

    function _getProxyOwner() internal view returns (address) {
        return StorageSlot.getAddressSlot(_PROXY_OWNER_SLOT).value;
    }

    modifier onlyProxyOwner() {
        require(
            msg.sender == _getProxyOwner(),
            "Proxy: caller is not the proxy owner"
        );
        _;
    }

    /// @dev Override: resolve implementation by pinned version from IVersionedBeacon.
    function _implementation()
        internal
        view
        virtual
        override
        returns (address)
    {
        return IVersionedBeacon(_getBeacon()).implementation(_getVersion());
    }

    function beacon() external view override returns (address) {
        return _getBeacon();
    }

    function version() external view override returns (uint64) {
        return _getVersion();
    }

    function proxyOwner() external view override returns (address) {
        return _getProxyOwner();
    }

    function transferProxyOwnership(address newOwner) external onlyProxyOwner {
        require(newOwner != address(0), "Proxy: new owner is the zero address");
        address oldOwner = _getProxyOwner();
        StorageSlot.getAddressSlot(_PROXY_OWNER_SLOT).value = newOwner;
        emit ProxyOwnerChanged(oldOwner, newOwner);
    }

    /// @dev Upgrade to a new version and optionally run init (upgradeToAndCall-style).
    function upgradeToVersion(
        uint64 newVersion,
        bytes memory data
    ) external override onlyProxyOwner {
        address b = _getBeacon();
        if (!IVersionedBeacon(b).isVersionAvailable(newVersion))
            revert VersionNotAvailable();
        uint64 oldVersion = _getVersion();
        address newImplementation = IVersionedBeacon(b).implementation(
            newVersion
        );
        StorageSlot.getUint256Slot(_VERSION_SLOT).value = newVersion;
        emit ProxyUpgraded(oldVersion, newVersion, newImplementation);
        if (data.length > 0) {
            Address.functionDelegateCall(newImplementation, data);
        }
    }
}
