// SPDX-License-Identifier: EUPL V1.2
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IPolicyRegistry.sol";
import "./external/interfaces/IVersionedBeaconProxy.sol";
import "./CustomPagination.sol";

/**
 * @title PolicyRegistry
 * @author EBSI
 * @notice Registry of policy definitions and user policy assignments. Supports EBSI global policies
 *         (targetContract = address(0)) and per-target-contract policies (e.g. beacon proxy).
 * @dev UUPS upgradeable; uses OPERATOR_ROLE for policy and attribute management. checkPolicy uses msg.sender
 *      as target contract and falls back to global scope when no target-specific assignment exists.
 */
contract PolicyRegistry is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    IPolicyRegistry
{
    // ============ State Variables ============
    using CustomPagination for uint256;
    using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;
    using EnumerableMap for EnumerableMap.Bytes32ToUintMap;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public policyCount;

    /// @dev Policy name (keccak256) -> policy id. Key: keccak256(abi.encode(policyName))
    EnumerableMap.Bytes32ToUintMap private policyNameToPolicyId;
    EnumerableSet.AddressSet private userAddresses;
    mapping(uint256 => Policy) public policies;

    /// @dev Set of composite keys (userAddress, targetContractAddress, policyName)
    /// Key: keccak256(abi.encode(userAddress, targetContractAddress, policyName))
    /// Target contract address(0) = EBSI global policy
    /// a list with all the policies assigned to a user
    EnumerableSet.Bytes32Set private userPolicies;

    /// @dev Composite key -> keccak256(policyName); use with policyNameToPolicyId to resolve to name
    EnumerableMap.Bytes32ToBytes32Map private compositeKeyToPolicyNameHash;

    /// @dev Per user: set of composite keys (user, targetContract, policyName) for getUserAttributes
    mapping(address => EnumerableSet.Bytes32Set) private userPolicyList;

    // ============ Function Modifiers ============
    /// @dev Reverts unless caller is OPERATOR or the proxy owner of targetContract (when targetContract supports IVersionedBeaconProxy).
    modifier onlyOperatorOrProxyOwner(address targetContract) {
        if (
            !hasRole(OPERATOR_ROLE, msg.sender) &&
            !(targetContract != address(0) && _isProxyOwner(targetContract))
        ) revert IPolicyRegistry.NotOperatorOrOwner();
        _;
    }

    // ============ Constructor ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Functions ============
    // --- Initializer ---
    /**
     * @notice Initializes the registry: AccessControl, UUPS, and grants DEFAULT_ADMIN_ROLE and OPERATOR_ROLE to sender.
     */
    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // --- Policy check (view) ---
    /**
     * @inheritdoc IPolicyRegistry
     */
    function checkPolicy(
        uint256 policyId,
        address user
    ) external view returns (bool) {
        return _checkPolicy(policyId, user);
    }

    /**
     * @inheritdoc IPolicyRegistry
     */
    function checkPolicy(
        string calldata policyName,
        address user
    ) external view returns (bool) {
        (, uint256 policyId) = policyNameToPolicyId.tryGet(
            keccak256(abi.encode(policyName))
        );
        return _checkPolicy(policyId, user);
    }

    // --- Policy write (insert / update / deactivate / activate) ---
    /**
     * @notice Inserts a new policy definition (global). Caller must have OPERATOR_ROLE.
     * @param policyName Unique policy name.
     * @param description Policy description.
     */
    function insertPolicy(
        string calldata policyName,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        {
            // to make sure not going into stack too deep
            if (bytes(policyName).length == 0)
                revert IPolicyRegistry.PolicyNameRequired();
            if (bytes(description).length == 0)
                revert IPolicyRegistry.DescriptionRequired();
            bytes32 nameHash = keccak256(abi.encode(policyName));
            if (policyNameToPolicyId.contains(nameHash))
                revert IPolicyRegistry.PolicyExists();
            policyCount++;
            uint256 policyId = policyCount;
            Policy storage policy = policies[policyId];
            policy.status = true;
            policy.policyName = policyName;
            policy.description = description;
            policyNameToPolicyId.set(nameHash, policyId);
            emit PolicyInserted(policyId, policyName, description);
        }
    }

    /**
     * @notice Updates a policy description by name. Caller must have OPERATOR_ROLE.
     * @param policyName Policy name.
     * @param description New description.
     */
    function updatePolicy(
        string calldata policyName,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        _updatePolicy(_getPolicyId(policyName), description);
    }

    /**
     * @notice Updates a policy description by id. Caller must have OPERATOR_ROLE.
     * @param policyId Policy identifier.
     * @param description New description.
     */
    function updatePolicy(
        uint256 policyId,
        string calldata description
    ) external onlyRole(OPERATOR_ROLE) {
        _updatePolicy(policyId, description);
    }

    /**
     * @notice Deactivates a policy by name. Caller must have OPERATOR_ROLE.
     * @param policyName Policy name.
     */
    function deactivatePolicy(
        string calldata policyName
    ) external onlyRole(OPERATOR_ROLE) {
        _deactivatePolicy(_getPolicyId(policyName));
    }

    /**
     * @notice Deactivates a policy by id. Caller must have OPERATOR_ROLE.
     * @param policyId Policy identifier.
     */
    function deactivatePolicy(
        uint256 policyId
    ) external onlyRole(OPERATOR_ROLE) {
        _deactivatePolicy(policyId);
    }

    /**
     * @notice Activates a policy by name. Caller must have OPERATOR_ROLE.
     * @param policyName Policy name.
     */
    function activatePolicy(
        string calldata policyName
    ) external onlyRole(OPERATOR_ROLE) {
        _activatePolicy(_getPolicyId(policyName));
    }

    /**
     * @notice Activates a policy by id. Caller must have OPERATOR_ROLE.
     * @param policyId Policy identifier.
     */
    function activatePolicy(uint256 policyId) external onlyRole(OPERATOR_ROLE) {
        _activatePolicy(policyId);
    }

    // --- User attributes write (insert / delete) ---
    /**
     * @notice Inserts user attributes (policy assignments) for EBSI global scope. Caller must have OPERATOR_ROLE.
     * @param user User address.
     * @param attributes Array of policy names (must exist and be active).
     */
    function insertUserAttributes(
        address user,
        string[] calldata attributes
    ) external onlyRole(OPERATOR_ROLE) {
        if (user == address(0)) revert IPolicyRegistry.InvalidUserAddress();
        for (uint256 i = 0; i < attributes.length; i++) {
            if (bytes(attributes[i]).length == 0)
                revert IPolicyRegistry.AttributeEmpty();
            _insertUserAttribute(user, attributes[i], address(0));
        }
    }

    /**
     * @notice Inserts user attributes for a specific target contract (or address(0) for global). Caller must have OPERATOR_ROLE or be the proxy owner of targetContract (when it supports IVersionedBeaconProxy).
     * @param user User address.
     * @param attributes Array of policy names (must exist and be active).
     * @param targetContract Contract these policies apply to; address(0) for EBSI global.
     */
    function insertScopedUserAttributes(
        address user,
        string[] calldata attributes,
        address targetContract
    ) external onlyOperatorOrProxyOwner(targetContract) {
        if (user == address(0)) revert IPolicyRegistry.InvalidUserAddress();
        for (uint256 i = 0; i < attributes.length; i++) {
            if (bytes(attributes[i]).length == 0)
                revert IPolicyRegistry.AttributeEmpty();
            _insertUserAttribute(user, attributes[i], targetContract);
        }
    }

    /**
     * @notice Deletes user attributes (policy assignments) for EBSI global scope. Caller must have OPERATOR_ROLE.
     * @param user User address.
     * @param attributes Policy names (attributes) to remove.
     */
    function deleteUserAttributes(
        address user,
        string[] calldata attributes
    ) external onlyRole(OPERATOR_ROLE) {
        if (user == address(0)) revert IPolicyRegistry.InvalidUserAddress();
        for (uint256 i = 0; i < attributes.length; i++) {
            _deleteUserAttribute(user, attributes[i], address(0));
        }
    }

    /**
     * @notice Deletes user attributes for a specific target contract (or address(0) for global). Caller must have OPERATOR_ROLE or be the proxy owner of targetContract (when it supports IVersionedBeaconProxy).
     * @param user User address.
     * @param attributes Policy names (attributes) to remove.
     * @param targetContract address(0) for EBSI global; beacon proxy address for per-contract.
     */
    function deleteScopedUserAttributes(
        address user,
        string[] calldata attributes,
        address targetContract
    ) external onlyOperatorOrProxyOwner(targetContract) {
        if (user == address(0)) revert IPolicyRegistry.InvalidUserAddress();
        for (uint256 i = 0; i < attributes.length; i++) {
            _deleteUserAttribute(user, attributes[i], targetContract);
        }
    }

    // --- Policy read (getPolicies / getPolicyNames / getPolicy) ---
    /**
     * @notice Returns policy ids paginated (1-based page, pageSize up to 50).
     * @param page Page number (1-based).
     * @param pageSize Page size (max 50).
     * @return items Slice of policy ids for this page.
     * @return total Total number of policies.
     * @return howMany Number of items on this page.
     * @return prev Previous page (0 if none).
     * @return next Next page (0 if none).
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
        if (pageSize > 50) revert IPolicyRegistry.PageSizeTooLarge();
        if (pageSize == 0) revert IPolicyRegistry.PageSizeZero();
        if (page == 0) revert IPolicyRegistry.PageZero();
        return policyCount.paginate(page, pageSize);
    }

    /**
     * @notice Returns policy names paginated (1-based page, pageSize up to 50).
     * @param page Page number (1-based).
     * @param pageSize Page size (max 50).
     * @return items Slice of policy names for this page.
     * @return total Total number of policies.
     * @return howMany Number of items on this page.
     * @return prev Previous page (0 if none).
     * @return next Next page (0 if none).
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
        if (pageSize > 50) revert IPolicyRegistry.PageSizeTooLarge();
        if (pageSize == 0) revert IPolicyRegistry.PageSizeZero();
        if (page == 0) revert IPolicyRegistry.PageZero();
        uint256[] memory itemsUint;
        (itemsUint, total, howMany, prev, next) = policyCount.paginate(
            page,
            pageSize
        );
        string[] memory itemsStrings = new string[](itemsUint.length);

        for (uint256 i = 0; i < itemsUint.length; i++) {
            itemsStrings[i] = policies[itemsUint[i]].policyName;
        }
        return (itemsStrings, total, howMany, prev, next);
    }

    /**
     * @notice Returns policy names for the given policy IDs (for API-side pagination).
     * @param policyIds List of policy identifiers.
     * @return names Policy names in the same order as policyIds.
     */
    function getPolicyNamesByIds(
        uint256[] calldata policyIds
    ) external view returns (string[] memory names) {
        names = new string[](policyIds.length);
        for (uint256 i = 0; i < policyIds.length; i++) {
            uint256 id = policyIds[i];
            if (id == 0 || id > policyCount)
                revert IPolicyRegistry.InvalidPolicy();
            Policy storage policy = policies[id];
            if (bytes(policy.policyName).length == 0)
                revert IPolicyRegistry.InvalidPolicy();
            names[i] = policy.policyName;
        }
    }

    /**
     * @notice Returns policy data by id.
     * @param _policyId Policy identifier.
     * @return policyId Same as _policyId.
     * @return description Policy description.
     * @return policyName Policy name.
     * @return status Whether the policy is active.
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
     * @notice Returns policy data by name.
     * @param _policyName Policy name.
     * @return policyId Policy identifier.
     * @return description Policy description.
     * @return policyName Same as _policyName.
     * @return status Whether the policy is active.
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

    // --- User attributes read (getUsers / getUserAttributes) ---
    /**
     * @notice Returns user addresses that have at least one attribute, paginated (1-based page, pageSize up to 50).
     * @param page Page number (1-based).
     * @param pageSize Page size (max 50).
     * @return items Slice of user addresses for this page.
     * @return total Total number of users with attributes.
     * @return howMany Number of items on this page.
     * @return prev Previous page (0 if none).
     * @return next Next page (0 if none).
     */
    function getUsers(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            address[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        if (pageSize > 50) revert IPolicyRegistry.PageSizeTooLarge();
        if (pageSize == 0) revert IPolicyRegistry.PageSizeZero();
        if (page == 0) revert IPolicyRegistry.PageZero();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = userAddresses.length().paginate(
            page,
            pageSize
        );
        items = new address[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = userAddresses.at(ids[i] - 1);
        }
    }

    /**
     * @notice Returns unique policy names (attributes) assigned to a user, paginated (1-based page, pageSize up to 50).
     * @param user User address (must have at least one attribute).
     * @param page Page number (1-based).
     * @param pageSize Page size (max 50).
     * @return items Slice of attribute (policy) names for this page.
     * @return total Total number of unique attributes for user.
     * @return howMany Number of items on this page.
     * @return prev Previous page (0 if none).
     * @return next Next page (0 if none).
     */
    function getUserAttributes(
        address user,
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
        if (pageSize > 50) revert IPolicyRegistry.PageSizeTooLarge();
        if (pageSize == 0) revert IPolicyRegistry.PageSizeZero();
        if (page == 0) revert IPolicyRegistry.PageZero();
        if (user == address(0)) revert IPolicyRegistry.InvalidUserAddress();
        if (!userAddresses.contains(user))
            revert IPolicyRegistry.UserDoesNotExist();
        uint256 listLen = userPolicyList[user].length();
        if (listLen == 0) revert IPolicyRegistry.UserHasNoAttribute();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = listLen.paginate(page, pageSize);
        items = new string[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            bytes32 compositeKey = userPolicyList[user].at(ids[i] - 1);
            uint256 policyId = policyNameToPolicyId.get(
                compositeKeyToPolicyNameHash.get(compositeKey)
            );
            items[i] = policies[policyId].policyName;
        }
    }

    /**
     * @dev Returns policy data by id. Reverts if policy invalid.
     * @param _policyId Policy identifier.
     * @return policyId Same as _policyId.
     * @return description Policy description.
     * @return policyName Policy name.
     * @return status Whether the policy is active.
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
        if (_policyId == 0 || _policyId > policyCount)
            revert IPolicyRegistry.InvalidPolicy();
        Policy storage policy = policies[_policyId];
        if (bytes(policy.policyName).length == 0)
            revert IPolicyRegistry.InvalidPolicy();
        return (
            _policyId,
            policy.description,
            policy.policyName,
            policy.status
        );
    }

    /**
     * @dev Inserts a single (user, targetContract, attribute) assignment. Validates policy existence and active status; updates userPolicies, lists, and emits UserAttributeInserted when added.
     * @param user User address.
     * @param attribute Policy name (attribute).
     * @param targetContract address(0) for global; otherwise target contract address.
     */
    function _insertUserAttribute(
        address user,
        string calldata attribute,
        address targetContract
    ) internal {
        uint256 policyId = policyNameToPolicyId.get(
            keccak256(abi.encode(attribute))
        );
        if (!policies[policyId].status) revert IPolicyRegistry.PolicyInactive();
        bytes32 compositeKey = keccak256(
            abi.encode(user, targetContract, attribute)
        );
        if (userPolicies.add(compositeKey)) {
            bytes32 nameHash = keccak256(abi.encode(attribute));
            compositeKeyToPolicyNameHash.set(compositeKey, nameHash);
            userPolicyList[user].add(compositeKey);
            emit UserAttributeInserted(user, attribute, targetContract);
        }
        userAddresses.add(user);
    }

    /**
     * @dev Returns policy id by name. Reverts if policy does not exist.
     * @param policyName Policy name.
     * @return Policy identifier.
     */
    function _getPolicyId(
        string calldata policyName
    ) internal view returns (uint256) {
        return policyNameToPolicyId.get(keccak256(abi.encode(policyName)));
    }

    /**
     * @dev Removes a single (user, targetContract, attribute) assignment; updates lists and removes user from userAddresses if no attributes remain.
     * @param user User address.
     * @param attribute Policy name (attribute) to remove.
     * @param targetContract Scope (address(0) or target contract).
     */
    function _deleteUserAttribute(
        address user,
        string calldata attribute,
        address targetContract
    ) internal {
        bytes32 compositeKey = keccak256(
            abi.encode(user, targetContract, attribute)
        );
        if (!userPolicies.remove(compositeKey))
            revert IPolicyRegistry.AttrInvalid();
        userPolicyList[user].remove(compositeKey);
        compositeKeyToPolicyNameHash.remove(compositeKey);
        if (userPolicyList[user].length() == 0) {
            userAddresses.remove(user);
        }
        emit UserAttributeDeleted(user, attribute, targetContract);
    }

    /**
     * @dev Checks whether user has the policy: target-specific (msg.sender) first, then EBSI global (address(0)).
     * @param policyId Policy identifier.
     * @param user User address.
     * @return True if user has the policy for msg.sender or for global scope.
     */
    function _checkPolicy(
        uint256 policyId,
        address user
    ) internal view returns (bool) {
        Policy storage policy = policies[policyId];
        if (!policy.status) revert IPolicyRegistry.PolicyInactiveOrNotDefined();

        address targetContract = msg.sender;
        bytes32 targetSpecificKey = keccak256(
            abi.encode(user, targetContract, policy.policyName)
        );
        bytes32 globalKey = keccak256(
            abi.encode(user, address(0), policy.policyName)
        );
        return
            userPolicies.contains(targetSpecificKey) ||
            userPolicies.contains(globalKey);
    }

    /**
     * @dev Updates a policy description by id. Policy must be active.
     * @param policyId Policy identifier.
     * @param description New description.
     */
    function _updatePolicy(
        uint256 policyId,
        string calldata description
    ) internal {
        Policy storage policy = policies[policyId];
        if (!policy.status) revert IPolicyRegistry.PolicyInactive();
        if (bytes(description).length == 0)
            revert IPolicyRegistry.InvalidDescription();
        string memory oldDescription = policy.description;
        policy.description = description;
        emit PolicyUpdated(policyId, oldDescription, description);
    }

    /**
     * @dev Deactivates a policy by id. Policy must be active.
     * @param policyId Policy identifier.
     */
    function _deactivatePolicy(uint256 policyId) internal {
        Policy storage policy = policies[policyId];
        if (!policy.status) revert IPolicyRegistry.InvalidPolicy();
        policy.status = false;
        emit PolicyDeactivated(policyId);
    }

    /**
     * @dev Activates a policy by id. Policy must exist and be inactive.
     * @param policyId Policy identifier.
     */
    function _activatePolicy(uint256 policyId) internal {
        if (policyId == 0 || policyId > policyCount)
            revert IPolicyRegistry.InvalidPolicy();
        Policy storage policy = policies[policyId];
        if (policy.status) revert IPolicyRegistry.PolicyAlreadyActive();
        policy.status = true;
        emit PolicyActivated(policyId);
    }

    /**
     * @dev Returns true if target supports IVersionedBeaconProxy and its proxyOwner() is msg.sender.
     * @param target Contract address to check (e.g. beacon proxy).
     * @return True if target is a contract implementing proxyOwner() and proxyOwner() == msg.sender.
     */
    function _isProxyOwner(address target) internal view returns (bool) {
        if (target.code.length == 0) return false;
        try IVersionedBeaconProxy(target).proxyOwner() returns (address owner) {
            return owner == msg.sender;
        } catch {
            return false;
        }
    }

    // ============ UUPS upgrade ============
    /**
     * @inheritdoc UUPSUpgradeable
     * @dev Restricts upgrades to accounts with DEFAULT_ADMIN_ROLE.
     * @param newImplementation Address of the new implementation (unused).
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    uint256[50] private __gap;
}
