// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

/**
 * @title Interface DID Registry to check controllers
 */
contract DidRegistryMock {
    bool public mockedValue = true;

    function checkController(
        bytes calldata,
        address
    ) external view returns (bool) {
        return mockedValue;
    }

    function setMockedValue(bool _mockedValue) external {
        mockedValue = _mockedValue;
    }
}
