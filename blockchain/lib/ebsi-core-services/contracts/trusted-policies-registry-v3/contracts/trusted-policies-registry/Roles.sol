// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract Roles {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
