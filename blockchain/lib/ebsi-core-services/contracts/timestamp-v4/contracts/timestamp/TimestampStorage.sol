// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./HashAlgoStorage.sol";

abstract contract TimestampStorage is HashAlgoStorage {
    // The state variables we care about.
    bytes32 public constant TS_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.timestamp.storage"
    );

    struct Hash {
        uint256 algorithm;
        bytes value;
    }

    struct Timestamp {
        Hash hash;
        address timestampedBy;
        uint256 blockNumber;
        bytes data;
    }

    struct Timestamps {
        uint256 version;
        mapping(bytes32 => Timestamp) timestampsStore;
        // a list of all ts ids. TS ID is computed as sha2-256(hashValue)
        bytes32[] timestampIdsList;
    }

    // Creates and returns the storage pointer to the struct.
    function timestampStorage() internal pure returns (Timestamps storage ms) {
        bytes32 position = TS_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    uint256[50] private __gap;
}
