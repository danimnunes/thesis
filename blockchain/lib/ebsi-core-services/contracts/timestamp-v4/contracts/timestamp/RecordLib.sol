// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./RecordStorage.sol";
import "@ebsiint-sc/bootstrap-v2/contracts/utils/StringManip.sol";
import "./TimestampLib.sol";
import "./TimestampStorage.sol";
import "./RecordStorage.sol";
import "./RecordStorage.sol";

library RecordLib {
    using StringManip for address;
    using TimestampLib for TimestampStorage.Timestamps;
    uint public constant MAX_TIMESTAMPS_PER_VERSION = 10;
    uint public constant MAX_RECORDS_PER_TIMESTAMP = 10;

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

    /**
     * @dev  checkIfOwnerExist checks if the sender is the owner of the record
     */
    function checkIfOwnerExist(
        address ownerId,
        RecordStorage.Record storage r
    ) internal view returns (bool) {
        string memory ownerIdStr = ownerId.convertToString();
        if (r.ownerIndex[ownerIdStr] == 0) return false;
        RecordStorage.OwnerInfo memory owner = r.ownerInfo[ownerIdStr];
        return
            !owner.revoked &&
            block.timestamp >= owner.notBefore &&
            block.timestamp <= owner.notAfter;
    }

    function _addTimestampsToVersion(
        RecordStorage.Records storage rs,
        RecordStorage.VersionDetails storage vd,
        bytes32[] calldata timestampIds,
        bytes32 recordId
    ) internal {
        for (uint256 i = 0; i < timestampIds.length; i++) {
            if (!vd.timestampExist[timestampIds[i]]) {
                vd.timestampsIds.push(timestampIds[i]);
                vd.timestampExist[timestampIds[i]] = true;
                // add this new timestampId to the record list
                if (
                    !rs.checkTimestampIdToRecordIdExist[timestampIds[i]][
                        recordId
                    ]
                ) {
                    require(
                        rs.timestampIdToRecordIds[timestampIds[i]].length <
                            MAX_RECORDS_PER_TIMESTAMP,
                        "limit of records per timestamp exceeded"
                    );
                    rs.timestampIdToRecordIds[timestampIds[i]].push(recordId);
                    rs.checkTimestampIdToRecordIdExist[timestampIds[i]][
                        recordId
                    ] = true;
                }
            }
        }
    }

    /**
     * @dev  timestampVersionHashes enables subjects to timestamp up to three (version) hashes
     *                              of different types at a time and store the timestamps under
     *                              the given record. It creates a new version inside the record to store
     *                              the new timestamps
     */
    function timestampVersionHashes(
        RecordStorage.Records storage rs,
        bytes calldata versionHash,
        bytes32[] calldata timestampIds,
        bytes calldata versionInfo
    ) external {
        require(versionHash.length > 0, "versionHash empty");
        //Compute timestampid from the versionHash to get the corresponding recordIds
        bytes32 tsId = sha256(versionHash);
        bytes32[] memory recordIds = rs.timestampIdToRecordIds[tsId];
        // if you have more than one you should call timestampRecordVersionHashes
        // and if you have zero you should call timestampRecordHashes
        require(recordIds.length == 1, "wrong record count");

        RecordStorage.Record storage r = rs.recordsStore[recordIds[0]];
        require(
            checkIfOwnerExist(msg.sender, r),
            "sender is not listed as owner"
        );

        RecordStorage.VersionDetails storage vd = r.versionsStore[
            r.totalVersions
        ];

        // No need to check MAX_TIMESTAMPS_PER_VERSION because
        // it is a new version, that is, no previous timestamps

        _addTimestampsToVersion(rs, vd, timestampIds, recordIds[0]);

        if (versionInfo.length > 0) {
            bytes32 versionInfoHash = sha256(versionInfo);
            rs.versionInfoStore[versionInfoHash] = versionInfo;
            vd.info.push(versionInfoHash);
        }
        // increment version numbers
        r.totalVersions++;
    }

    /**
     * @dev  timestampRecordHashes enables subjects to timestamp up to three record hashes
     *       of different types at a time. The method will create timestamps and collect
     *       the timestampIds in a record. hashValue is the hash of the first version of
     *       the timestamped object needed to calculate the recordId
     */
    function timestampRecordHashes(
        RecordStorage.Records storage rs,
        bytes calldata hashValue,
        bytes32[] calldata timestampIds,
        bytes calldata versionInfo
    ) external returns (bytes32 recordId) {
        //Compute record unique id as  SHA2-256(tx.signer.address || BlockNumber || hashValue of the timestamp object)
        recordId = sha256(abi.encode(msg.sender, block.number, hashValue));

        RecordStorage.Record storage r = rs.recordsStore[recordId];
        require(r.totalVersions == 0, "record exists");
        rs.recordIdsList.push(recordId);

        string memory ownerId = msg.sender.convertToString();

        if (r.ownerIndex[ownerId] == 0) {
            r.owners.push(ownerId);
            r.ownerIndex[ownerId] = r.owners.length;
        }
        rs.ownerIdToRecordIds[ownerId].push(recordId);
        rs.indexOwnerIdToRecordIds[ownerId][recordId] = rs
            .ownerIdToRecordIds[ownerId]
            .length;

        // solhint-disable-next-line
        r.ownerInfo[ownerId] = RecordStorage.OwnerInfo(
            block.timestamp,
            type(uint256).max,
            false
        );
        RecordStorage.VersionDetails storage vd = r.versionsStore[0];

        // No need to check MAX_TIMESTAMPS_PER_VERSION because
        // it is a new version, that is, no previous timestamps

        _addTimestampsToVersion(rs, vd, timestampIds, recordId);
        for (uint256 i = 0; i < timestampIds.length; i++) {
            // that timestamp is a first registered version for this new record
            require(
                rs.firstVersionTimestampToRecordIds[timestampIds[i]].length <
                    MAX_RECORDS_PER_TIMESTAMP,
                "limit of records per timestamp exceeded in first version"
            );
            rs.firstVersionTimestampToRecordIds[timestampIds[i]].push(recordId);
        }
        if (versionInfo.length > 0) {
            bytes32 versionInfoHash = sha256(versionInfo);
            if (rs.versionInfoStore[versionInfoHash].length == 0) {
                // removal of SafeAddArray
                vd.info.push(versionInfoHash);
            }
            rs.versionInfoStore[versionInfoHash] = versionInfo;
            emit RecordedHashes(recordId, timestampIds, versionInfoHash);
        } else {
            emit RecordedHashes(recordId, timestampIds, bytes32(0));
        }

        // increment version numbers
        r.totalVersions++;
    }

    /**
     * @dev  timestampRecordVersionHashes enables subjects to timestamp up to three (version) hashes
     *                                 of different types at a time and store the timestamps under the given record.
     */
    function timestampRecordVersionHashes(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        bytes32[] calldata timestampIds,
        bytes calldata versionInfo
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        // check record exists
        RecordStorage.Record storage r = rs.recordsStore[recordId];

        require(r.totalVersions > 0, "record unknown");
        require(
            checkIfOwnerExist(msg.sender, r),
            "sender is not listed as owner"
        );

        // create a new version detail

        RecordStorage.VersionDetails storage vd = r.versionsStore[
            r.totalVersions
        ];

        // No need to check MAX_TIMESTAMPS_PER_VERSION because
        // it is a new version, that is, no previous timestamps

        _addTimestampsToVersion(rs, vd, timestampIds, recordId);

        if (versionInfo.length > 0) {
            bytes32 versionInfoHash = sha256(versionInfo);
            rs.versionInfoStore[versionInfoHash] = versionInfo;
            vd.info.push(versionInfoHash);
            emit RecordedHashes(recordId, timestampIds, versionInfoHash);
        } else {
            emit RecordedHashes(recordId, timestampIds, bytes32(0));
        }
        // increment version numbers
        r.totalVersions++;
    }

    /**
     * @dev  appendRecordVersionHashes enables to append new types of hashes to a given version.
     *       The method will timestamp the hash(es) and add them to the giver version of a Record.
     */
    function appendRecordVersionHashes(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        uint256 versionId,
        bytes32[] calldata timestampIds,
        bytes calldata versionInfo
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        RecordStorage.VersionDetails storage vd = rs
            .recordsStore[recordId]
            .versionsStore[versionId];

        require(vd.timestampsIds.length > 0, "record/version unknown");
        require(
            checkIfOwnerExist(msg.sender, rs.recordsStore[recordId]),
            "sender is not listed as owner"
        );

        require(
            vd.timestampsIds.length + timestampIds.length <=
                MAX_TIMESTAMPS_PER_VERSION,
            "limit of timestamps per version exceeded"
        );

        _addTimestampsToVersion(rs, vd, timestampIds, recordId);

        if (versionInfo.length > 0) {
            bytes32 versionInfoHash = sha256(versionInfo);
            rs.versionInfoStore[versionInfoHash] = versionInfo;
            vd.info.push(versionInfoHash);
            emit RecordedHashes(recordId, timestampIds, versionInfoHash);
        } else {
            emit RecordedHashes(recordId, timestampIds, bytes32(0));
        }
    }

    /**
     * @dev  insertRecordVersionInfo enables to insert additional version info.
     */
    function insertRecordVersionInfo(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        uint256 versionId,
        bytes calldata versionInfo
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        require(versionInfo.length > 0, "versionInfo empty");
        RecordStorage.VersionDetails storage vd = rs
            .recordsStore[recordId]
            .versionsStore[versionId];
        require(vd.timestampsIds.length > 0, "record/version unknown");
        require(
            checkIfOwnerExist(msg.sender, rs.recordsStore[recordId]),
            "sender is not listed as owner"
        );

        bytes32 versionInfoHash = sha256(versionInfo);
        rs.versionInfoStore[versionInfoHash] = versionInfo;
        vd.info.push(versionInfoHash);
        emit RecordVersionInfo(recordId, versionInfoHash, versionId);
    }

    /**
     * @dev  detachRecordVersionHash detaches a timestamp id (computed from the hash value) from the given version.
     */
    function detachRecordVersionHash(
        RecordStorage.Records storage rs,
        TimestampStorage.Timestamps storage ts,
        bytes32 recordId,
        uint256 versionId,
        bytes calldata hashValue
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        require(hashValue.length > 0, "hashValue empty");
        RecordStorage.VersionDetails storage vd = rs
            .recordsStore[recordId]
            .versionsStore[versionId];
        require(vd.timestampsIds.length > 0, "record/version unknown");
        require(
            checkIfOwnerExist(msg.sender, rs.recordsStore[recordId]),
            "sender is not listed as owner"
        );

        bytes32 timestampId = sha256(hashValue);
        // check that the timestampId exists in the timestampsStore
        require(
            ts.timestampsStore[timestampId].hash.value.length > 0,
            "timestampId unknown"
        );

        // remove timestampId from versionDetail
        for (uint256 i = 0; i < vd.timestampsIds.length; i++) {
            if (vd.timestampsIds[i] == timestampId) {
                vd.timestampsIds[i] = vd.timestampsIds[
                    vd.timestampsIds.length - 1
                ];
                vd.timestampsIds.pop();
                vd.timestampExist[timestampId] = false;
                emit TimestampIdDetached(timestampId);
                break;
            }
        }

        // remove recordId from timestampIdToRecordIds
        for (
            uint256 i = 0;
            i < rs.timestampIdToRecordIds[timestampId].length;
            i++
        ) {
            if (rs.timestampIdToRecordIds[timestampId][i] == recordId) {
                rs.timestampIdToRecordIds[timestampId][i] = rs
                    .timestampIdToRecordIds[timestampId][
                        rs.timestampIdToRecordIds[timestampId].length - 1
                    ];
                rs.timestampIdToRecordIds[timestampId].pop();
                break;
            }
        }

        // remove recordId from firstVersionTimestampToRecordIds
        for (
            uint256 i = 0;
            i < rs.firstVersionTimestampToRecordIds[timestampId].length;
            i++
        ) {
            if (
                rs.firstVersionTimestampToRecordIds[timestampId][i] == recordId
            ) {
                rs.firstVersionTimestampToRecordIds[timestampId][i] = rs
                    .firstVersionTimestampToRecordIds[timestampId][
                        rs
                            .firstVersionTimestampToRecordIds[timestampId]
                            .length - 1
                    ];
                rs.firstVersionTimestampToRecordIds[timestampId].pop();
                break;
            }
        }
    }

    /**
     * @dev insertRecordOwner enables to insert an owner address to the record. OwnerIds list.
     */
    function insertRecordOwner(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        string calldata ownerId,
        uint256 notBefore,
        uint256 notAfter
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        require(bytes(ownerId).length > 0, "ownerId empty");
        require(
            notAfter > 0
                ? notAfter > notBefore && notBefore > 0
                : notBefore > 0,
            "date incorrect"
        );
        RecordStorage.Record storage r = rs.recordsStore[recordId];
        require(r.totalVersions > 0, "record unknown");
        require(
            r.ownerInfo[ownerId].notBefore == 0 || r.ownerInfo[ownerId].revoked,
            "ownerId exist"
        );
        require(
            checkIfOwnerExist(msg.sender, r),
            "sender is not listed as owner"
        );

        if (r.ownerIndex[ownerId] == 0) {
            // removal of SafeAddArray
            r.owners.push(ownerId);
            r.ownerIndex[ownerId] = r.owners.length;
        }
        rs.ownerIdToRecordIds[ownerId].push(recordId);
        rs.indexOwnerIdToRecordIds[ownerId][recordId] = rs
            .ownerIdToRecordIds[ownerId]
            .length;
        // increment owners
        if (r.ownerInfo[ownerId].revoked) {
            r.revokedOwnerIdsToBlockNum[ownerId] = 0;
            RecordStorage.RevokedOwner storage ro = r.revokedOwnerIndex[
                ownerId
            ];
            r.revokedOwnerIds[ro.index] = r.revokedOwnerIds[
                r.revokedOwnerIds.length
            ];
            r.revokedOwnerIds.pop();
            ro.exists = false;
            ro.index = 0;
            //
        }
        r.ownerInfo[ownerId] = RecordStorage.OwnerInfo(
            notBefore,
            notAfter,
            false
        );
        emit RecordOwnerAdded(ownerId);
    }

    /**
     * @dev revokeRecordOwner enables to revoke an existing record owner.
     *      Revoked owner's address is removed from record.OwnerIds list
     *      and is added to the record.revokedOwnerIds list.
     */
    function revokeRecordOwner(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        string calldata ownerId
    ) external {
        require(recordId != bytes32(0), "recordId empty");
        require(bytes(ownerId).length > 0, "ownerId empty");
        RecordStorage.Record storage r = rs.recordsStore[recordId];
        require(r.totalVersions > 0, "record unknown");
        require(
            checkIfOwnerExist(msg.sender, r),
            "sender is not listed as owner"
        );

        // remove ownerId from owners
        bool ownerIdFound = false;
        bytes32 ownerIdHash = keccak256(bytes(ownerId));
        require(r.ownerIndex[ownerId] > 0, "ownerId unknown");
        r.owners[r.ownerIndex[ownerId] - 1] = r.owners[r.owners.length - 1];
        r.ownerIndex[r.owners[r.owners.length - 1]] = r.ownerIndex[ownerId];
        r.owners.pop();
        r.ownerIndex[ownerId] = 0;

        if (!r.ownerInfo[ownerId].revoked) {
            // removal of SafeAddArray
            r.revokedOwnerIndex[ownerId].index = r.revokedOwnerIds.length;
            r.revokedOwnerIndex[ownerId].exists = true;
            r.revokedOwnerIds.push(ownerId);
        }
        // Remove the record owner from ownerIdToRecordIds map.
        rs.ownerIdToRecordIds[ownerId][
            rs.indexOwnerIdToRecordIds[ownerId][recordId] - 1
        ] = rs.ownerIdToRecordIds[ownerId][
            rs.ownerIdToRecordIds[ownerId].length - 1
        ];
        rs.indexOwnerIdToRecordIds[ownerId][
            rs.ownerIdToRecordIds[ownerId][
                rs.ownerIdToRecordIds[ownerId].length - 1
            ]
        ] = rs.indexOwnerIdToRecordIds[ownerId][recordId];
        rs.ownerIdToRecordIds[ownerId].pop();
        rs.indexOwnerIdToRecordIds[ownerId][recordId] = 0;

        // set the ownerInfo to revoked
        r.ownerInfo[ownerId].revoked = true;
        emit OwnerIdRevoked(ownerId);
    }

    /**
     * @dev getRecordOwnerInfo returns the record's owner info.
     */
    function getRecordOwnerInfo(
        RecordStorage.Records storage rs,
        bytes32 recordId,
        string calldata ownerId
    )
        external
        view
        returns (bool revoked, uint256 notBefore, uint256 notAfter)
    {
        require(recordId != bytes32(0), "recordId empty");
        require(bytes(ownerId).length > 0, "ownerId empty");
        RecordStorage.Record storage r = rs.recordsStore[recordId];
        require(r.totalVersions > 0, "record unknown");

        return (
            r.ownerInfo[ownerId].revoked,
            r.ownerInfo[ownerId].notBefore,
            r.ownerInfo[ownerId].notAfter
        );
    }
}
