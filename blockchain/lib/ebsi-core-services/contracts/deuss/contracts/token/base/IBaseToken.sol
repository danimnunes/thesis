// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC6909} from "@openzeppelin/contracts/interfaces/draft-IERC6909.sol";
import {IBondRegistry} from "../../registry/IBondRegistry.sol";

/**
 * @title IBaseToken
 * @author DEUSS Team
 * @notice This interface defines the basic functionalities of a token
 * @dev Interface for the BaseToken contract
 */
interface IBaseToken is IERC6909 {
    /**
     * @notice This event is emitted when the token information is updated
     * @dev The event is emitted by the token init function and by the setTokenInformation function
     * @param isin The bond identifier linked to token
     * @param newVersion The new version of the token, current version is 2.0
     */
    event UpdatedTokenInformation(bytes12 indexed isin, string newVersion);

    /**
     * @notice This event is emitted when the BondRegistry has been set for the token
     * @dev The event is emitted by the token constructor and by the setBondRegistry function
     * @param bondRegistry The address of BondRegistry for the token
     */
    event BondRegistryAdded(address indexed bondRegistry);

    /**
     * @notice This event is emitted when the wallet of an investor is frozen or unfrozen
     * @dev The event is emitted by setAddressFrozen and batchSetAddressFrozen functions
     * @param user The wallet of the investor that is concerned by the freezing status
     * @param isFrozen The freezing status of the wallet:
     *        - `true` if the wallet is frozen after this event
     *        - `false` if the wallet is unfrozen after this event
     * @param owner The address of the wallet that called the function
     */
    event AddressFrozen(
        address indexed user,
        bool indexed isFrozen,
        address indexed owner
    );

    /**
     * @notice This event is emitted when the token is paused
     * @dev The event is emitted by the pause function
     * @param user The address of the wallet that called the pause function
     */
    event Paused(address indexed user);

    /**
     * @notice This event is emitted when the token is unpaused
     * @dev The event is emitted by the unpause function
     * @param user The address of the wallet that called the unpause function
     */
    event Unpaused(address indexed user);

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set the BondRegistry for the token
     * @dev Only the owner of the token smart contract can call this function
     * This function can be called even if the token contract is paused.
     * @param bondRegistryAddr The address of BondRegistry to set
     */
    function setBondRegistry(address bondRegistryAddr) external;

    /*//////////////////////////////////////////////////////////////
                            AGENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IERC6909
     */
    function approve(
        address spender,
        uint256 id,
        uint256 amount
    ) external returns (bool);

    /**
     * @notice Initiate setting of frozen status for addresses in batch
     * @dev IMPORTANT: THIS TRANSACTION COULD EXCEED GAS LIMIT IF `users.length` IS TOO HIGH.
     * USE WITH CARE TO AVOID "OUT OF GAS" TRANSACTIONS AND POTENTIAL LOSS OF TX FEES
     * This function can only be called by an address that has been granted the role `ADDRESS_FREEZER_ROLE`.
     * If the caller does not have this role, the transaction will revert.
     * @param users Addresses for which to update frozen status
     * @param freeze The frozen status of the corresponding address
     */
    function batchSetAddressFrozen(
        address[] calldata users,
        bool[] calldata freeze
    ) external;

    /**
     * @notice Mint tokens to a specified address
     * @dev This enhanced version of the default mint method allows tokens to be minted to an address only
     * if it is a verified and whitelisted address according to the security token.
     * This function can only be called by the BondRegistry contract.
     * This function can only be performed during `Issued` token phase.
     * @param to The address to mint the tokens to
     * @param amount The amount of tokens to be minted.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Pause the token contract
     * @dev When the contract is paused, all token transfers are temporarily suspended.
     * This function can only be called by an address that has been granted the role `PAUSER_ROLE`.
     * If the caller does not have this role, the transaction will revert.
     * The function can be called only when the contract is not already paused.
     */
    function pause() external;

    /**
     * @notice Unpause the token contract, allowing investors to resume token transfers under normal conditions
     * @dev This function can only be called by an address that has been granted the role `PAUSER_ROLE`.
     * If the caller does not have this role, the transaction will revert.
     * The function can be called only when the contract is currently paused.
     */
    function unpause() external;

    /**
     * @notice Set an address's frozen status for this token.
     * @param user The address for which to update the frozen status
     * @param freeze The frozen status to be applied: `true` to freeze, `false` to unfreeze
     * @dev Freezing or unfreezing the address based on the provided boolean value.
     * This function can only be called by an address that has been granted the role `ADDRESS_FREEZER_ROLE`.
     * If the caller does not have this role, the transaction will revert.
     */
    function setAddressFrozen(address user, bool freeze) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Retrieve Bond Registry contract linked to the contract
     * @return BondRegistry contract
     */
    function bondRegistry() external view returns (IBondRegistry);

    /**
     * @notice Retrieve bond isin bind to the contract
     * @return The bond ISIN
     */
    function getIsin() external view returns (bytes12);

    /**
     * @notice Retrieve the freezing status of a wallet
     * @dev isFrozen returning `true` doesn't mean that the balance is free, tokens could be blocked by
     * a freeze or the whole contract could be blocked by pause
     * @param user The address of the wallet on which isFrozen is called
     * @return True if the wallet is frozen, otherwise false
     */
    function isFrozen(address user) external view returns (bool);

    /**
     * @notice Retrieve if the contract is paused
     * @return True if the contract is paused, otherwise false
     */
    function paused() external view returns (bool);

    /**
     * @notice Retrieve the DEUSS version of the non-fungible token
     * current version is 2.0.0
     * @return The version as string
     */
    function version() external view returns (string memory);
}
