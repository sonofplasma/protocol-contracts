require("dotenv").config();
const hre = require("hardhat");
const { ethers, network } = hre;
const { argv } = require("yargs");
const {
  getDeployedAddress,
  erc20,
  bytes32,
  getStablecoinAddress,
} = require("../../utils/helpers.js");
const { ether, send } = require("@openzeppelin/test-helpers");
const { WHALE_ADDRESSES } = require("../../utils/constants.js");

async function acquireToken(fundAccount, receiver, token, amount) {
  /* NOTE: Ganache is setup to control "whale" addresses. This method moves
  requested funds out of the fund account and into the specified wallet */

  amount = amount.toString();
  const fundAccountSigner = await ethers.provider.getSigner(fundAccount);
  const trx = await token.connect(fundAccountSigner).transfer(receiver, amount);
  trx.wait();
  const tokenBal = await token.balanceOf(receiver);
  console.log(`${token.address} Balance: ${tokenBal.toString()}`);
}

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  await hre.run("compile");
  const NETWORK_NAME = network.name.toUpperCase();
  console.log("");
  console.log(`${NETWORK_NAME} selected`);
  console.log("");

  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  console.log("Deployer address:", deployer);
  console.log("");

  const stablecoins = {};
  for (const symbol of ["DAI", "USDC", "USDT"]) {
    const stablecoinAddress = getStablecoinAddress(symbol, NETWORK_NAME);
    stablecoins[symbol] = await ethers.getContractAt(
      "IDetailedERC20",
      stablecoinAddress
    );
  }

  const APYManager = await ethers.getContractFactory("APYManager");
  const managerProxyAddress = getDeployedAddress(
    "APYManagerProxy",
    NETWORK_NAME
  );
  const manager = APYManager.attach(managerProxyAddress);
  const strategyAddress = await manager.getStrategy(bytes32("curve_y"));
  console.log("Strategy address:", strategyAddress);
  console.log("");

  console.log("Acquire extra funds for testing ...");
  for (const symbol of Object.keys(stablecoins)) {
    const token = stablecoins[symbol];
    const amount = erc20("100000", await token.decimals());
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDRESSES[symbol]],
    });
    await send.ether(deployer, WHALE_ADDRESSES[symbol], ether("1"));
    await acquireToken(WHALE_ADDRESSES[symbol], strategyAddress, token, amount);
  }
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