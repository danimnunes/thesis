// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UpgradeableBeaconMock
 * @dev Mock implementation of UpgradeableBeacon for testing
 */
contract UpgradeableBeaconMock is IBeacon, Ownable {
    address private _implementation;

    event ImplementationUpgraded(
        address indexed previousImplementation,
        address indexed newImplementation
    );

    constructor(address implementation_) Ownable(msg.sender) {
        _implementation = implementation_;
    }

    function implementation() public view override returns (address) {
        return _implementation;
    }

    function upgradeTo(address newImplementation) external onlyOwner {
        require(
            newImplementation != address(0),
            "New implementation cannot be zero"
        );
        require(
            newImplementation != _implementation,
            "New implementation must be different"
        );

        address previousImplementation = _implementation;
        _implementation = newImplementation;

        emit ImplementationUpgraded(previousImplementation, newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _implementation;
    }
}
