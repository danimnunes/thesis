// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Flag} from "../CompanyWalletStructs.sol";

/**
 * @title ICompanyWalletRegistry
 * @notice Interface for managing company wallets and their related operations
 * @author DEUSS Team
 */
interface ICompanyWalletRegistry is IERC165 {
    /**
     * @notice This event is emitted when `CompanyWalletFactory` is updated
     * @dev The event is emitted by the setCompanyWalletFactory function
     * @param companyWalletFactory The address of the CompanyWalletFactory
     */
    event CompanyWalletFactoryAddressUpdated(
        address indexed companyWalletFactory
    );

    /**
     * @notice This event is emitted when the new `CompanyWallet` contract is deployed for the new owner(issuer)
     * @dev The event is emitted by the registerCompanyWallet function
     * @param companyWallet The address of companyWallet contract deployed for owner
     * @param owner The wallet address of the real owner
     * @param flag The flag of the company wallet
     */
    event CompanyWalletRegistered(
        address indexed companyWallet,
        address indexed owner,
        Flag indexed flag
    );

    /**
     * @notice This event is emitted when the CompanyWallet is updated
     * @dev The event is emitted by the disableCompanyWallet
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param oldFlag The old state of wallet
     * @param newFlag The new state of wallet
     */
    event CompanyWalletUpdated(
        address indexed companyWallet,
        Flag indexed oldFlag,
        Flag indexed newFlag
    );

    /**
     * @notice This event is emitted when approval is granted for transferring the `CompanyWallet` contract to a new owner.
     * @dev The event is emitted by the handleCompanyWalletTransfer function
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param newOwner The address of the proposed new owner
     */
    event TransferCompanyWalletApproved(
        address indexed companyWallet,
        address indexed newOwner
    );

    /**
     * @notice This event is emitted when approval is rejected for transferring the `CompanyWallet` contract to a new owner.
     * @dev The event is emitted by the handleCompanyWalletTransfer function
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param newOwner The address of the proposed new owner
     */
    event TransferCompanyWalletRejected(
        address indexed companyWallet,
        address indexed newOwner
    );

    /**
     * @notice This event is emitted when a transfer of ownership request is created for transferring the `CompanyWallet` contract to a new owner.
     * @dev The event is emitted by the requestCompanyWalletTransfer function
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param newOwner The address of the proposed new owner
     */
    event TransferRequested(
        address indexed companyWallet,
        address indexed newOwner
    );

    /**
     * @notice This event is emitted when a transfer of ownership request is cancelled, after being rejected by the admin, for transferring the `CompanyWallet` contract to a new owner.
     * @dev The event is emitted by the transferCompanyWallet function
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param oldOwner The address of the current owner
     * @param newOwner The address of the proposed new owner
     */
    event TransferRequestCancelled(
        address indexed companyWallet,
        address indexed oldOwner,
        address indexed newOwner
    );

    /**
     * @notice This event is emitted when the `CompanyWallet` contract transfer is performed
     * @dev The event is emitted by the transferCompanyWallet function
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param oldOwner The address of the old owner
     * @param newOwner The address of the new owner
     */
    event OwnerChanged(
        address indexed companyWallet,
        address indexed oldOwner,
        address indexed newOwner
    );

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Sets the EBSI template (name, version) for a companyWallet and stores its templateId
     * @param name Template name registered in `ProxyTemplateRegistry`
     * @param version Template version registered in `ProxyTemplateRegistry`
     */
    function setCompanyWalletTemplate(
        string calldata name,
        string calldata version
    ) external;

    /*//////////////////////////////////////////////////////////////
                            OWNER | ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Manage the transfer of `CompanyWallet` contract to the new owner
     * @dev This function can only be by the user who has role `ADMIN_ROLE`
     * @param companyWallet The address of the `CompanyWallet` contract
     * @param approval Decision of the admin, whether to reject or approve the transfer
     */
    function handleCompanyWalletTransfer(
        address companyWallet,
        bool approval
    ) external;

    /**
     * @notice User requests a transfer of ownership of `CompanyWallet` contract to the new owner
     * @param newOwner The address of the new owner
     */
    function requestCompanyWalletTransfer(address newOwner) external;

    /**
     * @notice Finalize the transfer of ownership of the `CompanyWallet` contract to the new owner
     * @dev The transfer requires approval to proceed to the new address else it fails.
     * This function can only be called by the `CompanyWallet` contract involved in the transfer.
     * @param newOwner The address of the new owner
     * @return bool True, if the owner was changed successfully
     */
    function finalizeCompanyWalletTransfer(
        address newOwner
    ) external returns (bool);

    /**
     * @notice Disable the existent `CompanyWallet` contract
     * @dev This function can only be called by the owner of the `CompanyWalletRegistry` contract or by the user who has role `ADMIN_ROLE`
     * @param companyWallet The address of the `CompanyWallet` contract
     */
    function disableCompanyWallet(address companyWallet) external;

    /**
     * @notice Allows the owner to grant `user` `roles`
     * @dev See {OwnableRoles::grantRoles}
     * @param user The address of the user
     * @param roles The granted roles
     */
    function grantRoles(address user, uint256 roles) external payable;

    /**
     * @notice Allows the owner to grant `roles` to an array of `users`
     * @dev See {OwnableRolesExtension::grantRoles}
     * @param users The addresses of the users
     * @param roles The granted roles
     */
    function grantRoles(
        address[] calldata users,
        uint256 roles
    ) external payable;

    /**
     * @notice Enable the `CompanyWallet` contract after disabling it
     * @dev This function can only be called by the owner of the `CompanyWalletRegistry` contract or by the user who has role `ADMIN_ROLE`
     * @param companyWallet The address of the `CompanyWallet` contract
     */
    function enableCompanyWallet(address companyWallet) external;

    /**
     * @notice Register the new owner(company) and deploy `CompanyWallet` contract to them
     * @dev This function can only be called by the owner of the `CompanyWalletRegistry` contract or by the user who has role `ADMIN_ROLE`
     * @param companyWalletOwner The wallet address of the owner
     * @return address The address of the deployed `CompanyWallet` contract
     */
    function registerCompanyWallet(
        address companyWalletOwner
    ) external returns (address);

    /**
     * @notice Remove all records linked to `CompanyWallet` contract
     * @dev This function can only be called by the owner of the `CompanyWalletRegistry` contract or by the user who has role `ADMIN_ROLE`
     * @param companyWallet The address of the `CompanyWallet` contract
     */
    function removeCompanyWallet(address companyWallet) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Checks if there is an approval to transfer the given `CompanyWallet` contract
     * @param companyWallet The address of the `CompanyWallet` contract
     * @return bool True if the approval exists, false otherwise
     */
    function doesApprovalExist(
        address companyWallet
    ) external view returns (bool);

    /**
     * @notice Checks whether a `CompanyWallet` contract exists for the given address
     * @param companyWallet The address to check
     * @return bool True if the `CompanyWallet` exists, false otherwise
     */
    function doesCompanyWalletExist(
        address companyWallet
    ) external view returns (bool);

    /**
     * @notice Retrieves the list of CompanyWallet contract addresses owned by the given address
     * @param companyWalletOwner The address of the owner
     * @return An array of CompanyWallet contract addresses associated with the owner
     */
    function getCompanyWalletsByOwner(
        address companyWalletOwner
    ) external view returns (address[] memory);

    /**
     * @notice Retrieves the owner of the given `CompanyWallet` contract
     * @param companyWallet The address of the `CompanyWallet` contract
     * @return address The address of the owner
     */
    function getCompanyWalletOwner(
        address companyWallet
    ) external view returns (address);

    /**
     * @notice Retrieves the linked wallets associated with the given `CompanyWallet` contract
     * @param companyWallet The address of the `CompanyWallet` contract
     * @return An array of addresses representing the linked wallets
     */
    function getCompanyWalletLinkedWallets(
        address companyWallet
    ) external view returns (address[] memory);

    /**
     * @notice Returns configured templateId for a companyWallet
     * @return bytes32 Template Id for companyWallet
     */
    function getCompanyWalletTemplateId() external view returns (bytes32);

    /**
     * @notice Retrieve the status of the `CompanyWallet` contract
     * @param companyWallet The address of the `CompanyWallet` contract
     * @return bool True if the `CompanyWallet` is enabled else false
     */
    function isCompanyWalletEnabled(
        address companyWallet
    ) external view returns (bool);
}
