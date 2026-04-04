// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./TirV1.sol";
import "./TirStorageV1.sol";

/**
 * @title example of stored values on a SC with pause functionality.
 *
 */
contract TirV2 is TirV1, TirStorageV1 {
    function getDids2() public view returns (string[] memory) {
        TirModel2 storage ds = tirStorage2();
        return ds.dids;
    }

    function setMessage(string calldata message) public {
        TirModel2 storage ds = tirStorage2();
        if (
            keccak256(abi.encodePacked(ds.message)) !=
            keccak256(abi.encodePacked(message))
        ) {
            ds.message = message;
        }
    }

    function getMessage() public view returns (string memory) {
        TirModel2 storage ds = tirStorage2();
        return ds.message;
    }
}
