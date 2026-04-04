// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {Errors} from "./Errors.sol";

/**
 * @title AddressExtensions
 * @author DEUSS Team
 * @notice Provides utility functions for address type
 */
library AddressExtensions {
    /**
     * @notice Asserts that an address is not the zero address
     * @param caller The address to check
     * @dev Reverts with ZeroAddress if the address is zero
     */
    function assertAddressNotZero(address caller) public pure {
        if (caller == address(0)) {
            revert Errors.ZeroAddress();
        }
    }
}
