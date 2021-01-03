require("dotenv").config();
const chalk = require("chalk");
const hre = require("hardhat");
const { ethers, network, web3 } = hre;
const { argv } = require("yargs");
const {
  getDeployedAddress,
  bytes32,
  getStablecoinAddress,
} = require("../utils/helpers.js");
const { expectEvent } = require("@openzeppelin/test-helpers");
const legos = require("@apy-finance/defi-legos");

const curveMappings = {
  cDAI_cUSDC: {
    pool_address: legos.curvefi.addresses.Pool_cDAI_cUSDC,
    pool_abi: legos.curvefi.abis.Pool_cDAI_cUSDC,

    lp_token_address: legos.curvefi.addresses.Token_cDAI_cUSDC_cUSDT,
    lp_token_codec: legos.curvefi.codecs.Token_cDAI_cUSDC_cUSDT,

    depositor_address: legos.curvefi.addresses.Deposit_Compound,
    depositor_codec: legos.curvefi.codecs.Deposit_Compound,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_Compound,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_Compound,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_Compound,
  },
  cDAI_cUSDC_cUSDT: {
    pool_address: legos.curvefi.addresses.Pool_cDAI_cUSDC_cUSDT,
    pool_abi: legos.curvefi.abis.Pool_cDAI_cUSDC_cUSDT,

    lp_token_address: legos.curvefi.addresses.Token_cDAI_cUSDC_cUSDT,
    lp_token_codec: legos.curvefi.codecs.Token_cDAI_cUSDC_cUSDT,

    depositor_address: legos.curvefi.addresses.Deposit_USDT,
    depositor_codec: legos.curvefi.codecs.Deposit_USDT,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_USDT,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_USDT,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_USDT,
  },
  yDAI_yUSDC_yUSDT_yTUSD: {
    pool_address: legos.curvefi.addresses.Pool_yDAI_yUSDC_yUSDT_yTUSD,
    pool_abi: legos.curvefi.abis.Pool_yDAI_yUSDC_yUSDT_yTUSD,

    lp_token_address: legos.curvefi.addresses.Token_yDAI_yUSDC_yUSDT_yTUSD,
    lp_token_codec: legos.curvefi.codecs.Token_yDAI_yUSDC_yUSDT_yTUSD,

    depositor_address: legos.curvefi.addresses.Deposit_Y,
    depositor_codec: legos.curvefi.codecs.Deposit_Y,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_Y,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_Y,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_Y,
  },
  Aave: {
    pool_address: legos.curvefi.addresses.Pool_Aave,
    pool_abi: legos.curvefi.abis.Pool_Aave,

    lp_token_address: legos.curvefi.addresses.Token_Aave,
    lp_token_codec: legos.curvefi.codecs.Token_Aave,

    depositor_address: legos.curvefi.addresses.Deposit_Aave,
    depositor_codec: legos.curvefi.codecs.Deposit_Aave,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_Aave,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_Aave,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_Aave,
  },
  DUSD: {
    pool_address: legos.curvefi.addresses.Pool_DUSD,
    pool_abi: legos.curvefi.abis.Pool_DUSD,

    lp_token_address: legos.curvefi.addresses.Token_DUSD,
    lp_token_codec: legos.curvefi.codecs.Token_DUSD,

    depositor_address: legos.curvefi.addresses.Deposit_DUSD,
    depositor_codec: legos.curvefi.codecs.Deposit_DUSD,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_DUSD,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_DUSD,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_DUSD,
  },
  sUSD: {
    pool_address: legos.curvefi.addresses.Pool_sUSD,
    pool_abi: legos.curvefi.abis.Pool_sUSD,

    lp_token_address: legos.curvefi.addresses.Token_sUSD,
    lp_token_codec: legos.curvefi.codecs.Token_sUSD,

    depositor_address: legos.curvefi.addresses.Deposit_sUSD,
    depositor_codec: legos.curvefi.codecs.Deposit_sUSD,

    gauge_address: legos.curvefi.addresses.Liquidity_Gauge_sUSD,
    gauge_abi: legos.curvefi.abis.Liquidity_Gauge_sUSD,
    gauge_codec: legos.curvefi.codecs.Liquidity_Gauge_sUSD,
  },
};

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  console.log("-------------CURVE-------------");
  await hre.run("compile");
  const NETWORK_NAME = network.name.toUpperCase();
  console.log(`${NETWORK_NAME} selected`);

  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  console.log("Deployer address:", chalk.green(deployer));

  const selectedPool = argv.pool;
  if (!(selectedPool in curveMappings)) {
    console.log(
      `Select supported pool: ${chalk.red(Object.keys(curveMappings))}`
    );
    process.exit(0);
  }

  const pool_abi = curveMappings[selectedPool].pool_abi;
  const pool_address = curveMappings[selectedPool].pool_address;

  const lp_token_address = curveMappings[selectedPool].lp_token_address;
  const lp_token_codec = curveMappings[selectedPool].lp_token_codec;

  const depositor_address = curveMappings[selectedPool].depositor_address;
  const depositor_codec = curveMappings[selectedPool].depositor_codec;

  const gauge_address = curveMappings[selectedPool].gauge_address;
  const gauge_abi = curveMappings[selectedPool].gauge_abi;
  const gauge_codec = curveMappings[selectedPool].gauge_codec;

  console.log("Protocol addresses:");
  console.log("\tPool:", chalk.green(pool_address));
  console.log("\tLP Token:", chalk.green(lp_token_address));
  console.log("\tDepositor:", chalk.green(depositor_address));
  console.log("\tGauge:", chalk.green(gauge_address));

  const lp_token = await ethers.getContractAt(
    "IDetailedERC20",
    lp_token_address
  );

  const APYManager = await ethers.getContractFactory("APYManager");
  const managerProxyAddress = getDeployedAddress(
    "APYManagerProxy",
    NETWORK_NAME
  );
  const managerOwnerAddress = await APYManager.attach(
    managerProxyAddress
  ).owner();
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [managerOwnerAddress],
  });
  const managerSigner = await ethers.provider.getSigner(managerOwnerAddress);
  console.log(
    "Manager deployer address:",
    chalk.green(await managerSigner.getAddress())
  );

  const manager = APYManager.attach(managerProxyAddress).connect(managerSigner);

  const strategyAddress = await manager.getStrategy(bytes32("curve_y"));
  console.log("Strategy address:", chalk.green(strategyAddress));

  const stablecoins = {};
  for (const symbol of ["DAI", "USDC", "USDT"]) {
    const stablecoinAddress = getStablecoinAddress(symbol, NETWORK_NAME);
    stablecoins[symbol] = await ethers.getContractAt(
      "IDetailedERC20",
      stablecoinAddress
    );
  }
  const daiBalance = (
    await stablecoins["DAI"].balanceOf(strategyAddress)
  ).toString();
  const daiAmount = argv.daiBal ? argv.daiBal : daiBalance;

  const usdcBalance = (
    await stablecoins["USDC"].balanceOf(strategyAddress)
  ).toString();
  const usdcAmount = argv.usdcBal ? argv.usdcBal : usdcBalance;

  const usdtBalance = (
    await stablecoins["USDT"].balanceOf(strategyAddress)
  ).toString();
  const usdtAmount = argv.usdtBal ? argv.usdtBal : usdtBalance;

  console.log("Strategy balances (before):");
  console.log(
    "\tLP token:",
    chalk.yellow((await lp_token.balanceOf(strategyAddress)).toString())
  );
  console.log("\tDAI:", chalk.yellow(daiBalance));
  console.log("\tUSDC:", chalk.yellow(usdcBalance));
  console.log("\tUSDT:", chalk.yellow(usdtBalance));

  let balanceAllocation = [];
  if (selectedPool === "cDAI_cUSDC") {
    balanceAllocation = [daiAmount, usdcAmount];
  } else if (selectedPool === "cDAI_cUSDC_cUSDT") {
    balanceAllocation = [daiAmount, usdcAmount, usdtAmount];
  } else if (selectedPool === "yDAI_yUSDC_yUSDT_yTUSD") {
    balanceAllocation = [daiAmount, usdcAmount, usdtAmount, 0];
  } else if (selectedPool === "Aave") {
    balanceAllocation = [daiAmount, usdcAmount, usdtAmount];
  } else if (selectedPool === "DUSD") {
    balanceAllocation = [0, daiAmount, usdcAmount, usdtAmount];
  } else if (selectedPool === "sUSD") {
    balanceAllocation = [daiAmount, usdcAmount, usdtAmount, 0];
  }

  const addLiquidityData = [
    [
      stablecoins["DAI"].address,
      legos.maker.codecs.DAI.encodeApprove(depositor_address, daiAmount),
    ],
    [
      stablecoins["USDC"].address,
      legos.maker.codecs.DAI.encodeApprove(depositor_address, usdcAmount),
    ],
    [
      stablecoins["USDT"].address,
      legos.maker.codecs.DAI.encodeApprove(depositor_address, usdtAmount),
    ],
    [
      depositor_address,
      depositor_codec.encodeAddLiquidity(balanceAllocation, 0),
    ],
  ];

  const liquidityTrx = await manager.execute(
    strategyAddress,
    addLiquidityData,
    {
      gasLimit: 9e6,
    }
  );
  await liquidityTrx.wait();
  console.log("Strategy balances (after):");
  console.log(
    "\tLP token:",
    chalk.yellow((await lp_token.balanceOf(strategyAddress)).toString())
  );
  console.log(
    "\tDAI:",
    chalk.yellow(
      (await stablecoins["DAI"].balanceOf(strategyAddress)).toString()
    )
  );
  console.log(
    "\tUSDC:",
    chalk.yellow(
      (await stablecoins["USDC"].balanceOf(strategyAddress)).toString()
    )
  );
  console.log(
    "\tUSDT:",
    chalk.yellow(
      (await stablecoins["USDT"].balanceOf(strategyAddress)).toString()
    )
  );

  const stableSwapY = new web3.eth.Contract(pool_abi, pool_address);
  await expectEvent.inTransaction(
    liquidityTrx.hash,
    stableSwapY,
    "AddLiquidity"
  );

  const lpBalance = await lp_token.balanceOf(strategyAddress);
  const depositData = [
    [lp_token_address, lp_token_codec.encodeApprove(gauge_address, lpBalance)],
    [gauge_address, gauge_codec.encodeDeposit(lpBalance)],
  ];

  const depositTrx = await manager.execute(strategyAddress, depositData, {
    gasLimit: 9e6,
  });

  const liquidityGauge = new web3.eth.Contract(gauge_abi, gauge_address);
  await expectEvent.inTransaction(depositTrx.hash, liquidityGauge, "Deposit");
}

if (!module.parent) {
  main(argv)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  module.exports = main;
}
