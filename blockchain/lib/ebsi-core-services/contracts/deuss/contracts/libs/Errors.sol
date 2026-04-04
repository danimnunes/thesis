// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

/**
 * @title Errors
 * @author DEUSS Team
 * @notice Library containing custom errors
 */
library Errors {
    /*//////////////////////////////////////////////////////////////
                                GENERAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when address is zero
    error ZeroAddress();

    /// @notice Throw an error when the roles contain at least one undefined role
    error InvalidRoles();

    /// @notice Thrown when the bytes length is invalid for expected string conversion
    error StringExtensions__InvalidBytesLength();

    /// @notice Thrown when a string contains at least one non-ASCII character
    error StringExtensions__NonAsciiCharacter();

    /*//////////////////////////////////////////////////////////////
                               DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when a deployment is attempted on an unconfigured network
    error DeployConfig__NetworkNotConfigured(uint256 chainId);

    /// @notice Throw an error when the registry is invalid
    error ProxyDeployer__InvalidRegistry(
        address registry,
        address expectedRegistry
    );

    /// @notice Throw an error when template already exists
    error ProxyDeployer__TemplateAlreadyExists(string name, string version);

    /// @notice Throw an error when template is not found
    error ProxyDeployer__TemplateNotFound(bytes32 templateId);

    /// @notice Throw an error when template is not active
    error ProxyDeployer__TemplateNotActive(string name, string version);

    /// @notice Throw an error when EBSI proxy factory is not set
    error DeployConfig__EBSIProxyFactoryNotSet();

    /// @notice Throw an error when EBSI proxy registry is not set
    error DeployConfig__EBSIProxyRegistryNotSet();

    /// @notice Throw an error when EBSI did registry is not set
    error DeployConfig__EBSIDidRegistryNotSet();

    /// @notice Throw an error when beacon FT is not set
    error DeployConfig__BeaconFTNotSet();

    /// @notice Throw an error when beacon NFT is not set
    error DeployConfig__BeaconNFTNotSet();

    /// @notice Throw an error when beacon CompanyWallet is not set
    error DeployConfig__BeaconCWNotSet();

    /// @notice Throw an error when the deployment file does not exist in ./deployments/
    error DeploymentFileNotFound();

    /*/////////////////////////////////////////////////////////////
                             BOND REGISTRY
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when bond is already exist
    error BondRegistry__ActiveProposalExists(bytes12 isin);

    /// @notice Throw an error when bond is already exist
    error BondRegistry__BondAlreadyExists(bytes12 isin);

    /// @notice Thrown when the bond was redeemed and closed
    error BondRegistry__Closed();

    /// @notice Throw an error when 'denomination' is zero
    error BondRegistry__DenominationIsZero();

    /// @notice Throw an error when `BondStatus` is invalid for performing the operation
    error BondRegistry__InvalidBondStatus(bytes12 isin);

    /// @notice Throw an error when a currency is not allowed
    error BondRegistry__InvalidCurrency();

    /// @notice Throw an error if isin is an empty string
    error BondRegistry__InvalidISIN();

    /// @notice Throw an error when 'issueDate' is less than block.timestamp
    error BondRegistry__InvalidIssueDate();

    /// @notice Throw an error when 'issueCount' is decreased after issuance
    error BondRegistry__IssueCountCannotBeDecreased();

    /// @notice Throw an error when 'issueVolume' is zero
    error BondRegistry__IssueCountIsZero();

    /// @notice Throw an error when 'issueDate' is more than maturity
    error BondRegistry__IssueDateAfterMaturity();

    /// @notice Throw an error when 'issueDate' is modified after issuance
    error BondRegistry__IssueDateImmutableAfterIssuance();

    /// @notice Throw an error when `bondIssue` ia called before issue date
    error BondRegistry__IssueDateInFuture();

    /// @notice Throw an error when 'issueVolume' is reduced after issuance
    error BondRegistry__IssueVolumeCannotBeReduced();

    /// @notice Throw an error when 'maturityDate' is shortened after issuance
    error BondRegistry__MaturityDateCannotBeShortened();

    /// @notice Throw an error when `bondIssue` is called after maturity date
    error BondRegistry__MaturityDateExpired();

    /// @notice Throw an error when bond does not exist
    error BondRegistry__NonExistentBond(bytes12 isin);

    /// @notice Throw an error when there is no proposal for ISIN
    error BondRegistry__NonExistentProposal(bytes12 isin);

    /// @notice Throw an error when a proposal has already expired
    error BondRegistry__ProposalExpired(
        uint256 expiry,
        uint256 currentTimestamp
    );

    /// @notice Throw an error when bond is already exist
    error BondRegistry__ProposalInCooldown(bytes12 isin);

    /// @notice Throw an error when the token address of the deployed bond is zero
    error BondRegistry__TokenAddressZero();

    /// @notice Throw an error when `validityPeriod` is set to zero
    error BondRegistry__ValidityPeriodIsZero();

    /// @notice Throw an error when caller is not authorized to perform the operation
    error BondRegistry__Unauthorized(address sender);

    /// @notice Throw an error when the `couponRates` arrays contain different lengths
    error BondRegistry__CouponRatesLengthMismatch();

    /// @notice Throw an error if the `couponRates`.`paymentIntervals` array is not ordered ASC
    error BondRegistry__PaymentIntervalsUnordered();

    /// @notice Throw an error if the first payment interval is zero
    error BondRegistry__PaymentIntervalZero();

    /// @notice Throw an error if the last coupon rate is not zero
    error BondRegistry__CouponRatesLastRateNotZero();

    /// @notice Throw an error if the coupon type is fixed but the coupon rates are not of length 2
    error BondRegistry__CouponRatesUnexpectedLength();

    /// @notice Throw an error if any of the coupon rates are duplicated
    error BondRegistry__CouponRatesDuplicate();

    /*//////////////////////////////////////////////////////////////
                              DEUSS TOKEN
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when the caller is not the bond registry
    error Token__CallerNotBondRegistry(address caller);

    /// @notice Throw an error when the transfer cannot be executed because the wallet is frozen
    error Token__WalletIsFrozen();

    /// @notice Throw an error when the address balance is insufficient to execute the transfer
    error Token__InsufficientBalance();

    /// @notice Throw an error when array length is zero or array lengths are not equal
    error Token__InvalidArrayLength();

    /// @notice Throw an error when the bond status is not 'deployed'
    error Token__InvalidBondStatus();

    /// @notice Throw an error when the operation is executed after the maturity date
    error Token__MaturityExpired();

    /// @notice Throw an error when the amount is zero
    error Token__ZeroAmount();

    /// @notice Throw an error when it mints more tokens than 'issueVolume / denomination'
    error Token__MintExceedsMaxSupply();

    /// @notice Throw an error when it unfreezes more tokens than there is amount of frozen tokens
    error Token__InsufficientFrozenTokens();

    /// @notice Throw an error when NFT token is already frozen
    error Token__TokenAlreadyFrozen(uint256 id);

    /// @notice Throw an error when NFT token is already unfrozen
    error Token__TokenAlreadyUnfrozen(uint256 id);

    /// @notice Throw an error if the token contract is paused
    error Token__Paused();

    /// @notice Throw an error if the token contract is not paused
    error Token__NotPaused();

    /// @notice Throw an error if the batch transfer is not supported
    error Token__BatchTransferFromNotSupported();

    /// @notice Throw an error when id is invalid
    error Token__InvalidTokenId(uint256 id);

    /// @notice Throw an error when 'value' is zero or 'value' is not divisible by 'denomination'
    error Token__InvalidValue(uint256 value);

    /// @notice Throw an error when the address balance is insufficient to execute the transfer
    error Token__InsufficientUnfrozenBalance();

    /// @notice Throw an error when you try to approve from a nonzero allowance to another nonzero value without resetting to zero first
    error Token__ApproveNonZeroToNonZero();

    /// @notice Throw an error when a token is frozen and `force` is disabled
    error Token__Frozen(uint256 id);

    /*//////////////////////////////////////////////////////////////
                              BASE FACTORY
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when a call is not coming from
    /// a parent factory
    error NotParentFactory(address caller);

    /*//////////////////////////////////////////////////////////////
                             PROXY DEPLOYER
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when string is empty
    error EmptyString();

    /*//////////////////////////////////////////////////////////////
                           INTEREST DISCOVERY
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when the dispute buffer period is too high
    error InterestDiscovery__DisputeBufferPeriodTooHigh();

    /// @notice Throw an error when the expiry threshold is too low
    error InterestDiscovery__PaymentExpiryThresholdTooLow(
        uint256 expiryThreshold
    );

    /// @notice Throw an error when the policy ID already exists
    error InterestDiscovery__PolicyIdAlreadyExists(uint256 policyId);

    /// @notice Throw an error when the policy ID does not exist
    error InterestDiscovery__PolicyIdDoesNotExist(uint256 policyId);

    /// @notice Throw an error when the policy ID is invalid
    error InterestDiscovery__InvalidPolicyId(uint256 policyId);

    /// @notice Throw an error when the caller is not authorized
    error InterestDiscovery__NotAuthorized(address sender);

    /// @notice Throw an error when the offer has expired
    error InterestDiscovery__OfferExpired(
        uint256 expiry,
        uint256 currentTimestamp
    );

    /// @notice Throw an error when the counter offer has expired
    error InterestDiscovery__CounterOfferExpired(
        uint256 expiry,
        uint256 currentTimestamp
    );

    /// @notice Throw an error when the amount is zero
    error InterestDiscovery__ZeroAmount();

    /// @notice Throw an error when the lot size is too large
    error InterestDiscovery__LotSizeTooLarge();

    /// @notice Throw an error when the total amount is not a multiple of the lot size
    error InterestDiscovery__TotalAmountNotMultipleOfLot();

    /// @notice Throw an error when the price is zero
    error InterestDiscovery__ZeroPrice();

    /// @notice Throw an error when the currency is invalid
    error InterestDiscovery__InvalidCurrency(bytes3 currency);

    /// @notice Throw an error when the currency already exists
    error InterestDiscovery__CurrencyAlreadyExists(bytes3 currency);

    /// @notice Throw an error when the currency does not exist
    error InterestDiscovery__CurrencyDoesNotExist(bytes3 currency);

    /// @notice Throw an error when the bond status is invalid
    error InterestDiscovery__BondInvalidStatus(bytes12 isin, uint8 status);

    /// @notice Throw an error when the expiry is invalid
    error InterestDiscovery__InvalidExpiry(uint256 expiry, uint256 timestamp);

    /// @notice Throw an error when the deal status is invalid
    error InterestDiscovery__InvalidStatus(uint8 status);

    /// @notice Throw an error when the deal type is invalid
    error InterestDiscovery__InvalidDealType(uint8 dealType);

    /// @notice Throw an error when the deal is not expired
    error InterestDiscovery__DealNotExpired();

    /// @notice Throw an error when the dispute period has expired
    error InterestDiscovery__DisputePeriodExpired();

    /// @notice Throw an error when the deal is not in dispute
    error InterestDiscovery__DealNotInDispute();

    /// @notice Throw an error when the dispute period has not expired
    error InterestDiscovery__DisputePeriodNotExpired();

    /// @notice Throw an error when the available amount is insufficient
    error InterestDiscovery__InsufficientAvailableAmount(
        uint256 amount,
        uint256 available
    );

    /// @notice Throw an error when the amount is not a multiple of the lot size
    error InterestDiscovery__AmountNotMultipleOfLot(
        uint256 lot,
        uint256 amount
    );

    /// @notice Throw an error when the number of operators exceeds the maximum allowed
    error InterestDiscovery__OperatorsLengthExceeded();

    /// @notice Throw an error when the address is this contract
    error InterestDiscovery__SelfAddress();

    /// @notice Throw an error when the sender is the owner of the offer
    error InterestDiscovery__SenderIsOwner();

    /// @notice Throw an error when counter offers are not allowed for the offer
    error InterestDiscovery__CounterOffersNotAllowed();

    /// @notice Throw an error when the user has reached the counter offer limit for an offer
    error InterestDiscovery__CounterOfferLimitReached();

    /*//////////////////////////////////////////////////////////////
                            ESCROW MANAGER
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw an error when amount is zero
    error EscrowManager__ZeroAmount();

    /// @notice Throw an error when address parameter is zero address
    error EscrowManager__ZeroAddress();

    /// @notice Throw an error when caller is not authorized to perform the operation
    error EscrowManager__NotAuthorized();

    /// @notice Throw an error when trying to create an escrow that already exists
    error EscrowManager__EscrowAlreadyExists();

    /// @notice Throw an error when trying to withdraw with insufficient balance
    error EscrowManager__InsufficientBalance();

    /// @notice Thrown when a token transfer from or to the EscrowManager fails
    error EscrowManager__TokensTransferFailed();

    /*//////////////////////////////////////////////////////////////
                             COMPANY WALLET REGISTRY
    //////////////////////////////////////////////////////////////*/
    /// @notice Throw an error when a companyWalletOwner  is registered
    error CWR__AlreadyRegistered();

    /// @notice Throw an error when a companyWalletOwner is not registered
    error CWR__Unregistered();

    /// @notice Throw an error when `CompanyWallet` contract has been disabled
    error CWR__AlreadyDisabled();

    /// @notice Throw an error when `CompanyWallet` contract is not suspended
    error CWR__NotDisabled();

    /// @notice Throw an error when caller is not `CompanyWalletRegistry` contract
    error CWR__NotRegistry(address sender);

    // @notice Throw an error when `CompanyWallet` contract is suspended
    error CWR__Disabled();

    /// @notice Throw an error when there is already approved transfer for `CompanyWallet` contract
    error CWR__ApprovalAlreadyExists();

    /// @notice Throw an error when there is no approved transfer for `CompanyWallet` contract
    error CWR__NonexistentApproval();

    /// @notice Throw an error when the new owner is not approved for the transfer of ownership
    /// signature: 0x01194ad5
    error CWR__NotApprovedOwner(address owner);

    /// @notice Thrown when the contract deployment fails
    error CWR__CompanyWalletDeploymentFailed();

    /// @notice Thrown when the deployed company wallet is zero address
    error CWR__CompanyWalletAddressZero();

    /// @notice Thrown when a user tries to request a transfer of ownership that is already pending
    /// signature: 0x28574aad
    error CWR__TransferAlreadyRequested();

    /// @notice Thrown when a ownership transfer request of a companyWallet contract has not been created
    /// signature: 0x1e7631fd
    error CWR__TransferNotRequested();

    /// @notice Thrown when user tries to finalize transfer of ownership without admin approval
    /// signature: 0x6307792c
    error CWR__TransferNotApproved();

    /// @notice Thrown when admin tries to re-approve a transfer of ownership that is already approved
    /// signature: 0xbb35fd43
    error CWR__AlreadyApproved();

    /// @notice Thrown when admin tries to re-reject a transfer of ownership that is already rejected
    /// signature: 0x1ad03c42
    error CWR__AlreadyRejected();

    /*//////////////////////////////////////////////////////////////
                             COMPANY WALLET
    //////////////////////////////////////////////////////////////*/
    /// @notice Throw an error when address is not contract
    error CompanyWallet__NotContract(address addr);

    /// @notice Throw an error when a selector is zero
    error CompanyWallet__ZeroSelector();

    /// @notice Throw an error when an operation is already granted to all roles
    error CompanyWallet__OperationAlreadyGrantedToAllRoles();

    /// @notice Throw an error when an operation is already revoked to all roles
    error CompanyWallet__OperationAlreadyRevokedForAllRoles();

    /// @notice Throw an error when the operation target is the zero address, not a contract, or the same as the caller contract
    error CompanyWallet__InvalidCallTarget();

    /// @notice Throw an error when there is a mismatch between msq value and the operation value
    error CompanyWallet__MsgValueMismatch();

    /// @notice Throw an error when the signer is wrong
    error CompanyWallet__InvalidSigner(address operationFrom, address signer);

    /// @notice Throw an error when the call data is too short
    error CompanyWallet__InvalidCallData();

    /// @notice Throw an error when the sender is unauthorized to execute operation
    error CompanyWallet__Unauthorized();
}
