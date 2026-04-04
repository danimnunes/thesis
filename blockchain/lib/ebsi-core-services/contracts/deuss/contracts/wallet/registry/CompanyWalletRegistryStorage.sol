// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {CompanyWallet, TransferRequest} from "../CompanyWalletStructs.sol";

/**
 * @title CompanyWalletRegistryStorage
 * @author DEUSS Team
 * @notice Storage contract for the CompanyWalletRegistry contract
 */
contract CompanyWalletRegistryStorage {
    // @dev disable slither warning for this variable as this cannot be constant due to inheritance
    // slither-disable-next-line constable-states
    bool private _paused;

    // templateId for the CompanyWallet template in EBSI registry
    bytes32 internal _templateIdCW;

    // Mapping that stores companyWallet ownership transfer requests
    mapping(address companyWallet => TransferRequest request)
        internal _transferRequests;

    // Mapping from owner address to a list of associated CompanyWallet addresses
    mapping(address owner => address[] companyWallets)
        internal _ownerToCompanyWallets;

    // mapping that stores data for the all CompanyWallet contracts
    mapping(address companyWallet => CompanyWallet data)
        internal _companyWallets;

    // @dev reserved space to allow future versions to add new
    // variables without shifting down storage in the inheritance chain
    uint256[49] private __gap;
}
