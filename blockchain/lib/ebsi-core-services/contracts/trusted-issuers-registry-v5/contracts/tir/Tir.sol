// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./TirDetailed.sol";
import "./IssuerDetailed.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title Trusted Issuers Registry Smart Contract
 */
contract Tir is Initializable, TirDetailed, IssuerDetailed {
    IPolicyRegistry public immutable policyRegistryContract;
    IDidRegistry public immutable didRegistryContract;

    constructor(address _tprAddress, address _didRegistryAddress) {
        require(
            _tprAddress != address(0) && _didRegistryAddress != address(0),
            "zero address"
        );
        policyRegistryContract = IPolicyRegistry(_tprAddress);
        didRegistryContract = IDidRegistry(_didRegistryAddress);
        _disableInitializers();
    }

    function initialize(uint256 _version) external initializer {
        TirDetailed.init(_version);
    }

    function getDidRegistry()
        internal
        view
        virtual
        override
        returns (IDidRegistry)
    {
        return didRegistryContract;
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
