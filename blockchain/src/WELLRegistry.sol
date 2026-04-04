// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/*
 * @title WELLRegistry
 * @notice A simple registry for storing contract addresses by name.
 * Dependency injection is used to allow the WELL contract to interact with other contracts (e.g., EBSI Timestamp) without hardcoding their addresses.
 */

contract WELLRegistry {
    mapping(string => address) private _contracts;
    address public owner;

    constructor() { owner = msg.sender; }

    function setContract(string calldata name, address addr) external {
        require(msg.sender == owner, "Only owner");
        _contracts[name] = addr;
    }

    function getContract(string calldata name) external view returns (address) {
        return _contracts[name];
    }
}