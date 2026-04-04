// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@ebsiint-sc/bootstrap-v2/contracts/utils/upgradeability/Initializable.sol";

import "./TirStorage.sol";

contract TirDetailed is Initializable, TirStorage {
    /**
     * @dev Sets the values for  `version`.
     */

    function initialize(uint256 version) public onlyInitializing {
        _onInitialize(version);
    }

    function _onInitialize(uint256 version) internal onlyInitializing {
        Tir storage ds = TirStorage.tirStorage();
        if (ds._version != version) {
            ds._version = version;
        }
    }

    /**
     * @dev Returns the version of the Tir SC
     */
    function version() public view returns (uint256) {
        Tir storage ds = tirStorage();
        return ds._version;
    }

    function getDids() public view returns (string[] memory) {
        Tir storage ds = tirStorage();
        return ds.dids;
    }

    function pushDid(string calldata did) public {
        Tir storage ds = tirStorage();
        ds.dids.push(did);
    }

    uint256[50] private ______gap;
}
