// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./HashAlgoStorage.sol";
import "@ebsiint-sc/bootstrap-v2/contracts/utils/Pagination.sol";

library HashAlgoLib {
    using Pagination for uint256;

    event AddNewHashAlgo(
        uint256 indexed hashId,
        string indexed ianaNameHash,
        uint256 outputLength,
        string oid,
        HashAlgoStorage.Status status,
        string multiHash
    );

    event UpdateHashAlgo(
        uint256 indexed hashId,
        string indexed ianaNameHash,
        string ianaName,
        uint256 outputLength,
        string oid,
        HashAlgoStorage.Status status,
        string multiHash
    );

    /**
     * @dev insertHashAlgorithm enables to register a new hash algorithm.
     */
    function insertHashAlgorithm(
        HashAlgoStorage.HashAlgos storage hs,
        uint256 outputLength,
        string memory ianaName,
        string memory oid,
        HashAlgoStorage.Status status,
        string memory multiHash
    ) external {
        require(outputLength > 0, "outputLength==0");
        require(uint256(status) > 0, "status==0");
        require(bytes(ianaName).length > 0, "ianaName unknown");
        require(!hs.ianaNameDefined[ianaName], "ianaName defined");
        uint256 hashId = hs.numberOfAlgorithms;

        hs.hashAlgorithms[hashId] = HashAlgoStorage.HashAlgoInfo(
            outputLength,
            ianaName,
            oid,
            status,
            multiHash
        );
        hs.ianaNameDefined[ianaName] = true;

        hs.numberOfAlgorithms++;

        emit AddNewHashAlgo(
            hashId,
            ianaName,
            outputLength,
            oid,
            status,
            multiHash
        );
    }

    /**
     * @dev updateHashAlgorithm updates an existing hash algorithm info.
     */
    function updateHashAlgorithm(
        HashAlgoStorage.HashAlgos storage hs,
        uint256 hashAlgorithmId,
        uint256 outputLength,
        string memory ianaName,
        string memory oid,
        HashAlgoStorage.Status status,
        string memory multiHash
    ) external {
        require(outputLength > 0, "outputLength==0");
        require(uint256(status) > 0, "status==0");
        require(
            hashAlgorithmId < hs.numberOfAlgorithms,
            "hashAlgorithmId unknown"
        );
        require(bytes(ianaName).length > 0, "ianaName unknown");
        hs.ianaNameDefined[hs.hashAlgorithms[hashAlgorithmId].ianaName] = false;
        hs.ianaNameDefined[ianaName] = true;

        // Store the hashAlgorithmInfo in the hashAlgorighmInfoStore[id]
        hs.hashAlgorithms[hashAlgorithmId] = HashAlgoStorage.HashAlgoInfo(
            outputLength,
            ianaName,
            oid,
            status,
            multiHash
        );

        emit UpdateHashAlgo(
            hashAlgorithmId,
            ianaName,
            ianaName,
            outputLength,
            oid,
            status,
            multiHash
        );
    }

    /**
     * @dev Returns the hash algorithm details by the algorithm id
     */
    function getHashAlgorithmById(
        HashAlgoStorage.HashAlgos storage hs,
        uint256 hashAlgorithmId
    )
        external
        view
        returns (
            uint256 outputLength,
            string memory ianaName,
            string memory oid,
            HashAlgoStorage.Status status,
            string memory multiHash
        )
    {
        require(
            hs.hashAlgorithms[hashAlgorithmId].outputLength > 0,
            "hashAlgo unknown"
        );

        outputLength = hs.hashAlgorithms[hashAlgorithmId].outputLength;
        ianaName = hs.hashAlgorithms[hashAlgorithmId].ianaName;
        oid = hs.hashAlgorithms[hashAlgorithmId].oid;
        status = hs.hashAlgorithms[hashAlgorithmId].status;
        multiHash = hs.hashAlgorithms[hashAlgorithmId].multiHash;
    }

    /**
     * @dev Returns a paginated list of registered hash algorithm IDs.
     */
    function getHashAlgorithms(
        HashAlgoStorage.HashAlgos storage hs,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            uint256[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");

        return hs.numberOfAlgorithms.paginate(page, pageSize);
    }
}
