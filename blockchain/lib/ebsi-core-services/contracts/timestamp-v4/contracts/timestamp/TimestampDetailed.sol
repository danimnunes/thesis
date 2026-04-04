// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

// solhint-disable-next-line max-line-length
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./TimestampLib.sol";
import "./HashAlgoLib.sol";

abstract contract TimestampDetailed is Initializable, TimestampStorage {
    using TimestampLib for Timestamps;
    using Pagination for uint256;
    event TimestampedHashes(
        bytes32[] timestampIds,
        uint256[] hashAlgorithmIds,
        bytes[] hashValues,
        bytes[] timestampData
    );

    /**
     * @dev  timestamps one or more hashes. Up to three hashes can be timestamped at a time.
     */
    function timestampHashes(
        uint256[] calldata hashAlgorithmIds,
        bytes[] calldata hashValues,
        bytes[] calldata timestampData
    ) external returns (bytes32[] memory timestampIds) {
        HashAlgos storage hs = hashAlgoStorage();
        Timestamps storage ts = timestampStorage();
        timestampIds = ts.timestampHashes(
            hs,
            hashAlgorithmIds,
            hashValues,
            timestampData
        );
        return timestampIds;
    }

    /**
     * @dev returns a paginated list of timestamp hashes. List of all timestamp ids is stored in the timestampIdsList
     */
    function getTimestamps(
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
        Timestamps storage ts = timestampStorage();
        uint256[] memory timestampIds;
        (timestampIds, total, howMany, prev, next) = ts
            .timestampIdsList
            .length
            .paginate(page, pageSize);
        bytes32[] memory itemsFetched = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            itemsFetched[i] = ts.timestampIdsList[timestampIds[i]];
        }
        items = itemsFetched;
    }

    /**
     * @dev returns the timestamp of the hash. The timestamp is stored in the timestampsStore.
     */
    function getTimestamp(
        bytes calldata hashValue
    )
        external
        view
        returns (
            TimestampStorage.Hash memory hash,
            address timestampedBy,
            uint256 blockNumber,
            bytes memory data
        )
    {
        Timestamps storage ts = timestampStorage();
        return ts.getTimestamp(hashValue);
    }

    /**
     * @dev returns the timestamp by timestampId (sha256(hashvalue)). The timestamp is stored in the timestampsStore.
     */
    function getTimestampById(
        bytes32 timestampId
    )
        external
        view
        returns (
            TimestampStorage.Hash memory hash,
            address timestampedBy,
            uint256 blockNumber,
            bytes memory data
        )
    {
        Timestamps storage ts = timestampStorage();
        return ts.getTimestampById(timestampId);
    }

    uint256[50] private __gap;
}
