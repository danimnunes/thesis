// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract ControllersStorage {
    bytes32 public constant CONTROLLERS_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.controllers.storage"
    );

    struct Controllers {
        mapping(string => string[]) didsByController;
        mapping(string => mapping(string => uint)) didsByControllerIndex;
    }

    function controllersStorage()
        internal
        pure
        returns (Controllers storage ms)
    {
        bytes32 position = CONTROLLERS_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
