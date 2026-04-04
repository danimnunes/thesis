// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract SampleUpgradeableBeaconV5 is UpgradeableBeacon {
    constructor(
        address implementation,
        address owner
    ) UpgradeableBeacon(implementation, owner) {}
}
