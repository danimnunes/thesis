// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

// solhint-disable-next-line max-line-length
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./TimestampDetailed.sol";
import "./RecordDetailed.sol";
import "./HashAlgoDetailed.sol";
import "@ebsiint-sc/trusted-policies-registry-v3/contracts/trusted-policies-registry/interfaces/IPolicyRegistry.sol";

/**
 * @title Timestamp Smart Contract
 * @dev Initializable -> Indicates the contract will be initialized by an external function
 * @dev RecordDetailed -> Indicates that the contract is storing all detailed records.
 * @dev TimestampDetailed -> Indicates that the contract timestamps are being stored with all its details.
 * @dev HashAlgoDetailed -> Indicates that the contract is allowed to store and manipulate hashes.
 */
contract Timestamp is
    Initializable,
    RecordDetailed,
    TimestampDetailed,
    HashAlgoDetailed
{
    IPolicyRegistry public immutable policyRegistryContract;

    event NewVersion(uint);

    constructor(address _tprAddress) {
        require(_tprAddress != address(0), "zero address");
        policyRegistryContract = IPolicyRegistry(_tprAddress);
        _disableInitializers();
    }

    function initialize(uint256 v) public initializer {
        _onInitialize(v);
    }

    function _onInitialize(uint256 _version) internal onlyInitializing {
        setVersion(_version);
    }

    /**
     * @dev Returns the version of the Timestamp SC
     */
    function version() external view returns (uint256) {
        Timestamps storage ts = timestampStorage();
        return ts.version;
    }

    function setVersion(uint256 _version) internal {
        Timestamps storage ts = TimestampStorage.timestampStorage();
        ts.version = _version;
        emit NewVersion(_version);
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
