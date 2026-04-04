// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract TirStorage {
    // The state variables we care about.
    bytes32 public constant TIR_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.tir.storage"
    );

    struct Tir {
        uint256 _version;
    }

    // Creates and returns the storage pointer to the struct.
    function tirStorage() internal pure returns (Tir storage ms) {
        bytes32 position = TIR_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
