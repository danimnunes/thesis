// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./BaseUpgradeabilityProxy.sol";

/**
 * @title InitializableUpgradeabilityProxy
 * @dev Extends BaseUpgradeabilityProxy with an initializer for initializing
 * implementation and init data.
 */
abstract contract InitializableUpgradeabilityProxy is BaseUpgradeabilityProxy {
    /**
     * @dev Contract initializer.
     * @param _logic Address of the initial implementation.
     * @param _data Data to send as msg.data to the implementation to initialize the proxied contract.
     * It should include the signature and the parameters of the function to be called, as described in
     * https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding.
     * This parameter is optional, if no data is given the initialization call to proxied contract will be skipped.
     */
    function initialize(
        address _logic,
        bytes memory _data
    ) public payable virtual {
        require(_logic != address(0), "_logic address can't be zero");
        require(_implementation() == address(0), "implementation must be zero");
        require(
            DIAMOND_STORAGE_POSITION ==
                keccak256("diamond.standard.diamond.storage.proxy")
        );
        _setImplementation(_logic);
        if (_data.length > 0) {
            (bool success, ) = _logic.delegatecall(_data);
            require(success, "initialize delegatecall failed");
        }
    }
}
