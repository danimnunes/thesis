// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract PolicyStorage {
    // The state variables we care about.
    bytes32 public constant POLICY_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.policy.registry.storage"
    );
    struct UserAttribute {
        bool defined;
        uint index;
    }

    struct PolicyContractStorage {
        uint256 version;
        uint256 policyCount;
        mapping(address => mapping(string => UserAttribute)) userAttributes;
        mapping(address => string[]) listOfUserAttributes;
        mapping(string => uint256) policyNameToPolicyId;
        address[] addresses;
        mapping(address => bool) userAddressExists;
        mapping(uint256 => Policy) policies;
    }

    struct Policy {
        string policyName; // policyName will match attributeName
        string description;
        bool status;
    }

    // Creates and returns the storage pointer to the struct.
    function policyStorage()
        internal
        pure
        returns (PolicyContractStorage storage ps)
    {
        bytes32 position = POLICY_DIAMOND_STORAGE_POSITION;
        assembly {
            ps.slot := position
        }
    }

    bytes32 public constant DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.diamond.storage.proxy"
    );

    struct DiamondStorage {
        // owner of the contract
        address proxyAdmin;
        address implementation;
    }

    function diamondStorage()
        internal
        pure
        returns (DiamondStorage storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
