// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@ebsiint-sc/bootstrap-v2/contracts/utils/upgradeability/Initializable.sol";

import "./AnchorDetailed.sol";

/**
 * @title example of stored values on a SC with pause functionality.
 *
 */
contract Anchor is Initializable, AnchorDetailed {
    constructor() {}

    function initialize(
        bytes32[] memory _fields,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address[] memory pausers
    ) public initializer {
        AnchorDetailed._onInitialize(_fields, _name, _symbol, _decimals);
    }
}
