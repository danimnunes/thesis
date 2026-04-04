// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./TirStorage.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract TirDetailed is Initializable, TirStorage {
    /**
     * @dev Sets the values for  `version`.
     */
    event NewVersion(uint);

    /**
     * @dev Returns the version of the Tir SC
     */
    function version() external view returns (uint256) {
        Tir storage ds = tirStorage();
        return ds._version;
    }

    function init(uint256 v) public onlyInitializing {
        _onInitialize(v);
    }

    // internal functions

    function _onInitialize(uint256 _version) internal {
        setVersion(_version);
    }

    function setVersion(uint256 _version) internal {
        Tir storage ds = tirStorage();
        ds._version = _version;
        emit NewVersion(_version);
    }

    uint256[50] private ______gap;
}
