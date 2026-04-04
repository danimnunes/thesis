// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {OwnableRolesExtension} from "../utils/OwnableRolesExtension.sol";
import {Initializable} from "solady/src/utils/Initializable.sol";
import {ReentrancyGuard} from "solady/src/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
// DEUSS:
import {CompanyWalletStorage} from "./CompanyWalletStorage.sol";
import {AddressExtensions} from "../libs/AddressExtensions.sol";
import {Errors} from "../libs/Errors.sol";
import {ICompanyWalletRegistry} from "./registry/ICompanyWalletRegistry.sol";
import {ICompanyWallet} from "./ICompanyWallet.sol";

// slither-disable-start uninitialized-state
/**
 * @title CompanyWallet
 * @author DEUSS Team
 * @notice CompanyWallet is a contract that allows to handle bonds emission including all related operations
 * @dev disable locked-ether as only payable functions are admin functions inherited from OwnableRoles
 * and it is not anticipated these functions to be used for receiving funds
 */
contract CompanyWallet is
    ICompanyWallet,
    CompanyWalletStorage,
    OwnableRolesExtension,
    ReentrancyGuard,
    Initializable
{
    using AddressExtensions for address;

    /**
     * @notice Constructor that disables initializers to protect against reinitialization.
     */
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                       EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the contract with owner
     * @param owner_ The address that will own the contract
     * @param companyWalletRegistry The address of the CompanyWalletRegistry contract
     */
    function initialize(
        address owner_,
        address companyWalletRegistry
    ) external initializer {
        _initializeOwner(msg.sender);

        setCompanyWalletRegistry(companyWalletRegistry);

        if (owner_ != address(0)) {
            super.transferOwnership(owner_);
        }
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function execute(
        address target,
        bytes calldata callData
    ) external nonReentrant {
        address sender = msg.sender;

        if (
            target == address(0) ||
            target == address(this) ||
            !_isContract(target)
        ) {
            revert Errors.CompanyWallet__InvalidCallTarget();
        }

        if (callData.length < 4) {
            revert Errors.CompanyWallet__InvalidCallData();
        }

        bytes4 selector = bytes4(callData[0:4]);

        if (
            sender != owner() &&
            !isOperationAllowedForAnyRoles(selector, target, rolesOf(sender))
        ) {
            revert Errors.CompanyWallet__Unauthorized();
        }

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = target.call(callData);

        // slither-disable-next-line unused-return
        Address.verifyCallResult(success, returnData);

        emit Execution(sender, target, callData, returnData);
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function grantOperationToRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external onlyOwner {
        if (selector == bytes4(0)) {
            revert Errors.CompanyWallet__ZeroSelector();
        }

        target.assertAddressNotZero();

        bytes32 operationHash = _computeOperationHash(selector, target);
        uint256 operationRoles = _operations[operationHash];

        if (operationRoles & roles == roles) {
            revert Errors.CompanyWallet__OperationAlreadyGrantedToAllRoles();
        }

        _operations[operationHash] = operationRoles | roles;

        emit OperationGrantedToRoles(selector, target, roles);
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function revokeOperationForRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external onlyOwner {
        if (selector == bytes4(0)) {
            revert Errors.CompanyWallet__ZeroSelector();
        }

        target.assertAddressNotZero();

        bytes32 operationHash = _computeOperationHash(selector, target);
        uint256 operationRoles = _operations[operationHash];

        if (operationRoles & roles == 0) {
            revert Errors.CompanyWallet__OperationAlreadyRevokedForAllRoles();
        }

        _operations[operationHash] = (operationRoles & roles) ^ operationRoles;

        emit OperationRevokedForRoles(selector, target, roles);
    }

    /*//////////////////////////////////////////////////////////////
                    EXTERNAL FUNCTIONS THAT ARE VIEW
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc ICompanyWallet
     */
    function getCompanyWalletRegistry() external view returns (address) {
        return _companyWalletRegistry;
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function isOperationAllowedForAllRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) external view returns (bool) {
        return getRolesForOperation(selector, target) & roles == roles;
    }

    /*//////////////////////////////////////////////////////////////
                    PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    // @todo discuss: who should have permission to set CWR? Factory doesnt make sense.
    /**
     * @inheritdoc ICompanyWallet
     */
    function setCompanyWalletRegistry(
        address companyWalletRegistry
    ) public onlyOwner {
        companyWalletRegistry.assertAddressNotZero();

        if (!_isContract(companyWalletRegistry)) {
            revert Errors.CompanyWallet__NotContract(companyWalletRegistry);
        }

        _companyWalletRegistry = companyWalletRegistry;

        emit CompanyWalletRegistryUpdated(companyWalletRegistry);
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function requestTransferOwnership(
        address newOwner
    ) public payable onlyOwner {
        ICompanyWalletRegistry(_companyWalletRegistry)
            .requestCompanyWalletTransfer(newOwner);
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function finalizeTransferOwnership(
        address newOwner
    ) public payable onlyOwner {
        if (
            ICompanyWalletRegistry(_companyWalletRegistry)
                .finalizeCompanyWalletTransfer(newOwner)
        ) {
            super.transferOwnership(newOwner);
        }
    }

    /*//////////////////////////////////////////////////////////////
                     PUBLIC FUNCTIONS THAT ARE VIEW
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc ICompanyWallet
     */
    function getRolesForOperation(
        bytes4 selector,
        address target
    ) public view returns (uint256) {
        return _operations[_computeOperationHash(selector, target)];
    }

    /**
     * @inheritdoc ICompanyWallet
     */
    function isOperationAllowedForAnyRoles(
        bytes4 selector,
        address target,
        uint256 roles
    ) public view returns (bool) {
        return getRolesForOperation(selector, target) & roles != 0;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == type(ICompanyWallet).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Checks if a given address is a deployed contract.
     * @param addr Address to check.
     * @return True if the address is a contract, false otherwise.
     * @dev Uses extcodesize to determine if the address contains contract code.
     */
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    /**
     * @notice Computes a unique key for the `_operations` mapping based on function selector and contract address.
     * @param selector The function selector (first 4 bytes of the function signature).
     * @param target The address of the target contract.
     * @return The computed hash used as the key in the `_operations` mapping.
     */
    function _computeOperationHash(
        bytes4 selector,
        address target
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(selector, target));
    }
}
// slither-disable-end uninitialized-state
