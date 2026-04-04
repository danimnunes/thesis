// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import {IProxyFactory} from "../interfaces/IProxyFactory.sol";

/**
 * @title SimpleDeployer
 * @dev Simple non-upgradeable contract for deploying proxies (for testing purposes)
 */
contract SimpleDeployer {
    IProxyFactory public proxyFactory;

    constructor(address _proxyFactory) {
        proxyFactory = IProxyFactory(_proxyFactory);
    }

    function deployHelloWorldProxy(
        bytes calldata initData
    ) external returns (address) {
        return proxyFactory.deployProxy("HelloWorld", "1.0.0", initData, "");
    }
}
