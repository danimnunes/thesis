// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract DidRegistryMock {
    bool public didResult;

    function checkController(
        bytes calldata,
        address
    ) external view returns (bool) {
        return didResult;
    }

    /**
     * @dev set did result mock value as state variable
     * @param newDidResult bool
     */
    function setDidResult(bool newDidResult) external {
        didResult = newDidResult;
    }
}
