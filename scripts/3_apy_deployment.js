require("dotenv").config();
const { ethers, network } = require("hardhat");
const { updateDeployJsons, erc20 } = require("../utils/helpers");

const totalSupply = erc20("100000000", "18"); // 100MM

async function main() {
  const NETWORK_NAME = network.name.toUpperCase();
  console.log("");
  console.log(`${NETWORK_NAME} selected`);
  console.log("");

  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  console.log("Deployer address:", deployer);

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const GovernanceTokenProxy = await ethers.getContractFactory(
    "GovernanceTokenProxy"
  );

  let deploy_data = {};

  const proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.deployed();
  deploy_data["GovernanceTokenProxyAdmin"] = proxyAdmin.address;
  console.log(`ProxyAdmin: ${proxyAdmin.address}`);

  const logic = await GovernanceToken.deploy();
  await logic.deployed();
  deploy_data["GovernanceToken"] = logic.address;
  console.log(`Implementation Logic: ${logic.address}`);

  const proxy = await GovernanceTokenProxy.deploy(
    logic.address,
    proxyAdmin.address,
    totalSupply.toString()
  );
  await proxy.deployed();
  deploy_data["GovernanceTokenProxy"] = proxy.address;
  console.log(`Proxy: ${proxy.address}`);

  await updateDeployJsons(NETWORK_NAME, deploy_data);

  const instance = await GovernanceToken.attach(proxy.address);
  console.log("Total supply:", (await instance.totalSupply()).toString());
  console.log(
    "APY balance:",
    (await instance.balanceOf(deployer)).toString() /
      10 ** (await instance.decimals())
  );
}

main()
  .then(() => {
    console.log("Deployment successful.");
    console.log("");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    console.log("");
    process.exit(1);
  });
