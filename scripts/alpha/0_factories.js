#!/usr/bin/env node
/*
 * Command to run script:
 *
 * $ yarn hardhat --network <network name> run scripts/<script filename>
 *
 * Alternatively, to pass command-line arguments:
 *
 * $ HARDHAT_NETWORK=<network name> node scripts/<script filename> --arg1=val1 --arg2=val2
 */
require("dotenv").config();
const { argv } = require("yargs").option("gasPrice", {
  type: "number",
  description: "Gas price in gwei; omitting uses GasNow value",
});
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;
const chalk = require("chalk");
const { getGasPrice } = require("../../utils/helpers");
const fs = require("fs");

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  await hre.run("compile");
  const networkName = network.name.toUpperCase();
  console.log("");
  console.log(`${networkName} selected`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance =
    (await ethers.provider.getBalance(deployer.address)).toString() / 1e18;
  console.log("ETH balance:", balance.toString());
  console.log("");

  console.log("");
  console.log("Deploying ...");
  console.log("");

  const factoryNames = [
    "ProxyAdminFactory",
    "ProxyFactory",
    "AddressRegistryV2Factory",
    "MetaPoolTokenFactory",
    "PoolTokenV1Factory",
    "PoolTokenV2Factory",
    "TvlManagerFactory",
    "Erc20AllocationFactory",
    "OracleAdapterFactory",
    "LpAccountFactory",
  ];
  const factoryAddresses = [];
  const addressesFilename = "scripts/alpha/deployment-factory-addresses.json";
  let gasUsed = BigNumber.from("0");

  for (const name of factoryNames) {
    console.log(chalk.green(name));
    const contractFactory = await ethers.getContractFactory(name, deployer);
    const gasPrice = await getGasPrice(argv.gasPrice);
    const contract = await contractFactory.deploy({ gasPrice });
    console.log(`https://etherscan.io/tx/${contract.deployTransaction.hash}`);
    const receipt = await contract.deployTransaction.wait();
    gasUsed = gasUsed.add(receipt.gasUsed);
    console.log("  ... done.");
    console.log("");

    factoryAddresses.push(contract.address);

    // rewrite file on each iteration to safeguard against failed deployment
    const addressesJson = JSON.stringify(factoryAddresses, null, "  ");
    fs.writeFileSync(addressesFilename, addressesJson, (err) => {
      if (err) throw err;
    });
  }

  console.log("Total gas used: %s", chalk.yellow(gasUsed));
  console.log("");
  console.log("Deployed addresses filename: %s", addressesFilename);
}

if (!module.parent) {
  main(argv)
    .then(() => {
      console.log("");
      console.log("Deployment successful.");
      console.log("");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      console.log("");
      process.exit(1);
    });
} else {
  module.exports = main;
}