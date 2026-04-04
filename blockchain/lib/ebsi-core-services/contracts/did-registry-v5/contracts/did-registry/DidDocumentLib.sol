// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./DidDocumentStorage.sol";
import "./VRelationshipsStorage.sol";
import "./VRelationshipsLib.sol";
import "./UtilsLib.sol";

library DidDocumentLib {
    using VRelationshipsLib for VRelationshipsStorage.VRelationships;

    string public constant AUTHENTICATION_RELATIONSHIP = "authentication";
    string public constant ASSERTION_RELATIONSHIP = "assertionMethod";
    string public constant KEY_AGREEMENT_RELATIONSHIP = "keyAgreement";
    string public constant CAPABILITY_INVOCATION_RELATIONSHIP =
        "capabilityInvocation";
    string public constant CAPABILITY_DELEGATION_RELATIONSHIP =
        "capabilityDelegation";
    uint public constant MAX_CONTROLLERS = 10;

    function insertDidDocument(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        string memory did,
        string memory baseDocument,
        string memory vMethodId,
        bytes memory publicKey,
        bool isSecp256k1,
        uint256 notBefore,
        uint256 notAfter
    ) external returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(bytes(did).length > 0, "invalid did");
        require(bytes(baseDocument).length > 0, "invalid baseDocument");
        require(bytes(vMethodId).length > 0, "invalid vMethodId");
        require(publicKey.length > 0, "invalid publicKey");
        require(notAfter >= notBefore, "invalid dates");

        require(bytes(d.baseDocument).length == 0, "did already exists");

        d.baseDocument = baseDocument;
        d.controllers.push(did);
        d.controllerExist[did] = true;
        // first vMethod should always be secp256k1 type
        d.vMethods[vMethodId] = DidDocumentStorage.VMethod(
            publicKey,
            isSecp256k1,
            false
        );

        uint256 indexDid;

        indexDid = _addVerificationRelationship(
            vs,
            "capabilityInvocation",
            vMethodId,
            did,
            notBefore,
            notAfter
        );
        // insert getAddress in the did
        d.vMethodIdOfAddress[getAddress(publicKey)] = vMethodId;
        d.capabilityInvocationMethodIdExist[vMethodId] = true;
        d.capabilityInvocationMethodIdIndex[vMethodId] = d
            .capabilityInvocations
            .length;
        d.capabilityInvocations.push(
            DidDocumentStorage.VRelationship(
                "capabilityInvocation",
                vMethodId,
                notBefore,
                notAfter,
                indexDid
            )
        );

        indexDid = _addVerificationRelationship(
            vs,
            "authentication",
            vMethodId,
            did,
            notBefore,
            notAfter
        );
        d.vRelationshipsIndexes[vMethodId].push(d.vRelationships.length);
        d.vRelationshipsNameAndMethodIdTuple[
            keccak256(abi.encode("authentication", vMethodId))
        ] = true;
        d.vRelationships.push(
            DidDocumentStorage.VRelationship(
                "authentication",
                vMethodId,
                notBefore,
                notAfter,
                indexDid
            )
        );

        ds.dids.push(did);
        return true;
    }

    function updateBaseDocument(
        DidDocumentStorage.DidDocuments storage ds,
        string memory did,
        string memory baseDocument
    ) external returns (bool) {
        require(bytes(baseDocument).length > 0, "invalid baseDocument");
        ds.didList[did].baseDocument = baseDocument;
        return true;
    }

    function addController(
        DidDocumentStorage.DidDocuments storage ds,
        string memory did,
        string memory controller
    ) external returns (bool) {
        require(
            bytes(ds.didList[controller].baseDocument).length > 0,
            "controller doesn't exist"
        );
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(!d.controllerExist[controller], "it is already a controller");
        require(
            d.controllers.length < MAX_CONTROLLERS,
            "max number of controllers"
        );
        d.controllers.push(controller);
        d.controllerExist[controller] = true;
        return true;
    }

    function revokeController(
        DidDocumentStorage.DidDocuments storage ds,
        string memory did,
        string memory controller
    ) external returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(d.controllerExist[controller], "controller not found");
        for (uint256 i = 0; i < d.controllers.length; i++) {
            if (UtilsLib.equalStrings(d.controllers[i], controller)) {
                // swap with the last controller and pop the last one
                d.controllers[i] = d.controllers[d.controllers.length - 1];
                d.controllers.pop();
                d.controllerExist[controller] = false;
                break;
            }
        }
        return true;
    }

    function addVerificationMethod(
        DidDocumentStorage.DidDocuments storage ds,
        string memory did,
        string memory vMethodId,
        bytes memory publicKey,
        bool isSecp256k1
    ) external returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(bytes(vMethodId).length > 0, "invalid vMethodId");
        require(publicKey.length > 0, "invalid publicKey");
        require(
            d.vMethods[vMethodId].publicKey.length == 0,
            "vMethodId already exists"
        );

        if (isSecp256k1) {
            address keyAddress = getAddress(publicKey);
            require(
                bytes(d.vMethodIdOfAddress[keyAddress]).length == 0,
                "public key already in use"
            );
            d.vMethodIdOfAddress[keyAddress] = vMethodId;
        }

        d.vMethods[vMethodId] = DidDocumentStorage.VMethod(
            publicKey,
            isSecp256k1,
            false
        );

        return true;
    }

    function addVerificationRelationship(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        string memory did,
        string memory name,
        string memory vMethodId,
        uint256 notBefore,
        uint256 notAfter
    ) external returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(bytes(name).length > 0, "invalid name");
        require(notAfter >= notBefore, "invalid dates");
        require(isValidRelationshipName(name), "invalid verification method");
        require(
            d.vMethods[vMethodId].publicKey.length > 0,
            "vMethodId doesn't exist"
        );

        uint256 indexDid = vs.addVerificationRelationship(
            uint256(keccak256(abi.encodePacked(name, vMethodId))),
            did,
            notBefore,
            notAfter
        );

        if (UtilsLib.equalStrings(name, "capabilityInvocation")) {
            // is a capabilityInvocation
            require(
                !d.capabilityInvocationMethodIdExist[vMethodId],
                "capabilityInvocation already exists"
            );
            d.capabilityInvocationMethodIdExist[vMethodId] = true;
            d.capabilityInvocationMethodIdIndex[vMethodId] = d
                .capabilityInvocations
                .length;
            d.capabilityInvocations.push(
                DidDocumentStorage.VRelationship(
                    "capabilityInvocation",
                    vMethodId,
                    notBefore,
                    notAfter,
                    indexDid
                )
            );
        } else {
            // is a different verification relationship

            // check that the tuple (name, vMethodId) is unique in the relationships
            bytes32 tuple = keccak256(abi.encode(name, vMethodId));
            require(
                !d.vRelationshipsNameAndMethodIdTuple[tuple],
                "relationship already exists"
            );

            d.vRelationshipsNameAndMethodIdTuple[tuple] = true;
            d.vRelationshipsIndexes[vMethodId].push(d.vRelationships.length);
            d.vRelationships.push(
                DidDocumentStorage.VRelationship(
                    name,
                    vMethodId,
                    notBefore,
                    notAfter,
                    indexDid
                )
            );
        }
        return true;
    }

    function revokeVerificationMethod(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        string memory did,
        string memory vMethodId,
        uint256 notAfter
    ) external returns (bool) {
        require(notAfter <= block.timestamp, "invalid notAfter");
        _revokeVerificationMethod(ds, vs, did, vMethodId, notAfter);
        ds.didList[did].vMethods[vMethodId].revoked = true;
        return true;
    }

    function expireVerificationMethod(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        string memory did,
        string memory vMethodId,
        uint256 notAfter
    ) external returns (bool) {
        require(notAfter > block.timestamp, "invalid notAfter");
        return _revokeVerificationMethod(ds, vs, did, vMethodId, notAfter);
    }

    function rollVerificationMethod(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        DidDocumentStorage.RollArgs memory args
    ) external returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[args.did];
        require(bytes(args.vMethodId).length > 0, "invalid vMethodId");
        require(args.publicKey.length > 0, "invalid publicKey");
        require(
            d.vMethods[args.vMethodId].publicKey.length == 0,
            "vMethodId already exists"
        );
        require(
            d.vMethods[args.oldVMethodId].publicKey.length > 0,
            "oldVMethodId doesn't exist"
        );
        require(args.notBefore <= args.notAfter, "invalid dates");

        // add new verification method
        d.vMethods[args.vMethodId] = DidDocumentStorage.VMethod(
            args.publicKey,
            args.isSecp256k1,
            false
        );

        for (
            uint index = 0;
            index < d.vRelationshipsIndexes[args.oldVMethodId].length;
            index++
        ) {
            uint i = d.vRelationshipsIndexes[args.oldVMethodId][index];
            // update the previous relationship
            vs.updateVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            d.vRelationships[i].name,
                            args.oldVMethodId
                        )
                    )
                ),
                d.vRelationships[i].indexDid,
                args.notBefore + args.duration
            );
            d.vRelationships[i].notAfter = args.notBefore + args.duration;

            // add the new relationship
            uint256 indexDid = vs.addVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            d.vRelationships[i].name,
                            args.vMethodId
                        )
                    )
                ),
                args.did,
                args.notBefore,
                args.notAfter
            );
            d.vRelationshipsIndexes[args.vMethodId].push(
                d.vRelationships.length
            );
            d.vRelationshipsNameAndMethodIdTuple[
                keccak256(abi.encode(d.vRelationships[i].name, args.vMethodId))
            ] = true;

            d.vRelationships.push(
                DidDocumentStorage.VRelationship(
                    d.vRelationships[i].name,
                    args.vMethodId,
                    args.notBefore,
                    args.notAfter,
                    indexDid
                )
            );
        }

        if (d.capabilityInvocationMethodIdExist[args.oldVMethodId]) {
            uint i = d.capabilityInvocationMethodIdIndex[args.oldVMethodId];

            // update the previous relationship
            vs.updateVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            "capabilityInvocation",
                            args.oldVMethodId
                        )
                    )
                ),
                d.capabilityInvocations[i].indexDid,
                args.notBefore + args.duration
            );
            d.capabilityInvocations[i].notAfter =
                args.notBefore + args.duration;

            // add the new relationship
            uint256 indexDid = vs.addVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked("capabilityInvocation", args.vMethodId)
                    )
                ),
                args.did,
                args.notBefore,
                args.notAfter
            );
            if (d.vMethods[args.oldVMethodId].isSecp256k1) {
                address oldAddress = getAddress(
                    d.vMethods[args.oldVMethodId].publicKey
                );
                d.vMethodIdOfAddress[oldAddress] = "";
            }
            d.capabilityInvocationMethodIdExist[args.vMethodId] = true;
            d.capabilityInvocationMethodIdIndex[args.vMethodId] = d
                .capabilityInvocations
                .length;
            d.capabilityInvocations.push(
                DidDocumentStorage.VRelationship(
                    "capabilityInvocation",
                    args.vMethodId,
                    args.notBefore,
                    args.notAfter,
                    indexDid
                )
            );
        }

        return true;
    }

    function getDidDocumentByTimestamp(
        DidDocumentStorage.DidDocuments storage ds,
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
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        baseDocument = d.baseDocument;
        controllers = d.controllers;
        uint maxLength =
            d.vRelationships.length + d.capabilityInvocations.length;
        string[] memory vMethodIdsAux = new string[](maxLength);
        DidDocumentStorage.VMethod[]
            memory vMethodsAux = new DidDocumentStorage.VMethod[](maxLength);
        DidDocumentStorage.VRelationship[]
            memory vRelationshipsAux = new DidDocumentStorage.VRelationship[](
                maxLength
            );
        uint256 sizeVMethods = 0;
        uint256 sizeVRelationships = 0;
        for (uint256 i = 0; i < d.vRelationships.length; i++) {
            if (
                timestamp < d.vRelationships[i].notBefore ||
                timestamp > d.vRelationships[i].notAfter
            ) {
                continue;
            }
            vRelationshipsAux[sizeVRelationships] = d.vRelationships[i];
            sizeVRelationships++;
            bool vMethodAdded = false;
            string memory vMethodId = d.vRelationships[i].vMethodId;

            for (uint256 j = 0; j < sizeVMethods; j++) {
                if (UtilsLib.equalStrings(vMethodId, vMethodIdsAux[j])) {
                    vMethodAdded = true;
                    break;
                }
            }
            if (!vMethodAdded) {
                vMethodIdsAux[sizeVMethods] = vMethodId;
                vMethodsAux[sizeVMethods] = d.vMethods[vMethodId];
                sizeVMethods++;
            }
        }

        for (uint256 i = 0; i < d.capabilityInvocations.length; i++) {
            if (
                timestamp < d.capabilityInvocations[i].notBefore ||
                timestamp > d.capabilityInvocations[i].notAfter
            ) {
                continue;
            }
            vRelationshipsAux[sizeVRelationships] = d.capabilityInvocations[i];
            sizeVRelationships++;
            bool vMethodAdded = false;
            string memory vMethodId = d.capabilityInvocations[i].vMethodId;

            for (uint256 j = 0; j < sizeVMethods; j++) {
                if (UtilsLib.equalStrings(vMethodId, vMethodIdsAux[j])) {
                    vMethodAdded = true;
                    break;
                }
            }
            if (!vMethodAdded) {
                vMethodIdsAux[sizeVMethods] = vMethodId;
                vMethodsAux[sizeVMethods] = d.vMethods[vMethodId];
                sizeVMethods++;
            }
        }

        // copy auxiliary arrays to the result
        vMethodIds = new string[](sizeVMethods);
        vMethods = new DidDocumentStorage.VMethod[](sizeVMethods);
        vRelationships = new DidDocumentStorage.VRelationship[](
            sizeVRelationships
        );
        for (uint256 i = 0; i < sizeVMethods; i++) {
            vMethodIds[i] = vMethodIdsAux[i];
            vMethods[i] = vMethodsAux[i];
        }
        for (uint256 i = 0; i < sizeVRelationships; i++) {
            vRelationships[i] = vRelationshipsAux[i];
        }
    }

    // internal methods

    function _addVerificationRelationship(
        VRelationshipsStorage.VRelationships storage vs,
        string memory str,
        string memory vMethodId,
        string memory did,
        uint notBefore,
        uint notAfter
    ) internal returns (uint) {
        require(isValidRelationshipName(str), "invalid verification method");
        return
            vs.addVerificationRelationship(
                uint256(keccak256(abi.encodePacked(str, vMethodId))),
                did,
                notBefore,
                notAfter
            );
    }

    function _revokeVerificationMethod(
        DidDocumentStorage.DidDocuments storage ds,
        VRelationshipsStorage.VRelationships storage vs,
        string memory did,
        string memory vMethodId,
        uint256 notAfter
    ) internal returns (bool) {
        DidDocumentStorage.DidDocument storage d = ds.didList[did];
        require(
            d.vMethods[vMethodId].publicKey.length > 0,
            "vMethodId doesn't exist"
        );
        require(!d.vMethods[vMethodId].revoked, "vMethodId already revoked");

        for (uint i = 0; i < d.vRelationshipsIndexes[vMethodId].length; i++) {
            uint index = d.vRelationshipsIndexes[vMethodId][i];
            d.vRelationships[index].notAfter = notAfter;
            vs.updateVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            d.vRelationships[index].name,
                            vMethodId
                        )
                    )
                ),
                d.vRelationships[index].indexDid,
                notAfter
            );
        }

        if (d.capabilityInvocationMethodIdExist[vMethodId]) {
            uint i = d.capabilityInvocationMethodIdIndex[vMethodId];
            d.capabilityInvocations[i].notAfter = notAfter;
            // remove capabilityInvocation from mapping from DID
            if (d.vMethods[vMethodId].isSecp256k1) {
                d.vMethodIdOfAddress[
                    getAddress(d.vMethods[vMethodId].publicKey)
                ] = "";
            }
            vs.updateVerificationRelationship(
                uint256(
                    keccak256(
                        abi.encodePacked("capabilityInvocation", vMethodId)
                    )
                ),
                d.capabilityInvocations[i].indexDid,
                notAfter
            );
        }
        return true;
    }

    function isValidRelationshipName(
        string memory _method
    ) internal pure returns (bool) {
        return
            UtilsLib.equalStrings(_method, AUTHENTICATION_RELATIONSHIP) ||
            UtilsLib.equalStrings(_method, ASSERTION_RELATIONSHIP) ||
            UtilsLib.equalStrings(_method, KEY_AGREEMENT_RELATIONSHIP) ||
            UtilsLib.equalStrings(
                _method,
                CAPABILITY_INVOCATION_RELATIONSHIP
            ) ||
            UtilsLib.equalStrings(_method, CAPABILITY_DELEGATION_RELATIONSHIP);
    }

    function getAddress(
        bytes memory publicKey
    ) internal view returns (address) {
        return
            address(uint160(uint256(keccak256(sanitizePublicKey(publicKey)))));
    }

    function sanitizePublicKey(
        bytes memory publicKey
    ) internal pure returns (bytes memory) {
        if (publicKey.length == 65) {
            require(publicKey[0] == 0x04, "Invalid control byte");
            /**
             * step 1: EC public key prefix (04)
             * Note: We can not use the built-in array slices (like publicKey[1:])
             * because it is only for calldata arrays, not storage arrays.
             * Then we have to use a loop to make the slice
             */
            bytes memory publicKeyWithoutPrefix = new bytes(
                publicKey.length - 1
            );
            for (uint256 i = 1; i < publicKey.length; i++) {
                publicKeyWithoutPrefix[i - 1] = publicKey[i];
            }
            return publicKeyWithoutPrefix;
        } else if (publicKey.length == 64) {
            return publicKey;
        } else {
            revert("Invalid pub key length");
        }
    }
}
