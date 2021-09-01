// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {Ownable} from "contracts/common/Imports.sol";
import {MetaPoolToken} from "contracts/mapt/MetaPoolToken.sol";
import {MetaPoolTokenProxy} from "contracts/mapt/MetaPoolTokenProxy.sol";
import {PoolToken} from "contracts/pool/PoolToken.sol";
import {PoolTokenProxy} from "contracts/pool/PoolTokenProxy.sol";
import {PoolTokenV2} from "contracts/pool/PoolTokenV2.sol";
import {IAddressRegistryV2} from "contracts/registry/Imports.sol";
import {Erc20Allocation} from "contracts/tvl/Erc20Allocation.sol";
import {TvlManager} from "contracts/tvl/TvlManager.sol";
import {OracleAdapter} from "contracts/oracle/OracleAdapter.sol";
import {
    ProxyAdmin,
    TransparentUpgradeableProxy
} from "contracts/proxy/Imports.sol";

import {DeploymentConstants} from "./constants.sol";
import {
    ProxyAdminFactory,
    ProxyFactory,
    Erc20AllocationFactory,
    MetaPoolTokenFactory,
    OracleAdapterFactory,
    PoolTokenV1Factory,
    PoolTokenV2Factory,
    TvlManagerFactory
} from "./factories.sol";

/** @dev
# Alpha Deployment

## Deployment order of contracts

The address registry needs multiple addresses registered
to setup the roles for access control in the contract
constructors:

MetaPoolToken

- emergencySafe (emergency role, default admin role)
- lpSafe (LP role)

PoolTokenV2

- emergencySafe (emergency role, default admin role)
- adminSafe (admin role)
- mApt (contract role)

Erc20Allocation

- emergencySafe (default admin role)
- lpSafe (LP role)
- mApt (contract role)

TvlManager

- emergencySafe (emergency role, default admin role)
- lpSafe (LP role)

OracleAdapter

- emergencySafe (emergency role, default admin role)
- adminSafe (admin role)
- tvlManager (contract role)
- mApt (contract role)

Note the order of dependencies: a contract requires contracts
above it in the list to be deployed first. Thus we need
to deploy in the order given, starting with the Safes.

Other steps:
- LP Safe must approve mAPT for each pool underlyer
*/

/* solhint-disable max-states-count, func-name-mixedcase, no-empty-blocks */
contract AlphaDeployment is Ownable, DeploymentConstants {
    // TODO: figure out a versioning scheme
    uint256 public constant VERSION = 1;

    IAddressRegistryV2 public addressRegistry;

    address public proxyAdminFactory;
    address public proxyFactory;
    address public mAptFactory;
    address public poolTokenV1Factory;
    address public poolTokenV2Factory;
    address public erc20AllocationFactory;
    address public tvlManagerFactory;
    address public oracleAdapterFactory;

    uint256 public step;

    address public emergencySafe;
    address public adminSafe;
    address public lpSafe;

    // step 1
    address public mApt;

    // step 2
    address public demoProxyAdmin;
    address public daiDemoPool;
    address public usdcDemoPool;
    address public usdtDemoPool;

    // step 3
    address public erc20Allocation;
    address public tvlManager;

    // step 4
    address public oracleAdapter;

    // step 5
    // pool v2 upgrades
    address public poolTokenV2;

    modifier updateStep(uint256 step_) {
        require(step == step_, "INVALID_STEP");
        _;
        step += 1;
    }

    constructor(
        address addressRegistry_,
        address proxyAdminFactory_,
        address proxyFactory_,
        address mAptFactory_,
        address poolTokenV1Factory_,
        address poolTokenV2Factory_,
        address erc20AllocationFactory_,
        address tvlManagerFactory_,
        address oracleAdapterFactory_
    ) public {
        step = 1;

        addressRegistry = IAddressRegistryV2(addressRegistry_);

        // Simplest to check now that Safes are deployed in order to
        // avoid repeated preconditions checks later.
        emergencySafe = addressRegistry.getAddress("emergencySafe");
        adminSafe = addressRegistry.getAddress("adminSafe");
        lpSafe = addressRegistry.lpSafeAddress();

        proxyAdminFactory = proxyAdminFactory_;
        proxyFactory = proxyFactory_;
        mAptFactory = mAptFactory_;
        poolTokenV1Factory = poolTokenV1Factory_;
        poolTokenV2Factory = poolTokenV2Factory_;
        erc20AllocationFactory = erc20AllocationFactory_;
        tvlManagerFactory = tvlManagerFactory_;
        oracleAdapterFactory = oracleAdapterFactory_;
    }

    /**
     * @dev There are two types of checks:
     *   1. check a contract address from a previous step's deployment
     *      is registered with expected ID.
     *   2. check the deployment contract has ownership of necessary
     *      contracts to perform actions, e.g. register an address or upgrade
     *      a proxy.
     *
     * @param registeredIds identifiers for the Address Registry
     * @param deployedAddresses addresses from previous steps' deploys
     * @param ownedContracts addresses that should be owned by this contract
     */
    function verifyPreConditions(
        bytes32[] memory registeredIds,
        address[] memory deployedAddresses,
        address[] memory ownedContracts
    ) public view virtual {
        for (uint256 i = 0; i < registeredIds.length; i++) {
            require(
                addressRegistry.getAddress(registeredIds[i]) ==
                    deployedAddresses[i],
                "MISSING_DEPLOYED_ADDRESS"
            );
        }
        for (uint256 i = 0; i < ownedContracts.length; i++) {
            require(
                Ownable(ownedContracts[i]).owner() == address(this),
                "MISSING_OWNERSHIP"
            );
        }
    }

    /// @dev Deploy the mAPT proxy and its proxy admin.
    ///      Does not register any roles for contracts.
    function deploy_1_MetaPoolToken()
        external
        onlyOwner
        updateStep(1)
        returns (address)
    {
        address[] memory ownedContracts = new address[](1);
        ownedContracts[0] = address(addressRegistry);
        verifyPreConditions(new bytes32[](0), new address[](0), ownedContracts);

        address newOwner = msg.sender; // will own the proxy admin
        address proxyAdmin =
            ProxyAdminFactory(proxyAdminFactory).create(newOwner);
        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(address,address)",
                proxyAdmin,
                addressRegistry
            );
        mApt = MetaPoolTokenFactory(mAptFactory).create(
            proxyFactory,
            proxyAdmin,
            initData,
            address(0) // no owner for mAPT
        );
        addressRegistry.registerAddress("mApt", mApt);
        return mApt;
    }

    /// @dev complete proxy deploy for the demo pools
    ///      Registers mAPT for a contract role.
    function deploy_2_DemoPools() external onlyOwner updateStep(2) {
        bytes32[] memory registeredIds = new bytes32[](1);
        address[] memory deployedAddresses = new address[](1);
        address[] memory ownedContracts = new address[](1);
        registeredIds[0] = "mApt";
        deployedAddresses[0] = mApt;
        ownedContracts[0] = address(addressRegistry);
        verifyPreConditions(registeredIds, deployedAddresses, ownedContracts);

        address proxyAdmin =
            ProxyAdminFactory(proxyAdminFactory).create(msg.sender);

        address fakeAggAddress = 0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe;
        bytes memory daiInitData =
            abi.encodeWithSignature(
                "initialize(address,address,address)",
                proxyAdmin,
                DAI_ADDRESS,
                fakeAggAddress
            );

        address logicV2 = PoolTokenV2Factory(poolTokenV2Factory).create();
        bytes memory initDataV2 =
            abi.encodeWithSignature(
                "initializeUpgrade(address)",
                address(addressRegistry)
            );

        address daiProxy =
            PoolTokenV1Factory(poolTokenV1Factory).create(
                proxyFactory,
                proxyAdmin,
                daiInitData,
                msg.sender
            );
        ProxyAdmin(proxyAdmin).upgradeAndCall(
            PoolTokenProxy(payable(daiProxy)),
            logicV2,
            initDataV2
        );
        addressRegistry.registerAddress("daiDemoPool", daiProxy);

        bytes memory usdcInitData =
            abi.encodeWithSignature(
                "initialize(address,address,address)",
                proxyAdmin,
                USDC_ADDRESS,
                fakeAggAddress
            );
        address usdcProxy =
            PoolTokenV1Factory(poolTokenV1Factory).create(
                proxyFactory,
                proxyAdmin,
                usdcInitData,
                msg.sender
            );
        ProxyAdmin(proxyAdmin).upgradeAndCall(
            PoolTokenProxy(payable(usdcProxy)),
            logicV2,
            initDataV2
        );
        addressRegistry.registerAddress("usdcDemoPool", usdcProxy);

        bytes memory usdtInitData =
            abi.encodeWithSignature(
                "initialize(address,address,address)",
                proxyAdmin,
                USDT_ADDRESS,
                fakeAggAddress
            );
        address usdtProxy =
            PoolTokenV1Factory(poolTokenV1Factory).create(
                proxyFactory,
                proxyAdmin,
                usdtInitData,
                msg.sender
            );
        ProxyAdmin(proxyAdmin).upgradeAndCall(
            PoolTokenProxy(payable(usdtProxy)),
            logicV2,
            initDataV2
        );
        addressRegistry.registerAddress("usdtDemoPool", usdtProxy);
    }

    /// @dev Deploy ERC20 allocation and TVL Manager.
    ///      Does not register any roles for contracts.
    function deploy_3_TvlManager()
        external
        onlyOwner
        updateStep(3)
        returns (address)
    {
        bytes32[] memory registeredIds = new bytes32[](0);
        address[] memory deployedAddresses = new address[](0);
        address[] memory ownedContracts = new address[](1);
        ownedContracts[0] = address(addressRegistry);
        verifyPreConditions(registeredIds, deployedAddresses, ownedContracts);

        erc20Allocation = Erc20AllocationFactory(erc20AllocationFactory).create(
            address(addressRegistry)
        );
        tvlManager = TvlManagerFactory(tvlManagerFactory).create(
            address(addressRegistry)
        );
        TvlManager(tvlManager).registerAssetAllocation(
            Erc20Allocation(erc20Allocation)
        );

        addressRegistry.registerAddress("tvlManager", address(tvlManager));
        return tvlManager;
    }

    /// @dev registers mAPT and TvlManager for contract roles
    function deploy_4_OracleAdapter()
        external
        onlyOwner
        updateStep(4)
        returns (address)
    {
        bytes32[] memory registeredIds = new bytes32[](2);
        address[] memory deployedAddresses = new address[](2);
        address[] memory ownedContracts = new address[](1);
        registeredIds[0] = "mApt";
        deployedAddresses[0] = mApt;
        registeredIds[1] = "tvlManager";
        deployedAddresses[1] = tvlManager;
        ownedContracts[0] = address(addressRegistry);
        verifyPreConditions(registeredIds, deployedAddresses, ownedContracts);

        address[] memory assets = new address[](3);
        assets[0] = DAI_ADDRESS;
        assets[1] = USDC_ADDRESS;
        assets[2] = USDT_ADDRESS;

        address[] memory sources = new address[](3);
        sources[0] = DAI_USD_AGG_ADDRESS;
        sources[1] = USDC_USD_AGG_ADDRESS;
        sources[2] = USDT_USD_AGG_ADDRESS;

        uint256 aggStalePeriod = 86400;
        uint256 defaultLockPeriod = 270;

        oracleAdapter = OracleAdapterFactory(oracleAdapterFactory).create(
            address(addressRegistry),
            TVL_AGG_ADDRESS,
            assets,
            sources,
            aggStalePeriod,
            defaultLockPeriod
        );
        addressRegistry.registerAddress("oracleAdapter", oracleAdapter);
        return oracleAdapter;
    }

    /// @notice upgrade from v1 to v2
    /// @dev register mAPT for a contract role
    function deploy_5_PoolTokenV2_upgrade() external onlyOwner updateStep(5) {
        bytes32[] memory registeredIds = new bytes32[](1);
        address[] memory deployedAddresses = new address[](1);
        address[] memory ownedContracts = new address[](2);
        registeredIds[0] = "mApt";
        deployedAddresses[0] = mApt;
        ownedContracts[0] = address(addressRegistry);
        ownedContracts[1] = POOL_PROXY_ADMIN;
        verifyPreConditions(registeredIds, deployedAddresses, ownedContracts);

        address logicV2 = PoolTokenV2Factory(poolTokenV2Factory).create();
        bytes memory initData =
            abi.encodeWithSignature(
                "initializeUpgrade(address)",
                addressRegistry
            );
        ProxyAdmin(POOL_PROXY_ADMIN).upgradeAndCall(
            TransparentUpgradeableProxy(payable(DAI_POOL_PROXY)),
            logicV2,
            initData
        );
        ProxyAdmin(POOL_PROXY_ADMIN).upgradeAndCall(
            TransparentUpgradeableProxy(payable(USDC_POOL_PROXY)),
            logicV2,
            initData
        );
        ProxyAdmin(POOL_PROXY_ADMIN).upgradeAndCall(
            TransparentUpgradeableProxy(payable(USDT_POOL_PROXY)),
            logicV2,
            initData
        );
    }

    function cleanup() external onlyOwner {
        handoffOwnership(address(addressRegistry));
        handoffOwnership(POOL_PROXY_ADMIN);
    }

    function handoffOwnership(address ownedContract) public onlyOwner {
        Ownable(ownedContract).transferOwnership(msg.sender);
    }
}
/* solhint-enable func-name-mixedcase */
