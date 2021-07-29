// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;

import {
    IERC20
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface IDetailedERC20UpgradeSafe is IERC20 {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);
}