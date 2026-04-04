// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title ICompanyWallet
 * @author DEUSS Team
 * @notice Interface for managing company wallets and their related operations
 */
interface ICompanyWallet is IERC165 {
    /**
     * @notice This event is emitted when `companyWalletRegistry` address is updated
     * @dev The event is emitted by the setCompanyWalletRegistry function
     * @param companyWalletRegistry The address of the CompanyWalletRegistry
     */
    event CompanyWalletRegistryUpdated(address indexed companyWalletRegistry);

    /**
     * @notice Emitted when an operation is executed
     * @dev This event is emitted by the execute function
     * @param sender The address that initiated the execution
     * @param target The target contract on which the operation was performed
     * @param callData The operation that was executed on the target contract
     * @param returnData The return data from the executed operation
     */
    event Execution(
        address indexed sender,
        address indexed target,
        bytes callData,
        bytes returnData
    );

    /**
     * @notice Emitted when an operation is granted to specific roles
     * @dev The event is emitted by the grantOperationToRoles function
     * @param selector The function selector of the operation
     * @param target The address of the contract to which the operation is granted
     * @param role The role to which the operation is granted
     */
    event OperationGrantedToRoles(
        bytes4 indexed selector,
        address indexed target,
        uint256 indexed role
    );

    /**
     * @notice Emitted when an operation is revoked from specific roles
     * @dev The event is emitted by the revokeOperationForRoles function
     * @param selector The function selector of the operation
     * @param target The address of the contract from which the operation is revoked
     * @param role The role from which the operation is revoked
     */
    event OperationRevokedForRoles(
        bytes4 indexed selector,
        address indexed target,
        uint256 indexed role
    );

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Grants permission for an operation (function selector) to specific roles on a contract
     * @dev This function is typically called by the owner
     * @param selector The function selector (bytes4) representing the operation to grant
     * @param target The address of the contract on which the operation is allowed
     * @param roles A bitmask representing one or more roles being granted permission
     */
    function grantOperationToRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external;

    /**
     * @notice Revokes permission for an operation (function selector) from specific roles on a contract
     * @dev This function is typically called by the owner
     * @param selector The function selector (bytes4) representing the operation to revoke
     * @param target The address of the contract from which the operation is being revoked
     * @param roles A bitmask representing one or more roles being revoked
     */
    function revokeOperationForRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external;

    /**
     * @notice Allows the owner to request a transfer of ownership to the new issuer(owner)
     * @param newOwner The address of the newOwner
     */
    function requestTransferOwnership(address newOwner) external payable;

    /**
     * @notice Allows the owner, after an approval from the registry admin, to finalize the ownership transfer to the new issuer(owner)
     * @param newOwner The address of the new owner
     */
    function finalizeTransferOwnership(address newOwner) external payable;

    /*//////////////////////////////////////////////////////////////
                            COMPANY WALLET FACTORY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set the address of CompanyWalletRegistry
     * @dev This function can only be called by the CompanyWalletFactory that deployed this contract
     * @param companyWalletRegistry The address of the CompanyWalletRegistry
     */
    function setCompanyWalletRegistry(address companyWalletRegistry) external;

    /*//////////////////////////////////////////////////////////////
                                GENERAL
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Executes a specified operation on the given target contract
     * @param target The address of the contract on which the operation will be executed
     * @param callData The encoded function call data to be sent to the target contract
     */
    function execute(address target, bytes calldata callData) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Retrieve the CompanyWalletRegistry address
     * @return address CompanyWalletRegistry contract address
     */
    function getCompanyWalletRegistry() external view returns (address);

    /**
     * @notice Retrieves the roles associated with a specific operation
     * @param selector The function signature of the operation
     * @param target The address of the target contract
     * @return uint256 The roles assigned to the operation
     */
    function getRolesForOperation(
        bytes4 selector,
        address target
    ) external view returns (uint256);

    /**
     * @notice Checks whether an operation is allowed for all specified roles
     * @param selector The function signature of the operation
     * @param target The address of the target contract
     * @param roles The roles to be checked
     * @return bool True if the operation is allowed for all specified roles, false otherwise
     */
    function isOperationAllowedForAllRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external view returns (bool);

    /**
     * @notice Checks whether an operation is allowed for any of the specified roles
     * @param selector The function signature of the operation
     * @param target The address of the target contract
     * @param roles The roles to be checked
     * @return bool True if the operation is allowed for any of the specified roles, false otherwise
     */
    function isOperationAllowedForAnyRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external view returns (bool);
}
