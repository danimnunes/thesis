// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

/**
 * @notice Enum representing the status of a deal in the marketplace
 * @param NON_EXISTING Deal does not exist (default state)
 * @param PENDING Deal is created and payment by buyer is expected
 * @param PAID Payment has been received and confirmed
 * @param UNPAID Payment was not received within the deadline
 * @param CANCELLED Deal was cancelled by the buyer
 * @param IN_DISPUTE Deal is currently under dispute resolution
 * @param PROPOSED Counter offer deal is proposed and awaiting response
 * @param DECLINED Counter offer deal was declined by the original offer owner
 * @param SUCCESSFUL Deal was successfully settled (tokens transferred to buyer)
 * @param UNSUCCESSFUL Deal was disputed and resolved unfavorably
 */
enum DealStatus {
    NON_EXISTING,
    PENDING,
    PAID,
    UNPAID,
    CANCELLED,
    IN_DISPUTE,
    PROPOSED,
    DECLINED,
    SUCCESSFUL,
    UNSUCCESSFUL
}

/**
 * @notice Enum signaling whether the deal belongs to a regular or counter offer
 * @param OFFER Regular offer deal (direct acceptance of an offer)
 * @param COUNTER_OFFER Counter offer deal (proposed alternative terms)
 */
enum DealType {
    OFFER,
    COUNTER_OFFER
}

/**
 * @notice Structure representing an offer input for registration
 * @param isin Bond ISIN identifier (International Securities Identification Number)
 * @param totalAmount Total amount of tokens to be sold in the offer
 * @param lot Lot size for trading (amount must be multiple of lot)
 * @param unitPrice Price per token/bond in the specified currency
 * @param currency Currency code for pricing (e.g., "EUR", "USD")
 * @param expiry Expiry timestamp of the offer (must be in the future)
 * @param allowCounterOffers Whether counter offers are allowed for this offer
 */
struct OfferInput {
    string isin;
    uint256 totalAmount;
    uint256 lot;
    uint256 unitPrice;
    string currency;
    uint256 expiry;
    bool allowCounterOffers;
}

/**
 * @notice Structure representing a counter offer input
 * @param offerId ID of the original offer being countered
 * @param expiry Expiry timestamp of the counter offer (must be in the future)
 * @param amount Amount of tokens to counter (must be multiple of original offer's lot)
 * @param unitPrice Unit price proposed in the counter offer
 */
struct CounterOfferInput {
    uint256 offerId;
    uint256 expiry;
    uint256 amount;
    uint256 unitPrice;
}

/**
 * @notice Structure representing the token amounts for an offer
 * @param total Total amount of tokens deposited in the offer
 * @param available Amount of tokens available for new deals
 * @param inDeals Amount of tokens currently locked in pending deals
 * @param sold Amount of tokens successfully sold to buyers
 */
struct Amounts {
    uint256 total;
    uint256 available;
    uint256 inDeals;
    uint256 sold;
}

/**
 * @notice Structure representing a registered offer in the marketplace
 * @param owner Address of the offer owner (creator)
 * @param isin Bond ISIN identifier (converted to bytes12)
 * @param tokenAddress Address of the token contract
 * @param tokenId ID of the specific token
 * @param denomination Denomination of the token
 * @param lot Lot size for trading (minimum tradeable amount)
 * @param unitPrice Price per token/bond in the specified currency
 * @param currency Currency code for pricing (converted to bytes3)
 * @param expiry Expiry timestamp of the offer
 * @param amounts Token amounts tracking (total, available, inDeals, sold)
 * @param allowCounterOffers Whether counter offers are allowed for this offer
 */
struct Offer {
    bytes12 isin;
    bytes3 currency;
    bool allowCounterOffers;
    address owner;
    address tokenAddress;
    uint256 tokenId;
    uint256 denomination;
    uint256 lot;
    uint256 unitPrice;
    uint256 expiry;
    Amounts amounts;
}

/**
 * @notice Structure representing a deal in the marketplace
 * @param offerId ID of the offer this deal is based on
 * @param amount Amount of tokens in the deal
 * @param buyer Address of the buyer (deal creator)
 * @param price Total price of the deal (amount * unitPrice)
 * @param counterOfferExpiry Acceptance deadline for counter offers (0 for regular deals)
 * @param paymentDeadline Payment deadline for PENDING deals
 * @param disputeBuffer Dispute buffer period end timestamp
 * @param status Current status of the deal
 * @param dealType Type of deal (OFFER or COUNTER_OFFER)
 */
struct Deal {
    uint256 offerId;
    uint256 amount;
    address buyer;
    uint256 price;
    uint256 counterOfferExpiry;
    uint256 paymentDeadline;
    uint256 disputeBuffer;
    DealStatus status;
    DealType dealType;
}

/**
 * @notice Structure representing an escrow for token custody
 * @param depositor Address of the token depositor (offer owner)
 * @param tokenAddress Address of the token contract
 * @param tokenId ID of the specific token
 * @param denomination Denomination of the token
 * @param amount Amount of tokens currently held in escrow
 */
struct Escrow {
    address depositor;
    address tokenAddress;
    uint256 tokenId;
    uint256 denomination;
    uint256 amount;
}
