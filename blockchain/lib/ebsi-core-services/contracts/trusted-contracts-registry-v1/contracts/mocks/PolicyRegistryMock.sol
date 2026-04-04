// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

/**
 * @title PolicyRegistry Mock for testing
 */
contract PolicyRegistryMock {
    bool public mockedValue = true;

    function checkPolicy(
        string calldata,
        address
    ) external view returns (bool) {
        return mockedValue;
    }

    function checkPolicy(uint256, address) external view returns (bool) {
        return mockedValue;
    }

    function setMockedValue(bool _mockedValue) external {
        mockedValue = _mockedValue;
    }
}
