// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

library TrackAndTraceLib {
    function sliceBytes(
        bytes calldata pubKeyBytes
    ) public view returns (bytes memory) {
        if (pubKeyBytes.length == 65) {
            require(pubKeyBytes[0] == 0x04, "Invalid control byte");
            return pubKeyBytes[1:];
        } else if (pubKeyBytes.length == 64) {
            return pubKeyBytes;
        } else {
            revert("invalid pub key length");
        }
    }

    function getAddress(
        bytes calldata publicKey
    ) public view returns (address) {
        return address(uint160(uint256(keccak256(sliceBytes(publicKey)))));
    }

    /*
    Function: equal(bytes memory, bytes memory)

    Assert that two tightly packed bytes arrays are equal.

    Params:
        A (bytes) - The first bytes.
        B (bytes) - The second bytes.
        message (string) - A message that is sent if the assertion fails.

    Returns:
        result (bool) - The result.
    */
    function _equal(
        bytes memory _a,
        bytes memory _b
    ) internal pure returns (bool) {
        bool returnBool = true;

        assembly {
            let length := mload(_a)

            // if lengths don't match the arrays are not equal
            switch eq(length, mload(_b))
            case 1 {
                // cb is a circuit breaker in the for loop since there's
                //  no said feature for inline assembly loops
                // cb = 1 - don't breaker
                // cb = 0 - break
                let cb := 1

                let mc := add(_a, 0x20)
                let end := add(mc, length)

                for {
                    let cc := add(_b, 0x20)
                } eq(add(lt(mc, end), cb), 2) {
                    // the previous line is the loop condition:
                    // while(uint256(mc < end) + cb == 2)
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    // if any of these checks fails then arrays are not equal
                    if iszero(eq(mload(mc), mload(cc))) {
                        // unsuccessful:
                        returnBool := 0
                        cb := 0
                    }
                }
            }
            default {
                // unsuccessful:
                returnBool := 0
            }
        }

        return returnBool;
    }
}
