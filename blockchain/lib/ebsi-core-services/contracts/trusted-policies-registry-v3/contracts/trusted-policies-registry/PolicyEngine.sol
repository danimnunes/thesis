// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;
pragma experimental ABIEncoderV2;

import "./PolicyStorage.sol";

abstract contract PolicyEngine is PolicyStorage {
    // Viewer functions

    /**
     * @dev Check if an user has a policy by policy id
     * @param policyId uint256
     * @param user address
     * @return bool
     */
    function checkPolicy(
        uint256 policyId,
        address user
    ) external view returns (bool) {
        return _checkPolicy(policyId, user);
    }

    /**
     * @dev Check if an user has a policy by policy name (unique)
     * @param policyName string
     * @param user address
     * @return bool
     */
    function checkPolicy(
        string calldata policyName,
        address user
    ) external view returns (bool) {
        PolicyContractStorage storage ps = policyStorage();
        return _checkPolicy(ps.policyNameToPolicyId[policyName], user);
    }

    // Internal functions
    /**
     * @dev internal - Check if an user has a policy by policy id
     * @param policyId uint256
     * @param user address
     * @return bool
     */

    function _checkPolicy(
        uint256 policyId,
        address user
    ) internal view returns (bool) {
        PolicyContractStorage storage ps = policyStorage();
        Policy storage policy = ps.policies[policyId];
        require(policy.status, "Policy: inactive or not defined");
        return ps.userAttributes[user][policy.policyName].defined;
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
