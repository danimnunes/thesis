// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract DidStorage {
    // The state variables we care about.
    bytes32 public constant TSC_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.did.registry.storage"
    );

    struct TSC {
        uint256 version;
    }

    // Creates and returns the storage pointer to the struct.
    function tscStorage() internal pure returns (TSC storage ms) {
        bytes32 position = TSC_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
