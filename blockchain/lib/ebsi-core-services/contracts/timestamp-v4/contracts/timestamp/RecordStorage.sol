// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./TimestampStorage.sol";

abstract contract RecordStorage is TimestampStorage {
    // The state variables we care about.
    bytes32 public constant TS_RECORD_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.record.storage"
    );

    struct OwnerInfo {
        uint256 notBefore; // time before which the owner should be considered inactive
        uint256 notAfter; // time after which the owner should be considered inactive
        bool revoked; // set to true when revoked
    }

    struct VersionDetails {
        bytes32[] timestampsIds; // one or more version timestamps
        bytes32[] info; // ordered list of version info hashes
        mapping(bytes32 => bool) timestampExist;
    }

    struct RevokedOwner {
        bool exists;
        uint index;
    }

    struct Record {
        // ownerId is DID or address of the user that can control the metadata-file-links-store.
        string[] owners;
        /**
         * map to get the index of the previous array.
         * 0 means that it doesn't exist
         * the rest of indexes are increased by 1
         */
        mapping(string => uint256) ownerIndex;
        string[] revokedOwnerIds;
        mapping(string => RevokedOwner) revokedOwnerIndex;
        // owners information
        mapping(string => OwnerInfo) ownerInfo;
        // a list of revoked owner ids and the blocknumber which the owner id is revoked
        mapping(string => uint256) revokedOwnerIdsToBlockNum;
        // mapping of a timestmapID to a version
        mapping(bytes32 => uint256) timestampIdToVersionId;
        // Number of total record versions
        uint256 totalVersions;
        mapping(uint256 => VersionDetails) versionsStore;
    }

    struct Records {
        mapping(bytes32 => Record) recordsStore;
        // version timestamp information key is info hash
        mapping(bytes32 => bytes) versionInfoStore;
        // a list of all record ids. recordId is computed as SHA2-256(tx.signer.Address|blocknumber|hashvalue)
        bytes32[] recordIdsList;
        //  timestampId to list a recordIds
        mapping(bytes32 => bytes32[]) timestampIdToRecordIds;
        /**
         * ownerId to list a recordIds
         * example:
         *   ["0x1234"]:
         *     0- 0xRecordA
         *     1- 0xRecordB
         *   ["0x2345"]:
         *     0- 0xRecordB
         *     1- 0xRecordC
         *     2- 0xRecordD
         */
        mapping(string => bytes32[]) ownerIdToRecordIds;
        /**
         * index of the records in ownerIdToRecordIds.
         * 0 means that it doesn't exist
         * the rest of indexes are increased by 1
         * example:
         *   ["0x1234"]:
         *     [0xRecordA]: 1
         *     [0xRecordB]: 2
         *   ["0x2345"]:
         *     [0xRecordA]: 0 (not part of 0x2345)
         *     [0xRecordB]: 1
         *     [0xRecordC]: 2
         *     [0xRecordD]: 3
         */
        mapping(string => mapping(bytes32 => uint256)) indexOwnerIdToRecordIds;
        //  hash of the first record version (timestampId) to recordId
        mapping(bytes32 => bytes32[]) firstVersionTimestampToRecordIds;
        mapping(bytes32 => mapping(bytes32 => bool)) checkTimestampIdToRecordIdExist;
    }

    // Creates and returns the storage pointer to the struct.
    function recordStorage() internal pure returns (Records storage ms) {
        bytes32 position = TS_RECORD_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    uint256[50] private __gap;
}
