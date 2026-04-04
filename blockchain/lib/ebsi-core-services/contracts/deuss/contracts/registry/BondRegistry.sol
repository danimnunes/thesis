// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Initializable} from "solady/src/utils/Initializable.sol";
import {OwnableRolesExtension} from "../utils/OwnableRolesExtension.sol";
import {ReentrancyGuard} from "solady/src/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "solady/src/utils/UUPSUpgradeable.sol";
// DEUSS:
import {AddressExtensions} from "../libs/AddressExtensions.sol";
import {StringExtensions} from "../libs/StringExtensions.sol";
import {BondRegistryStorage} from "./BondRegistryStorage.sol";
import {
    Bond,
    BondInput,
    BondProposal,
    BondStatus,
    CouponFrequency,
    TokenType,
    CouponRates,
    CouponType
} from "./BondStructs.sol";
import {ProxyDeployer} from "../deployer/ProxyDeployer.sol";
import {Errors} from "../libs/Errors.sol";
import {IBondRegistry} from "./IBondRegistry.sol";
import {IBaseToken} from "../token/base/IBaseToken.sol";

// slither-disable-start uninitialized-state
// @todo @dev slither detect muliple uninitialized-state-variables in this contract due to the following error during compilation:
//    ERROR:ContractSolcParsing:Impossible to generate IR for CompanyWalletRegistry.registerCompanyWallet (src/wallet/registry/CompanyWalletRegistry.sol#53-80):
//    'NoneType' object has no attribute 'parameters'
//    ERROR:ContractSolcParsing:Impossible to generate IR for CompanyWalletRegistry.setBondRegistry (src/wallet/registry/CompanyWalletRegistry.sol#83-89):
//    'NoneType' object has no attribute 'parameters'
//    ...
// thus we disable the uninitialized-state-variables check temporarily until the issue is fixed/resolved
/**
 * @title BondRegistry
 * @author DEUSS Team
 * @notice This contract manages the bond registry, including bond proposals, approvals, issuances, and status updates
 */
contract BondRegistry is
    IBondRegistry,
    BondRegistryStorage,
    ProxyDeployer,
    Initializable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using AddressExtensions for address;
    using StringExtensions for string;

    /// @notice Role for making bond proposals
    uint256 public constant PROPOSER_ROLE = _ROLE_0;

    /// @notice Role for approving/rejecting bond proposals
    uint256 public constant REGISTRAR_ROLE = _ROLE_1;

    /// @notice Role for closing bonds
    uint256 public constant CLOSER_ROLE = _ROLE_2;

    /**
     * @notice Locks any future initializations or reinitializations
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initiates the bond registry contract
     * @dev The owner of the smart contract is set by deployer
     * @param owner_ The address owner of this contract
     * @param validityPeriod The validity period for a proposal
     */
    function initialize(
        address owner_,
        uint256 validityPeriod
    ) external initializer {
        __BondRegistry_init(owner_, validityPeriod);
    }

    /*//////////////////////////////////////////////////////////////
                             MAIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    // @todo DISCUSS: What is the expected behavior of the token contract when the ISIN is closed?
    /**
     * @inheritdoc IBondRegistry
     */
    function close(string calldata isin) external onlyRoles(CLOSER_ROLE) {
        bytes12 isinBytes = isin._isinToBytes12();

        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        Bond storage bond = _bonds[id];

        if (bond.status == BondStatus.Redeemed) {
            revert Errors.BondRegistry__Closed();
        }

        bond.status = BondStatus.Redeemed;

        bond.updatedAt = block.timestamp;

        emit BondRedeemed(isinBytes, id, msg.sender, block.timestamp);
    }

    // solhint-disable function-max-lines
    /**
     * @inheritdoc IBondRegistry
     */
    function handleRegistrationProposal(
        string calldata isin,
        bool approved
    ) external onlyRoles(REGISTRAR_ROLE) nonReentrant {
        bytes12 isinBytes = isin._isinToBytes12();

        BondProposal storage proposal = _registrationProposals[isinBytes];
        uint256 id = proposal.id;

        _validateProposal(id, proposal.expiry, isinBytes);

        // remove proposal
        delete _registrationProposals[isinBytes];

        Bond storage bond = _bonds[id];
        bond.updatedAt = block.timestamp;

        // slither-disable-next-line uninitialized-local
        address deployedTokenAddr;
        // if the new bond is approved
        if (approved) {
            _approvedBonds[isinBytes] = id;
            bond.status = BondStatus.Approved;
            TokenType tokenType_ = bond.tokenType;

            // Build init data without selector; factory will prepend template's initSelector
            bytes memory initData = abi.encode(
                owner(),
                address(this),
                isinBytes
            );

            // Choose template id based on token type
            // slither-disable-next-line incorrect-equality
            bytes32 templateId =
                tokenType_ == TokenType.ERC6909FT
                    ? _templateIdFT
                    : _templateIdNFT;

            // Deploy via EBSI ProxyFactory through ProxyDeployer
            deployedTokenAddr = _deployProxy(templateId, initData);

            if (deployedTokenAddr == address(0)) {
                revert Errors.BondRegistry__TokenAddressZero();
            }

            bond.tokenAddress = deployedTokenAddr;
        } else {
            bond.status = BondStatus.Rejected;
        }

        emit BondRegistrationResolved(
            isinBytes,
            id,
            msg.sender,
            block.timestamp,
            deployedTokenAddr,
            approved
        );
    }

    // solhint-enable function-max-lines

    /**
     * @inheritdoc IBondRegistry
     */
    function handleUpdateProposal(
        string calldata isin,
        bool approved
    ) external onlyRoles(REGISTRAR_ROLE) {
        bytes12 isinBytes = isin._isinToBytes12();

        BondProposal storage proposal = _updateProposals[isinBytes];
        uint256 newId = proposal.id;

        _validateProposal(newId, proposal.expiry, isinBytes);

        // remove proposal
        delete _updateProposals[isinBytes];

        uint256 oldId = _approvedBonds[isinBytes];

        Bond storage oldBond = _bonds[oldId];

        if (
            oldBond.status != BondStatus.Approved &&
            oldBond.status != BondStatus.Issued
        ) {
            revert Errors.BondRegistry__InvalidBondStatus(isinBytes);
        }

        Bond storage newBond = _bonds[newId];
        newBond.updatedAt = block.timestamp;

        if (approved) {
            newBond.tokenAddress = oldBond.tokenAddress;
            newBond.status = oldBond.status;
            _approvedBonds[isinBytes] = newId;

            oldBond.status = BondStatus.Replaced;
            oldBond.updatedAt = block.timestamp;
        } else {
            newBond.status = BondStatus.Rejected;
        }

        emit BondUpdateResolved(
            isinBytes,
            oldId,
            newId,
            msg.sender,
            block.timestamp,
            approved
        );
    }

    // @todo DISCUSS: If the issue count (issueVolume / denomination) changes after issuance via `handleUpdateProposal`, should we allow minting additional tokens?
    /**
     * @inheritdoc IBondRegistry
     */
    function issueBond(string calldata isin) external {
        bytes12 isinBytes = isin._isinToBytes12();

        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        Bond storage bond = _bonds[id];

        if (bond.status != BondStatus.Approved) {
            revert Errors.BondRegistry__InvalidBondStatus(isinBytes);
        }

        if (bond.issueDate > block.timestamp) {
            revert Errors.BondRegistry__IssueDateInFuture();
        }

        if (!(bond.maturityDate > block.timestamp)) {
            revert Errors.BondRegistry__MaturityDateExpired();
        }

        bond.status = BondStatus.Issued;
        bond.updatedAt = block.timestamp;
        uint256 tokenQuantity = bond.issueVolume / bond.denomination;

        IBaseToken(bond.tokenAddress).unpause();
        IBaseToken(bond.tokenAddress).mint(bond.issuer, tokenQuantity);

        emit BondIssued(isinBytes, id, tokenQuantity, block.timestamp);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function setAllowedCurrency(
        string calldata currencyCode,
        bool allowed
    ) external onlyRoles(REGISTRAR_ROLE) {
        bytes3 currencyBytes = currencyCode._currencyToBytes3();

        _allowedCurrencies[currencyBytes] = allowed;

        emit AllowedCurrencyUpdated(currencyBytes, allowed, msg.sender);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function submitRegistrationProposal(
        BondInput calldata bondInput,
        TokenType tokenType_
    ) external onlyRoles(PROPOSER_ROLE) {
        bytes12 isinBytes = bondInput.isin._isinToBytes12();

        if (_approvedBonds[isinBytes] != 0) {
            revert Errors.BondRegistry__BondAlreadyExists(isinBytes);
        }

        BondProposal storage proposal = _registrationProposals[isinBytes];

        if (proposal.id != 0) {
            _validateProposalWindow(proposal.expiry, isinBytes);
        }

        _validateBasicBondInput(bondInput, true);

        // pre-increment counter, the lowest id value is 1
        uint256 newId = ++_counter;

        _createBond(isinBytes, newId, bondInput, tokenType_);

        proposal.id = newId;
        proposal.expiry = block.timestamp + _validityPeriod;
        proposal.requestor = msg.sender;

        emit BondProposed(isinBytes, newId, proposal.expiry, msg.sender);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function submitUpdateProposal(
        BondInput calldata bondInput
    ) external onlyRoles(PROPOSER_ROLE) {
        // check only issuer
        bytes12 isinBytes = bondInput.isin._isinToBytes12();
        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        Bond memory bond = _bonds[id];

        if (
            bond.status != BondStatus.Approved &&
            bond.status != BondStatus.Issued
        ) {
            revert Errors.BondRegistry__InvalidBondStatus(isinBytes);
        }

        if (bond.issuer != msg.sender) {
            revert Errors.BondRegistry__Unauthorized(msg.sender);
        }

        BondProposal storage proposal = _updateProposals[isinBytes];

        if (proposal.id != 0) {
            _validateProposalWindow(proposal.expiry, isinBytes);
        }

        _validateBondUpdateInput(id, bondInput);

        uint256 newId = ++_counter;

        _createNewBondVersion(id, newId, bondInput);

        proposal.id = newId;
        proposal.expiry = block.timestamp + _validityPeriod;
        proposal.requestor = msg.sender;

        emit BondUpdateProposed(
            isinBytes,
            id,
            newId,
            proposal.expiry,
            msg.sender
        );
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function suspendBond(
        string calldata isin
    ) external onlyRoles(REGISTRAR_ROLE) {
        bytes12 isinBytes = isin._isinToBytes12();

        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        Bond storage bond = _bonds[id];

        BondStatus oldStatus = bond.status;
        if (
            oldStatus != BondStatus.Approved && oldStatus != BondStatus.Issued
        ) {
            revert Errors.BondRegistry__InvalidBondStatus(isinBytes);
        }

        _preSuspensionStatus[isinBytes] = oldStatus;
        bond.status = BondStatus.Suspended;

        bond.updatedAt = block.timestamp;

        if (oldStatus == BondStatus.Issued) {
            IBaseToken(bond.tokenAddress).pause();
        }

        emit BondSuspended(isinBytes, id, msg.sender, block.timestamp, true);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function unsuspendBond(
        string calldata isin
    ) external onlyRoles(REGISTRAR_ROLE) {
        bytes12 isinBytes = isin._isinToBytes12();

        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        Bond storage bond = _bonds[id];

        if (bond.status != BondStatus.Suspended) {
            revert Errors.BondRegistry__InvalidBondStatus(isinBytes);
        }

        BondStatus previousStatus = _preSuspensionStatus[isinBytes];
        bond.status = previousStatus;
        bond.updatedAt = block.timestamp;

        // @dev: slither detects incorrect-equality below. However, it does not make sense since at all.
        // slither-disable-next-line incorrect-equality
        if (bond.status == BondStatus.Issued) {
            IBaseToken(bond.tokenAddress).unpause();
        }

        emit BondSuspended(isinBytes, id, msg.sender, block.timestamp, false);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function withdrawRegistrationProposal(string calldata isin) external {
        _withdrawProposal(isin, true);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function withdrawUpdateProposal(string calldata isin) external {
        _withdrawProposal(isin, false);
    }

    // @todo we need to discuss MAX_VALIDITY_PERIOD to prevent it from being set to an unreasonable value, such as type(uint256).max
    /**
     * @inheritdoc IBondRegistry
     */
    function setProposalValidityPeriod(uint256 period) external onlyOwner {
        _setProposalValidityPeriod(period);
    }

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
    ) external onlyOwner {
        bytes32 templateId = addTemplateConfig(name, version);

        if (tokenType_ == TokenType.ERC6909FT) {
            _templateIdFT = templateId;
        }

        if (tokenType_ == TokenType.ERC6909NFT) {
            _templateIdNFT = templateId;
        }
    }

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IBondRegistry
     */
    function bondStatus(
        string calldata isin
    ) external view returns (BondStatus) {
        Bond memory bond = getBondByIsin(isin);

        return bond.status;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function bondStatus(bytes12 isinBytes) external view returns (BondStatus) {
        uint256 id = _approvedBonds[isinBytes];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isinBytes);
        }

        return _bonds[id].status;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function counter() external view returns (uint256) {
        return _counter;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function couponFrequency(
        string calldata isin
    ) external view returns (CouponFrequency) {
        Bond memory bond = getBondByIsin(isin);

        return bond.couponFrequency;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function couponType(
        string calldata isin
    ) external view returns (CouponType) {
        Bond memory bond = getBondByIsin(isin);

        return bond.couponType;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function currency(string calldata isin) external view returns (bytes3) {
        Bond memory bond = getBondByIsin(isin);

        return bond.currency;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function denomination(
        string calldata isin
    ) external view returns (uint256) {
        Bond memory bond = getBondByIsin(isin);

        return bond.denomination;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getProposalValidityPeriod() external view returns (uint256) {
        return _validityPeriod;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getRegistrationProposal(
        string calldata isin
    ) external view returns (uint256, uint256, address) {
        bytes12 isinBytes = isin._isinToBytes12();
        BondProposal storage proposal = _registrationProposals[isinBytes];

        _validateProposal(proposal.id, proposal.expiry, isinBytes);

        return (proposal.id, proposal.expiry, proposal.requestor);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getUpdateProposal(
        string calldata isin
    ) external view returns (uint256, uint256, address) {
        bytes12 isinBytes = isin._isinToBytes12();
        BondProposal storage proposal = _updateProposals[isinBytes];

        _validateProposal(proposal.id, proposal.expiry, isinBytes);

        return (proposal.id, proposal.expiry, proposal.requestor);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function isBondApproved(string calldata isin) external view returns (bool) {
        bytes12 isinBytes = isin._isinToBytes12();
        return _approvedBonds[isinBytes] != 0;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function issueDate(string calldata isin) external view returns (uint256) {
        Bond memory bond = getBondByIsin(isin);

        return bond.issueDate;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function issueVolume(string calldata isin) external view returns (uint256) {
        Bond memory bond = getBondByIsin(isin);

        return bond.issueVolume;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function maturityDate(
        string calldata isin
    ) external view returns (uint256) {
        Bond memory bond = getBondByIsin(isin);

        return bond.maturityDate;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function tokenAddress(
        string calldata isin
    ) external view returns (address) {
        Bond memory bond = getBondByIsin(isin);

        return bond.tokenAddress;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function tokenType(string calldata isin) external view returns (TokenType) {
        Bond memory bond = getBondByIsin(isin);

        return bond.tokenType;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getAllCouponRates(
        string calldata isin
    )
        external
        view
        returns (uint256[] memory paymentIntervals, uint256[] memory rates)
    {
        Bond memory bond = getBondByIsin(isin);

        return (bond.couponRates.paymentIntervals, bond.couponRates.rates);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getCouponRatesLength(
        string calldata isin
    ) external view returns (uint256 length) {
        Bond memory bond = getBondByIsin(isin);

        return bond.couponRates.paymentIntervals.length;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getCouponRateAt(
        string calldata isin,
        uint256 paymentInterval
    ) external view returns (uint256 rate) {
        Bond memory bond = getBondByIsin(isin);

        uint256 left = 0;
        uint256 right = bond.couponRates.paymentIntervals.length;

        // binary search the highest item that is <= `paymentInterval`
        while (left < right) {
            uint256 mid = left + (right - left) / 2;
            if (!(bond.couponRates.paymentIntervals[mid] > paymentInterval)) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        return left != 0 ? bond.couponRates.rates[left - 1] : 0;
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getLatestCouponRate(
        string calldata isin
    ) external view returns (uint256 rate) {
        Bond memory bond = getBondByIsin(isin);
        uint256 length = bond.couponRates.rates.length;

        if (length < 2) {
            return 0;
        }

        // length-1 always contains 0 value representing the outer edge of the coupon validity (e.g. "13th month and forward, rate is 0")
        // length-2 is the last non-zero value
        return bond.couponRates.rates[length - 2];
    }

    /**
     * @notice Returns configured templateId for a token type
     * @param tokenType_ Token type (FT or NFT)
     * @return templateId The templateID associated with the token type
     */
    function getTokenTemplateId(
        TokenType tokenType_
    ) external view returns (bytes32 templateId) {
        if (tokenType_ == TokenType.ERC6909FT) {
            templateId = _templateIdFT;
        }

        if (tokenType_ == TokenType.ERC6909NFT) {
            templateId = _templateIdNFT;
        }
    }

    /*//////////////////////////////////////////////////////////////
                         PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IBondRegistry
     */
    function grantRoles(
        address user,
        uint256 roles
    ) public payable override(IBondRegistry, OwnableRolesExtension) onlyOwner {
        if (roles & ~(PROPOSER_ROLE | REGISTRAR_ROLE | CLOSER_ROLE) != 0) {
            revert Errors.InvalidRoles();
        }

        super.grantRoles(user, roles);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function grantRoles(
        address[] calldata users,
        uint256 roles
    ) public payable override(IBondRegistry, OwnableRolesExtension) onlyOwner {
        if (roles & ~(PROPOSER_ROLE | REGISTRAR_ROLE | CLOSER_ROLE) != 0) {
            revert Errors.InvalidRoles();
        }

        super.grantRoles(users, roles);
    }

    /*//////////////////////////////////////////////////////////////
                         PUBLIC VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IBondRegistry
     */
    function getBondByIsin(
        string memory isin
    ) public view returns (Bond memory) {
        bytes12 isinBytes = isin._isinToBytes12();

        return getBondByIsin(isinBytes);
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getBondByIsin(bytes12 isin) public view returns (Bond memory) {
        uint256 id = _approvedBonds[isin];

        if (id == 0) {
            revert Errors.BondRegistry__NonExistentBond(isin);
        }

        return _bonds[id];
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function getBondById(uint256 id) public view returns (Bond memory) {
        return _bonds[id];
    }

    /**
     * @inheritdoc IBondRegistry
     */
    function isCurrencyAllowed(
        string memory currencyCode
    ) public view returns (bool) {
        bytes3 currencyBytes = currencyCode._currencyToBytes3();

        return _allowedCurrencies[currencyBytes];
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public pure override returns (bool) {
        return
            interfaceId == type(IBondRegistry).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Authorizes an upgrade for the contract.
     * @param newImplementation The address of the new implementation contract.
     * @dev Only callable by the contract owner.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {} // solhint-disable-line no-empty-blocks

    /**
     * @notice Initializes the contract with owner and validity period
     * @param owner_ The address that will own the contract
     * @param validityPeriod The validity period for a proposal
     */
    function __BondRegistry_init(
        address owner_,
        uint256 validityPeriod
    ) internal onlyInitializing {
        // solhint-disable-line func-name-mixedcase
        _initializeOwner(msg.sender);

        _setProposalValidityPeriod(validityPeriod);

        transferOwnership(owner_);
    }

    /**
     * @notice Updates the validity period for proposal
     * @param period The new period
     */
    function _setProposalValidityPeriod(uint256 period) internal {
        if (period == 0) {
            revert Errors.BondRegistry__ValidityPeriodIsZero();
        }

        _validityPeriod = period;

        emit ValidityPeriodUpdated(period);
    }

    /*//////////////////////////////////////////////////////////////
                           PRIVATE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize and store a new bond struct
     * @dev Populates the bond data for the given ID and ISIN using the provided input.
     *      Sets default status to `Proposed` and issuer to `msg.sender`.
     * @param isin The 12-character ISIN identifier (converted to `bytes12`)
     * @param id The unique bond ID assigned by the registry
     * @param input Struct containing input parameters for the bond (e.g., coupon rate, denomination)
     * @param tokenType_ The type of token representing the bond
     */
    function _createBond(
        bytes12 isin,
        uint256 id,
        BondInput memory input,
        TokenType tokenType_
    ) private {
        Bond storage bond = _bonds[id];

        bond.isin = isin;
        bond.issuer = msg.sender;
        bond.status = BondStatus.Proposed;
        bond.tokenType = tokenType_;
        bond.couponFrequency = input.couponFrequency;
        bond.currency = input.currency._currencyToBytes3();
        bond.denomination = input.denomination;
        bond.issueVolume = _computeIssueVolume(
            input.issueCount,
            input.denomination
        );
        bond.couponRates = input.couponRates;
        bond.couponType = input.couponType;
        bond.issueDate = input.issueDate;
        bond.maturityDate = input.maturityDate;
        bond.updatedAt = block.timestamp;
    }

    /**
     * @notice Creates a new version of an existing bond with updated metadata
     * @dev Copies immutable fields from the original bond and applies new input fields.
     *      Sets the bond status to `Proposed` and updates the `updatedAt` timestamp.
     * @param id The ID of the existing bond to copy from
     * @param newId The new unique bond ID to assign to the updated version
     * @param input The updated bond input fields (frequency, currency, coupon info, etc.)
     */
    function _createNewBondVersion(
        uint256 id,
        uint256 newId,
        BondInput memory input
    ) private {
        Bond storage bond = _bonds[id];
        Bond storage newBond = _bonds[newId];

        newBond.isin = bond.isin;
        newBond.issuer = bond.issuer;
        newBond.status = BondStatus.Proposed;
        newBond.tokenType = bond.tokenType;
        newBond.couponFrequency = input.couponFrequency;
        newBond.currency = input.currency._currencyToBytes3();
        newBond.denomination = input.denomination;
        newBond.issueVolume = _computeIssueVolume(
            input.issueCount,
            input.denomination
        );
        newBond.couponRates = input.couponRates;
        newBond.couponType = input.couponType;
        newBond.issueDate = input.issueDate;
        newBond.maturityDate = input.maturityDate;
        newBond.updatedAt = block.timestamp;
    }

    /**
     * @notice Withdraw a bond proposal (registration or update)
     * @param isin The ISIN of the bond
     * @param isRegistration True if withdrawing a registration proposal, false for update proposal
     */
    function _withdrawProposal(
        string memory isin,
        bool isRegistration
    ) private {
        bytes12 isinBytes = isin._isinToBytes12();

        BondProposal storage proposal =
            isRegistration
                ? _registrationProposals[isinBytes]
                : _updateProposals[isinBytes];

        uint256 id = proposal.id;

        _validateProposal(id, proposal.expiry, isinBytes);

        Bond storage bond = _bonds[id];

        if (bond.issuer != msg.sender) {
            revert Errors.BondRegistry__Unauthorized(msg.sender);
        }

        bond.status = BondStatus.Withdrawn;
        bond.updatedAt = block.timestamp;

        if (isRegistration) {
            delete _registrationProposals[isinBytes];
            emit BondRegistrationProposalWithdrawn(
                isinBytes,
                id,
                block.timestamp
            );
        } else {
            delete _updateProposals[isinBytes];
            emit BondUpdateProposalWithdrawn(isinBytes, id, block.timestamp);
        }
    }

    /*//////////////////////////////////////////////////////////////
                         PRIVATE VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validates whether a proposal is active
     * @dev Reverts if the proposal does not exist or has already expired
     * @param id Identifier of a proposal
     * @param expiry The expiry timestamp of the proposal
     * @param isin The ISIN used to identify the bond proposal
     */
    function _validateProposal(
        uint256 id,
        uint256 expiry,
        bytes12 isin
    ) private view {
        if (id == 0) {
            revert Errors.BondRegistry__NonExistentProposal(isin);
        }

        // slither-disable-next-line timestamp
        if (!(expiry > block.timestamp)) {
            revert Errors.BondRegistry__ProposalExpired(
                expiry,
                block.timestamp
            );
        }
    }

    /**
     * @notice Validates the timing window for submitting a new bond proposal
     * @dev Reverts if an active or cooling-down proposal already exists for the given ISIN
     * @param expiry The expiry timestamp of the previous proposal
     * @param isin The ISIN used to identify the bond proposal
     */
    function _validateProposalWindow(
        uint256 expiry,
        bytes12 isin
    ) private view {
        // slither-disable-next-line timestamp
        if (expiry > block.timestamp) {
            revert Errors.BondRegistry__ActiveProposalExists(isin);
        }

        // slither-disable-next-line timestamp
        if (expiry + COOLDOWN_PERIOD > block.timestamp) {
            revert Errors.BondRegistry__ProposalInCooldown(isin);
        }
    }

    /**
     * @notice Validates the input arguments to record proposal to register new bond
     * @param input The bond data
     * @param checkFutureIssueDate Whether to check that the issue date is in the future
     */
    function _validateBasicBondInput(
        BondInput memory input,
        bool checkFutureIssueDate
    ) private view {
        if (!isCurrencyAllowed(input.currency)) {
            revert Errors.BondRegistry__InvalidCurrency();
        }

        if (input.denomination == 0) {
            revert Errors.BondRegistry__DenominationIsZero();
        }

        // slither-disable-next-line timestamp
        if (checkFutureIssueDate && input.issueDate < block.timestamp) {
            revert Errors.BondRegistry__InvalidIssueDate();
        }

        if (input.issueCount == 0) {
            revert Errors.BondRegistry__IssueCountIsZero();
        }

        if (!(input.issueDate < input.maturityDate)) {
            revert Errors.BondRegistry__IssueDateAfterMaturity();
        }

        _validateCouponRates(input.couponRates, input.couponType);
    }

    /**
     * @notice Validates the input arguments to record proposal to update existing bond
     * @param id The bond ID to be updated
     * @param input The updated bond data
     */
    function _validateBondUpdateInput(
        uint256 id,
        BondInput memory input
    ) private view {
        Bond memory bond = _bonds[id];

        bool checkFutureIssueDate =
            bond.issueDate != input.issueDate ? true : false;
        _validateBasicBondInput(input, checkFutureIssueDate);

        if (bond.status != BondStatus.Approved) {
            if (bond.issueDate != input.issueDate) {
                revert Errors.BondRegistry__IssueDateImmutableAfterIssuance();
            }

            if (
                bond.issueVolume >
                _computeIssueVolume(input.issueCount, input.denomination)
            ) {
                revert Errors.BondRegistry__IssueVolumeCannotBeReduced();
            }

            if (bond.issueVolume / bond.denomination > input.issueCount) {
                revert Errors.BondRegistry__IssueCountCannotBeDecreased();
            }
        }

        if (bond.maturityDate > input.maturityDate) {
            revert Errors.BondRegistry__MaturityDateCannotBeShortened();
        }
    }

    /*//////////////////////////////////////////////////////////////
                         PRIVATE PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validates the coupon rates structure for a bond
     * @param couponRates The coupon rates data
     * @param couponType_ The type of coupon for the bond (fixed, floating, zero coupon)
     * @dev Ensures the coupon rates and payment intervals are consistent with the bond's coupon type
     */
    function _validateCouponRates(
        CouponRates memory couponRates,
        CouponType couponType_
    ) private pure {
        uint256 paymentIntervalsLength = couponRates.paymentIntervals.length;
        uint256 ratesLength = couponRates.rates.length;

        if (paymentIntervalsLength != ratesLength) {
            revert Errors.BondRegistry__CouponRatesLengthMismatch();
        }

        if (
            couponType_ == CouponType.ZERO_COUPON &&
            paymentIntervalsLength != 0 &&
            ratesLength != 0
        ) {
            revert Errors.BondRegistry__CouponRatesUnexpectedLength();
        }

        if (couponType_ == CouponType.ZERO_COUPON) {
            // empty array in ZERO_COUPON - no other validations
            return;
        }

        if (
            couponType_ == CouponType.FIXED &&
            paymentIntervalsLength != 2 &&
            ratesLength != 2
        ) {
            revert Errors.BondRegistry__CouponRatesUnexpectedLength();
        }

        if (
            couponType_ == CouponType.FLOATING &&
            paymentIntervalsLength < 2 &&
            ratesLength < 2
        ) {
            revert Errors.BondRegistry__CouponRatesUnexpectedLength();
        }

        if (couponRates.paymentIntervals[0] == 0) {
            revert Errors.BondRegistry__PaymentIntervalZero();
        }

        if (couponRates.rates[ratesLength - 1] != 0) {
            revert Errors.BondRegistry__CouponRatesLastRateNotZero();
        }

        uint256 previousInterval;
        uint256 previousRate;
        for (uint256 i; i < paymentIntervalsLength - 1; ) {
            uint256 currentInterval = couponRates.paymentIntervals[i];
            uint256 currentRate = couponRates.rates[i];

            if (currentInterval > couponRates.paymentIntervals[i + 1]) {
                revert Errors.BondRegistry__PaymentIntervalsUnordered();
            }

            if (
                currentInterval == previousInterval &&
                currentRate == previousRate
            ) {
                revert Errors.BondRegistry__CouponRatesDuplicate();
            }

            previousInterval = currentInterval;
            previousRate = currentRate;

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Calculates the total issue volume of a bond
     * @dev Multiplies the number of bond units (`issueCount`) by the denomination value
     * @param issueCount The number of individual bond units to be issued
     * @param denomination_ The face value of a single bond unit
     * @return The total volume of the bond issuance
     */
    function _computeIssueVolume(
        uint256 issueCount,
        uint256 denomination_
    ) private pure returns (uint256) {
        return issueCount * denomination_;
    }
}
// slither-disable-end uninitialized-state
