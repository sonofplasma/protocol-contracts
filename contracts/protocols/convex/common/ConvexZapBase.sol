// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IZap} from "contracts/lpaccount/Imports.sol";
import {
    IAssetAllocation,
    IERC20,
    IDetailedERC20
} from "contracts/common/Imports.sol";
import {SafeERC20} from "contracts/libraries/Imports.sol";
import {
    IBooster,
    IBaseRewardPool
} from "contracts/protocols/convex/common/interfaces/Imports.sol";
import {CurveZapBase} from "contracts/protocols/curve/common/CurveZapBase.sol";

abstract contract ConvexZapBase is IZap, CurveZapBase {
    using SafeERC20 for IERC20;

    address internal constant BOOSTER_ADDRESS =
        0xF403C135812408BFbE8713b5A23a04b3D48AAE31;

    address internal immutable LP_ADDRESS;
    uint256 internal immutable PID;

    constructor(
        address swapAddress,
        address lpAddress,
        uint256 pid,
        uint256 denominator,
        uint256 slippage,
        uint256 nCoins
    )
        public
        CurveZapBase(swapAddress, denominator, slippage, nCoins)
    // solhint-disable-next-line no-empty-blocks
    {
        LP_ADDRESS = lpAddress;
        PID = pid;
    }

    function getLpTokenBalance(address account)
        external
        view
        override
        returns (uint256 lpBalance)
    {
        IBaseRewardPool rewardContract = _getRewardContract();
        // Convex's staking token is issued 1:1 for deposited LP tokens
        lpBalance = rewardContract.balanceOf(account);
    }

    /// @dev deposit LP tokens in Convex's Booster contract
    function _depositToGauge() internal override {
        IBooster booster = IBooster(BOOSTER_ADDRESS);
        uint256 lpBalance = IERC20(LP_ADDRESS).balanceOf(address(this));
        IERC20(LP_ADDRESS).safeApprove(BOOSTER_ADDRESS, 0);
        IERC20(LP_ADDRESS).safeApprove(BOOSTER_ADDRESS, lpBalance);
        booster.deposit(PID, lpBalance, true);
    }

    function _withdrawFromGauge(uint256 amount)
        internal
        override
        returns (uint256)
    {
        IBaseRewardPool rewardContract = _getRewardContract();
        rewardContract.withdrawAndUnwrap(amount, true);
        //lpBalance
        return IERC20(LP_ADDRESS).balanceOf(address(this));
    }

    function _claim() internal override {
        // this will claim CRV and extra rewards
        IBaseRewardPool rewardContract = _getRewardContract();
        rewardContract.getReward();
    }

    function _getRewardContract() internal view returns (IBaseRewardPool) {
        IBooster booster = IBooster(BOOSTER_ADDRESS);
        IBooster.PoolInfo memory poolInfo = booster.poolInfo(PID);
        return IBaseRewardPool(poolInfo.crvRewards);
    }
}
