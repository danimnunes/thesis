// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract DidRegistryMock {
    bool public didResult;

    /**
     * @dev set did result mock value as state variable
     * @param newDidResult bool
     */
    function setDidResult(bool newDidResult) external {
        didResult = newDidResult;
    }

    /**
     * @dev check controller is owner on a did identifier, return mock result
     * @param identifier bytes
     * @param ctrl address
     * @return didResult bool
     */
    function checkController(
        bytes calldata identifier,
        address ctrl
    ) external view returns (bool) {
        return didResult;
    }
}
