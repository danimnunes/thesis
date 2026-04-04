// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./RecordStorage.sol";
import "./TimestampDetailed.sol";
import "./TimestampLib.sol";
import "./TimestampStorage.sol";
import "./RecordLib.sol";

abstract contract RecordDetailed is RecordStorage {
    using RecordLib for Records;
    using TimestampLib for Timestamps;
    using Pagination for uint256;

    event RecordedHashes(
        bytes32 indexed recordId,
        bytes32[] timestampIds,
        bytes32 versionInfoHash
    );
    event RecordVersionInfo(
        bytes32 recordId,
        bytes32 versionInfoHash,
        uint versionId
    );
    event TimestampIdDetached(bytes32 timestampId);
    event RecordOwnerAdded(string ownerId);
    event OwnerIdRevoked(string ownerId);
    event TimestampVersionHashes(
        bytes versionHash,
        bytes32[] timestampIds,
        bytes versionInfo
    );

    /**
     * @dev  timestampVersionHashes enables subjects to timestamp up to three (version) hashes
     *                              of different types at a time and store the timestamps under
     *                              the given record. It creates a new version inside the record to store
     *                              the new timestamps
     */
    function timestampVersionHashes(
        bytes calldata versionHash,
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData,
        bytes calldata versionInfo
    ) external {
        bytes32[] memory timestampIds;
        // block scoping to avoid stack too deep
        {
            HashAlgos storage hs = hashAlgoStorage();
            Timestamps storage ts = timestampStorage();
            timestampIds = ts.timestampHashes(
                hs,
                hashAlgorithmIds,
                hashValues,
                timestampData
            );
        }
        Records storage rs = recordStorage();
        rs.timestampVersionHashes(versionHash, timestampIds, versionInfo);
        emit TimestampVersionHashes(versionHash, timestampIds, versionInfo);
    }

    /**
     * @dev  timestampRecordHashes enables subjects to timestamp up to three record hashes
     *                             of different types at a time. The method will create timestamps
     *                             and collect the timestampIds in a record.
     */
    function timestampRecordHashes(
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData,
        bytes calldata versionInfo
    ) external returns (bytes32 recordId) {
        bytes32[] memory timestampIds;
        // block scoping to avoid stack too deep
        {
            HashAlgos storage hs = hashAlgoStorage();
            Timestamps storage ts = timestampStorage();
            timestampIds = ts.timestampHashes(
                hs,
                hashAlgorithmIds,
                hashValues,
                timestampData
            );
        }
        Records storage rs = recordStorage();
        return
            rs.timestampRecordHashes(hashValues[0], timestampIds, versionInfo);
    }

    /**
     * @dev  timestampRecordVersionHashes enables subjects to timestamp up to three (version) hashes
     *                                 of different types at a time and store the timestamps under the given record.
     */
    function timestampRecordVersionHashes(
        bytes32 recordId,
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData,
        bytes calldata versionInfo
    ) external {
        bytes32[] memory timestampIds;
        // block scoping to avoid stack too deep
        {
            HashAlgos storage hs = hashAlgoStorage();
            Timestamps storage ts = timestampStorage();
            timestampIds = ts.timestampHashes(
                hs,
                hashAlgorithmIds,
                hashValues,
                timestampData
            );
        }

        Records storage rs = recordStorage();
        rs.timestampRecordVersionHashes(recordId, timestampIds, versionInfo);
    }

    /**
     * @dev  appendRecordVersionHashes enables to append new types of hashes to a given version.
     *       The method will timestamp the hash(es) and add them to the giver version of a Record.
     */
    function appendRecordVersionHashes(
        bytes32 recordId,
        uint256 versionId,
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData,
        bytes calldata versionInfo
    ) external {
        bytes32[] memory timestampIds;
        // block scoping to avoid stack too deep
        {
            HashAlgos storage hs = hashAlgoStorage();
            Timestamps storage ts = timestampStorage();
            timestampIds = ts.timestampHashes(
                hs,
                hashAlgorithmIds,
                hashValues,
                timestampData
            );
        }

        Records storage rs = recordStorage();
        rs.appendRecordVersionHashes(
            recordId,
            versionId,
            timestampIds,
            versionInfo
        );
    }

    /**
     * @dev  insertRecordVersionInfo enables to insert additional version info.
     */
    function insertRecordVersionInfo(
        bytes32 recordId,
        uint256 versionId,
        bytes calldata versionInfo
    ) external {
        Records storage rs = recordStorage();
        rs.insertRecordVersionInfo(recordId, versionId, versionInfo);
    }

    /**
     * @dev  detachRecordVersionHash detaches a timestamp id (computed from the hash value) from the given version.
     */
    function detachRecordVersionHash(
        bytes32 recordId,
        uint256 versionId,
        bytes calldata hashValue
    ) external {
        Records storage rs = recordStorage();
        Timestamps storage ts = timestampStorage();
        rs.detachRecordVersionHash(ts, recordId, versionId, hashValue);
    }

    /**
     * @dev insertRecordOwner enables to insert an owner address to the record. OwnerIds list.
     */
    function insertRecordOwner(
        bytes32 recordId,
        string calldata ownerId,
        uint256 notBefore,
        uint256 notAfter
    ) external {
        Records storage rs = recordStorage();
        rs.insertRecordOwner(recordId, ownerId, notBefore, notAfter);
    }

    /**
     * @dev revokeRecordOwner enables to revoke an existing record owner.
     *      Revoked owner's address is removed from record.OwnerIds list and is added to the record.
     *      revokedOwnerIds list.
     */
    function revokeRecordOwner(
        bytes32 recordId,
        string calldata ownerId
    ) external {
        Records storage rs = recordStorage();
        rs.revokeRecordOwner(recordId, ownerId);
    }

    /**
     * @dev getRecordOwnerInfo returns the record's owner info.
     */
    function getRecordOwnerInfo(
        bytes32 recordId,
        string calldata ownerId
    )
        external
        view
        returns (bool revoked, uint256 notBefore, uint256 notAfter)
    {
        Records storage rs = recordStorage();
        return rs.getRecordOwnerInfo(recordId, ownerId);
    }

    /**
     * @dev getRecordIdsByOwnerId returns a paginated list of record ids owned by the owner.
     */
    function getRecordIdsByOwnerId(
        string calldata ownerId,
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
        require(bytes(ownerId).length > 0, "ownerId empty");
        Records storage rs = recordStorage();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = rs
            .ownerIdToRecordIds[ownerId]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = rs.ownerIdToRecordIds[ownerId][ids[i]];
        }
    }

    /**
     * @dev getRecordIds returns a paginated list of record ids from recordIdsList
     */
    function getRecordIds(
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
        Records storage rs = recordStorage();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = rs.recordIdsList.length.paginate(
            page,
            pageSize
        );
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = rs.recordIdsList[ids[i]];
        }
    }

    /**
     * @dev getRecordIdsByFirstVersionHash returns a paginated list of record ids of which
     *      the first version contains the hash.
     */
    function getRecordIdsByFirstVersionHash(
        bytes calldata hashValue,
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
        require(hashValue.length > 0, "hashValue empty");
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        Records storage rs = recordStorage();
        bytes32 sha256HashValue = sha256(hashValue);
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = rs
            .firstVersionTimestampToRecordIds[sha256HashValue]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = rs.firstVersionTimestampToRecordIds[sha256HashValue][
                ids[i]
            ];
        }
    }

    /**
     * @dev getRecord returns information about a the record.
     */
    function getRecord(
        bytes32 recordId
    )
        external
        view
        returns (
            string[] memory ownerIds,
            string[] memory revokedOwnerIds,
            uint256 totalVersions
        )
    {
        require(recordId != bytes32(0), "recordId empty");
        Records storage rs = recordStorage();
        totalVersions = rs.recordsStore[recordId].totalVersions;
        require(totalVersions > 0, "record unknown");
        ownerIds = rs.recordsStore[recordId].owners;
        revokedOwnerIds = rs.recordsStore[recordId].revokedOwnerIds;
    }

    /**
     * @dev getRecordVersion returns the recordVersion object from recordsStore[recordId].versionsStore[versionId]
     */
    function getRecordVersion(
        bytes32 recordId,
        uint256 versionId,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            uint256[] memory hashAlgorithmIds,
            bytes[] memory hashValues,
            bytes32[] memory infoIds,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(recordId != bytes32(0), "recordId empty");
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        Records storage rs = recordStorage();
        bytes32[] memory timestampIds;

        RecordStorage.VersionDetails storage vd = rs
            .recordsStore[recordId]
            .versionsStore[versionId];
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = vd.timestampsIds.length.paginate(
            page,
            pageSize
        );
        timestampIds = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            timestampIds[i] = vd.timestampsIds[ids[i]];
        }
        // no pagination as we might have less info than timestamps
        infoIds = vd.info;

        // For every timestampId in versionDetails.timestampIds get the timestamped hash
        Timestamps storage ts = timestampStorage();
        hashAlgorithmIds = new uint256[](timestampIds.length);
        hashValues = new bytes[](timestampIds.length);
        for (uint256 i = 0; i < timestampIds.length; i++) {
            hashAlgorithmIds[i] = ts
                .timestampsStore[timestampIds[i]]
                .hash
                .algorithm;
            hashValues[i] = ts.timestampsStore[timestampIds[i]].hash.value;
        }
    }

    /**
     * @dev getRecordVersionInfo returns version info by version info id (hash) from the versionInfoStore[versionInfoId]
     */
    function getRecordVersionInfo(
        bytes32 versionInfoId
    ) external view returns (bytes memory info) {
        require(versionInfoId != bytes32(0), "versionInfoId empty");
        Records storage rs = recordStorage();
        return rs.versionInfoStore[versionInfoId];
    }

    uint256[50] private __gap;
}
