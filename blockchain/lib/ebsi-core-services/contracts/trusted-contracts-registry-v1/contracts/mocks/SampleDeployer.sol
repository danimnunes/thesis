// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IProxyFactory} from "../interfaces/IProxyFactory.sol";

/**
 * @title SampleDeployer
 * @dev Sample implementation contract for deploying proxies from a contract
 */
contract SampleDeployer is Initializable, OwnableUpgradeable {
    IProxyFactory public proxyFactory;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner,
        address _proxyFactory
    ) public initializer {
        __Ownable_init(owner);
        proxyFactory = IProxyFactory(_proxyFactory);
    }

    function deployHelloWorldProxy(
        bytes calldata initData
    ) external returns (address) {
        return proxyFactory.deployProxy("HelloWorld", "1.0.0", initData, "");
    }
}
