// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract PolicyRegistryMock {
    bool public policyResult;

    /**
     * @dev check policy name against user, return state variable
     * @param policyName string
     * @param user address
     * @return bool policyResult
     */
    function checkPolicy(
        string calldata policyName,
        address user
    ) external view returns (bool) {
        return policyResult;
    }

    /**
     * @dev set policy result mock value as state variable
     * @param newPolicyResult bool
     */
    function setPolicyResult(bool newPolicyResult) external {
        policyResult = newPolicyResult;
    }
}
