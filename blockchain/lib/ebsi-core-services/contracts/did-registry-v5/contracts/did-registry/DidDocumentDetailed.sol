// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "@ebsiint-sc/bootstrap-v2/contracts/utils/Pagination.sol";
import "./DidDocumentStorage.sol";
import "./ControllersStorage.sol";
import "./DidDocumentLib.sol";
import "./ControllersLib.sol";
import "@ebsiint-sc/trusted-policies-registry-v3/contracts/trusted-policies-registry/interfaces/IPolicyRegistry.sol";
import "./interfaces/IDidRegistry.sol";

abstract contract DidDocumentDetailed is
    DidDocumentStorage,
    ControllersStorage,
    VRelationshipsStorage
{
    using DidDocumentLib for DidDocuments;
    using ControllersLib for Controllers;
    using VRelationshipsLib for VRelationships;
    using Pagination for uint256;

    event DidDocumentInserted(
        string did,
        string baseDocument,
        string vMethodId,
        bytes publicKey,
        bool isSecp256k1,
        uint256 notBefore,
        uint256 notAfter
    );

    event BaseDocumentUpdated(string did, string baseDocument);

    event ControllerAdded(string did, string controller);

    event ControllerRevoked(string did, string controller);

    event VerificationMethodAdded(
        string did,
        string vMethodId,
        bytes publicKey,
        bool isSecp256k1
    );

    event VerificationRelationshipAdded(
        string did,
        string name,
        string vMethodId,
        uint256 notBefore,
        uint256 notAfter
    );

    event VerificationMethodRevoked(
        string did,
        string vMethodId,
        uint256 notAfter
    );

    event VerificationMethodExpired(
        string did,
        string vMethodId,
        uint256 notAfter
    );

    event VerificationMethodRolled(
        string did,
        string vMethodId,
        bytes publicKey,
        bool isSecp256k1,
        uint256 notBefore,
        uint256 notAfter,
        string oldVMethodId,
        uint256 duration
    );

    function insertDidDocument(
        string memory did,
        string memory baseDocument,
        string memory vMethodId,
        bytes memory publicKey,
        bool isSecp256k1,
        uint256 notBefore,
        uint256 notAfter
    ) external returns (bool) {
        require(isSecp256k1, "first publicKey must be for secp256k1");
        DidDocuments storage ds = didDocumentStorage();
        Controllers storage cs = controllersStorage();
        VRelationships storage vs = vRelationshipsStorage();
        bool result = ds.insertDidDocument(
            vs,
            did,
            baseDocument,
            vMethodId,
            publicKey,
            isSecp256k1,
            notBefore,
            notAfter
        );
        cs.linkDidToController(did, did);
        emit DidDocumentInserted(
            did,
            baseDocument,
            vMethodId,
            publicKey,
            isSecp256k1,
            notBefore,
            notAfter
        );
        return result;
    }

    function updateBaseDocument(
        string memory did,
        string memory baseDocument
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:updateBaseDocument");
        DidDocuments storage ds = didDocumentStorage();
        bool result = ds.updateBaseDocument(did, baseDocument);
        emit BaseDocumentUpdated(did, baseDocument);
        return result;
    }

    function addController(
        string memory did,
        string memory controller
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:addController");
        DidDocuments storage ds = didDocumentStorage();
        Controllers storage cs = controllersStorage();
        bool result = ds.addController(did, controller);
        cs.linkDidToController(did, controller);
        emit ControllerAdded(did, controller);
        return result;
    }

    function revokeController(
        string memory did,
        string memory controller
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:revokeController");
        DidDocuments storage ds = didDocumentStorage();
        Controllers storage cs = controllersStorage();
        bool result = ds.revokeController(did, controller);
        cs.unlinkDidFromController(did, controller);
        emit ControllerRevoked(did, controller);
        return result;
    }

    function addVerificationMethod(
        string memory did,
        string memory vMethodId,
        bytes memory publicKey,
        bool isSecp256k1
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:addVerificationMethod");
        DidDocuments storage ds = didDocumentStorage();
        bool result = ds.addVerificationMethod(
            did,
            vMethodId,
            publicKey,
            isSecp256k1
        );
        emit VerificationMethodAdded(did, vMethodId, publicKey, isSecp256k1);
        return result;
    }

    function addVerificationRelationship(
        string memory did,
        string memory name,
        string memory vMethodId,
        uint256 notBefore,
        uint256 notAfter
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:addVerificationRelationship");
        DidDocuments storage ds = didDocumentStorage();
        VRelationships storage vs = vRelationshipsStorage();
        bool result = ds.addVerificationRelationship(
            vs,
            did,
            name,
            vMethodId,
            notBefore,
            notAfter
        );
        emit VerificationRelationshipAdded(
            did,
            name,
            vMethodId,
            notBefore,
            notAfter
        );
        return result;
    }

    function revokeVerificationMethod(
        string memory did,
        string memory vMethodId,
        uint256 notAfter
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:revokeVerificationMethod");
        DidDocuments storage ds = didDocumentStorage();
        VRelationships storage vs = vRelationshipsStorage();
        bool result = ds.revokeVerificationMethod(vs, did, vMethodId, notAfter);
        emit VerificationMethodRevoked(did, vMethodId, notAfter);
        return result;
    }

    function expireVerificationMethod(
        string memory did,
        string memory vMethodId,
        uint256 notAfter
    ) external returns (bool) {
        onlyControllerOrAuth(did, "DID:expireVerificationMethod");
        DidDocuments storage ds = didDocumentStorage();
        VRelationships storage vs = vRelationshipsStorage();
        bool result = ds.expireVerificationMethod(vs, did, vMethodId, notAfter);
        emit VerificationMethodExpired(did, vMethodId, notAfter);
        return result;
    }

    function rollVerificationMethod(
        RollArgs memory args
    ) external returns (bool) {
        onlyControllerOrAuth(args.did, "DID:rollVerificationMethod");
        DidDocuments storage ds = didDocumentStorage();
        VRelationships storage vs = vRelationshipsStorage();

        ds.rollVerificationMethod(vs, args);
        emit VerificationMethodRolled(
            args.did,
            args.vMethodId,
            args.publicKey,
            args.isSecp256k1,
            args.notBefore,
            args.notAfter,
            args.oldVMethodId,
            args.duration
        );
        return true;
    }

    function getDids(
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
        require(pageSize <= 50, "pageSize must be <= 50");
        require(pageSize > 0, "pageSize must be >0");
        require(page > 0, "Page not >0");
        DidDocuments storage ds = didDocumentStorage();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ds.dids.length.paginate(
            page,
            pageSize
        );
        items = new string[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ds.dids[ids[i]];
        }
    }

    function getDidsByController(
        string memory controller,
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
        require(pageSize <= 50, "pageSize must be <= 50");
        require(pageSize > 0, "pageSize must be >0");
        require(page > 0, "Page not >0");
        DidDocuments storage ds = didDocumentStorage();
        Controllers storage cs = controllersStorage();
        require(
            bytes(ds.didList[controller].baseDocument).length > 0,
            "controller doesn't exist"
        );
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = cs
            .didsByController[controller]
            .length
            .paginate(page, pageSize);
        items = new string[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = cs.didsByController[controller][ids[i]];
        }
    }

    function getDidsByVerificationRelationship(
        string memory vMethodId,
        string memory name,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            DidWithPeriod[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "pageSize must be <= 50");
        require(pageSize > 0, "pageSize must be >0");
        require(page > 0, "Page not >0");
        VRelationships storage vs = vRelationshipsStorage();
        uint256 vrId = uint256(keccak256(abi.encodePacked(name, vMethodId)));

        uint256[] memory ids;
        (ids, total, howMany, prev, next) = vs
            .didsByVRelationship[vrId]
            .length
            .paginate(page, pageSize);
        items = new DidWithPeriod[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = vs.didsByVRelationship[vrId][ids[i]];
        }
    }

    function getDidDocument(
        string memory did
    )
        external
        view
        returns (
            string memory baseDocument,
            string[] memory controllers,
            string[] memory vMethodIds,
            DidDocumentStorage.VMethod[] memory vMethods,
            DidDocumentStorage.VRelationship[] memory vRelationships
        )
    {
        DidDocuments storage ds = didDocumentStorage();
        return ds.getDidDocumentByTimestamp(did, block.timestamp);
    }

    function getDidDocumentByTimestamp(
        string memory did,
        uint256 timestamp
    )
        external
        view
        returns (
            string memory baseDocument,
            string[] memory controllers,
            string[] memory vMethodIds,
            DidDocumentStorage.VMethod[] memory vMethods,
            DidDocumentStorage.VRelationship[] memory vRelationships
        )
    {
        DidDocuments storage ds = didDocumentStorage();
        return ds.getDidDocumentByTimestamp(did, timestamp);
    }

    function checkController(
        string memory did,
        address controller
    ) external view returns (bool) {
        return _checkController(did, controller);
    }

    function checkController(
        bytes memory did,
        address controller
    ) external view returns (bool) {
        return _checkController(string(did), controller);
    }

    // internal

    function _checkController(
        string memory did,
        address controller
    ) internal view returns (bool) {
        DidDocuments storage ds = didDocumentStorage();
        DidDocumentStorage.DidDocument storage d = ds.didList[did];

        // check did exist
        require(bytes(d.baseDocument).length > 0, "did doesn't exist");

        // check all controllers
        for (uint256 i = 0; i < d.controllers.length; i++) {
            // get DID Document of the controller
            DidDocumentStorage.DidDocument storage docController = ds.didList[
                d.controllers[i]
            ];

            // check all capabilityInvocations
            string memory vMethodId = docController.vMethodIdOfAddress[
                controller
            ];

            if (bytes(vMethodId).length > 0) {
                if (
                    docController.capabilityInvocationMethodIdExist[vMethodId]
                ) {
                    DidDocumentStorage.VRelationship memory vRelationship;
                    vRelationship = docController.capabilityInvocations[
                        docController.capabilityInvocationMethodIdIndex[
                            vMethodId
                        ]
                    ];
                    if (
                        block.timestamp > vRelationship.notBefore &&
                        vRelationship.notAfter > block.timestamp
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function onlyControllerOrAuth(
        string memory did,
        string memory tprAttribute
    ) internal view {
        DidDocuments storage ds = didDocumentStorage();
        DidDocumentStorage.DidDocument storage d = ds.didList[did];

        // check did exist
        require(bytes(d.baseDocument).length > 0, "did doesn't exist");

        bool isController = _checkController(did, msg.sender);

        if (isController) {
            return;
        } else {
            bool isAuthorized = getTrustedPolicyRegistry().checkPolicy(
                tprAttribute,
                msg.sender
            );
            require(
                isAuthorized,
                string(
                    abi.encodePacked(
                        "not controller and not authorized for policy ",
                        tprAttribute
                    )
                )
            );
            return;
        }
    }

    function getTrustedPolicyRegistry()
        internal
        view
        virtual
        returns (IPolicyRegistry);

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
