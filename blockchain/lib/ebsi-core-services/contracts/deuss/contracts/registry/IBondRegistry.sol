// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
// DEUSS:
import {
    Bond,
    BondInput,
    BondStatus,
    CouponFrequency,
    TokenType,
    CouponType
} from "./BondStructs.sol";

/**
 * @title IBondRegistry
 * @author DEUSS Team
 * @notice The IBondRegistry interface defines the functions and events for managing bond registrations
 */
interface IBondRegistry is IERC165 {
    /**
     * @notice This event is emitted  when a currency’s allowed status is updated
     * @param currency The 3-letter ISO 4217 currency code (bytes3)
     * @param allowed True if the currency is allowed, false if disabled
     * @param changedBy The address who updated the currency status
     */
    event AllowedCurrencyUpdated(
        bytes3 indexed currency,
        bool indexed allowed,
        address indexed changedBy
    );

    /**
     * @notice This event is emitted when the factory address is modified
     * @dev This event is emitted by init and updateFactory functions
     * @param bondFactory The address of the bond factory
     * @param tokenType The token type that is deployed by the bondFactory
     */
    event BondFactoryAddressUpdated(
        address indexed bondFactory,
        TokenType indexed tokenType
    );

    /**
     * @notice Emitted when a bond is successfully issued and tokens are minted
     * @param isin The ISIN of the issued bond
     * @param id The ID of the bond data associated with the issued bond
     * @param tokenQuantity The total number of tokens minted for the bond
     * @param timestamp The timestamp when the bond was issued
     */
    event BondIssued(
        bytes12 indexed isin,
        uint256 indexed id,
        uint256 indexed tokenQuantity,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a proposal to register a bond ISIN is submitted
     * @dev Emitted by the `submitRegistrationProposal` function
     * @param isin The ISIN of the bond being proposed
     * @param id The ID assigned to bond data in the proposal
     * @param expiry The timestamp when the proposal expires
     * @param applicant The address that submitted the registration proposal
     */
    event BondProposed(
        bytes12 indexed isin,
        uint256 indexed id,
        uint256 indexed expiry,
        address applicant
    );

    /**
     * @notice Emitted when a bond is redeemed and subsequently closed
     * @dev Emitted by the `close` function
     * @param isin The bond ISIN
     * @param id The ID of the bond data associated with the redeemed bond
     * @param executor The address that executed the close
     * @param timestamp The timestamp when the bond was redeemed and closed
     */
    event BondRedeemed(
        bytes12 indexed isin,
        uint256 indexed id,
        address indexed executor,
        uint256 timestamp
    );

    /**
     * @notice This event is emitted when a proposal is withdrawn
     * @dev This event is emitted by the withdrawRegistrationProposal function
     * @param isin The ISIN of the withdrawn proposal
     * @param id The ID of the bond data associated with the withdrawn registration
     * @param timestamp The timestamp when the proposal was withdrawn
     */
    event BondRegistrationProposalWithdrawn(
        bytes12 indexed isin,
        uint256 indexed id,
        uint256 indexed timestamp
    );

    /**
     * @notice Emitted when a bond registration proposal is approved or rejected by the registrar
     * @dev Emitted by the handleRegistrationProposal function
     * @param isin The ISIN of the bond
     * @param id The ID of the bond data associated with the investigated ISIN
     * @param approver The address of the registrar who made the decision
     * @param timestamp The timestamp when the decision was made
     * @param tokenAddress The predicted token address for the bond, if the proposal is rejected, it will be 0
     * @param approved Whether the proposal was approved (`true`) or rejected (`false`)
     */
    event BondRegistrationResolved(
        bytes12 indexed isin,
        uint256 indexed id,
        address indexed approver,
        uint256 timestamp,
        address tokenAddress,
        bool approved
    );

    /**
     * @notice Emitted when a bond is suspended, halting its operations
     * @dev This event is emitted when the suspendBond function is called
     * @param isin The ISIN of the suspended bond
     * @param id The ID of the bond data associated with suspended ISIN
     * @param executor The address of the entity that executed the suspension
     * @param timestamp The timestamp when the bond was suspended
     * @param status A boolean indicating the suspension status: `true` if the bond is suspended, `false` if it is unsuspended
     */
    event BondSuspended(
        bytes12 indexed isin,
        uint256 indexed id,
        address indexed executor,
        uint256 timestamp,
        bool status
    );

    /**
     * @notice This event is emitted when a proposal is withdrawn
     * @dev This event is emitted by the withdrawRegistrationProposal function
     * @param isin The ISIN of the withdrawn proposal
     * @param id The ID of the bond data associated with the withdrawn update
     * @param timestamp The timestamp when the proposal was withdrawn
     */
    event BondUpdateProposalWithdrawn(
        bytes12 indexed isin,
        uint256 indexed id,
        uint256 indexed timestamp
    );

    /**
     * @notice Emitted when a proposal to update bond data is submitted
     * @dev Emitted by the `submitUpdateProposal` function
     * @param isin The ISIN of the bond.
     * @param currentId The ID of the current bond data associated with the ISIN
     * @param newId The ID of the proposed updated bond data
     * @param expiry The UNIX timestamp when the proposal expires
     * @param requestor The address of the entity submitting the update proposal
     */
    event BondUpdateProposed(
        bytes12 indexed isin,
        uint256 indexed currentId,
        uint256 indexed newId,
        uint256 expiry,
        address requestor
    );

    /**
     * @notice Emitted when a bond update proposal is either approved or rejected by the registrar
     * @dev Emitted by the handleUpdateProposal function
     * @param isin The ISIN of the bond
     * @param oldId The ID of the old bond data associated with the ISIN
     * @param newId The ID of the updated bond data associated with the ISIN
     * @param approver The address of the registrar who made the decision
     * @param timestamp The time when the decision was made
     * @param approved Whether the proposal was approved (`true`) or rejected (`false`)
     */
    event BondUpdateResolved(
        bytes12 indexed isin,
        uint256 indexed oldId,
        uint256 indexed newId,
        address approver,
        uint256 timestamp,
        bool approved
    );

    /**
     * @notice This event is emitted when the validity period is modified
     * @dev This event is emitted by init and setProposalValidityPeriod functions
     * @param period The validity period for proposals
     */
    event ValidityPeriodUpdated(uint256 indexed period);

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Allows the owner to grant specified `roles` to a `user`
     * @dev See {OwnableRoles::grantRoles} for more details
     * @param user The address of the user receiving the roles
     * @param roles The roles to be granted
     */
    function grantRoles(address user, uint256 roles) external payable;

    /**
     * @notice Allows the owner to grant specified `roles` to an array of `users`
     * @dev See {OwnableRolesExtension::grantRoles} for more details
     * @param users The addresses of the users receiving the roles
     * @param roles The roles to be granted
     */
    function grantRoles(
        address[] calldata users,
        uint256 roles
    ) external payable;

    /**
     * @notice Sets the validity period for proposals
     * @dev This function can only be called by the contract owner
     * @dev The period must be greater than zero
     * @param period The new period
     */
    function setProposalValidityPeriod(uint256 period) external;

    /**
     * @notice Sets the EBSI template (name, version) for a token type and stores its templateId
     * @param name Template name registered in `ProxyTemplateRegistry`
     * @param version Template version registered in `ProxyTemplateRegistry`
     * @param tokenType_ Token type to associate with this template
     */
    function setTokenTemplate(
        string calldata name,
        string calldata version,
        TokenType tokenType_
    ) external;

    /*//////////////////////////////////////////////////////////////
                            PROPOSER ROLE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Submit a proposal to register an ISIN
     * @dev Caller must have the `PROPOSER` role, otherwise the call will revert
     * @param bond A `BondInput` struct containing the bond's data
     * @param tokenType_ The type of token associated with the bond
     */
    function submitRegistrationProposal(
        BondInput calldata bond,
        TokenType tokenType_
    ) external;

    /**
     * @notice Submits a proposal to update the data of an existing bond
     * @dev If a caller does not have `PROPOSER` role the function call will fail
     * @param bond A `BondInput` struct containing the updated bond data.
     */
    function submitUpdateProposal(BondInput calldata bond) external;

    /*//////////////////////////////////////////////////////////////
                            REGISTRAR ROLE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Handles the approval or rejection of a registration proposal for a bond ISIN
     * @dev If a caller does not have `REGISTRAR` role the function call will fail
     * @param isin The ISIN of the bond being registered
     * @param status A boolean indicating the proposal's decision: `true` for approval, `false` for rejection
     */
    function handleRegistrationProposal(
        string memory isin,
        bool status
    ) external;

    /**
     * @notice Handles the approval or rejection of a update proposal for a exiting bond ISIN
     * @dev If a caller does not have `REGISTRAR` role the function call will fail
     * @param isin The ISIN of the bond being updated
     * @param status A boolean indicating the proposal's decision: `true` for approval, `false` for rejection
     */
    function handleUpdateProposal(string memory isin, bool status) external;

    /**
     * @notice Sets the allowed status for a given currency code
     * @dev Callable only by authorized roles (e.g., registrar)
     * @param currencyCode The 3-letter ISO 4217 currency code as a string (e.g., "USD", "EUR")
     * @param allowed True to allow the currency, false to disable it
     */
    function setAllowedCurrency(
        string memory currencyCode,
        bool allowed
    ) external;

    /**
     * @notice Suspends a bond, temporarily halting its operations
     * @dev If a caller does not have `REGISTRAR` role the function call will fail.
     * Once suspended, the bond cannot be interacted with until reactivated.
     * @param isin The ISIN of the bond to be suspended
     */
    function suspendBond(string memory isin) external;

    /**
     * @notice Unsuspends a bond, restoring its normal operations
     * @dev If a caller does not have `REGISTRAR` role the function call will fail.
     * Once unsuspended, the bond can be interacted with as usual.
     * @param isin The ISIN of the bond to be unsuspended
     */
    function unsuspendBond(string memory isin) external;

    /*//////////////////////////////////////////////////////////////
                            CLOSER ROLE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Closes a bond after it has been fully redeemed
     * @dev This function is called to mark the bond as closed once it has been redeemed.
     * This function can only be called by an address with the CLOSER_ROLE.
     * @param isin The ISIN of the bond to be closed
     */
    function close(string memory isin) external;

    /*//////////////////////////////////////////////////////////////
                            ISSUER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Issues a new bond for the given ISIN
     * @dev Callable only by the issuer of the bond after it has reached the `Approved` status in the registry.
     * This function calls `mint` on the token contract and updates the bond’s status to `Issued`.
     * @param isin The ISIN representing the bond
     */
    function issueBond(string memory isin) external;

    /**
     * @notice Withdraws a registration proposal identified by its ISIN
     * @dev This function allows the proposer to withdraw their pending registration proposal
     * @param isin The ISIN of the proposal to be withdrawn
     */
    function withdrawRegistrationProposal(string memory isin) external;

    /**
     * @notice Withdraws an update proposal identified by its ISIN
     * @dev This function allows the proposer to withdraw their pending update proposal
     * @param isin The ISIN of the update proposal to be withdrawn
     */
    function withdrawUpdateProposal(string memory isin) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Retrieves the bond status for the specified ISIN (string version)
     * @param isin The bond ISIN as a string
     * @return The bond status as an enum of type `BondStatus`
     */
    function bondStatus(string memory isin) external view returns (BondStatus);

    /**
     * @notice Retrieves the bond status for the specified ISIN (bytes12 version)
     * @param isin The bond ISIN as a fixed-size `bytes12` value
     * @return The bond status as an enum of type `BondStatus`
     */
    function bondStatus(bytes12 isin) external view returns (BondStatus);

    /**
     * @notice Returns the total number of bonds recorded in the system
     * @dev Increments each time a new Bond struct is created, regardless of its status
     * @return count The total number of created bonds
     */
    function counter() external view returns (uint256);

    /**
     * @notice Returns the coupon frequency for the specified ISIN
     * @param isin The bond ISIN
     * @return The number of coupon payments per year
     */
    function couponFrequency(
        string memory isin
    ) external view returns (CouponFrequency);

    /**
     * @notice Retrieves the coupon type for the specified ISIN
     * @param isin The bond ISIN
     * @return The coupon type of the bond
     */
    function couponType(string memory isin) external view returns (CouponType);

    /**
     * @notice Returns the currency code of the bond identified by the given ISIN
     * @param isin The ISIN of the bond
     * @return The 3-letter currency code (ISO 4217 format) of the bond
     */
    function currency(string memory isin) external view returns (bytes3);

    /**
     * @notice Retrieves the denomination for the specified ISIN
     * @param isin The bond ISIN
     * @return The denomination of the bond
     */
    function denomination(string memory isin) external view returns (uint256);

    /**
     * @notice Returns the current bond data for a given approved ISIN
     * @param isin The ISIN (International Securities Identification Number) of the bond.
     * @return The corresponding `Bond` data.
     */
    function getBondByIsin(bytes12 isin) external view returns (Bond memory);

    /**
     * @notice Returns the current bond data for a given approved ISIN
     * @param isin The ISIN (International Securities Identification Number) of the bond.
     * @return The corresponding `Bond` data.
     */
    function getBondByIsin(
        string memory isin
    ) external view returns (Bond memory);

    /**
     * @notice Returns specific version of bond data, identified by its internal ID
     * @param id The internal identifier of the bond version.
     * @return The corresponding `Bond` data.
     */
    function getBondById(uint256 id) external view returns (Bond memory);

    /**
     * @notice Retrieves the validity period set for proposals
     * @return The validity period as a `uint256` in seconds
     */
    function getProposalValidityPeriod() external view returns (uint256);

    /**
     * @notice Gets details about a bond registration proposal, if the proposal is not expired
     * @param isin The ISIN of the bond
     * Returns tuple:
     *     - @return uint256 bond data Id
     *     - @return uint256 proposal expiration timestamp
     *     - @return address of the requester
     */
    function getRegistrationProposal(
        string memory isin
    ) external view returns (uint256, uint256, address);

    /**
     * @notice Gets details about a bond update proposal, if the proposal is not expired
     * @param isin The bond ISIN
     * Returns tuple:
     *     - @return uint256 bond data Id
     *     - @return uint256 proposal expiration timestamp
     *     - @return address of the requester
     */
    function getUpdateProposal(
        string memory isin
    ) external view returns (uint256, uint256, address);

    /**
     * @notice Checks whether the bond with the specified ISIN is approved.
     * @dev Returns true if the bond is marked as approved in the internal registry.
     * @param isin The ISIN (International Securities Identification Number) of the bond.
     * @return True if the bond is approved, false otherwise.
     */
    function isBondApproved(string memory isin) external view returns (bool);

    /**
     * @notice Checks whether the specified currency is allowed for bond issuance
     * @dev Returns true if the currency is marked as allowed in the internal mapping
     * @param currencyCode The 3-letter ISO 4217 currency code as a string (e.g., "USD", "EUR")
     * @return True if the currency is allowed, false otherwise
     */
    function isCurrencyAllowed(
        string memory currencyCode
    ) external view returns (bool);

    /**
     * @notice Retrieves the issue date for the specified ISIN
     * @param isin The bond ISIN
     * @return The issue date of the bond
     */
    function issueDate(string memory isin) external view returns (uint256);

    /**
     * @notice Retrieves the issue volume for the specified ISIN
     * @param isin The bond ISIN
     * @return The issue volume of the bond
     */
    function issueVolume(string memory isin) external view returns (uint256);

    /**
     * @notice Retrieves the maturity date for the specified ISIN
     * @param isin The bond ISIN
     * @return The maturity date of the bond
     */
    function maturityDate(string memory isin) external view returns (uint256);

    /**
     * @notice Retrieves the address of the token contract for the specified ISIN
     * @param isin The bond ISIN
     * @return The token address of the bond
     */
    function tokenAddress(string memory isin) external view returns (address);

    /**
     * @notice Retrieves the type of the deployed token contract for the specified ISIN
     * @param isin The bond ISIN
     * @return The token type as an enumerator of type `TokenType`
     */
    function tokenType(string memory isin) external view returns (TokenType);

    /**
     * @notice Returns configured templateId for a token type
     * @param tokenType_ Token type to query
     * @return templateId Template Id
     */
    function getTokenTemplateId(
        TokenType tokenType_
    ) external view returns (bytes32 templateId);

    /**
     * @notice Retrieves the coupon rate for specified ISIN and payment interval
     * @param isin The bond ISIN
     * @param paymentInterval The payment interval ID
     * @return rate Coupon rate for the specified payment timestamp
     */
    function getCouponRateAt(
        string memory isin,
        uint256 paymentInterval
    ) external view returns (uint256 rate);

    /**
     * @notice Retrieves the coupon rate for specified ISIN and the highest previously set payment interval
     * @param isin The bond ISIN
     * @return rate Coupon rate for the highest previously set payment timestamp
     */
    function getLatestCouponRate(
        string memory isin
    ) external view returns (uint256 rate);

    /**
     * @notice Retrieves all coupon rates for specified ISIN
     * @param isin The bond ISIN
     * @return paymentIntervals Array of payment interval ID checkpoints
     * @return rates Array of rate checkpoints
     */
    function getAllCouponRates(
        string memory isin
    )
        external
        view
        returns (uint256[] memory paymentIntervals, uint256[] memory rates);

    /**
     * @notice Retrieves length of all coupon rates for specified ISIN
     * @param isin The bond ISIN
     * @return length Length of the rate checkpoints
     */
    function getCouponRatesLength(
        string memory isin
    ) external view returns (uint256 length);
}
