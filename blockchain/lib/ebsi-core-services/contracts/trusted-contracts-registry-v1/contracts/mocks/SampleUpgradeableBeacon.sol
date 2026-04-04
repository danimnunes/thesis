// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/**
 * @title SampleUpgradeableBeacon
 * @dev Sample upgradeable beacon contract for testing proxy deployments
 */
contract SampleUpgradeableBeacon is UpgradeableBeacon {
    constructor(
        address implementation
    ) UpgradeableBeacon(implementation, msg.sender) {}
}
