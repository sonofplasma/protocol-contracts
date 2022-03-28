// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {
    MetaPoolAllocationBaseV3
} from "contracts/protocols/convex/metapool/Imports.sol";

import {ConvexUstWormholeConstants} from "./Constants.sol";

contract ConvexUstWormholeAllocation is
    MetaPoolAllocationBaseV3,
    ConvexUstWormholeConstants
{
    function balanceOf(address account, uint8 tokenIndex)
        public
        view
        override
        returns (uint256)
    {
        return
            super.getUnderlyerBalance(
                account,
                META_POOL,
                REWARD_CONTRACT,
                LP_TOKEN,
                uint256(tokenIndex)
            );
    }

    function _getTokenData()
        internal
        pure
        override
        returns (TokenData[] memory)
    {
        return _getBasePoolTokenData();
    }
}
