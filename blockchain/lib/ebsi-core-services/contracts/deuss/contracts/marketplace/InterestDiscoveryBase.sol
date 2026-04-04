// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Initializable} from "solady/src/utils/Initializable.sol";
import {OwnableRolesExtension} from "../utils/OwnableRolesExtension.sol";
import {UUPSUpgradeable} from "solady/src/utils/UUPSUpgradeable.sol";
import {Errors} from "../libs/Errors.sol";
import {StringExtensions} from "../libs/StringExtensions.sol";
import {InterestDiscoveryStorage} from "./InterestDiscoveryStorage.sol";

/**
 * @title InterestDiscoveryBase
 * @author DEUSS Team
 * @notice Base contract for InterestDiscovery that handles common functionality and storage
 */
contract InterestDiscoveryBase is
    InterestDiscoveryStorage,
    Initializable,
    OwnableRolesExtension,
    UUPSUpgradeable
{
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using StringExtensions for string;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Role for administrative functions
     */
    uint256 public constant ADMIN = _ROLE_0;

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set of allowed currencies
     */
    EnumerableSet.Bytes32Set internal _currencies;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when a new currency is added to the allowed set
     * @param currency The currency that was added (as bytes3)
     */
    event CurrencyAdded(bytes3 indexed currency);
    /**
     * @notice Emitted when a currency is removed from the allowed set
     * @param currency The currency that was removed (as bytes3)
     */
    event CurrencyRemoved(bytes3 indexed currency);
    /**
     * @notice Emitted when the bond registry address is set
     * @param bondRegistry The address of the bond registry contract
     */
    event BondRegistrySet(address indexed bondRegistry);
    /**
     * @notice Emitted when the escrow manager address is set
     * @param escrowManager The address of the escrow manager contract
     */
    event EscrowManagerSet(address indexed escrowManager);
    /**
     * @notice Emitted when the company wallet registry address is set
     * @param companyRegistry The address of the company wallet registry contract
     */
    event CompanyWalletRegistrySet(address indexed companyRegistry);
    /**
     * @notice Emitted when the payment expiry threshold is set
     * @param expiryThreshold The new expiry threshold in seconds
     */
    event PaymentExpiryThresholdSet(uint256 indexed expiryThreshold);

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Constructor that disables initialization
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Sets the bond registry address
     * @param bondRegistry The address of the bond registry contract
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if bondRegistry is zero address
     * @dev Emits BondRegistrySet event on success
     */
    function setBondRegistry(address bondRegistry) public onlyRoles(ADMIN) {
        if (bondRegistry == address(0)) {
            revert Errors.ZeroAddress();
        }
        _setBondRegistry(bondRegistry);
    }

    /**
     * @notice Sets the escrow manager address
     * @param escrowManager The address of the escrow manager contract
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if escrowManager is zero address
     * @dev Emits EscrowManagerSet event on success
     */
    function setEscrowManager(address escrowManager) public onlyRoles(ADMIN) {
        if (escrowManager == address(0)) {
            revert Errors.ZeroAddress();
        }
        _setEscrowManager(escrowManager);
    }

    /**
     * @notice Sets the company wallet registry address
     * @param companyWalletRegistry The address of the company wallet registry contract
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if companyWalletRegistry is zero address
     * @dev Emits CompanyWalletRegistrySet event on success
     */
    function setCompanyWalletRegistry(
        address companyWalletRegistry
    ) public onlyRoles(ADMIN) {
        if (companyWalletRegistry == address(0)) {
            revert Errors.ZeroAddress();
        }
        _setCompanyWalletRegistry(companyWalletRegistry);
    }

    /**
     * @notice Adds a new currency to the allowed set
     * @param currency The currency string to add (e.g., "EUR", "USD")
     * @dev Only callable by addresses with ADMIN role
     * @dev Converts string to bytes3 format for storage
     * @dev Reverts if currency already exists in the set
     * @dev Emits CurrencyAdded event on success
     */
    function addCurrency(string memory currency) public onlyRoles(ADMIN) {
        bytes3 currencyBytes3 = currency._currencyToBytes3();
        bytes32 currencyBytes = bytes32(currencyBytes3);
        if (_currencies.contains(currencyBytes)) {
            revert Errors.InterestDiscovery__CurrencyAlreadyExists(
                currencyBytes3
            );
        }
        // @dev disabled slither warning as we revert if the currency already exists
        // slither-disable-next-line unused-return
        _currencies.add(currencyBytes);

        emit CurrencyAdded(currencyBytes3);
    }

    /**
     * @notice Removes a currency from the allowed set
     * @param currency The currency string to remove (e.g., "EUR", "USD")
     * @dev Only callable by addresses with ADMIN role
     * @dev Converts string to bytes3 format for lookup
     * @dev Reverts if currency does not exist in the set
     * @dev Emits CurrencyRemoved event on success
     */
    function removeCurrency(string memory currency) public onlyRoles(ADMIN) {
        bytes3 currencyBytes3 = currency._currencyToBytes3();
        bytes32 currencyBytes = bytes32(currencyBytes3);
        if (!_currencies.contains(currencyBytes)) {
            revert Errors.InterestDiscovery__CurrencyDoesNotExist(
                currencyBytes3
            );
        }
        // @dev disabled slither warning as we revert if the currency does not exist
        // slither-disable-next-line unused-return
        _currencies.remove(currencyBytes);

        emit CurrencyRemoved(currencyBytes3);
    }

    /**
     * @notice Sets the payment expiry threshold for offers
     * @param paymentExpiryThreshold The new payment expiry threshold in seconds
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if paymentExpiryThreshold is below MIN_OFFER_EXPIRY
     * @dev Emits PaymentExpiryThresholdSet event on success
     */
    function setPaymentExpiryThreshold(
        uint256 paymentExpiryThreshold
    ) public onlyRoles(ADMIN) {
        _setPaymentExpiryThreshold(paymentExpiryThreshold);
    }

    /**
     * @notice Sets the dispute buffer period
     * @param disputeBufferPeriod The new dispute buffer period in seconds
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if disputeBufferPeriod exceeds MAX_DISPUTE_BUFFER_PERIOD
     * @dev This period determines how long after payment deadline disputes can be initiated
     */
    function setDisputeBufferPeriod(
        uint256 disputeBufferPeriod
    ) public onlyRoles(ADMIN) {
        if (disputeBufferPeriod > MAX_DISPUTE_BUFFER_PERIOD) {
            revert Errors.InterestDiscovery__DisputeBufferPeriodTooHigh();
        }
        _disputeBufferPeriod = disputeBufferPeriod;
    }

    /**
     * @notice Sets the maximum number of counter offers allowed per user per offer
     * @param maxCounterOffers The maximum number of counter offers allowed
     * @dev Only callable by addresses with ADMIN role
     * @dev Setting to 0 effectively disables counter offers platform-wide
     */
    function setMaxCounterOffersPerUser(
        uint256 maxCounterOffers
    ) public onlyRoles(ADMIN) {
        _maxCounterOffersPerUser = maxCounterOffers;
    }

    /*//////////////////////////////////////////////////////////////
                            GETTERS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Gets the bond registry address
     * @return The address of the bond registry contract
     */
    function getBondRegistry() public view returns (address) {
        return _bondRegistry;
    }

    /**
     * @notice Gets the escrow manager address
     * @return The address of the escrow manager contract
     */
    function getEscrowManager() public view returns (address) {
        return _escrowManager;
    }

    /**
     * @notice Gets the company wallet registry address
     * @return The address of the company wallet registry contract
     */
    function getCompanyWalletRegistry() public view returns (address) {
        return _companyWalletRegistry;
    }

    /**
     * @notice Gets all allowed currencies
     * @return An array of all allowed currencies as bytes32 values
     */
    function getCurrencies() public view returns (bytes32[] memory) {
        return _currencies.values();
    }

    /**
     * @notice Gets the dispute buffer period
     * @return The current dispute buffer period in seconds
     */
    function getDisputeBufferPeriod() public view returns (uint256) {
        return _disputeBufferPeriod;
    }

    /**
     * @notice Gets the payment expiry threshold
     * @return The current payment expiry threshold in seconds
     */
    function getPaymentExpiryThreshold() public view returns (uint256) {
        return _paymentExpiryThreshold;
    }

    /**
     * @notice Returns the current value of the offer counter
     * @return The current offer counter value (next offer ID will be this value + 1)
     */
    function getOfferCounter() public view returns (uint256) {
        return _offerCounter;
    }

    /**
     * @notice Returns the current value of the deal counter
     * @return The current deal counter value (next deal ID will be this value + 1)
     */
    function getDealCounter() public view returns (uint256) {
        return _dealCounter;
    }

    /**
     * @notice Gets the maximum number of counter offers allowed per user per offer
     * @return The maximum counter offers cap
     */
    function getMaxCounterOffersPerUser() public view returns (uint256) {
        return _maxCounterOffersPerUser;
    }

    /**
     * @notice Gets the number of counter offers a user has made for a specific offer
     * @param user The address of the user
     * @param offerId The ID of the offer
     * @return The number of counter offers the user has made for this offer
     */
    function getCounterOfferCount(
        address user,
        uint256 offerId
    ) public view returns (uint256) {
        return _counterOfferCounts[user][offerId];
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Sets the bond registry address internally
     * @param bondRegistry The address of the bond registry contract
     * @dev Internal function that updates storage and emits event
     * @dev Emits BondRegistrySet event
     */
    function _setBondRegistry(address bondRegistry) internal {
        _bondRegistry = bondRegistry;

        emit BondRegistrySet(bondRegistry);
    }

    /**
     * @notice Sets the escrow manager address internally
     * @param escrowManager The address of the escrow manager contract
     * @dev Internal function that updates storage and emits event
     * @dev Emits EscrowManagerSet event
     */
    function _setEscrowManager(address escrowManager) internal {
        _escrowManager = escrowManager;

        emit EscrowManagerSet(escrowManager);
    }

    /**
     * @notice Sets the company wallet registry address internally
     * @param companyWalletRegistry The address of the company wallet registry contract
     * @dev Internal function that updates storage and emits event
     * @dev Emits CompanyWalletRegistrySet event
     */
    function _setCompanyWalletRegistry(address companyWalletRegistry) internal {
        _companyWalletRegistry = companyWalletRegistry;

        emit CompanyWalletRegistrySet(companyWalletRegistry);
    }

    /**
     * @notice Sets the payment expiry threshold internally
     * @param expiryThreshold The new expiry threshold in seconds
     * @dev Internal function that validates and updates storage
     * @dev Reverts if expiryThreshold is below MIN_OFFER_EXPIRY
     * @dev Emits PaymentExpiryThresholdSet event
     */
    function _setPaymentExpiryThreshold(uint256 expiryThreshold) internal {
        if (expiryThreshold < MIN_OFFER_EXPIRY) {
            revert Errors.InterestDiscovery__PaymentExpiryThresholdTooLow(
                expiryThreshold
            );
        }
        _paymentExpiryThreshold = expiryThreshold;

        emit PaymentExpiryThresholdSet(expiryThreshold);
    }

    /**
     * @notice Authorizes an upgrade for the contract
     * @param newImplementation The address of the new implementation contract
     * @dev Only callable by the contract owner
     * @dev Required by UUPSUpgradeable pattern for upgrade authorization
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {} // solhint-disable-line no-empty-blocks

    /**
     * @notice Initializes the base contract
     * @param owner_ The address of the contract owner
     * @param expiryThreshold The expiry threshold for offers in seconds
     * @param bondRegistry_ The address of the bond registry contract
     * @param escrowManager The address of the escrow manager contract
     * @param companyWalletRegistry_ The address of the company wallet registry contract
     * @param maxCounterOffers The maximum number of counter offers per user per offer
     * @dev Initializes the contract with the provided parameters and sets up the initial state
     * @dev Only callable during contract initialization
     * @dev Sets up owner, expiry threshold, and optional registry addresses
     */
    function __InterestDiscoveryBase_init(
        // solhint-disable-line func-name-mixedcase
        address owner_,
        uint256 expiryThreshold,
        address bondRegistry_,
        address escrowManager,
        address companyWalletRegistry_,
        uint256 maxCounterOffers
    ) internal onlyInitializing {
        _initializeOwner(msg.sender);
        _setPaymentExpiryThreshold(expiryThreshold);
        _maxCounterOffersPerUser = maxCounterOffers;
        if (bondRegistry_ != address(0)) {
            _setBondRegistry(bondRegistry_);
        }
        if (escrowManager != address(0)) {
            _setEscrowManager(escrowManager);
        }
        if (companyWalletRegistry_ != address(0)) {
            _setCompanyWalletRegistry(companyWalletRegistry_);
        }
        transferOwnership(owner_);
    }
}
