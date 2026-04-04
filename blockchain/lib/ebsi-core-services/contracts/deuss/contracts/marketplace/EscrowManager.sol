// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC6909} from "@openzeppelin/contracts/interfaces/draft-IERC6909.sol";
import {Initializable} from "solady/src/utils/Initializable.sol";
import {OwnableRolesExtension} from "../utils/OwnableRolesExtension.sol";
import {UUPSUpgradeable} from "solady/src/utils/UUPSUpgradeable.sol";
import {AddressExtensions} from "../libs/AddressExtensions.sol";
import {Errors} from "../libs/Errors.sol";
import {Escrow} from "./MarketStructs.sol";
import {IEscrowManager} from "./IEscrowManager.sol";

/**
 * @title EscrowManager
 * @author DEUSS Team
 * @notice Manages token escrow for the bond market
 */
contract EscrowManager is
    IEscrowManager,
    IERC165,
    Initializable,
    OwnableRolesExtension,
    UUPSUpgradeable
{
    using AddressExtensions for address;

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/
    /// @notice The main admin role
    uint256 public constant ADMIN = _ROLE_0;

    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/
    /// @notice Address of the InterestDiscovery module
    address public interestDiscovery;

    /// @notice Mapping of offer ID to Escrow struct
    mapping(uint256 offerId => Escrow escrow) public escrows;

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Modifier to restrict access to InterestDiscovery module
     * @dev Reverts if the caller is not the InterestDiscovery module
     */
    modifier onlyInterestDiscovery() {
        if (msg.sender != interestDiscovery)
            revert Errors.EscrowManager__NotAuthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Locks any future initializations or reinitializations
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param owner_ Address of the contract owner
     * @param interestDiscovery_ Address of the InterestDiscovery module
     */
    function initialize(
        address owner_,
        address interestDiscovery_
    ) external initializer {
        __EscrowManager_init(owner_, interestDiscovery_);
    }

    /**
     * @inheritdoc IEscrowManager
     */
    function updateInterestDiscovery(
        address newInterestDiscovery
    ) external onlyRoles(ADMIN) {
        if (newInterestDiscovery == address(0))
            revert Errors.EscrowManager__ZeroAddress();
        interestDiscovery = newInterestDiscovery;
        emit InterestDiscoveryUpdated(newInterestDiscovery);
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc IEscrowManager
     */
    function createEscrow(
        uint256 offerId,
        uint256 amount,
        address depositor,
        address tokenAddress,
        uint256 tokenId,
        uint256 denomination
    ) external onlyInterestDiscovery {
        if (amount == 0) revert Errors.EscrowManager__ZeroAmount();
        if (depositor == address(0)) revert Errors.EscrowManager__ZeroAddress();
        if (tokenAddress == address(0))
            revert Errors.EscrowManager__ZeroAddress();

        // revert if the escrow already exists
        if (escrows[offerId].tokenAddress != address(0))
            revert Errors.EscrowManager__EscrowAlreadyExists();

        escrows[offerId] = Escrow({
            depositor: depositor,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            denomination: denomination,
            amount: amount
        });
        // transfer tokens from depositor to escrow
        bool success = IERC6909(tokenAddress).transferFrom(
            depositor,
            address(this),
            tokenId,
            amount
        );

        if (!success) {
            revert Errors.EscrowManager__TokensTransferFailed();
        }

        emit EscrowCreated(offerId, depositor, tokenAddress, tokenId, amount);
    }

    /**
     * @inheritdoc IEscrowManager
     */
    function withdraw(
        uint256 offerId,
        uint256 amount
    ) external onlyInterestDiscovery {
        address depositor = escrows[offerId].depositor;
        _transferFromEscrow(offerId, amount, depositor);

        emit Withdrawn(offerId, depositor, amount);
    }

    /**
     * @inheritdoc IEscrowManager
     */
    function claim(
        uint256 offerId,
        uint256 amount,
        address beneficiary
    ) external onlyInterestDiscovery {
        _transferFromEscrow(offerId, amount, beneficiary);

        emit Claimed(offerId, beneficiary, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc IEscrowManager
     */
    function getEscrow(uint256 offerId) external view returns (Escrow memory) {
        return escrows[offerId];
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IEscrowManager).interfaceId;
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
     * @notice Initializes the contract
     * @param owner_ Address of the contract owner
     * @param interestDiscovery_ Address of the InterestDiscovery module
     * @dev Reverts if interestDiscovery_ is zero address
     */
    function __EscrowManager_init(
        address owner_,
        address interestDiscovery_
    ) internal onlyInitializing {
        // solhint-disable-line func-name-mixedcase
        _initializeOwner(msg.sender);

        if (interestDiscovery_ == address(0)) {
            revert Errors.EscrowManager__ZeroAddress();
        }

        interestDiscovery = interestDiscovery_;
        transferOwnership(owner_);
    }

    /**
     * @notice Shared internal logic to move tokens out of escrow and emit the appropriate event
     * @param offerId The offer identifier bound to the escrow
     * @param amount The amount of tokens to transfer
     * @param recipient The address receiving the tokens
     */
    function _transferFromEscrow(
        uint256 offerId,
        uint256 amount,
        address recipient
    ) internal {
        Escrow storage escrow = escrows[offerId];
        if (escrow.amount < amount)
            revert Errors.EscrowManager__InsufficientBalance();
        if (recipient == address(0)) revert Errors.ZeroAddress();

        escrow.amount -= amount;

        bool success = IERC6909(escrow.tokenAddress).transferFrom(
            address(this),
            recipient,
            escrow.tokenId,
            amount
        );
        if (!success) revert Errors.EscrowManager__TokensTransferFailed();
    }
}
