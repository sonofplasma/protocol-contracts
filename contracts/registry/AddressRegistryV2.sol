// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {OwnableUpgradeSafe} from "contracts/proxy/Imports.sol";
import {Initializable} from "contracts/proxy/Imports.sol";
import {IAddressRegistryV2} from "./IAddressRegistryV2.sol";

/**
 * @title APY.Finance's address registry
 * @author APY.Finance
 * @notice The address registry has two important purposes, one which
 * is fairly concrete and another abstract.
 *
 * 1. The registry enables components of the APY.Finance system
 * and external systems to retrieve core addresses reliably
 * even when the functionality may move to a different
 * address.
 *
 * 2. The registry also makes explicit which contracts serve
 * as primary entrypoints for interacting with different
 * components.  Not every contract is registered here, only
 * the ones properly deserving of an identifier.  This helps
 * define explicit boundaries between groups of contracts,
 * each of which is logically cohesive.
 */
contract AddressRegistryV2 is
    Initializable,
    OwnableUpgradeSafe,
    IAddressRegistryV2
{
    /* ------------------------------- */
    /* impl-specific storage variables */
    /* ------------------------------- */
    /** @notice the same address as the proxy admin; used
     *  to protect init functions for upgrades */
    address public proxyAdmin;
    bytes32[] internal _idList;
    mapping(bytes32 => address) internal _idToAddress;

    /* ------------------------------- */

    event AdminChanged(address);

    /**
     * @dev Throws if called by any account other than the proxy admin.
     */
    modifier onlyAdmin() {
        require(msg.sender == proxyAdmin, "ADMIN_ONLY");
        _;
    }

    /**
     * @dev Since the proxy delegate calls to this "logic" contract, any
     * storage set by the logic contract's constructor during deploy is
     * disregarded and this function is needed to initialize the proxy
     * contract's storage according to this contract's layout.
     *
     * Since storage is not set yet, there is no simple way to protect
     * calling this function with owner modifiers.  Thus the OpenZeppelin
     * `initializer` modifier protects this function from being called
     * repeatedly.  It should be called during the deployment so that
     * it cannot be called by someone else later.
     *
     * NOTE: this function is copied from the V1 contract and has already
     * been called during V1 deployment.  It is included here for clarity.
     */
    function initialize(address adminAddress) external initializer {
        require(adminAddress != address(0), "INVALID_ADMIN");

        // initialize ancestor storage
        __Context_init_unchained();
        __Ownable_init_unchained();

        // initialize impl-specific storage
        _setAdminAddress(adminAddress);
    }

    /**
     * @dev Dummy function to show how one would implement an init function
     * for future upgrades.  Note the `initializer` modifier can only be used
     * once in the entire contract, so we can't use it here.  Instead,
     * we set the proxy admin address as a variable and protect this
     * function with `onlyAdmin`, which only allows the proxy admin
     * to call this function during upgrades.
     */
    // solhint-disable-next-line no-empty-blocks
    function initializeUpgrade() external virtual onlyAdmin {}

    /**
     * @dev Convenient method to register multiple addresses at once.
     */
    function registerMultipleAddresses(
        bytes32[] calldata ids,
        address[] calldata addresses
    ) external override onlyOwner {
        require(ids.length == addresses.length, "Inputs have differing length");
        for (uint256 i = 0; i < ids.length; i++) {
            bytes32 id = ids[i];
            address address_ = addresses[i];
            registerAddress(id, address_);
        }
    }

    /**
     * @dev Delete the address corresponding to the identifier.
     * Time-complexity is O(n) where n is the length of `_idList`.
     */
    function deleteAddress(bytes32 id) external override onlyOwner {
        for (uint256 i = 0; i < _idList.length; i++) {
            if (_idList[i] == id) {
                // copy last element to slot i and shorten array
                _idList[i] = _idList[_idList.length - 1];
                _idList.pop();
                address address_ = _idToAddress[id];
                delete _idToAddress[id];
                emit AddressDeleted(id, address_);
                break;
            }
        }
    }

    function setAdminAddress(address adminAddress) external onlyOwner {
        _setAdminAddress(adminAddress);
    }

    /**
     * @notice Returns the list of all registered identifiers.
     */
    function getIds() external view override returns (bytes32[] memory) {
        return _idList;
    }

    /**
     * @notice Retrieve the address corresponding to the identifier.
     */
    function getAddress(bytes32 id) public view override returns (address) {
        address address_ = _idToAddress[id];
        require(address_ != address(0), "Missing address");
        return address_;
    }

    /**
     * @notice Get the address for the TVL Manager.
     * @dev Not just a helper function, this makes explicit a key ID
     * for the system.
     */
    function tvlManagerAddress() public view override returns (address) {
        return getAddress("tvlManager");
    }

    /**
     * @notice An alias for the TVL Manager.  This is used by
     * Chainlink nodes to compute the deployed value of the
     * APY.Finance system.
     * @dev Not just a helper function, this makes explicit a key ID
     * for the system.
     */
    function chainlinkRegistryAddress()
        external
        view
        override
        returns (address)
    {
        return tvlManagerAddress();
    }

    /**
     * @notice Get the address for APY.Finance's DAI stablecoin pool.
     * @dev Not just a helper function, this makes explicit a key ID
     * for the system.
     */
    function daiPoolAddress() external view override returns (address) {
        return getAddress("daiPool");
    }

    /**
     * @notice Get the address for APY.Finance's USDC stablecoin pool.
     * @dev Not just a helper function, this makes explicit a key ID
     * for the system.
     */
    function usdcPoolAddress() external view override returns (address) {
        return getAddress("usdcPool");
    }

    /**
     * @notice Get the address for APY.Finance's USDT stablecoin pool.
     * @dev Not just a helper function, this makes explicit a key ID
     * for the system.
     */
    function usdtPoolAddress() external view override returns (address) {
        return getAddress("usdtPool");
    }

    function mAptAddress() external view override returns (address) {
        return getAddress("mApt");
    }

    /**
     * @notice Get the address for the APY.Finance LP Safe.
     */
    function lpSafeAddress() external view override returns (address) {
        return getAddress("lpSafe");
    }

    function adminSafeAddress() external view override returns (address) {
        return getAddress("adminSafe");
    }

    function emergencySafeAddress() external view override returns (address) {
        return getAddress("emergencySafe");
    }

    function oracleAdapterAddress() external view override returns (address) {
        return getAddress("oracleAdapter");
    }

    /**
     * @notice Register address with identifier.
     * @dev Using an existing ID will replace the old address with new.
     * Currently there is no way to remove an ID, as attempting to
     * register the zero address will revert.
     */
    function registerAddress(bytes32 id, address address_)
        public
        override
        onlyOwner
    {
        require(address_ != address(0), "Invalid address");
        if (_idToAddress[id] == address(0)) {
            // id wasn't registered before, so add it to the list
            _idList.push(id);
        }
        _idToAddress[id] = address_;
        emit AddressRegistered(id, address_);
    }

    function _setAdminAddress(address adminAddress) internal {
        require(adminAddress != address(0), "INVALID_ADMIN");
        proxyAdmin = adminAddress;
        emit AdminChanged(adminAddress);
    }
}
