// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract VRelationshipsStorage {
    bytes32 public constant VRELATIONSHIPS_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.vrelationships.storage"
    );

    struct DidWithPeriod {
        string did;
        uint256 notBefore;
        uint256 notAfter;
    }

    struct VRelationships {
        mapping(uint256 => DidWithPeriod[]) didsByVRelationship;
    }

    function vRelationshipsStorage()
        internal
        pure
        returns (VRelationships storage ms)
    {
        bytes32 position = VRELATIONSHIPS_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
