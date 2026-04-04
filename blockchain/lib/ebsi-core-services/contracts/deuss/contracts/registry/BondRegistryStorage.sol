// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {Bond, BondStatus, BondProposal} from "./BondStructs.sol";

/**
 * @title BondRegistryStorage
 * @author DEUSS Team
 * @notice This contract defines the storage layout for the BondRegistry
 * @dev It is used to store the basic information of the bond registry
 */
contract BondRegistryStorage {
    /// @notice period between the expiration of the old proposal and the creation of a new proposal for ISIN
    uint256 public constant COOLDOWN_PERIOD = 900;

    /// @notice decimals for bond denomination (e.g., 2 for cents in USD)
    uint256 public constant DENOMINATION_DECIMALS = 2;

    /// @notice counter of the submitted bond proposals
    uint256 internal _counter;

    /// @notice duration during which a proposal is valid
    uint256 internal _validityPeriod;

    /// @notice templateId for the FT bond token template in EBSI registry
    bytes32 internal _templateIdFT;

    /// @notice templateId for the NFT bond token template in EBSI registry
    bytes32 internal _templateIdNFT;

    /// @notice tracks which 3-letter currency codes (ISO 4217) are allowed for bond issuance
    mapping(bytes3 currency => bool allowed) internal _allowedCurrencies;

    /// @notice stores bond registration proposals by ISIN
    mapping(bytes12 isin => BondProposal proposal)
        internal _registrationProposals;

    /// @notice stores bond update proposals by ISIN
    mapping(bytes12 isin => BondProposal proposal) internal _updateProposals;

    /// @notice maps approved ISINs to their active bond ID
    mapping(bytes12 isin => uint256 id) internal _approvedBonds;

    /// @notice maps bond IDs to their corresponding bond data structures
    mapping(uint256 id => Bond bond) internal _bonds;

    /// @notice stores the previous state before suspension
    mapping(bytes12 isin => BondStatus status) internal _preSuspensionStatus;

    /**
     * @dev reserved space to allow future versions to add new
     * variables without shifting down storage in the inheritance chain
     */
    // slither-disable-next-line naming-convention
    uint256[49] private __gap;
}
