// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {BondRegistry} from "../registry/BondRegistry.sol";
import {Bond, BondStatus} from "../registry/BondStructs.sol";
import {Errors} from "../libs/Errors.sol";
import {EscrowManager} from "./EscrowManager.sol";
import {ICompanyWalletRegistry} from "../wallet/registry/ICompanyWalletRegistry.sol";
import {InterestDiscoveryBase} from "./InterestDiscoveryBase.sol";
import {IInterestDiscovery} from "./IInterestDiscovery.sol";
import {
    Amounts,
    CounterOfferInput,
    Offer,
    OfferInput,
    Deal,
    DealStatus,
    DealType
} from "./MarketStructs.sol";
import {StringExtensions} from "../libs/StringExtensions.sol";

/**
 * @title InterestDiscovery
 * @notice Interest discovery contract
 * @author DEUSS Team
 * @dev solhint-disable ordering because the functions are logically ordered differently into groups
 *
 * solhint-disable ordering
 */
contract InterestDiscovery is IInterestDiscovery, InterestDiscoveryBase {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using StringExtensions for string;

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Role for handling payments
    uint256 public constant PAYMENT_HANDLER = _ROLE_1;
    /// @notice Role for arbitrating disputes
    uint256 public constant ARBITRATOR = _ROLE_2;

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
     * @notice Initializes the contract
     * @param owner_ Address of the contract owner
     * @param expiryThreshold Expiry threshold for offers
     * @param registry_ Address of the bond registry
     * @param escrowManager Address of the escrow manager
     * @param companyRegistry_ Address of the company registry
     * @param maxCounterOffers Maximum number of counter offers per user per offer
     */
    function initialize(
        address owner_,
        uint256 expiryThreshold,
        address registry_,
        address escrowManager,
        address companyRegistry_,
        uint256 maxCounterOffers
    ) external initializer {
        __InterestDiscovery_init(
            owner_,
            expiryThreshold,
            registry_,
            escrowManager,
            companyRegistry_,
            maxCounterOffers
        );
    }

    /*//////////////////////////////////////////////////////////////
                            offer functions
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IInterestDiscovery
     */
    function registerOffer(
        OfferInput calldata offer
    ) external returns (uint256 offerId) {
        // validation part
        Offer memory validatedOffer = _validateOffer(offer, msg.sender);
        // increase counter and cache its value
        offerId = ++_offerCounter;
        // update internal mappings
        _offers[offerId] = validatedOffer;
        _makersOfferIds[msg.sender].push(offerId);

        EscrowManager(_escrowManager).createEscrow(
            offerId,
            validatedOffer.amounts.total,
            validatedOffer.owner,
            validatedOffer.tokenAddress,
            validatedOffer.tokenId,
            validatedOffer.denomination
        );

        emit OfferRegistered(offerId, validatedOffer.isin, msg.sender);
        emit AmountsUpdated(
            offerId,
            validatedOffer.amounts.available,
            validatedOffer.amounts.inDeals,
            validatedOffer.amounts.sold
        );
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function acceptOffer(
        uint256 offerId,
        uint256 amount
    ) external returns (uint256 dealId) {
        Offer storage currentOffer = _offers[offerId];
        // validation part
        _validateMsgSender(msg.sender);
        _validateNotOwner(msg.sender, currentOffer.owner);
        _validateOfferExpiry(currentOffer.expiry, DealType.OFFER);
        _validateAmounts(currentOffer, amount);
        // update amounts in the current offer
        currentOffer.amounts.available -= amount;
        currentOffer.amounts.inDeals += amount;

        dealId = _createAndStoreDeal(
            offerId,
            amount,
            currentOffer.unitPrice,
            DealStatus.PENDING,
            DealType.OFFER,
            0
        );

        emit AmountsUpdated(
            offerId,
            currentOffer.amounts.available,
            currentOffer.amounts.inDeals,
            currentOffer.amounts.sold
        );
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function cancelOffer(uint256 offerId) external {
        Offer storage currentOffer = _offers[offerId];
        // validation
        _doAddressesMatch(msg.sender, currentOffer.owner);
        // update amounts in the current offer
        uint256 available = currentOffer.amounts.available;
        currentOffer.amounts.available = 0;

        EscrowManager(_escrowManager).withdraw(offerId, available);

        emit OfferCancelled(offerId, msg.sender);
        emit AmountsUpdated(
            offerId,
            currentOffer.amounts.available,
            currentOffer.amounts.inDeals,
            currentOffer.amounts.sold
        );
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function createCounterOffer(
        CounterOfferInput calldata counterOffer
    ) external returns (uint256 dealId) {
        Offer memory originalOffer = _offers[counterOffer.offerId];

        // Check if counter offers are allowed for this offer
        if (!originalOffer.allowCounterOffers) {
            revert Errors.InterestDiscovery__CounterOffersNotAllowed();
        }
        // Check if user has reached the counter offer cap
        uint256 currentCount = _counterOfferCounts[msg.sender][
            counterOffer.offerId
        ];
        if (!(currentCount < _maxCounterOffersPerUser)) {
            revert Errors.InterestDiscovery__CounterOfferLimitReached();
        }

        _validateMsgSender(msg.sender);
        _validateNotOwner(msg.sender, originalOffer.owner);
        _validateOfferExpiry(originalOffer.expiry, DealType.OFFER); // check if the offer has already expired
        // @dev cannot use '_validateOfferExpiry' here because of different validation condition ('>=' vs '>')
        if (!(block.timestamp < counterOffer.expiry)) {
            revert Errors.InterestDiscovery__CounterOfferExpired(
                counterOffer.expiry,
                block.timestamp
            );
        }
        _validateAmounts(originalOffer, counterOffer.amount);

        // Increment counter offer count for this user and offer
        ++_counterOfferCounts[msg.sender][counterOffer.offerId];

        dealId = _createAndStoreDeal(
            counterOffer.offerId,
            counterOffer.amount,
            counterOffer.unitPrice,
            DealStatus.PROPOSED,
            DealType.COUNTER_OFFER,
            counterOffer.expiry
        );

        emit CounterOfferCreated(counterOffer.offerId, dealId, msg.sender);
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function cancelCounterOffer(uint256 dealId) external {
        Deal memory currentDeal = _deals[dealId];

        // implicitly validates deal type (only counter offers can be PROPOSED)
        _validateDealStatus(currentDeal.status, DealStatus.PROPOSED);
        // validate that counter offer is not expired
        _validateOfferExpiry(
            currentDeal.counterOfferExpiry,
            DealType.COUNTER_OFFER
        );
        // only counter offer creator can cancel it
        _doAddressesMatch(msg.sender, currentDeal.buyer);

        _deals[dealId].status = DealStatus.CANCELLED;

        emit DealStatusUpdated(dealId, uint8(DealStatus.CANCELLED));
        emit CounterOfferCancelled(dealId, msg.sender);
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function resolveCounterOffer(uint256 dealId, bool accepted) external {
        Deal memory currentDeal = _deals[dealId]; // counter offer deal
        Offer memory originalOffer = _offers[currentDeal.offerId]; // original offer

        // implicitly validates deal type (only counter offers can be PROPOSED)
        _validateDealStatus(currentDeal.status, DealStatus.PROPOSED);
        _doAddressesMatch(msg.sender, originalOffer.owner);
        // validate that counter offer is not expired
        _validateOfferExpiry(
            currentDeal.counterOfferExpiry,
            DealType.COUNTER_OFFER
        );
        // @dev we do not validate original offer expiry on purpose due to intended
        // business logic, i.e., counter offer can be accepted even if original offer is expired

        if (accepted) {
            _validateAmounts(originalOffer, currentDeal.amount);
            // store and update deal data
            Deal storage _currentDeal = _deals[dealId];
            _currentDeal.status = DealStatus.PENDING;
            _currentDeal.dealType = DealType.OFFER;
            uint256 newPaymentDeadline =
                _paymentExpiryThreshold + block.timestamp;
            _currentDeal.paymentDeadline = newPaymentDeadline;
            _currentDeal.disputeBuffer =
                newPaymentDeadline + _disputeBufferPeriod;
            _currentDeal.counterOfferExpiry = 0;
            // update offer data
            Offer storage _originalOffer = _offers[currentDeal.offerId];
            _originalOffer.amounts.available -= currentDeal.amount;
            _originalOffer.amounts.inDeals += currentDeal.amount;

            emit AmountsUpdated(
                currentDeal.offerId,
                _originalOffer.amounts.available,
                _originalOffer.amounts.inDeals,
                _originalOffer.amounts.sold
            );
            emit DealStatusUpdated(dealId, uint8(DealStatus.PENDING));
        } else {
            Deal storage _currentDeal = _deals[dealId];

            _currentDeal.status = DealStatus.DECLINED;
            _currentDeal.counterOfferExpiry = 0;

            emit DealStatusUpdated(dealId, uint8(DealStatus.DECLINED));
        }

        emit CounterOfferResolved(dealId, accepted);
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function markDealAsPaid(
        uint256 dealId
    ) external onlyRoles(PAYMENT_HANDLER) {
        Deal storage currentDeal = _deals[dealId];

        // implicitly validates deal type (only regular offers can be PENDING)
        _validateDealStatus(currentDeal.status, DealStatus.PENDING);

        currentDeal.status = DealStatus.PAID;

        emit DealStatusUpdated(dealId, uint8(DealStatus.PAID));
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function markDealAsNotPaid(uint256 dealId) external {
        Deal storage currentDeal = _deals[dealId];

        // implicitly validates deal type (only regular offers can be PENDING)
        _validateDealStatus(currentDeal.status, DealStatus.PENDING);
        if (!(block.timestamp > currentDeal.paymentDeadline))
            revert Errors.InterestDiscovery__DealNotExpired();

        currentDeal.status = DealStatus.UNPAID;

        emit DealStatusUpdated(dealId, uint8(DealStatus.UNPAID));
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function initiateDispute(uint256 dealId) external {
        Deal storage currentDeal = _deals[dealId];

        _doAddressesMatch(msg.sender, currentDeal.buyer);
        // implicitly validates deal type (only regular offers can be UNPAID)
        _validateDealStatus(currentDeal.status, DealStatus.UNPAID);
        if (block.timestamp > currentDeal.disputeBuffer)
            revert Errors.InterestDiscovery__DisputePeriodExpired();

        currentDeal.status = DealStatus.IN_DISPUTE;

        emit DealStatusUpdated(dealId, uint8(DealStatus.IN_DISPUTE));
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function resolveDispute(
        uint256 dealId,
        DealStatus status
    ) external onlyRoles(ARBITRATOR) {
        Deal storage currentDeal = _deals[dealId];

        // implicitly validates deal type (only regular offers can be IN_DISPUTE, PAID, or UNPAID)
        if (currentDeal.status != DealStatus.IN_DISPUTE)
            revert Errors.InterestDiscovery__DealNotInDispute();
        // validate that the status to be assigned is either PAID or UNPAID
        if (status != DealStatus.PAID && status != DealStatus.UNPAID) {
            revert Errors.InterestDiscovery__InvalidStatus(uint8(status));
        }

        currentDeal.disputeBuffer = 0; // set dispute buffer to 0 to prevent from being disputed again (griefing attack)
        currentDeal.status = status;

        emit DealStatusUpdated(dealId, uint8(status));
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function settleDeal(uint256 dealId) external {
        Deal storage currentDeal = _deals[dealId];

        // implicitly validates deal type (only regular offers can be PAID or UNPAID)
        if (
            currentDeal.status != DealStatus.PAID &&
            currentDeal.status != DealStatus.UNPAID
        ) {
            // deal can be settled only if it is either PAID or UNPAID
            revert Errors.InterestDiscovery__InvalidStatus(
                uint8(currentDeal.status)
            );
        }
        // Handle UNPAID case with additional time check
        if (currentDeal.status == DealStatus.UNPAID) {
            if (currentDeal.disputeBuffer > block.timestamp) {
                revert Errors.InterestDiscovery__DisputePeriodNotExpired();
            }
        }
        // Cache common values to avoid duplicate storage reads
        uint256 amount = currentDeal.amount;
        uint256 offerId = currentDeal.offerId;
        Offer storage currentOffer = _offers[offerId];
        DealStatus originalStatus = currentDeal.status;
        // update deal
        currentDeal.status = DealStatus.SUCCESSFUL;
        // update offer
        currentOffer.amounts.inDeals -= amount;
        if (originalStatus != DealStatus.PAID) {
            currentOffer.amounts.available += amount;
        } else {
            currentOffer.amounts.sold += amount;
            // claim tokens from escrow
            EscrowManager(_escrowManager).claim(
                offerId,
                amount,
                currentDeal.buyer
            );
        }

        emit DealStatusUpdated(dealId, uint8(DealStatus.SUCCESSFUL));
        emit AmountsUpdated(
            offerId,
            currentOffer.amounts.available,
            currentOffer.amounts.inDeals,
            currentOffer.amounts.sold
        );
    }

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc IInterestDiscovery
     */
    function getOffer(uint256 offerId) public view returns (Offer memory) {
        return _offers[offerId];
    }

    /**
     * @inheritdoc IInterestDiscovery
     */
    function getDeal(uint256 dealId) public view returns (Deal memory) {
        return _deals[dealId];
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice initialize the contract
     * @param owner_ owner of the contract
     * @param expiryThreshold expiry threshold
     * @param bondRegistry_ address of valid Bond Registry
     * @param escrowManager address of valid Escrow Manager
     * @param companyRegistry_ address of valid Company Registry (optional)
     * @param maxCounterOffers maximum number of counter offers per user per offer
     */
    function __InterestDiscovery_init(
        // solhint-disable-line func-name-mixedcase
        address owner_,
        uint256 expiryThreshold,
        address bondRegistry_,
        address escrowManager,
        address companyRegistry_,
        uint256 maxCounterOffers
    ) internal {
        // Call the base initialization first
        __InterestDiscoveryBase_init(
            owner_,
            expiryThreshold,
            bondRegistry_,
            escrowManager,
            companyRegistry_,
            maxCounterOffers
        );
    }

    /**
     * @notice Create and store a deal
     * @param offerId ID of the offer this deal is bound to
     * @param amount Amount of units
     * @param unitPrice Unit price
     * @param status Create the deal with this status
     * @param dealType Regular offer or counter offer type of deal
     * @param counterOfferExpiry Expiry timestamp for counter offers
     * @return dealId ID of the created deal
     */
    function _createAndStoreDeal(
        uint256 offerId,
        uint256 amount,
        uint256 unitPrice,
        DealStatus status,
        DealType dealType,
        uint256 counterOfferExpiry
    ) internal returns (uint256 dealId) {
        dealId = ++_dealCounter;
        // slither-disable-next-line uninitialized-local
        uint256 paymentDeadline;
        // slither-disable-next-line uninitialized-local
        uint256 disputeBuffer;
        if (dealType == DealType.OFFER) {
            paymentDeadline = _paymentExpiryThreshold + block.timestamp;
            disputeBuffer = paymentDeadline + _disputeBufferPeriod;
        }
        _deals[dealId] = Deal({
            offerId: offerId,
            amount: amount,
            buyer: msg.sender,
            price: unitPrice * amount,
            counterOfferExpiry: dealType == DealType.COUNTER_OFFER
                ? counterOfferExpiry
                : 0,
            paymentDeadline: paymentDeadline,
            disputeBuffer: disputeBuffer,
            status: status,
            dealType: dealType
        });

        emit DealCreated(offerId, dealId, paymentDeadline);
    }

    /*//////////////////////////////////////////////////////////////
                          VALIDATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate offer
     * @param offer offer to be validated
     * @param owner_ owner of offer to be validated
     * @return validatedOffer The validated offer
     * @dev Reverts if any data is not valid
     */
    function _validateOffer(
        OfferInput calldata offer,
        address owner_
    ) internal view returns (Offer memory) {
        // validate msg.sender
        _validateMsgSender(owner_);
        // convert isin string to bytes
        bytes12 isinBytes = offer.isin._isinToBytes12();
        // get tokenAddress and tokenId from the _bondRegistry
        Bond memory bond = _validateAsset(isinBytes);
        _validateDepositAmounts(offer.totalAmount, offer.lot);
        bytes3 currencyBytes = offer.currency._currencyToBytes3();
        _validatePrice(offer.unitPrice, currencyBytes);
        _validateOfferExpiry(offer.expiry, DealType.OFFER);
        // create offer struct
        Offer memory validatedOffer = Offer({
            isin: isinBytes,
            owner: owner_,
            tokenAddress: bond.tokenAddress,
            currency: currencyBytes,
            tokenId: uint256(keccak256(bytes(offer.isin))),
            denomination: bond.denomination,
            lot: offer.lot,
            unitPrice: offer.unitPrice,
            expiry: offer.expiry,
            amounts: Amounts({
                total: offer.totalAmount,
                available: offer.totalAmount,
                inDeals: 0,
                sold: 0
            }),
            allowCounterOffers: offer.allowCounterOffers
        });
        return validatedOffer;
    }

    /**
     * @notice Validate offer expiry
     * @param offerExpiry Expiry timestamp of the offer
     * @param dealType Type of the deal (offer or counter offer)
     * @dev Reverts if the offer has expired
     */
    function _validateOfferExpiry(
        uint256 offerExpiry,
        DealType dealType
    ) internal view {
        if (block.timestamp > offerExpiry) {
            if (dealType == DealType.OFFER) {
                revert Errors.InterestDiscovery__OfferExpired(
                    offerExpiry,
                    block.timestamp
                );
            } else {
                revert Errors.InterestDiscovery__CounterOfferExpired(
                    offerExpiry,
                    block.timestamp
                );
            }
        }
    }

    /**
     * @notice Validate price and currency
     * @param price price to be validated
     * @param currency currency to be validated
     * @dev Reverts if price is zero or currency is invalid
     */
    function _validatePrice(uint256 price, bytes3 currency) internal view {
        if (price == 0) {
            revert Errors.InterestDiscovery__ZeroPrice();
        }
        if (!_currencies.contains(bytes32(currency))) {
            revert Errors.InterestDiscovery__InvalidCurrency(currency);
        }
    }

    /**
     * @notice Validate asset (bond)
     * @param isin id of the asset to be validated against the bond registry
     * @return validated bond metadata
     * @dev Reverts if the bond is not in Issued status
     */
    function _validateAsset(bytes12 isin) internal view returns (Bond memory) {
        Bond memory bond = BondRegistry(_bondRegistry).getBondByIsin(isin);
        if (bond.status != BondStatus.Issued) {
            revert Errors.InterestDiscovery__BondInvalidStatus(
                isin,
                uint8(bond.status)
            );
        }
        return bond;
    }

    /**
     * @notice Validate message sender
     * @param sender address of the sender
     * @dev If company wallet registry is set, only enabled company wallets are allowed
     * @dev Reverts if the sender is not an enabled company wallet when registry is set
     * @dev Regular EOAs are rejected when company wallet registry is configured
     */
    function _validateMsgSender(address sender) internal view {
        address cwr = _companyWalletRegistry;
        if (cwr != address(0)) {
            if (!ICompanyWalletRegistry(cwr).isCompanyWalletEnabled(sender)) {
                revert Errors.InterestDiscovery__NotAuthorized(sender);
            }
        }
    }

    /**
     * @notice Validate that the sender is not the owner of the offer
     * @param sender address of the sender
     * @param owner address of the owner
     * @dev Reverts if the sender is the owner of the offer
     */
    function _validateNotOwner(address sender, address owner) internal pure {
        if (sender == owner) revert Errors.InterestDiscovery__SenderIsOwner();
    }

    /**
     * @notice Validate the deal status
     * @param actual Actual status of the deal
     * @param desired Desired status of the deal
     * @dev Reverts if don't match
     */
    function _validateDealStatus(
        DealStatus actual,
        DealStatus desired
    ) internal pure {
        if (actual != desired) {
            revert Errors.InterestDiscovery__InvalidStatus(uint8(actual));
        }
    }

    /**
     * @notice Validate that the caller is an owner
     * @param caller address of the caller
     * @param owner_ address of the owner
     * @dev Reverts if the caller is not the owner
     */
    function _doAddressesMatch(address caller, address owner_) internal pure {
        if (caller != owner_) {
            revert Errors.InterestDiscovery__NotAuthorized(caller);
        }
    }

    /**
     * @notice Validate amounts for an offer
     * @param offer The offer to validate amounts for
     * @param amount The amount to validate
     * @dev Reverts if amount exceeds available amount or is not a multiple of lot size
     */
    function _validateAmounts(
        Offer memory offer,
        uint256 amount
    ) internal pure {
        if (amount > offer.amounts.available) {
            revert Errors.InterestDiscovery__InsufficientAvailableAmount(
                amount,
                offer.amounts.available
            );
        }
        // @dev: slither detects weak-prng in 'amount % offer.lot != 0', but no randomnes is being used
        // slither-disable-next-line weak-prng
        if (amount % offer.lot != 0) {
            revert Errors.InterestDiscovery__AmountNotMultipleOfLot(
                offer.lot,
                amount
            );
        }
    }

    /**
     * @notice Validate deposit amounts
     * @param total total amount to be validated
     * @param lot lot size to be validated
     * @dev Reverts if total or lot is zero, if lot is larger than total, or if total is not a multiple of lot
     */
    function _validateDepositAmounts(uint256 total, uint256 lot) internal pure {
        if (total == 0 || lot == 0) {
            revert Errors.InterestDiscovery__ZeroAmount();
        }
        if (total < lot) {
            revert Errors.InterestDiscovery__LotSizeTooLarge();
        }
        if (total % lot != 0) {
            revert Errors.InterestDiscovery__TotalAmountNotMultipleOfLot();
        }
    }
}
