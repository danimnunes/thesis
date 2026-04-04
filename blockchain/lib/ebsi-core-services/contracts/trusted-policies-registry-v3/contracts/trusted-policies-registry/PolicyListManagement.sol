// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./PolicyStorage.sol";
import "./CustomPagination.sol";
import "./Roles.sol";

abstract contract PolicyListManagement is PolicyStorage, AccessControl, Roles {
    using CustomPagination for uint256;

    /**
     * Events
     */
    event PolicyInserted(
        uint256 indexed policyId,
        string policyName,
        string description
    );

    event PolicyUpdated(
        uint256 indexed policyId,
        string oldDescription,
        string newDescription
    );
    event PolicyDeactivated(uint256 indexed policyId);
    event PolicyActivated(uint256 indexed policyId);

    // SETTERS

    /**
     * @dev insert an Policy
     * @param policyName string
     * @param description string
     */
    function insertPolicy(
        string calldata policyName,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        {
            // to make sure not going into stack too deep
            require(bytes(policyName).length > 0, "Policy: name required");
            require(
                bytes(description).length > 0,
                "Policy: description required"
            );
            PolicyContractStorage storage ps = policyStorage();
            // check if the policy already exists
            require(
                ps.policyNameToPolicyId[policyName] == 0,
                "Policy: policy exists"
            );
            ps.policyCount++;
            uint256 policyId = ps.policyCount;
            Policy storage policy = ps.policies[policyId];
            policy.status = true;
            policy.policyName = policyName;
            policy.description = description;
            // add to search index
            ps.policyNameToPolicyId[policyName] = policyId;
            emit PolicyInserted(policyId, policyName, description);
        }
    }

    /**
     * @dev update a policy (by policy name)
     * @param policyName string
     * @param description string
     */
    function updatePolicy(
        string calldata policyName,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        _updatePolicy(_getPolicyId(policyName), description);
    }

    /**
     * @dev update a policy (by policy id)
     * @param policyId uint256
     * @param description string
     */
    function updatePolicy(
        uint256 policyId,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        _updatePolicy(policyId, description);
    }

    /**
     * @dev deactivate a policy (by policy name)
     * @param policyName string
     */
    function deactivatePolicy(
        string calldata policyName
    ) external onlyRole(OPERATOR_ROLE) {
        _deactivatePolicy(_getPolicyId(policyName));
    }

    /**
     * @dev deactivate a policy (by policy id)
     * @param policyId uint256
     */
    function deactivatePolicy(
        uint256 policyId
    ) external onlyRole(OPERATOR_ROLE) {
        _deactivatePolicy(policyId);
    }

    /**
     * @dev activate a policy (by policy name)
     * @param policyName string
     */
    function activatePolicy(
        string calldata policyName
    ) external onlyRole(OPERATOR_ROLE) {
        _activatePolicy(_getPolicyId(policyName));
    }

    /**
     * @dev activate a policy (by policy id)
     * @param policyId uint256
     */
    function activatePolicy(uint256 policyId) external onlyRole(OPERATOR_ROLE) {
        _activatePolicy(policyId);
    }

    // INTERNAL SETTERS

    /**
     * @dev update a policy operation type and description by policy Id
     * @param policyId uint256
     * @param description string
     */
    function _updatePolicy(
        uint256 policyId,
        string calldata description
    ) internal {
        PolicyContractStorage storage ps = policyStorage();
        Policy storage policy = ps.policies[policyId];
        require(policy.status, "Policy: policy inactive");
        require(bytes(description).length > 0, "Policy: invalidDescription");
        string memory oldDescription = policy.description;
        policy.description = description;
        emit PolicyUpdated(policyId, oldDescription, description);
    }

    /**
     * @dev deactivate a policy by id
     * @param policyId uint256
     */

    function _deactivatePolicy(uint256 policyId) internal {
        PolicyContractStorage storage ps = policyStorage();
        Policy storage policy = ps.policies[policyId];
        require(policy.status, "Policy: invalid policy");
        policy.status = false;
        emit PolicyDeactivated(policyId);
    }

    /**
     * @dev activate a policy by id
     * @param policyId uint256
     */
    function _activatePolicy(uint256 policyId) internal {
        PolicyContractStorage storage ps = policyStorage();
        require(
            policyId <= ps.policyCount && policyId > 0,
            "Policy: invalid policy"
        );
        Policy storage policy = ps.policies[policyId];
        require(!policy.status, "Policy: policy already active");
        policy.status = true;
        emit PolicyActivated(policyId);
    }

    // GETTERS

    /**
     * @dev get policies paginated
     * @param page uint256
     * @param pageSize uint256
     */
    function getPolicies(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            uint256[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <=50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        PolicyContractStorage storage ps = policyStorage();
        return ps.policyCount.paginate(page, pageSize);
    }

    /**
     * @dev get policy names paginated
     * @param page uint256
     * @param pageSize uint256
     */
    function getPolicyNames(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            string[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <=50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        PolicyContractStorage storage ps = policyStorage();
        uint256[] memory itemsUint;
        (itemsUint, total, howMany, prev, next) = ps.policyCount.paginate(
            page,
            pageSize
        );
        string[] memory itemsStrings = new string[](itemsUint.length);

        for (uint256 i = 0; i < itemsUint.length; i++) {
            itemsStrings[i] = ps.policies[itemsUint[i]].policyName;
        }
        return (itemsStrings, total, howMany, prev, next);
    }

    /**
     * @dev get policy by id
     * @param _policyId uint256
     */
    function getPolicy(
        uint256 _policyId
    )
        external
        view
        returns (
            uint256 policyId,
            string memory description,
            string memory policyName,
            bool status
        )
    {
        return _getPolicy(_policyId);
    }

    /**
     * @dev get policy by policy name
     * @param _policyName string
     */
    function getPolicy(
        string calldata _policyName
    )
        external
        view
        returns (
            uint256 policyId,
            string memory description,
            string memory policyName,
            bool status
        )
    {
        return _getPolicy(_getPolicyId(_policyName));
    }

    // INTERNAL

    /**
     * @dev get policy by id
     * @param _policyId uint256
     */
    function _getPolicy(
        uint256 _policyId
    )
        internal
        view
        returns (
            uint256 policyId,
            string memory description,
            string memory policyName,
            bool status
        )
    {
        PolicyContractStorage storage ps = policyStorage();

        require(
            ps.policyCount >= _policyId && _policyId > 0,
            "Policy: invalid policy"
        );
        Policy storage policy = ps.policies[_policyId];
        return (
            _policyId,
            policy.description,
            policy.policyName,
            policy.status
        );
    }

    /**
     * @dev get policy by name
     * @param policyName string
     */
    function _getPolicyId(
        string calldata policyName
    ) internal view returns (uint256) {
        PolicyContractStorage storage ps = policyStorage();
        require(
            bytes(ps.policies[ps.policyNameToPolicyId[policyName]].policyName)
                .length > 0,
            "Policy: invalid policy"
        );
        return ps.policyNameToPolicyId[policyName];
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
