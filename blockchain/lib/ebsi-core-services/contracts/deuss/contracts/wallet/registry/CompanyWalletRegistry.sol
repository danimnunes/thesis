// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Initializable} from "solady/src/utils/Initializable.sol";
import {OwnableRolesExtension} from "../../utils/OwnableRolesExtension.sol";
import {ReentrancyGuard} from "solady/src/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "solady/src/utils/UUPSUpgradeable.sol";
// DEUSS:
import {AddressExtensions} from "../../libs/AddressExtensions.sol";
import {CompanyWalletRegistryStorage} from "./CompanyWalletRegistryStorage.sol";
import {Errors} from "../../libs/Errors.sol";
import {ICompanyWalletRegistry} from "./ICompanyWalletRegistry.sol";
import {
    CompanyWallet,
    TransferRequest,
    Flag,
    Status
} from "../CompanyWalletStructs.sol";
import {ProxyDeployer} from "../../deployer/ProxyDeployer.sol";

// @todo @dev slither detect muliple uninitialized-state-variables in this contract due to the following error during compilation:
//    ERROR:ContractSolcParsing:Impossible to generate IR for CompanyWalletRegistry.registerCompanyWallet (src/wallet/registry/CompanyWalletRegistry.sol#53-80):
//    'NoneType' object has no attribute 'parameters'
//    ERROR:ContractSolcParsing:Impossible to generate IR for CompanyWalletRegistry.setBondRegistry (src/wallet/registry/CompanyWalletRegistry.sol#83-89):
//    'NoneType' object has no attribute 'parameters'
//    ...
// thus we disable the uninitialized-state-variables check temporarily until the issue is fixed/resolved
// slither-disable-start uninitialized-state
/**
 * @title CompanyWalletRegistry
 * @author DEUSS Team
 * @notice CompanyWalletRegistry is a contract that allows to handle company wallets including all related operations
 * @dev disable locked-ether as only payable functions are admin functions inherited from OwnableRolesExtension
 * and it is not anticipated these functions to be used for receiving funds
 */
contract CompanyWalletRegistry is
    ICompanyWalletRegistry,
    CompanyWalletRegistryStorage,
    ProxyDeployer,
    Initializable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using AddressExtensions for address;

    /// @notice Role identifier for addresses authorized to manage company wallets
    uint256 public constant ADMIN_ROLE = _ROLE_0;

    // solhint-disable-next-line use-natspec
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                       EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the contract with owner
     * @param owner_ The address that will own the contract
     */
    function initialize(address owner_) external initializer {
        __CompanyWalletRegistry_init(owner_);
    }

    // slither-disable-start reentrancy-no-eth
    /**
     * @inheritdoc ICompanyWalletRegistry
     * @dev slither detects reentrancy in this function because state variables are written after the CompanyWalletFactory(_companyWalletFactory).createCompanyWallet(companyWalletOwner) call
     *  - we are making a call to our own contract, so no reentrancy expected
     * TODO DISCUSS: Should we add more company data, such as company name, state, registrar (i.e., the address making the call), etc.?
     */
    function registerCompanyWallet(
        address companyWalletOwner
    ) external onlyRoles(ADMIN_ROLE) nonReentrant returns (address) {
        companyWalletOwner.assertAddressNotZero();

        // Build init data without selector; factory will prepend template's initSelector
        bytes memory initData = abi.encode(companyWalletOwner, address(this));

        // Deploy via EBSI ProxyFactory through ProxyDeployer
        address deployedCompanyWalletAddr = _deployProxy(
            _templateIdCW,
            initData
        );

        if (deployedCompanyWalletAddr == address(0)) {
            revert Errors.CWR__CompanyWalletAddressZero();
        }

        _ownerToCompanyWallets[companyWalletOwner].push(
            deployedCompanyWalletAddr
        );

        _companyWallets[deployedCompanyWalletAddr] = CompanyWallet({
            owner: companyWalletOwner,
            ownerCompanyWalletIndex: _ownerToCompanyWallets[companyWalletOwner]
                .length,
            flag: Flag.ENABLED,
            wallets: new address[](0)
        });

        emit CompanyWalletRegistered(
            deployedCompanyWalletAddr,
            companyWalletOwner,
            Flag.ENABLED
        );

        return deployedCompanyWalletAddr;
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function disableCompanyWallet(
        address companyWallet
    ) external onlyRoles(ADMIN_ROLE) {
        companyWallet.assertAddressNotZero();

        Flag flag = _companyWallets[companyWallet].flag;

        if (flag == Flag.NON_EXISTING) {
            revert Errors.CWR__Unregistered();
        }

        if (flag == Flag.DISABLED) {
            revert Errors.CWR__AlreadyDisabled();
        }

        _companyWallets[companyWallet].flag = Flag.DISABLED;

        emit CompanyWalletUpdated(companyWallet, flag, Flag.DISABLED);
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function enableCompanyWallet(
        address companyWallet
    ) external onlyRoles(ADMIN_ROLE) {
        companyWallet.assertAddressNotZero();

        Flag flag = _companyWallets[companyWallet].flag;

        if (flag == Flag.NON_EXISTING) {
            revert Errors.CWR__Unregistered();
        }

        if (flag != Flag.DISABLED) {
            revert Errors.CWR__NotDisabled();
        }

        _companyWallets[companyWallet].flag = Flag.ENABLED;

        emit CompanyWalletUpdated(companyWallet, flag, Flag.ENABLED);
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function removeCompanyWallet(
        address companyWallet
    ) external onlyRoles(ADMIN_ROLE) {
        companyWallet.assertAddressNotZero();

        Flag flag = _companyWallets[companyWallet].flag;

        if (flag == Flag.NON_EXISTING) {
            revert Errors.CWR__Unregistered();
        }

        address companyWalletOwner = _companyWallets[companyWallet].owner;
        uint256 index = _companyWallets[companyWallet].ownerCompanyWalletIndex;

        _removeFromOwnerCompanyWallets(companyWalletOwner, index);

        delete _companyWallets[companyWallet];
        delete _transferRequests[companyWallet];

        emit CompanyWalletUpdated(companyWallet, flag, Flag.NON_EXISTING);
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function requestCompanyWalletTransfer(address newOwner) external {
        newOwner.assertAddressNotZero();
        address companyWallet = msg.sender;

        if (_companyWallets[companyWallet].flag == Flag.DISABLED) {
            revert Errors.CWR__Disabled();
        } else if (_companyWallets[companyWallet].flag == Flag.NON_EXISTING) {
            revert Errors.CWR__Unregistered();
        }

        if (_transferRequests[companyWallet].status != Status.NON_EXISTING) {
            revert Errors.CWR__TransferAlreadyRequested();
        }

        _transferRequests[companyWallet] = TransferRequest({
            newOwner: newOwner,
            status: Status.REQUESTED
        });

        emit TransferRequested(companyWallet, newOwner);
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function handleCompanyWalletTransfer(
        address companyWallet,
        bool approval
    ) external onlyRoles(ADMIN_ROLE) {
        companyWallet.assertAddressNotZero();

        if (_companyWallets[companyWallet].flag == Flag.DISABLED) {
            revert Errors.CWR__Disabled();
        } else if (_companyWallets[companyWallet].flag == Flag.NON_EXISTING) {
            revert Errors.CWR__Unregistered();
        }

        TransferRequest storage request = _transferRequests[companyWallet];

        if (request.status == Status.NON_EXISTING) {
            revert Errors.CWR__TransferNotRequested();
        } else if (request.status == Status.APPROVED) {
            revert Errors.CWR__AlreadyApproved();
        } else if (request.status == Status.REJECTED) {
            revert Errors.CWR__AlreadyRejected();
        }

        if (approval) {
            request.status = Status.APPROVED;
            emit TransferCompanyWalletApproved(companyWallet, request.newOwner);
        } else {
            request.status = Status.REJECTED;
            emit TransferCompanyWalletRejected(companyWallet, request.newOwner);
        }
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function finalizeCompanyWalletTransfer(
        address newOwner
    ) external returns (bool) {
        newOwner.assertAddressNotZero();
        address companyWallet = msg.sender;

        TransferRequest memory request = _transferRequests[companyWallet];

        address oldOwner = _companyWallets[companyWallet].owner;

        if (request.status == Status.NON_EXISTING) {
            revert Errors.CWR__TransferNotRequested();
        } else if (request.status == Status.REQUESTED) {
            revert Errors.CWR__TransferNotApproved();
        } else if (request.status == Status.REJECTED) {
            delete _transferRequests[companyWallet];
            emit TransferRequestCancelled(companyWallet, oldOwner, newOwner);
            return false;
        }

        if (request.newOwner != newOwner)
            revert Errors.CWR__NotApprovedOwner(newOwner);

        uint256 oldIndex = _companyWallets[companyWallet]
            .ownerCompanyWalletIndex;

        _addToOwnerCompanyWallets(newOwner, companyWallet);
        _removeFromOwnerCompanyWallets(oldOwner, oldIndex);

        delete _transferRequests[companyWallet];

        emit OwnerChanged(companyWallet, oldOwner, request.newOwner);
        return true;
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function setCompanyWalletTemplate(
        string calldata name,
        string calldata version
    ) external onlyOwner {
        _templateIdCW = addTemplateConfig(name, version);
    }

    /*//////////////////////////////////////////////////////////////
                    EXTERNAL FUNCTIONS THAT ARE VIEW
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function doesCompanyWalletExist(
        address companyWallet
    ) external view returns (bool) {
        return _companyWallets[companyWallet].flag != Flag.NON_EXISTING;
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function getCompanyWalletOwner(
        address companyWallet
    ) external view returns (address) {
        return _companyWallets[companyWallet].owner;
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function getCompanyWalletsByOwner(
        address companyWalletOwner
    ) external view returns (address[] memory) {
        return _ownerToCompanyWallets[companyWalletOwner];
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function getCompanyWalletLinkedWallets(
        address companyWallet
    ) external view returns (address[] memory) {
        return _companyWallets[companyWallet].wallets;
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function getCompanyWalletTemplateId() external view returns (bytes32) {
        return _templateIdCW;
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function isCompanyWalletEnabled(
        address companyWallet
    ) external view returns (bool) {
        return _companyWallets[companyWallet].flag == Flag.ENABLED;
    }

    /*//////////////////////////////////////////////////////////////
                     PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function grantRoles(
        address user,
        uint256 roles
    )
        public
        payable
        override(ICompanyWalletRegistry, OwnableRolesExtension)
        onlyOwner
    {
        if (roles != ADMIN_ROLE) {
            revert Errors.InvalidRoles();
        }

        super.grantRoles(user, roles);
    }

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function grantRoles(
        address[] calldata users,
        uint256 roles
    )
        public
        payable
        override(ICompanyWalletRegistry, OwnableRolesExtension)
        onlyOwner
    {
        if (roles != ADMIN_ROLE) {
            revert Errors.InvalidRoles();
        }

        super.grantRoles(users, roles);
    }

    /*//////////////////////////////////////////////////////////////
                    PUBLIC FUNCTIONS THAT ARE VIEW
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc ICompanyWalletRegistry
     */
    function doesApprovalExist(
        address companyWallet
    ) public view returns (bool) {
        return _transferRequests[companyWallet].status == Status.APPROVED;
    }

    /*//////////////////////////////////////////////////////////////
                    PUBLIC FUNCTIONS THAT ARE PURE
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public pure override returns (bool) {
        return
            interfaceId == type(ICompanyWalletRegistry).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /*//////////////////////////////////////////////////////////////
                     INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /* solhint-disable no-empty-blocks */
    /**
     * @notice Authorizes an upgrade for the contract.
     * @param newImplementation The address of the new implementation contract.
     * @dev Only callable by the contract owner.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /* solhint-enable no-empty-blocks */

    /* solhint-disable func-name-mixedcase */
    /**
     * @notice Initializes the contract with owner
     * @param owner_ The address that will own the contract
     */
    function __CompanyWalletRegistry_init(
        address owner_
    ) internal onlyInitializing {
        owner_.assertAddressNotZero();

        _initializeOwner(owner_);
    }

    /* solhint-enable func-name-mixedcase */

    /**
     * @notice Adds a new company wallet address to the owner's company wallets list
     * @dev Updates the mapping and stores the wallet index for reverse lookup
     * @param owner_ The address of the company wallet owner
     * @param companyWallet The address of the company wallet to associate
     */
    function _addToOwnerCompanyWallets(
        address owner_,
        address companyWallet
    ) internal {
        _ownerToCompanyWallets[owner_].push(companyWallet);
        _companyWallets[companyWallet].owner = owner_;
        _companyWallets[companyWallet]
            .ownerCompanyWalletIndex = _ownerToCompanyWallets[owner_].length;
    }

    /**
     * @notice Removes a company wallet from the owner's list using the swap-and-pop technique
     * @dev Swaps the target index with the last element, updates the index mapping, then pops the last element
     * @param owner_ The address of the company wallet owner
     * @param index The index of the company wallet to remove
     */
    function _removeFromOwnerCompanyWallets(
        address owner_,
        uint256 index
    ) internal {
        uint256 lastIndex = _ownerToCompanyWallets[owner_].length;

        if (index != lastIndex) {
            address lastCompanyWallet = _ownerToCompanyWallets[owner_][
                lastIndex - 1
            ];
            _ownerToCompanyWallets[owner_][index - 1] = lastCompanyWallet;
            _companyWallets[lastCompanyWallet].ownerCompanyWalletIndex = index;
        }

        _ownerToCompanyWallets[owner_].pop();
    }
}
// slither-disable-end uninitialized-state
