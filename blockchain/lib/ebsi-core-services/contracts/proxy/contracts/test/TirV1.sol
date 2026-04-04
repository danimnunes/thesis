// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./tir/Tir.sol";

/**
 * @title example of stored values on a SC with pause functionality.
 *
 */
contract TirV1 is Tir {
    function init2(uint256 newVersion) public {
        Tir storage ds = tirStorage();
        if (ds._version != newVersion) {
            ds._version = newVersion;
        }
    }

    function getDidLast() public view returns (string memory) {
        Tir storage ds = tirStorage();
        return ds.dids[ds.dids.length - 1];
    }
}
