// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract PolicyRegistryMock {
    bool public policyResult;

    function checkPolicy(
        string calldata,
        address
    ) external view returns (bool) {
        return policyResult;
    }

    function setPolicyResult(bool newPolicyResult) external {
        policyResult = newPolicyResult;
    }
}
