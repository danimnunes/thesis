// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract IssuerStorage {
    // The state variables we care about.
    bytes32 public constant ISSUER_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.tir.issuer.storage"
    );

    enum IssuerType {
        Undefined,
        RootTAO,
        TAO,
        TI,
        Revoked
    }

    struct AttributeMetadata {
        // For each Attribute version hash, this is an object that stores
        // the DID of his owner and the hash of the first version.
        string did; // DID of the attribute owner.
        bytes32 attributeId; // Unique attribute ID (hash of the first attribute version)
        IssuerType issuerType;
        string taoDid;
        string rootTaoDid;
    }

    struct Attribute {
        string did;
        bytes32 attributeId;
        bytes attribData;
        string tao;
        string rootTao;
        IssuerType issuerType;
    }

    struct Entity {
        //This is the Entity Object is in charge of storing all the attributes
        // information of each type of entity (domain owner, Domain Administrator,
        // Domain Issuer) identified by their DID and managed by the registry.
        // [Attr1firstHash, Attr2firstHash, Attr3firstHash ...]
        bytes32[] attributes;
        // For a particular Entity and a specific Attribute id, this is a collection of
        // all attribute version hashes and corresponding attribute JSON-LD value.
        mapping(bytes32 => bytes) revisions;
        // firstAttrHash ->  {versionHashes:[firstAttrHash, v2Hash, v3Hash ...],
        // versionData:Attr(n)v(n)Hash -> data}
        mapping(bytes32 => bytes32[]) revisionHashes;
        // Proxying issuer's statusList(s)
        bytes32[] proxies;
        mapping(bytes32 => string) proxiesStore;
        bool noAttributesAccepted;
        mapping(bytes32 => uint256) proxyIndex;
    }

    struct Issuers {
        string[] didStore; // list of all dids
        mapping(string => Entity) issuerStore; // DID -> [Issuer]
        // Attr(n)v(n)Hash -> DID, firsthash  // a convenient way to
        // retrieve a did and firsthash based on any attributeHash
        mapping(bytes32 => AttributeMetadata) attributeMetadataStore;
    }

    // Creates and returns the storage pointer to the struct.
    function issuerStorage() internal pure returns (Issuers storage ms) {
        bytes32 position = ISSUER_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
