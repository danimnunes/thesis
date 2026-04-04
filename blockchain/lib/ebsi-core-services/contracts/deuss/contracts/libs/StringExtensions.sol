// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {Errors} from "./Errors.sol";

/**
 * @title StringExtensions
 * @author DEUSS Team
 * @notice Provides utility functions for string type
 */
library StringExtensions {
    /**
     * @notice Converts an ISIN string to bytes12
     * @param isin The ISIN string to convert
     * @return bytes12 representation of the ISIN
     */
    function _isinToBytes12(
        string memory isin
    ) internal pure returns (bytes12) {
        return bytes12(_stringToFixedBytes(isin, 12));
    }

    /**
     * @notice Converts a currency code to bytes3
     * @param currency The currency code string to convert
     * @return bytes3 representation of the currency code
     */
    function _currencyToBytes3(
        string memory currency
    ) internal pure returns (bytes3) {
        return bytes3(_stringToFixedBytes(currency, 3));
    }

    /**
     * @notice Converts a string to fi
     * @param input The string to convert
     * @param expectedLength The expected length of the string in bytes
     * @return result representation of the string in bytes32
     */
    function _stringToFixedBytes(
        string memory input,
        uint256 expectedLength
    ) internal pure returns (bytes32 result) {
        bytes memory inputBytes = bytes(input);

        if (expectedLength > 32 || inputBytes.length != expectedLength) {
            revert Errors.StringExtensions__InvalidBytesLength();
        }

        // Check all characters are valid ASCII (0x00 to 0x7F)
        for (uint256 i = 0; i < inputBytes.length; ++i) {
            if (uint8(inputBytes[i]) > 0x7F) {
                revert Errors.StringExtensions__NonAsciiCharacter();
            }
        }

        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(add(inputBytes, 0x20))
        }
    }
}
