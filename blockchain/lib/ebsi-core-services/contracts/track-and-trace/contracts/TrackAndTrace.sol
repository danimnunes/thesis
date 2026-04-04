// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import "./interfaces/ITrackAndTraceInterface.sol";
import "@ebsiint-sc/trusted-policies-registry-v3/contracts/trusted-policies-registry/interfaces/IPolicyRegistry.sol";
import "@ebsiint-sc/did-registry-v5/contracts/did-registry/interfaces/IDidRegistry.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@ebsiint-sc/bootstrap-v2/contracts/utils/Pagination.sol";
import "./libraries/TrackAndTraceLib.sol";

contract TrackAndTrace is
    UUPSUpgradeable,
    ITrackAndTraceInterface,
    AccessControlUpgradeable
{
    using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;

    using Pagination for uint256;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    uint256 public constant MAX_METADATA_LENGTH = 4000;
    uint256 public constant MAX_DELEGATED_CHILDREN = 10;

    // Variables

    // list of all documents created
    mapping(bytes32 => Document) public documents;
    EnumerableMap.Bytes32ToBytes32Map internal documentsMapped;
    mapping(bytes => bytes32[]) internal accessBySubject;
    mapping(bytes => mapping(bytes32 => uint256)) internal accessBySubjectIndex;

    mapping(string => bool) public invitedDidEbsiAccounts;
    IDidRegistry public didRegistry;
    IPolicyRegistry public trustedPoliciesRegistry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _roleDefaultAdminAddress,
        address _upgraderAddress,
        address _tprAddress,
        address _didRegistryAddress
    ) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _roleDefaultAdminAddress);
        _grantRole(UPGRADER_ROLE, _upgraderAddress);
        trustedPoliciesRegistry = IPolicyRegistry(_tprAddress);
        didRegistry = IDidRegistry(_didRegistryAddress);
    }

    function authoriseDid(
        string calldata senderDid,
        string calldata authorisedDid,
        bool whiteList
    ) external {
        require(
            trustedPoliciesRegistry.checkPolicy("TNT:authoriseDid", msg.sender),
            "Policy error: sender doesn't have the attribute TNT:authoriseDid"
        );

        if (_authorize(bytes(senderDid), ACCOUNT_TYPE.DID_EBSI) == false) {
            revert NotDidController();
        }

        invitedDidEbsiAccounts[authorisedDid] = whiteList;
        emit DidEbsiAuthorised(authorisedDid, whiteList);
    }

    function createDocument(
        bytes32 documentHash,
        string calldata documentMetadata,
        string calldata didEbsiCreator
    ) external {
        // authorize
        if (_authorize(bytes(didEbsiCreator), ACCOUNT_TYPE.DID_EBSI) == false) {
            revert NotDidController();
        }
        if (
            _getAccountAccess(
                bytes32(0),
                bytes(didEbsiCreator),
                SCOPE.TNT_CREATE
            ) == false
        ) {
            revert DidNotInvited();
        }
        _createDocument(
            documentHash,
            documentMetadata,
            block.timestamp,
            Source.Block,
            bytes32(block.number),
            didEbsiCreator
        );
    }

    function createDocument(
        bytes32 documentHash,
        string calldata documentMetadata,
        string calldata didEbsiCreator,
        uint256 timestamp,
        bytes32 timestampProof
    ) external {
        // authorize signer
        if (_authorize(bytes(didEbsiCreator), ACCOUNT_TYPE.DID_EBSI) == false) {
            revert NotDidController();
        }
        if (
            _getAccountAccess(
                bytes32(0),
                bytes(didEbsiCreator),
                SCOPE.TNT_CREATE
            ) == false
        ) {
            revert DidNotInvited();
        }
        _createDocument(
            documentHash,
            documentMetadata,
            timestamp,
            Source.External,
            timestampProof,
            didEbsiCreator
        );
    }

    function removeDocument(bytes32 documentHash) external {
        // authorize signer
        if (
            _authorize(
                bytes(documents[documentHash].creator),
                ACCOUNT_TYPE.DID_EBSI
            ) == false
        ) {
            revert NotDidController();
        }

        documentsMapped.remove(documentHash);
        bytes memory creatorBytes = bytes(documents[documentHash].creator);
        uint256 index = accessBySubjectIndex[creatorBytes][documentHash];
        delete accessBySubjectIndex[creatorBytes][documentHash];
        accessBySubject[creatorBytes][index] = accessBySubject[creatorBytes][
            accessBySubject[creatorBytes].length - 1
        ];
        accessBySubject[creatorBytes].pop();
        delete documents[documentHash];

        emit DocumentRemoved(documentHash);
    }

    function migrationRemoveDocument(bytes32 documentHash) external {
        // the document must be already removed
        if (bytes(documents[documentHash].creator).length > 0) {
            revert DocumentExists();
        }
        if (
            trustedPoliciesRegistry.checkPolicy(
                "TNT:migrationRemoveDocument",
                msg.sender
            ) == false
        ) {
            revert NotAuthorised();
        }
        emit DocumentRemoved(documentHash);
    }

    function grantAccess(
        bytes32 documentHash,
        bytes calldata grantedByAccount,
        bytes calldata subjectAccount,
        ACCOUNT_TYPE grantedByAccType,
        ACCOUNT_TYPE subjectAccType,
        ACCESS_ENUM permission
    ) external {
        // authorize signer
        if (_authorize(grantedByAccount, grantedByAccType) == false) {
            revert NotDidController();
        }
        // _authorize
        if (
            permission == ACCESS_ENUM.DELEGATE &&
            _getAccountAccess(
                documentHash,
                grantedByAccount,
                SCOPE.TNT_CREATE
            ) ==
                false
        ) {
            revert OnlyCreator();
        } else if (
            permission == ACCESS_ENUM.WRITE &&
            _getAccountAccess(
                documentHash,
                grantedByAccount,
                SCOPE.TNT_CREATE
            ) ==
                false &&
            _getAccountAccess(
                documentHash,
                grantedByAccount,
                SCOPE.TNT_DELEGATE
            ) ==
                false
        ) {
            revert OnlyCreatorOrDelegated();
        }

        _grantAccess(
            documentHash,
            grantedByAccount,
            subjectAccount,
            grantedByAccType,
            subjectAccType,
            permission
        );
    }

    function revokeAccess(
        bytes32 documentHash,
        bytes calldata revokedByAccount,
        bytes calldata subjectAccount,
        ACCESS_ENUM permission
    ) external {
        Document storage doc = documents[documentHash];
        if (
            !TrackAndTraceLib._equal(
                revokedByAccount,
                doc.invited[subjectAccount].grantedBy[permission]
            )
        ) {
            revert OnlyAccessGranter();
        }

        // authorize signer
        if (
            _authorize(
                revokedByAccount,
                doc.invited[subjectAccount].grantedByAccountType[permission]
            ) == false
        ) {
            revert NotDidController();
        }

        _revokeAccess(
            documentHash,
            revokedByAccount,
            subjectAccount,
            permission
        );
    }

    function writeEvent(WriteEvent calldata eventParams) external {
        // authorize signer
        if (
            _authorize(
                eventParams.sender,
                documents[eventParams.documentHash]
                    .invited[eventParams.sender]
                    .subjectAccountType
            ) == false
        ) {
            revert NotDidController();
        }
        if (
            _getAccountAccess(
                eventParams.documentHash,
                eventParams.sender,
                SCOPE.TNT_WRITE
            ) == false
        ) {
            revert OnlyCreatorOrWriter();
        }
        _writeEvent(
            eventParams,
            block.timestamp,
            Source.Block,
            bytes32(block.number)
        );
    }

    function writeEvent(
        WriteEvent calldata eventParams,
        uint256 timestamp,
        bytes32 timestampProof
    ) external {
        // authorize signer
        if (
            _authorize(
                eventParams.sender,
                documents[eventParams.documentHash]
                    .invited[eventParams.sender]
                    .subjectAccountType
            ) == false
        ) {
            revert NotDidController();
        }
        if (
            _getAccountAccess(
                eventParams.documentHash,
                eventParams.sender,
                SCOPE.TNT_WRITE
            ) == false
        ) {
            revert OnlyCreatorOrWriter();
        }
        _writeEvent(eventParams, timestamp, Source.External, timestampProof);
    }

    function getImplementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    function getDocuments(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = documentsMapped.length().paginate(
            page,
            pageSize
        );
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            (bytes32 key, ) = documentsMapped.at(ids[i]);
            items[i] = key;
        }
    }

    function getDocument(
        bytes32 documentHash
    ) external view returns (DocumentGetter memory) {
        Document storage iDoc = documents[documentHash];
        require(bytes(iDoc.creator).length > 0, "Document does not exist");
        DocumentGetter memory doc;
        doc.creator = iDoc.creator;
        doc.documentMetadata = iDoc.documentMetadata;
        doc.documentTimestamp = iDoc.documentTimestamp;
        return doc;
    }

    function getDocument__deprecated(
        bytes32 documentHash
    ) external view returns (DocumentGetter__deprecated memory) {
        Document storage iDoc = documents[documentHash];
        require(bytes(iDoc.creator).length > 0, "Document does not exist");
        DocumentGetter__deprecated memory doc;
        doc.creator = iDoc.creator;
        doc.documentMetadata = iDoc.documentMetadata;
        doc.documentTimestamp = iDoc.documentTimestamp;
        doc.eventHashes = iDoc.eventHashes;
        return doc;
    }

    function getEvents(
        bytes32 documentHash,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        require(
            bytes(documents[documentHash].creator).length > 0,
            "Document does not exist"
        );
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = documents[documentHash]
            .eventHashes
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = documents[documentHash].eventHashes[ids[i]];
        }
    }

    function getEvent(
        bytes32 documentHash,
        bytes32 eventHash
    ) external view returns (Event memory) {
        require(
            bytes(documents[documentHash].creator).length > 0,
            "Document does not exist"
        );
        Event memory ev = documents[documentHash].events[eventHash];
        require(ev.sender.length > 0, "Event does not exist");
        return ev;
    }

    function getAccessesByDocument(
        bytes32 documentHash,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        require(
            bytes(documents[documentHash].creator).length > 0,
            "Document does not exist"
        );
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = documents[documentHash]
            .allInvited
            .length
            .paginate(page, pageSize);
        items = new bytes[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = documents[documentHash].allInvited[ids[i]];
        }
    }

    function getAccessesBySubject(
        bytes calldata subject,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        require(accessBySubject[subject].length > 0, "Subject does not exist");
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = accessBySubject[subject]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = accessBySubject[subject][ids[i]];
        }
    }

    function isCreator(bytes calldata did) external view returns (bool) {
        return _getAccountAccess(bytes32(0), did, SCOPE.TNT_CREATE);
    }

    function getGrantedBy(
        bytes32 docHash,
        bytes calldata did,
        ACCESS_ENUM[] calldata acc
    )
        external
        view
        returns (bytes[] memory, ACCOUNT_TYPE[] memory, bool[] memory)
    {
        if (acc.length == 0) {
            revert InvalidArrayLength();
        }
        require(
            bytes(documents[docHash].creator).length > 0,
            "Document does not exist"
        );
        uint256 accLength = acc.length;
        bytes[] memory grantedByAccounts = new bytes[](accLength);
        ACCOUNT_TYPE[] memory grantedByAccountType = new ACCOUNT_TYPE[](
            accLength
        );
        bool[] memory access = new bool[](accLength);
        Document storage doc = documents[docHash];
        Access_Struct storage accs = doc.invited[did];
        for (uint256 i = 0; i < accLength; i++) {
            if (acc[i] == ACCESS_ENUM.CREATOR) {
                if (compareStrings(string(did), doc.creator)) {
                    grantedByAccounts[i] = did;
                    grantedByAccountType[i] = ACCOUNT_TYPE.DID_EBSI;
                    access[i] = true;
                }
            } else {
                grantedByAccounts[i] = accs.grantedBy[acc[i]];
                grantedByAccountType[i] = accs.grantedByAccountType[acc[i]];
                access[i] = accs.acc[acc[i]];
            }
        }
        return (grantedByAccounts, grantedByAccountType, access);
    }

    // public functions
    function initializeV2(address _tprAddress) public reinitializer(2) {
        trustedPoliciesRegistry = IPolicyRegistry(_tprAddress);
        emit ContractReinitialized(2, abi.encode(_tprAddress));
    }

    // internal functions

    function _onInitialize() internal onlyInitializing {}

    function _createDocument(
        bytes32 documentHash,
        string calldata documentMetadata,
        uint256 timestamp,
        Source timestampSource,
        bytes32 timestampProof,
        string calldata creator
    ) internal {
        if (bytes(documentMetadata).length > MAX_METADATA_LENGTH) {
            revert InvalidMetadata();
        }
        if (bytes(documents[documentHash].creator).length > 0) {
            revert DocumentExists();
        }
        // create document
        Document storage _document = documents[documentHash];
        _document.documentMetadata = documentMetadata;
        _document.creator = creator;
        // add Timestamp
        if (timestamp == 0) {
            revert InvalidTimestamp();
        }
        Timestamp storage _timestamp = _document.documentTimestamp;
        _timestamp.timestamp = timestamp;
        _timestamp.proof = timestampProof;
        _timestamp.source = timestampSource;
        documentsMapped.set(documentHash, documentHash);

        // add helpers
        bytes memory creatorBytes = bytes(creator);
        _document.allInvitedIndex[creatorBytes] = _document.allInvited.length;
        _document.allInvited.push(creatorBytes);

        if (
            accessBySubject[creatorBytes].length == 0 ||
            (accessBySubject[creatorBytes].length > 0 &&
                accessBySubjectIndex[creatorBytes][documentHash] == 0 &&
                accessBySubject[creatorBytes][0] != documentHash)
        ) {
            accessBySubject[creatorBytes].push(documentHash);
            accessBySubjectIndex[creatorBytes][documentHash] =
                accessBySubject[creatorBytes].length - 1;
        }

        emit DocumentCreated(
            documentHash,
            documentMetadata,
            creator,
            timestamp,
            timestampSource,
            timestampProof
        );
    }

    function _grantAccess(
        bytes32 documentHash,
        bytes calldata grantedByAccount,
        bytes calldata subjectAccount,
        ACCOUNT_TYPE grantedByAccType,
        ACCOUNT_TYPE subjectAccType,
        ACCESS_ENUM permission
    ) internal {
        Document storage _document = documents[documentHash];
        if (_document.invited[subjectAccount].acc[permission]) {
            revert PermissionExists();
        }

        if (
            !TrackAndTraceLib._equal(grantedByAccount, bytes(_document.creator))
        ) {
            // granted by an account with "delegate" permission.
            // Save the subjectAccount as one of its children
            if (
                _document.invited[grantedByAccount].children.length ==
                MAX_DELEGATED_CHILDREN
            ) {
                revert TooManyDelegatedChildren();
            }
            _document.invited[grantedByAccount].children.push(subjectAccount);
            _document.invited[grantedByAccount].childrenIndex[subjectAccount] =
                _document.invited[grantedByAccount].children.length - 1;
        }

        _document.invited[subjectAccount].acc[permission] = true;
        _document.invited[subjectAccount].grantedBy[permission] =
            grantedByAccount;
        _document.invited[subjectAccount].grantedByAccountType[permission] =
            grantedByAccType;
        if (_document.invited[subjectAccount].subject.length == 0) {
            _document.invited[subjectAccount].subject = subjectAccount;
            _document.invited[subjectAccount].subjectAccountType =
                subjectAccType;
        }
        // add helpers

        if (
            _document.allInvitedIndex[subjectAccount] == 0 &&
            !TrackAndTraceLib._equal(_document.allInvited[0], subjectAccount)
        ) {
            uint256 index = _document.allInvited.length;
            _document.allInvited.push(subjectAccount);
            _document.allInvitedIndex[subjectAccount] = index;
        }

        if (
            accessBySubject[subjectAccount].length == 0 ||
            (accessBySubject[subjectAccount].length > 0 &&
                accessBySubjectIndex[subjectAccount][documentHash] == 0 &&
                accessBySubject[subjectAccount][0] != documentHash)
        ) {
            accessBySubject[subjectAccount].push(documentHash);
            accessBySubjectIndex[subjectAccount][documentHash] =
                accessBySubject[subjectAccount].length - 1;
        }

        emit AccessGranted(
            documentHash,
            subjectAccount,
            grantedByAccount,
            permission
        );
    }

    function _revokeAccess(
        bytes32 documentHash,
        bytes memory revokedByAccount,
        bytes memory subjectAccount,
        ACCESS_ENUM permission
    ) internal {
        Document storage doc = documents[documentHash];

        delete doc.invited[subjectAccount].acc[permission];
        delete doc.invited[subjectAccount].grantedBy[permission];
        delete doc.invited[subjectAccount].grantedByAccountType[permission];
        if (
            !doc.invited[subjectAccount].acc[ACCESS_ENUM.WRITE] &&
            !doc.invited[subjectAccount].acc[ACCESS_ENUM.DELEGATE] &&
            !TrackAndTraceLib._equal(subjectAccount, bytes(doc.creator))
        ) {
            // remove subject from allInvited
            uint256 index = doc.allInvitedIndex[subjectAccount];
            bytes memory lastAcc = doc.allInvited[doc.allInvited.length - 1];
            doc.allInvited[index] = lastAcc;
            doc.allInvited.pop();
            doc.allInvitedIndex[lastAcc] = index;
            doc.allInvitedIndex[subjectAccount] = 0;

            // remove subject from accessBySubject
            index = accessBySubjectIndex[subjectAccount][documentHash];
            bytes32 lastElement = accessBySubject[subjectAccount][
                accessBySubject[subjectAccount].length - 1
            ];
            accessBySubject[subjectAccount][index] = lastElement;
            accessBySubject[subjectAccount].pop();
            accessBySubjectIndex[subjectAccount][lastElement] = index;
            accessBySubjectIndex[subjectAccount][documentHash] = 0;
        }

        if (
            permission == ACCESS_ENUM.WRITE &&
            !TrackAndTraceLib._equal(revokedByAccount, bytes(doc.creator))
        ) {
            // revoked by an account with "delegate" permission.
            // Remove the subjectAccount from the children
            uint256 index = doc.invited[revokedByAccount].childrenIndex[
                subjectAccount
            ];
            bytes memory lastChild = doc.invited[revokedByAccount].children[
                doc.invited[revokedByAccount].children.length - 1
            ];
            doc.invited[revokedByAccount].children[index] = lastChild;
            doc.invited[revokedByAccount].childrenIndex[lastChild] = index;
            doc.invited[revokedByAccount].children.pop();
            doc.invited[revokedByAccount].childrenIndex[subjectAccount] = 0;
        }

        if (permission == ACCESS_ENUM.DELEGATE) {
            while (doc.invited[subjectAccount].children.length > 0) {
                bytes memory child = doc.invited[subjectAccount].children[0];
                _revokeAccess(
                    documentHash,
                    subjectAccount,
                    child,
                    ACCESS_ENUM.WRITE
                );
            }
        }

        emit AccessRevoked(documentHash, subjectAccount, revokedByAccount);
    }

    function _writeEvent(
        WriteEvent calldata eventParams,
        uint256 timestamp,
        Source timestampSource,
        bytes32 timestampProof
    ) internal {
        if (bytes(eventParams.metadata).length > MAX_METADATA_LENGTH) {
            revert InvalidMetadata();
        }
        bytes32 eventHash = keccak256(bytes(eventParams.externalHash));
        Document storage _document = documents[eventParams.documentHash];
        if (_document.events[eventHash].hash != 0x00) {
            revert ExternalHashExist();
        }
        _document.events[eventHash].hash = eventHash;
        _document.events[eventHash].externalHash = eventParams.externalHash;
        _document.events[eventHash].sender = eventParams.sender;
        _document.events[eventHash].origin = eventParams.origin;
        _document.events[eventHash].eventMetadata = eventParams.metadata;
        // add Timestamp
        if (timestamp == 0) {
            revert InvalidTimestamp();
        }
        Timestamp storage _timestamp = _document
            .events[eventHash]
            .eventTimestamp;
        _timestamp.timestamp = timestamp;
        _timestamp.proof = timestampProof;
        _timestamp.source = timestampSource;

        // helpers

        _document.eventHashes.push(eventHash);

        emit EventWritten(
            eventParams.documentHash,
            eventHash,
            eventParams.sender,
            eventParams.metadata,
            eventParams.origin,
            timestamp,
            timestampSource,
            timestampProof
        );
    }

    function _authorizeUpgrade(address) internal view override {
        if (!hasRole(UPGRADER_ROLE, msg.sender)) {
            revert NotUpgrader();
        }
    }

    function _authorize(
        bytes memory account,
        ACCOUNT_TYPE accountType
    ) internal view returns (bool) {
        // authorise did:ebsi or did:key with msg.sender.
        return
            (accountType == ACCOUNT_TYPE.DID_EBSI &&
                didRegistry.checkController(account, msg.sender)) ||
            (accountType == ACCOUNT_TYPE.DID_KEY &&
                msg.sender == TrackAndTraceLib.getAddress(account));
    }

    function _getAccountAccess(
        bytes32 documentHash,
        bytes memory account,
        SCOPE scopeRequested
    ) internal view returns (bool) {
        Document storage doc = documents[documentHash];
        Access_Struct storage current = doc.invited[account];
        if (SCOPE.TNT_DELEGATE == scopeRequested) {
            return current.acc[ACCESS_ENUM.DELEGATE];
        } else if (SCOPE.TNT_CREATE == scopeRequested) {
            if (documentHash == bytes32(0)) {
                // general tnt create -> to create new document
                return invitedDidEbsiAccounts[string(account)];
            } else {
                return compareStrings(string(account), doc.creator);
            }
        } else if (SCOPE.TNT_WRITE == scopeRequested) {
            return
                compareStrings(string(account), doc.creator) ||
                current.acc[ACCESS_ENUM.WRITE];
        } else {
            return false;
        }
    }

    function compareStrings(
        string memory str1,
        string memory str2
    ) internal pure returns (bool) {
        return
            keccak256(abi.encodePacked(str1)) ==
            keccak256(abi.encodePacked(str2));
    }
}
