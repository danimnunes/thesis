// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

interface ITrackAndTraceInterface {
    // List of structures and variable types

    enum Source {
        Block,
        External
    }
    enum ACCESS_ENUM {
        DELEGATE,
        WRITE,
        CREATOR
    }
    enum ACCOUNT_TYPE {
        DID_EBSI,
        DID_KEY
    }
    enum SCOPE {
        NO_ACCESS,
        TNT_AUTHORIZE,
        TNT_CREATE,
        TNT_WRITE,
        TNT_DELEGATE
    }

    struct Access_Struct {
        mapping(ACCESS_ENUM => bool) acc;
        mapping(ACCESS_ENUM => bytes) grantedBy;
        mapping(ACCESS_ENUM => ACCOUNT_TYPE) grantedByAccountType;
        bytes subject;
        ACCOUNT_TYPE subjectAccountType;
        /**
         * When the subject has "delegate" permission he can grant
         * write access to other accounts. These accounts are the
         * "children" of the subject.
         */
        bytes[] children;
        mapping(bytes => uint256) childrenIndex;
    }

    struct Timestamp {
        uint256 timestamp; // seconds since 1 Jan 1970 (UTC)
        Source source;
        bytes32 proof; // external proof or if internal then its block.hash
    }

    struct Event {
        string externalHash;
        bytes32 hash;
        Timestamp eventTimestamp; // creation of the event timestamp
        bytes sender; // did:ebsi or did:key
        string origin;
        string eventMetadata; // limited to 2k char in strings -> will be casted to bytes and use string utilities
    }

    struct DocumentGetter {
        string documentMetadata;
        Timestamp documentTimestamp; // creation of the document
        string creator;
    }

    struct DocumentGetter__deprecated {
        string documentMetadata;
        Timestamp documentTimestamp; // creation of the document
        /**
         * list of hashes so we can iterate through them, will see
         * on implementation if we need additional mappings to reduce
         * complexity for querying an event
         */
        bytes32[] eventHashes;
        string creator;
    }

    struct Document {
        string documentMetadata;
        Timestamp documentTimestamp; // creation of the document
        /**
         * list of events by their unique identifier (hash which
         * on-chain is a sha3 of externalHash)
         */
        mapping(bytes32 => Event) events;
        /**
         * list of hashes so we can iterate through them, will see
         * on implementation if we need additional mappings to reduce
         * complexity for querying an event
         */
        bytes32[] eventHashes;
        string creator;
        mapping(bytes => Access_Struct) invited;
        bytes[] allInvited;
        mapping(bytes => uint256) allInvitedIndex;
    }

    struct WriteEvent {
        bytes32 documentHash;
        string externalHash;
        bytes sender;
        string origin;
        string metadata;
    }

    // events

    event DidAuthorised(address addr, bytes pubKey, bool val);
    event ContractReinitialized(uint256 version, bytes data);
    event DidEbsiAuthorised(string did, bool val);
    event DocumentCreated(
        bytes32 docHash,
        string metadata,
        string creator,
        uint256 timestamp,
        Source source,
        bytes32 proof
    );
    event DocumentRemoved(bytes32 docHash);
    event AccessGranted(
        bytes32 docHash,
        bytes subject,
        bytes signer,
        ACCESS_ENUM permission
    );
    event AccessRevoked(bytes32 docHash, bytes subject, bytes signer);
    event EventWritten(
        bytes32 docHash,
        bytes32 eventHash,
        bytes sender,
        string metadata,
        string origin,
        uint256 timestamp,
        Source source,
        bytes32 proof
    );

    // errors
    error NotUpgrader();
    error InvalidAddress();
    error InvalidPublicKeyLength();
    error DidNotInvited();
    error DocumentExists();
    error DocumentDoesNotExist();
    error InvalidAccess();
    error OnlyAccessGranter();
    error OnlyCreator();
    error OnlyCreatorOrDelegated();
    error OnlyCreatorOrWriter();
    error NotAuthorised();
    error NotDidController();
    error NotWhitelisted();
    error InvalidMetadata();
    error PermissionExists();
    error InvalidArrayLength();
    error InvalidTimestamp();
    error ExternalHashExist();
    error TooManyDelegatedChildren();
}
