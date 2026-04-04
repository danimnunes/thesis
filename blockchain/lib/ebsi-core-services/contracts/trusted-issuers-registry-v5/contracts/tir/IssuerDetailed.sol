// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

// solhint-disable-next-line max-line-length
import "./IssuerStorage.sol";
import "@ebsiint-sc/bootstrap-v2/contracts/utils/Pagination.sol";
import "@ebsiint-sc/did-registry-v5/contracts/did-registry/interfaces/IDidRegistry.sol";
import "@ebsiint-sc/trusted-policies-registry-v3/contracts/trusted-policies-registry/interfaces/IPolicyRegistry.sol";

// solhint-disable-next-line indent
abstract contract IssuerDetailed is IssuerStorage {
    using Pagination for uint256;

    event AddAttributeRevision(
        string did,
        bytes32 indexed attributeId,
        bytes32 indexed revisionId,
        IssuerType issuerType
    );

    event AddIssuerProxy(string did, bytes32 indexed proxyId);
    event UpdateIssuerProxy(string did, bytes32 indexed proxyId);
    event RemoveIssuerProxy(string did, bytes32 indexed proxyId);

    // external functions

    function setAttributeMetadata(
        string calldata did,
        bytes32 revisionId,
        IssuerType issuerType,
        string calldata taoDid,
        bytes32 attributeIdTao
    ) external {
        require(issuerType != IssuerType.Undefined, "invalid issuerType");
        Issuers storage ds = issuerStorage();

        Entity storage iss = ds.issuerStore[did];
        AttributeMetadata storage attrMetadata = ds.attributeMetadataStore[
            revisionId
        ];

        // insert the issuer if it doesn't exist
        if (iss.attributes.length == 0) {
            ds.didStore.push(did);
            iss.noAttributesAccepted = true;
        }

        bytes32 attributeId;
        bytes32 lastRevisionId;
        bytes32 newRevisionId;
        if (compareStrings(attrMetadata.did, "")) {
            // new attribute
            attributeId = revisionId;
            iss.attributes.push(attributeId);
            lastRevisionId = revisionId;
            newRevisionId = revisionId;
        } else {
            // existing attribute
            attributeId = attrMetadata.attributeId;
            require(
                compareStrings(attrMetadata.did, did),
                "attribute already stored"
            );
            lastRevisionId = getLatestRevisionAttributeId(did, revisionId);
            bytes memory seedAttributeData = abi.encode(
                block.timestamp,
                did,
                lastRevisionId
            );
            newRevisionId = sha256(seedAttributeData);
        }

        string memory _rootTaoDid;
        bytes32 lastRevisionIdTao = bytes32(0);
        if (issuerType == IssuerType.RootTAO) {
            taoDid = did;
            _rootTaoDid = did;
        } else {
            lastRevisionIdTao = getLatestRevisionAttributeId(
                taoDid,
                attributeIdTao
            );
            _rootTaoDid = ds
                .attributeMetadataStore[lastRevisionIdTao]
                .rootTaoDid;
        }

        checkEligibility(
            did,
            lastRevisionId,
            issuerType,
            taoDid,
            lastRevisionIdTao,
            "TIR:setAttributeMetadata"
        );

        addRevision(
            did,
            attributeId,
            newRevisionId,
            issuerType,
            taoDid,
            _rootTaoDid,
            ""
        );
    }

    function setAttributeData(
        string calldata did,
        bytes32 attributeId,
        bytes calldata attributeData
    ) external {
        require(
            checkController(bytes(did), msg.sender),
            "Not the issuer itself"
        );
        Issuers storage ds = issuerStorage();
        ds.issuerStore[did].noAttributesAccepted = false;

        bytes32 lastRevisionId = getLatestRevisionAttributeId(did, attributeId);
        AttributeMetadata memory lastAttrMetadata = ds.attributeMetadataStore[
            lastRevisionId
        ];

        bytes32 newRevisionId = sha256(attributeData);
        string memory taoDid = lastAttrMetadata.taoDid;
        string memory rootTaoDid = lastAttrMetadata.rootTaoDid;

        addRevision(
            did,
            lastAttrMetadata.attributeId,
            newRevisionId,
            lastAttrMetadata.issuerType,
            taoDid,
            rootTaoDid,
            attributeData
        );
    }

    /**
     * @dev Add a proxy record to an issuer.
     */
    function addIssuerProxy(
        string calldata did,
        string calldata proxyData
    ) external {
        Issuers storage ds = issuerStorage();

        require(
            ds.issuerStore[did].attributes.length > 0,
            "issuer does not exist"
        );

        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TIR:updateIssuer",
                msg.sender
            ) || checkController(bytes(did), msg.sender),
            string(
                abi.encodePacked(
                    "Policy error: sender is not controller of the did ",
                    did,
                    " and it doesn't have the attribute TIR:updateIssuer"
                )
            )
        );

        bytes32 proxyId = sha256(bytes(proxyData));
        Entity storage iss = ds.issuerStore[did];

        require(
            bytes(iss.proxiesStore[proxyId]).length == 0,
            "proxy already stored"
        );
        iss.proxies.push(proxyId);
        iss.proxyIndex[proxyId] = iss.proxies.length;
        iss.proxiesStore[proxyId] = proxyData;
        emit AddIssuerProxy(did, proxyId);
    }

    /**
     * @dev Update a given issuer proxy.
     */
    function updateIssuerProxy(
        string calldata did,
        bytes32 proxyId,
        string calldata proxyData
    ) external {
        Issuers storage ds = issuerStorage();

        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TIR:updateIssuer",
                msg.sender
            ) || checkController(bytes(did), msg.sender),
            string(
                abi.encodePacked(
                    "Policy error: sender is not controller of the did ",
                    did,
                    " and it doesn't have the attribute TIR:updateIssuer"
                )
            )
        );

        Entity storage iss = ds.issuerStore[did];

        require(bytes(iss.proxiesStore[proxyId]).length > 0, "proxy not found");
        iss.proxiesStore[proxyId] = proxyData;
        emit UpdateIssuerProxy(did, proxyId);
    }

    /**
     * @dev Remove an issuer proxy.
     */
    function removeIssuerProxy(string calldata did, bytes32 proxyId) external {
        Issuers storage ds = issuerStorage();

        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TIR:updateIssuer",
                msg.sender
            ) || checkController(bytes(did), msg.sender),
            string(
                abi.encodePacked(
                    "Policy error: sender is not controller of the did ",
                    did,
                    " and it doesn't have the attribute TIR:updateIssuer"
                )
            )
        );

        Entity storage iss = ds.issuerStore[did];

        require(bytes(iss.proxiesStore[proxyId]).length > 0, "proxy not found");
        iss.proxiesStore[proxyId] = "";

        require(iss.proxyIndex[proxyId] > 0, "proxyId unknown or old");
        iss.proxies[iss.proxyIndex[proxyId] - 1] = iss.proxies[
            iss.proxies.length - 1
        ];
        iss.proxyIndex[iss.proxies[iss.proxies.length - 1]] = iss.proxyIndex[
            proxyId
        ];
        iss.proxies.pop();
        iss.proxyIndex[proxyId] = 0;

        emit RemoveIssuerProxy(did, proxyId);
    }

    /**
     * @dev DEPRECATED. Get an issuer by its DID.
     * @param did string
     * @return bytes32[] attributeLastHash
     */
    function getIssuer__deprecated(
        string memory did
    ) external view returns (bytes32[] memory) {
        Issuers storage ds = issuerStorage();
        bytes32[] memory attributesFirstHash = ds.issuerStore[did].attributes;
        require(attributesFirstHash.length > 0, "issuer does not exist");
        bytes32[] memory attributesLastHash = new bytes32[](
            attributesFirstHash.length
        );

        // list all the attributes
        for (uint256 index = 0; index < attributesFirstHash.length; index++) {
            // get all the versions for the current attribute
            bytes32[] memory versions = ds.issuerStore[did].revisionHashes[
                attributesFirstHash[index]
            ];

            // get the last version hash for this attribute
            attributesLastHash[index] = versions[versions.length - 1];
        }
        return attributesLastHash;
    }

    /**
     * @dev Get an issuer by its DID.
     * @param did The DID of the issuer
     * @return noAttributesAccepted Whether the issuer has accepted any attribute or not
     * @return totalAttributes The number of attributes the issuer has (accepted or not)
     */
    function getIssuer(
        string memory did
    )
        external
        view
        returns (bool noAttributesAccepted, uint256 totalAttributes)
    {
        Issuers storage ds = issuerStorage();
        require(
            ds.issuerStore[did].attributes.length > 0,
            "issuer does not exist"
        );
        noAttributesAccepted = ds.issuerStore[did].noAttributesAccepted;
        totalAttributes = ds.issuerStore[did].attributes.length;
    }

    function getIssuers(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            string[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Issuers storage ds = issuerStorage();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ds.didStore.length.paginate(
            page,
            pageSize
        );
        items = new string[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ds.didStore[ids[i]];
        }
    }

    function getIssuerAttributes(
        string memory did,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Issuers storage ds = issuerStorage();
        uint256[] memory ids;
        require(
            ds.issuerStore[did].attributes.length > 0,
            "issuer does not exist"
        );
        (ids, total, howMany, prev, next) = ds
            .issuerStore[did]
            .attributes
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ds.issuerStore[did].attributes[ids[i]];
        }
    }

    function getIssuerAttributeRevisions(
        string memory did,
        bytes32 anyAttrVersHash,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Issuers storage ds = issuerStorage();
        // retrieve first the did and attrId (firstHash of attribute)
        AttributeMetadata storage am = ds.attributeMetadataStore[
            anyAttrVersHash
        ];
        require(
            ds.issuerStore[did].attributes.length > 0,
            "issuer does not exist"
        );
        require(
            keccak256(bytes(am.did)) == keccak256(bytes(did)),
            "attribute has not been found"
        );

        bytes32[] storage revisionHashes = ds
            .issuerStore[am.did]
            .revisionHashes[am.attributeId];

        // retrieve the issuer and the attribute detail
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ds
            .issuerStore[am.did]
            .revisionHashes[am.attributeId]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = revisionHashes[ids[i]];
        }
    }

    function getIssuerAttributeRevisions__deprecated(
        string memory did,
        bytes32 anyAttrVersHash,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            Attribute[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Issuers storage ds = issuerStorage();
        // retrieve first the did and attrId (firstHash of attribute)
        AttributeMetadata storage am = ds.attributeMetadataStore[
            anyAttrVersHash
        ];
        require(
            ds.issuerStore[did].attributes.length > 0,
            "issuer does not exist"
        );
        require(
            keccak256(bytes(am.did)) == keccak256(bytes(did)),
            "attribute has not been found"
        );

        // retrieve the issuer and the attribute detail
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ds
            .issuerStore[am.did]
            .revisionHashes[am.attributeId]
            .length
            .paginate(page, pageSize);
        items = new Attribute[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            bytes32 hashId = ds.issuerStore[am.did].revisionHashes[
                am.attributeId
            ][ids[i]];
            AttributeMetadata memory a = ds.attributeMetadataStore[hashId];
            items[i].did = a.did;
            items[i].tao = a.taoDid;
            items[i].rootTao = a.rootTaoDid;
            items[i].issuerType = a.issuerType;
            items[i].attributeId = a.attributeId;
            items[i].attribData = ds.issuerStore[a.did].revisions[hashId];
        }
    }

    function getIssuerAttributeByHash__deprecated(
        bytes32 anyAttrVersHash
    )
        external
        view
        returns (
            string memory did,
            bytes memory attribData,
            string memory tao,
            string memory rootTao,
            IssuerType issuerType
        )
    {
        Issuers storage ds = issuerStorage();
        // retrieve first the did and attrId (firstHash of attribute)
        AttributeMetadata memory i = ds.attributeMetadataStore[anyAttrVersHash];
        require(
            keccak256(bytes(i.did)) != keccak256(bytes("")),
            "attribute has not been found"
        );
        did = i.did;
        // retrieve the issuer and the attribute detail
        Entity storage iss = ds.issuerStore[i.did];
        attribData = iss.revisions[anyAttrVersHash];
        tao = i.taoDid;
        rootTao = i.rootTaoDid;
        issuerType = i.issuerType;
    }

    function getLatestRevisionAttributeId(
        string calldata did,
        bytes32 attributeId
    ) public view returns (bytes32 latestRevisionAttributeId) {
        Issuers storage ds = issuerStorage();
        Entity storage iss = ds.issuerStore[did];
        require(iss.attributes.length > 0, "issuer does not exist");
        require(
            keccak256(bytes(ds.attributeMetadataStore[attributeId].did)) ==
                keccak256(bytes(did)),
            "attribute has not been found"
        );
        bytes32 firstAttrHash = ds
            .attributeMetadataStore[attributeId]
            .attributeId;
        bytes32[] storage revisionHashes = iss.revisionHashes[firstAttrHash];
        latestRevisionAttributeId = revisionHashes[revisionHashes.length - 1];
    }

    function getRevisionAttribute(
        string calldata did,
        bytes32 attributeId,
        bytes32 revisionId
    ) public view returns (Attribute memory attribute) {
        Issuers storage ds = issuerStorage();
        Entity storage iss = ds.issuerStore[did];
        require(iss.attributes.length > 0, "issuer does not exist");

        require(
            keccak256(bytes(ds.attributeMetadataStore[attributeId].did)) ==
                keccak256(bytes(did)),
            "attribute has not been found"
        );

        // retrieve first the did and attrId (firstHash of attribute)
        AttributeMetadata storage i = ds.attributeMetadataStore[revisionId];
        require(
            keccak256(bytes(i.did)) == keccak256(bytes(did)),
            "revision has not been found"
        );
        // retrieve the issuer and the attribute detail
        attribute.did = i.did;
        attribute.attributeId = revisionId;
        attribute.attribData = iss.revisions[revisionId];
        attribute.tao = i.taoDid;
        attribute.rootTao = i.rootTaoDid;
        attribute.issuerType = i.issuerType;
    }

    function getLatestRevisionAttribute(
        string calldata issuerDid,
        bytes32 attributeId
    ) external view returns (Attribute memory attribute) {
        bytes32 latestRevisionAttributeId = getLatestRevisionAttributeId(
            issuerDid,
            attributeId
        );

        return
            getRevisionAttribute(
                issuerDid,
                attributeId,
                latestRevisionAttributeId
            );
    }

    /**
     * @dev Get proxy data by its id/hash.
     */
    function getIssuerProxyById(
        string memory did,
        bytes32 proxyId
    ) external view returns (string memory proxyData) {
        Issuers storage ds = issuerStorage();
        Entity storage iss = ds.issuerStore[did];
        require(iss.attributes.length > 0, "issuer does not exist");
        require(bytes(iss.proxiesStore[proxyId]).length > 0, "proxy not found");
        return iss.proxiesStore[proxyId];
    }

    /**
     * @dev Return the list of proxies of a given issuer.
     */
    function getIssuerProxies(
        string memory did,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Issuers storage ds = issuerStorage();
        Entity storage iss = ds.issuerStore[did];
        require(iss.attributes.length > 0, "issuer does not exist");

        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ds
            .issuerStore[did]
            .proxies
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ds.issuerStore[did].proxies[ids[i]];
        }
    }

    // internal functions

    function addRevision(
        string memory did,
        bytes32 attributeId,
        bytes32 newRevisionId,
        IssuerType issuerType,
        string memory taoDid,
        string memory _rootTaoDid,
        bytes memory attributeData
    ) internal {
        Issuers storage ds = issuerStorage();
        Entity storage iss = ds.issuerStore[did];

        require(
            compareStrings(ds.attributeMetadataStore[newRevisionId].did, ""),
            "revision already stored"
        );

        // push the new version hash for this attribute
        iss.revisionHashes[attributeId].push(newRevisionId);
        // push the new version data for this attribute
        iss.revisions[newRevisionId] = attributeData;
        // push the new version metadata for this attribute
        ds.attributeMetadataStore[newRevisionId] = AttributeMetadata(
            did,
            attributeId,
            issuerType,
            taoDid,
            _rootTaoDid
        );

        emit AddAttributeRevision(did, attributeId, newRevisionId, issuerType);
    }

    // internal view functions

    function checkEligibility(
        string memory did,
        bytes32 lastRevisionId,
        IssuerType issuerType,
        string memory taoDid,
        bytes32 lastRevisionIdTao,
        string memory policy
    ) internal view {
        Issuers storage ds = issuerStorage();
        bool hasTprPolicy = getTrustedPolicyRegistry().checkPolicy(
            policy,
            msg.sender
        );
        if (hasTprPolicy) return;
        require(
            issuerType != IssuerType.RootTAO,
            string(
                abi.encodePacked(
                    "Policy error: sender doesn't have the attribute ",
                    policy
                )
            )
        );
        AttributeMetadata memory lastAttrMetadata = ds.attributeMetadataStore[
            lastRevisionId
        ];

        AttributeMetadata memory lastTaoAttrMetadata = ds
            .attributeMetadataStore[lastRevisionIdTao];
        require(
            checkController(bytes(taoDid), msg.sender) &&
                (lastTaoAttrMetadata.issuerType == IssuerType.RootTAO ||
                    lastTaoAttrMetadata.issuerType == IssuerType.TAO),
            string(
                abi.encodePacked(
                    "Policy error: sender is not TAO/RootTao it doesn't have the attribute ",
                    policy
                )
            )
        );

        // in the case of existing attributes make sure the TAO/RootTAO
        // is part of the trust chain of the attribute
        bool isNewAttribute = compareStrings(lastAttrMetadata.did, "");
        bool isTaoOfAttribute = compareStrings(lastAttrMetadata.taoDid, taoDid);
        bool isRootTaoOfAttribute = compareStrings(
            lastAttrMetadata.rootTaoDid,
            taoDid
        );
        require(
            isNewAttribute || isTaoOfAttribute || isRootTaoOfAttribute,
            string(
                abi.encodePacked(
                    "Policy error: sender is not TAO/RootTao of current did ",
                    did,
                    " and it doesn't have the attribute ",
                    policy
                )
            )
        );
    }

    function checkController(
        bytes memory identifier,
        address ctrl
    ) internal view returns (bool) {
        return getDidRegistry().checkController(identifier, ctrl);
    }

    function getDidRegistry() internal view virtual returns (IDidRegistry);

    function getTrustedPolicyRegistry()
        internal
        view
        virtual
        returns (IPolicyRegistry);

    // pure functions

    function compareStrings(
        string memory str1,
        string memory str2
    ) internal pure returns (bool) {
        return
            keccak256(abi.encodePacked(str1)) ==
            keccak256(abi.encodePacked(str2));
    }

    uint256[50] private ______gap;
}
