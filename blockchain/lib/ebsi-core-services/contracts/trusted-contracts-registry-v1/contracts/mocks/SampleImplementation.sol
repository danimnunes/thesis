// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title SampleImplementation
 * @dev Sample implementation contract for testing proxy deployments
 */
contract SampleImplementation is Initializable, OwnableUpgradeable {
    string public name;
    string public version;
    address public contractOwner;
    bytes32 public dataHash;

    // Storage for testing
    mapping(bytes32 => string) private _dataStore;

    event DataStored(bytes32 indexed key, string value);
    event DataRetrieved(bytes32 indexed key, string value);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string calldata _name,
        string calldata _version,
        address _owner,
        bytes32 _dataHash
    ) public initializer {
        __Ownable_init(_owner);
        name = _name;
        version = _version;
        contractOwner = _owner;
        dataHash = _dataHash;
    }

    function storeData(bytes32 key, string calldata value) external {
        _dataStore[key] = value;
        emit DataStored(key, value);
    }

    function getData(bytes32 key) external view returns (string memory) {
        return _dataStore[key];
    }

    function updateName(string calldata _name) external onlyOwner {
        name = _name;
    }

    function updateVersion(string calldata _version) external onlyOwner {
        version = _version;
    }

    function getContractInfo()
        external
        view
        returns (
            string memory _name,
            string memory _version,
            address _owner,
            bytes32 _dataHash
        )
    {
        return (name, version, contractOwner, dataHash);
    }
}
