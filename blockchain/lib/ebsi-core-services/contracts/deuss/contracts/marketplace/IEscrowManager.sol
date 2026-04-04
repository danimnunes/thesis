// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {Escrow} from "./MarketStructs.sol";

/**
 * @title IEscrowManager
 * @author DEUSS Team
 * @notice Interface for managing token escrow operations in the bond marketplace
 * @dev Defines the contract interface for secure token escrow management during bond trading
 * @dev Handles token deposits, withdrawals, and claims for offers and deals
 */
interface IEscrowManager {
    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Emitted when a new escrow is created
     * @param offerId The ID of the offer
     * @param depositor The address of the depositor
     * @param tokenAddress The address of the token contract
     * @param tokenId The ID of the token
     * @param amount The amount of tokens deposited
     */
    event EscrowCreated(
        uint256 indexed offerId,
        address indexed depositor,
        address indexed tokenAddress,
        uint256 tokenId,
        uint256 amount
    );

    /**
     * @notice Emitted when tokens are claimed from an escrow by a buyer
     * @param offerId The ID of the offer associated with the escrow
     * @param beneficiary The address of the beneficiary receiving the tokens
     * @param amount The amount of tokens claimed from the escrow
     */
    event Claimed(
        uint256 indexed offerId,
        address indexed beneficiary,
        uint256 indexed amount
    );

    /**
     * @notice Emitted when tokens are withdrawn from an escrow back to the depositor
     * @param offerId The ID of the offer associated with the escrow
     * @param beneficiary The address of the beneficiary (typically the original depositor)
     * @param amount The amount of tokens withdrawn from the escrow
     */
    event Withdrawn(
        uint256 indexed offerId,
        address indexed beneficiary,
        uint256 indexed amount
    );

    /**
     * @notice Emitted when the InterestDiscovery module is updated
     * @param newInterestDiscovery The new address of the InterestDiscovery module
     */
    event InterestDiscoveryUpdated(address indexed newInterestDiscovery);

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Updates the InterestDiscovery module address
     * @param newInterestDiscovery The new address of the InterestDiscovery module
     * @dev Only callable by addresses with ADMIN role
     * @dev Reverts if newInterestDiscovery is zero address
     * @dev Emits InterestDiscoveryUpdated event on success
     */
    function updateInterestDiscovery(address newInterestDiscovery) external;

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Creates a new escrow for an offer and deposits tokens
     * @param offerId The ID of the offer to create escrow for
     * @param amount The amount of tokens to deposit into escrow
     * @param depositor The address of the token depositor (offer owner)
     * @param tokenAddress The address of the token contract
     * @param tokenId The ID of the specific token
     * @param denomination The denomination of the token
     * @dev Only callable by the InterestDiscovery module
     * @dev Reverts if amount is zero, depositor is zero address, or tokenAddress is zero address
     * @dev Reverts if escrow already exists for the offer
     * @dev Reverts if token transfer fails
     * @dev Emits EscrowCreated event on success
     */
    function createEscrow(
        uint256 offerId,
        uint256 amount,
        address depositor,
        address tokenAddress,
        uint256 tokenId,
        uint256 denomination
    ) external;

    /**
     * @notice Withdraws tokens from an escrow back to the original depositor
     * @param offerId The ID of the offer associated with the escrow
     * @param amount The amount of tokens to withdraw from the escrow
     * @dev Only callable by the InterestDiscovery module
     * @dev Reverts if escrow has insufficient balance
     * @dev Reverts if token transfer fails
     * @dev Emits Withdrawn event on success
     */
    function withdraw(uint256 offerId, uint256 amount) external;

    /**
     * @notice Claims tokens from an escrow to a beneficiary
     * @param offerId The ID of the offer associated with the escrow
     * @param amount The amount of tokens to claim from the escrow
     * @param beneficiary The address of the beneficiary receiving the tokens
     * @dev Only callable by the InterestDiscovery module
     * @dev Reverts if escrow has insufficient balance
     * @dev Reverts if beneficiary is zero address
     * @dev Reverts if token transfer fails
     * @dev Emits Claimed event on success
     */
    function claim(
        uint256 offerId,
        uint256 amount,
        address beneficiary
    ) external;

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Gets the escrow details for an offer
     * @param offerId The ID of the offer to get escrow for
     * @return escrow The complete escrow struct containing all escrow data
     */
    function getEscrow(uint256 offerId) external view returns (Escrow memory);

    /**
     * @notice Gets the current InterestDiscovery module address
     * @return address The address of the InterestDiscovery module
     */
    function interestDiscovery() external view returns (address);
}
