// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {Offer, Deal} from "./MarketStructs.sol";

/**
 * @title InterestDiscoveryStorage
 * @author DEUSS Team
 * @notice Storage contract for InterestDiscovery that defines all state variables and constants
 * @dev This contract contains all storage variables used by InterestDiscovery and InterestDiscoveryBase
 * @dev Uses upgradeable storage pattern with reserved gap for future versions
 */
abstract contract InterestDiscoveryStorage {
    /**
     * @notice Minimum expiry time for offers in seconds
     * @dev Offers must have expiry at least this far in the future
     */
    uint256 public constant MIN_OFFER_EXPIRY = 1 days;

    /**
     * @notice Maximum dispute buffer period in seconds
     * @dev Maximum time allowed for dispute buffer period configuration
     */
    uint256 public constant MAX_DISPUTE_BUFFER_PERIOD = 10 days;

    /**
     * @notice Maximum number of operators allowed per offer
     * @dev Limits the number of addresses that can be set as operators for a single offer
     */
    uint256 public constant MAX_OPERATORS = 3;

    /**
     * @notice Counter for generating unique offer IDs
     * @dev Incremented each time a new offer is created
     */
    uint256 internal _offerCounter;

    /**
     * @notice Counter for generating unique deal IDs
     * @dev Incremented each time a new deal is created
     */
    uint256 internal _dealCounter;

    /**
     * @notice Address of the bond registry contract
     * @dev Used to validate bonds and retrieve bond metadata
     */
    address internal _bondRegistry;

    /**
     * @notice Address of the escrow manager contract
     * @dev Used to manage token escrow operations for offers and deals
     */
    address internal _escrowManager;

    /**
     * @notice Address of the company wallet registry contract
     * @dev Used to verify company wallet addresses and permissions
     */
    address internal _companyWalletRegistry;

    /**
     * @notice Payment expiry threshold in seconds
     * @dev Time period after deal creation within which payment must be made
     */
    uint256 internal _paymentExpiryThreshold;

    /**
     * @notice Dispute buffer period in seconds
     * @dev Additional time after payment deadline during which disputes can be initiated
     */
    uint256 internal _disputeBufferPeriod;

    /**
     * @notice Maximum number of counter offers allowed per user per offer
     * @dev Platform-wide cap on counter offers that can be set by admin
     */
    uint256 internal _maxCounterOffersPerUser;

    /**
     * @notice Mapping of offer ID to Offer struct
     * @dev Stores all registered offers indexed by their unique ID
     */
    mapping(uint256 offerId => Offer offer) internal _offers;

    /**
     * @notice Mapping of deal ID to Deal struct
     * @dev Stores all created deals indexed by their unique ID
     */
    mapping(uint256 dealId => Deal deal) internal _deals;

    /**
     * @notice Mapping of maker address to array of their offer IDs
     * @dev Allows efficient lookup of all offers created by a specific address
     */
    mapping(address makers => uint256[] offerIds) internal _makersOfferIds;

    /**
     * @notice Mapping of offer ID to operator address to permission status
     * @dev Stores which addresses are authorized as operators for each offer
     */
    mapping(uint256 offerId => mapping(address operator => bool allowed))
        internal _offerOperators;

    /**
     * @notice Mapping of user address to offer ID to counter offer count
     * @dev Tracks how many counter offers each user has made for each specific offer
     */
    mapping(address user => mapping(uint256 offerId => uint256 count))
        internal _counterOfferCounts;

    /**
     * @notice Reserved storage gap for future upgrades
     * @dev Reserved space to allow future versions to add new variables without shifting down storage in the inheritance chain
     * @dev This prevents storage layout conflicts during contract upgrades
     */
    // slither-disable-next-line naming-convention
    uint256[49] private __gap;
}
