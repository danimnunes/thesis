// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

/**
 * @notice Represents the status of an company wallet
 * @param NON_EXISTING Company wallet does not exist in the registry
 * @param ENABLED Company wallet is active and can be used
 * @param DISABLED Company wallet is registered but (temporarily) disabled
 */
enum Flag {
    NON_EXISTING,
    ENABLED,
    DISABLED
}

/**
 * @notice Represents the status of an company wallet ownership transfer request
 * @param NON_EXISTING Company wallet does not have an active ownership transfer request
 * @param REQUESTED Company wallet has requested a transfer of ownership (not yet approved)
 * @param REJECTED Company wallet's ownership transfer request has been rejected by the admin
 * @param APPROVED Company wallet's ownership transfer request has been approved by the admin
 */
enum Status {
    NON_EXISTING,
    REQUESTED,
    REJECTED,
    APPROVED
}

/**
 * @notice Struct containing company wallet information
 * @param flag Current status of the company wallet
 * @param ownerCompanyWalletIndex The index of this wallet in the owner's companyWallets array
 * @param wallets Array of wallet addresses linked to this identity
 */
struct CompanyWallet {
    address owner;
    uint256 ownerCompanyWalletIndex;
    Flag flag;
    address[] wallets;
}

/**
 * @notice Struct containing information about a companyWallet ownership transfer request
 * @param newOwner Address of a new owner, to which the user wishes to transfer their companyWallet
 * @param status Current status of the ownership transfer request
 */
struct TransferRequest {
    address newOwner;
    Status status;
}
