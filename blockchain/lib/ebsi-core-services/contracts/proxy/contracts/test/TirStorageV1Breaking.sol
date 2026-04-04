// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;
import "./tir/TirStorage.sol";

contract TirStorageV1Breaking is TirStorage {
    struct TirModel2 {
        string message;
        uint256 _version;
        string[] dids;
    }

    // Creates and returns the storage pointer to the struct.
    function tirStorage2() internal pure returns (TirModel2 storage ms) {
        bytes32 position = TIR_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }
}
