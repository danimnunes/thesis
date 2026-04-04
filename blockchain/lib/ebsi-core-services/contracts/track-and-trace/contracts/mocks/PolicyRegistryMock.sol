// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract PolicyRegistryMock {
    bool public policyResult;

    function setPolicyResult(bool newPolicyResult) external {
        policyResult = newPolicyResult;
    }

    function checkPolicy(
        string calldata policyName,
        address user
    ) external view returns (bool) {
        require(bytes(policyName).length > 0);
        require(user != address(0));
        return policyResult;
    }
}
