// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@ebsiint-sc/bootstrap-v2/contracts/utils/upgradeability/Initializable.sol";

import "./TirDetailed.sol";

/**
 * @title example of stored values on a SC with pause functionality.
 *
 */
contract Tir is Initializable, TirDetailed {
    function initialize(
        uint256 version,
        address[] memory pausers
    ) public initializer {
        TirDetailed.initialize(version);
    }
}
