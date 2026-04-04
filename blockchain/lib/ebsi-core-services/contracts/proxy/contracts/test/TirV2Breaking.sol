// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./TirV1.sol";
import "./TirStorageV1Breaking.sol";

/**
 * @title example of stored values on a SC with pause functionality.
 *
 */
contract TirV2Breaking is TirV1, TirStorageV1Breaking {
    function getDids2() public view returns (string[] memory) {
        TirModel2 storage ds = tirStorage2();
        return ds.dids;
    }

    function pushDid2(string calldata did) public {
        TirModel2 storage ds = tirStorage2();
        ds.dids.push(did);
    }

    function getbyDids2(uint256 id) public view returns (string memory) {
        TirModel2 storage ds = tirStorage2();
        return ds.dids[id];
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
