// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title MockImplementation
 * @dev Minimal upgradeable implementation for testing BeaconProxyExtended.
 */
contract MockImplementation is Initializable {
    string public name;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string calldata _name) public initializer {
        name = _name;
    }
}
