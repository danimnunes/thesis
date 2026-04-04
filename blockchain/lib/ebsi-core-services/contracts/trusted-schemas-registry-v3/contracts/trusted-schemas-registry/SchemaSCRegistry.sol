// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;
// solhint-disable-next-line max-line-length
import "./SchemaSCStorage.sol";
import "./SchemaDetailed.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract SchemaSCRegistry is SchemaSCStorage, SchemaDetailed, Initializable {
    IPolicyRegistry public immutable policyRegistryContract;

    event NewVersion(uint);

    constructor(address _tprAddress) {
        require(_tprAddress != address(0), "zero address");
        policyRegistryContract = IPolicyRegistry(_tprAddress);
        _disableInitializers();
    }

    function initialize(uint256 _version) public initializer {
        _onInitialize(_version);
    }

    function _onInitialize(uint256 _version) internal {
        setVersion(_version);
    }

    /**
     * @dev Returns the version of the TIR SC
     */
    function version() external view returns (uint256) {
        TSC storage ts = SchemaSCStorage.tscStorage();
        return ts.version;
    }

    /**
     * @dev set the version of the TIR SC
     */
    function setVersion(uint256 _version) internal {
        TSC storage ts = SchemaSCStorage.tscStorage();
        ts.version = _version;
        emit NewVersion(_version);
    }

    function getTrustedPolicyRegistry()
        internal
        view
        virtual
        override
        returns (IPolicyRegistry)
    {
        return policyRegistryContract;
    }
}
