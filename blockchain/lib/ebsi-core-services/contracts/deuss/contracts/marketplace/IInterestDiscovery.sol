// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {
    CounterOfferInput,
    Offer,
    OfferInput,
    DealStatus,
    Deal
} from "./MarketStructs.sol";

/**
 * @title IInterestDiscovery
 * @author DEUSS Team
 * @notice Interface for Interest Discovery contract managing bond offers and deals
 * @dev solhint-disable ordering because the functions are logically ordered differently into groups
 *
 * solhint-disable ordering
 */
interface IInterestDiscovery {
    /**
     * @notice Emitted when a new offer is registered
     * @param offerId The ID of the offer
     * @param isin  The ISIN of the bond
     * @param owner The address of the offer owner
     */
    event OfferRegistered(
        uint256 indexed offerId,
        bytes12 indexed isin,
        address indexed owner
    );

    /**
     * @notice Emitted when offer amounts are updated
     * @param offerId The ID of the offer
     * @param availableAmount The new available amount
     * @param inDealsAmount The new amount in deals
     * @param soldAmount The new sold amount
     */
    event AmountsUpdated(
        uint256 indexed offerId,
        uint256 indexed availableAmount,
        uint256 indexed inDealsAmount,
        uint256 soldAmount
    );

    /**
     * @notice Emitted when an offer is cancelled
     * @param offerId The ID of the offer
     * @param cancelor The address of the cancelor
     */
    event OfferCancelled(uint256 indexed offerId, address indexed cancelor);

    /**
     * @notice Emitted when a counter offer is created
     * @param offerId ID of the original offer
     * @param dealId ID of the deal created as a result of the counter offer
     * @param owner Address of the counter offer owner
     */
    event CounterOfferCreated(
        uint256 indexed offerId,
        uint256 indexed dealId,
        address indexed owner
    );

    /**
     * @notice Emitted when counter offer deal is cancelled
     * @param dealId The ID of the counter offer deal
     * @param cancelor The address of the cancelor
     */
    event CounterOfferCancelled(
        uint256 indexed dealId,
        address indexed cancelor
    );

    /**
     * @notice Emitted when counter offer deal is resolved
     * @param dealId The ID of the counter offer deal
     * @param accepted Was the counter offer accepted?
     */
    event CounterOfferResolved(uint256 indexed dealId, bool indexed accepted);

    /**
     * @notice Emitted when a deal is created
     * @param offerId The ID of the offer
     * @param dealId The ID of the deal
     * @param paymentDeadline The payment deadline timestamp of the deal
     */
    event DealCreated(
        uint256 indexed offerId,
        uint256 indexed dealId,
        uint256 indexed paymentDeadline
    );

    /**
     * @notice Emitted when a deal status is updated
     * @param dealId The ID of the deal
     * @param newStatus The new status of the deal
     */
    event DealStatusUpdated(uint256 indexed dealId, uint8 indexed newStatus);

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Register a new offer for bond trading
     * @param offer The offer input containing all necessary data (isin, amounts, price, etc.)
     * @return offerId The unique identifier for the registered offer
     * @dev Proper validation of input data is performed including bond status, amounts, and pricing
     */
    function registerOffer(
        OfferInput calldata offer
    ) external returns (uint256 offerId);

    /**
     * @notice Cancel an existing offer
     * @param offerId The ID of the offer to cancel
     * @dev Only the offer owner can cancel the offer
     * @dev Withdraws escrowed tokens back to the owner
     */
    function cancelOffer(uint256 offerId) external;

    /**
     * @notice Accept an offer by creating a deal
     * @param offerId The ID of the offer to accept
     * @param amount The amount of tokens to accept (must be multiple of lot size)
     * @return dealId The unique identifier for the created deal
     * @dev Validates offer expiry and amount constraints
     * @dev Creates a PENDING deal that requires payment within the deadline
     */
    function acceptOffer(
        uint256 offerId,
        uint256 amount
    ) external returns (uint256 dealId);

    /**
     * @notice Creates a counter offer to an existing offer
     * @param counterOffer The counter offer input containing offer ID, amount, price, and expiry
     * @return dealId The unique identifier for the counter offer deal
     * @dev Creates a PROPOSED deal that the original offer owner can accept or decline
     * @dev Validates sender authorization and offer constraints
     */
    function createCounterOffer(
        CounterOfferInput calldata counterOffer
    ) external returns (uint256 dealId);

    /**
     * @notice Cancels a counter offer
     * @param dealId The ID of the counter offer deal to cancel
     * @dev Only the counter offer creator can cancel a valid counter offer
     * @dev Anyone can cancel an expired counter offer
     * @dev Changes deal status to CANCELLED
     */
    function cancelCounterOffer(uint256 dealId) external;

    /**
     * @notice Resolves a counter offer by accepting or declining it
     * @param dealId The ID of the counter offer deal to resolve
     * @param accepted Whether to accept (true) or decline (false) the counter offer
     * @dev Only the original offer owner can resolve counter offers
     * @dev If accepted, converts counter offer to regular deal with PENDING status
     * @dev If declined, sets deal status to DECLINED
     */
    function resolveCounterOffer(uint256 dealId, bool accepted) external;

    /**
     * @notice Mark a deal as paid by the payment handler
     * @param dealId The ID of the deal to mark as paid
     * @dev Only addresses with PAYMENT_HANDLER role can call this function
     * @dev Reverts if the deal is not in PENDING status
     * @dev Changes deal status to PAID
     */
    function markDealAsPaid(uint256 dealId) external;

    /**
     * @notice Mark a deal as not paid after payment deadline expires
     * @param dealId The ID of the deal to mark as not paid
     * @dev Can be called by anyone after the payment deadline has passed
     * @dev Reverts if the deal is not in PENDING status or if the deal has not expired
     * @dev Changes deal status to UNPAID
     */
    function markDealAsNotPaid(uint256 dealId) external;

    /**
     * @notice Initiate a dispute for an unpaid deal
     * @param dealId The ID of the deal to dispute
     * @dev Only the buyer can initiate a dispute
     * @dev Reverts if the caller is not the buyer, deal is not in UNPAID status, or dispute period has expired
     * @dev Changes deal status to IN_DISPUTE
     */
    function initiateDispute(uint256 dealId) external;

    /**
     * @notice Resolve a dispute for a deal by an arbitrator
     * @param dealId The ID of the deal to resolve
     * @param status The new status for the deal (PAID or UNPAID)
     * @dev Only addresses with ARBITRATOR role can call this function
     * @dev Reverts if the deal is not in IN_DISPUTE status or if the new status is invalid
     * @dev Prevents future disputes by setting dispute buffer to 0
     */
    function resolveDispute(uint256 dealId, DealStatus status) external;

    /**
     * @notice Settle a deal after payment resolution
     * @param dealId The ID of the deal to settle
     * @dev Can be called by anyone once the deal is in PAID or UNPAID status
     * @dev For UNPAID deals, requires dispute period to have expired
     * @dev Transfers tokens to buyer if PAID, returns to seller if UNPAID
     * @dev Changes deal status to SUCCESSFUL and updates offer amounts
     */
    function settleDeal(uint256 dealId) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Get offer details by ID
     * @param offerId The ID of the offer to retrieve
     * @return offer The complete offer structure containing all offer data
     */
    function getOffer(uint256 offerId) external view returns (Offer memory);

    /**
     * @notice Get deal details by ID
     * @param dealId The ID of the deal to retrieve
     * @return deal The complete deal structure containing all deal data
     */
    function getDeal(uint256 dealId) external view returns (Deal memory);
}
