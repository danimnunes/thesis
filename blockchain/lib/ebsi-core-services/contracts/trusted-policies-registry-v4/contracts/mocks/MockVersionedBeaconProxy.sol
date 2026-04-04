// SPDX-License-Identifier: EUPL V1.2
pragma solidity 0.8.26;

import "../external/interfaces/IVersionedBeaconProxy.sol";

/**
 * @title MockVersionedBeaconProxy
 * @dev Mock for tests: returns a configurable proxyOwner so PolicyRegistry onlyOperatorOrProxyOwner can be tested.
 */
contract MockVersionedBeaconProxy is IVersionedBeaconProxy {
    address private _proxyOwner;
    address private _beacon;

    constructor(address proxyOwner_) {
        _proxyOwner = proxyOwner_;
    }

    function version() external pure override returns (uint64) {
        return 1;
    }

    function beacon() external view override returns (address) {
        return _beacon;
    }

    function proxyOwner() external view override returns (address) {
        return _proxyOwner;
    }

    function upgradeToVersion(uint64, bytes memory) external override {}
}
