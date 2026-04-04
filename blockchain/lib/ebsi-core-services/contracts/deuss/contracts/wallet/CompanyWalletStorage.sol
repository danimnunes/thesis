// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

/**
 * @title CompanyWalletStorage
 * @author DEUSS Team
 * @notice Storage contract for the CompanyWallet contract
 */
contract CompanyWalletStorage {
    // address of the CompanyWalletFactory
    address internal _companyWalletFactory;

    // address of the CompanyWalletRegistry
    address internal _companyWalletRegistry;

    // Maps operation identifiers (keccak256(selector + contract address)) to role bitmaps defining execution permissions
    mapping(bytes32 operation => uint256 roles) internal _operations;

    // @dev reserved space to allow future versions to add new
    // variables without shifting down storage in the inheritance chain
    uint256[49] private __gap;
}
