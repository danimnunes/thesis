// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

/**
 * @notice Represents a token type (FT or NFT)
 * @param ERC6909FT Token type is Fungible Token
 * @param ERC6909NFT Token type is Non Fungible Token
 */
enum TokenType {
    ERC6909FT,
    ERC6909NFT
}

/**
 * @notice Represents the frequency of coupon payments
 * @param Annual 1 payment per year
 * @param SemiAnnual 2 payments per year
 * @param Quarterly 4 payments per year
 * @param Monthly 12 payments per year
 * @param Daily 360 payments per year
 */
enum CouponFrequency {
    Annual,
    SemiAnnual,
    Quarterly,
    Monthly,
    Daily
}

/**
 * @notice Represents the status of a bond
 * @param Unregistered Bond is not registered
 * @param Proposed Bond proposal has been submitted but not yet approved
 * @param Approved Bond proposal has been approved
 * @param Issued Bond has been issued
 * @param Redeemed Bond has been fully redeemed
 * @param Suspended Bond is temporarily suspended
 * @param Rejected Bond proposal has been rejected
 * @param Replaced Bond has been replaced by another bond
 * @param Withdrawn Bond proposal has been withdrawn
 */
enum BondStatus {
    Unregistered,
    Proposed,
    Approved,
    Issued,
    Redeemed,
    Suspended,
    Rejected,
    Replaced,
    Withdrawn
}

/**
 * @notice Represents the status of a company wallet in the bond registry
 * @param Unregistered Company wallet is not registered
 * @param Registered Company wallet is registered
 * @param Suspended Company wallet is suspended
 */
enum CompanyWalletStatus {
    Unregistered,
    Registered,
    Suspended
}

/**
 * @notice Represents the type of coupon payments
 * @param ZERO_COUPON No coupon payments
 * @param FIXED Fixed rate for entire bond lifetime
 * @param FLOATING Floating rate - Variable rates that can change over time
 */
enum CouponType {
    ZERO_COUPON,
    FIXED,
    FLOATING
}

/**
 * @notice Represents metadata for a company wallet in the bond registry
 * @param owner Address of the company wallet owner
 * @param status Current status of the company wallet
 */
struct CompanyWalletMetadata {
    address owner;
    CompanyWalletStatus status;
}

/**
 * @notice Represents a bond proposal
 * @param id ID of the bond proposal
 * @param expiry Expiry timestamp of the bond proposal
 * @param requestor Address of the bond proposal requestor
 */
struct BondProposal {
    uint256 id;
    uint256 expiry;
    address requestor;
}

/**
 * @notice Represents coupon rates for a bond
 * @param paymentIntervals Intervals at which payments are made
 * @param rates Corresponding coupon rates for each payment interval
 */
struct CouponRates {
    uint256[] paymentIntervals;
    uint256[] rates;
}

/**
 * @notice Represents a bond
 * @param isin ISIN code of the bond
 * @param issuer Address of the bond issuer
 * @param tokenAddress Address of the bond token contract
 * @param status Current status of the bond
 * @param tokenType Type of the bond token (FT or NFT)
 * @param couponFrequency Frequency of coupon payments
 * @param currency Currency code of the bond
 * @param denomination Denomination of the bond
 * @param couponRates Coupon rates for the bond
 * @param couponType Type of coupon payments
 * @param issueDate Issue date of the bond
 * @param issueVolume Volume of the bond issued
 * @param maturityDate Maturity date of the bond
 * @param updatedAt Timestamp of the last update to the bond
 */
struct Bond {
    bytes12 isin;
    address issuer;
    address tokenAddress;
    BondStatus status;
    TokenType tokenType;
    CouponFrequency couponFrequency;
    bytes3 currency;
    uint256 denomination;
    CouponRates couponRates;
    CouponType couponType;
    uint256 issueDate;
    uint256 issueVolume;
    uint256 maturityDate;
    uint256 updatedAt;
}

/**
 * @notice Represents input data for creating a bond
 * @param isin ISIN code of the bond
 * @param currency Currency code of the bond
 * @param denomination Denomination of the bond
 * @param couponRates Coupon rates for the bond
 * @param couponType Type of coupon payments
 * @param issueCount Number of bonds to be issued
 * @param issueDate Issue date of the bond
 * @param maturityDate Maturity date of the bond
 * @param couponFrequency Frequency of coupon payments
 */
struct BondInput {
    string isin;
    string currency;
    uint256 denomination;
    CouponRates couponRates;
    CouponType couponType;
    uint256 issueCount;
    uint256 issueDate;
    uint256 maturityDate;
    CouponFrequency couponFrequency;
}
