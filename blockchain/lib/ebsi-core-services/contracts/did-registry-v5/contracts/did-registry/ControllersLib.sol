// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

import "./ControllersStorage.sol";
import "./UtilsLib.sol";

library ControllersLib {
    function linkDidToController(
        ControllersStorage.Controllers storage cs,
        string memory did,
        string memory controller
    ) external returns (bool) {
        uint index = cs.didsByController[controller].length;
        cs.didsByController[controller].push(did);
        cs.didsByControllerIndex[controller][did] = index;
        return true;
    }

    function unlinkDidFromController(
        ControllersStorage.Controllers storage cs,
        string memory did,
        string memory controller
    ) external returns (bool) {
        string[] storage dids = cs.didsByController[controller];
        uint index = cs.didsByControllerIndex[controller][did];

        if (UtilsLib.equalStrings(dids[index], did)) {
            // correct index
            dids[index] = dids[dids.length - 1];
            // remap index
            cs.didsByControllerIndex[controller][did] = 0;
            cs.didsByControllerIndex[controller][dids[index]] = index;
            dids.pop();
        }
        return true;
    }
}
