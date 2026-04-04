// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@ebsiint-sc/bootstrap-v2/contracts/utils/upgradeability/Initializable.sol";

/**
 * @title example of stored values on a SC with an initialization.
 *
 */
abstract contract AnchorDetailed is Initializable {
    bytes32[] private storedFields;
    string public name;
    string public symbol;
    uint8 public decimals;

    /**
     * @dev Sets the values for `name`, `symbol`, and `decimals`. All three of
     * these values are immutable: they can only be set once during
     * construction.
     */
    function initialize(
        bytes32[] memory _fields,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public virtual initializer {
        _onInitialize(_fields, _name, _symbol, _decimals);
    }

    function _onInitialize(
        bytes32[] memory _fields,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) internal onlyInitializing {
        storedFields = _fields;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function fields(uint8 i) public view returns (bytes32) {
        return storedFields[i];
    }

    function setFields(bytes32[] memory newFields) external {
        storedFields = newFields;
    }

    uint256[50] private ______gap;
}
