// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./PolicyStorage.sol";
import "./PolicyListManagement.sol";
import "./UserAttributesManagement.sol";
import "./PolicyEngine.sol";

contract PolicyRegistry is
    PolicyStorage,
    Initializable,
    PolicyListManagement,
    UserAttributesManagement,
    PolicyEngine
{
    function initialize(uint256 _version) public initializer {
        _onInitialize(_version);
    }

    function _onInitialize(uint256 _version) internal {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        PolicyContractStorage storage ps = PolicyStorage.policyStorage();
        ps.version = _version;
    }

    /**
     * @dev Returns the version of the PolicyStorage SC
     */
    function version() external view returns (uint256) {
        PolicyContractStorage storage ps = PolicyStorage.policyStorage();
        return ps.version;
    }

    function admin() external view returns (address) {
        DiamondStorage storage ms = diamondStorage();
        return ms.proxyAdmin;
    }

    function implementation() external view returns (address) {
        DiamondStorage storage ms = diamondStorage();
        return ms.implementation;
    }

    uint256[50] private ______gap;
}
