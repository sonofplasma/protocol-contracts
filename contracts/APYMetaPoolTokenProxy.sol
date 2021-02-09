// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";

contract APYMetaPoolTokenProxy is TransparentUpgradeableProxy {
    constructor(
        address _logic,
        address _proxyAdmin,
        address _tvlAgg,
        address _ethUsdAgg,
        uint256 _aggStalePeriod
    )
        public
        TransparentUpgradeableProxy(
            _logic,
            _proxyAdmin,
            abi.encodeWithSignature(
                "initialize(address,address,address,uint256)",
                _proxyAdmin,
                _tvlAgg,
                _ethUsdAgg,
                _aggStalePeriod
            )
        )
    {} // solhint-disable no-empty-blocks
}
