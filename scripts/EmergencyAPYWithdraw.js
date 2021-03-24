require("dotenv").config();
const { ethers, network } = require("hardhat");
const { generateSignature } = require("./generate_signature");
const { CHAIN_IDS, DEPLOYS_JSON } = require("../utils/constants");
const GOV_PROXY = require(DEPLOYS_JSON["GovernanceTokenProxy"]);
const DISTRIBUTOR_ADDR = require(DEPLOYS_JSON["RewardDistributor"]);

async function main() {
  if (!process.env.SIGNER) {
    console.log("Private key env SIGNER is not set");
    return;
  }

  const NETWORK_NAME = network.name.toUpperCase();
  console.log(`${NETWORK_NAME} selected`);

  const GovToken = await ethers.getContractFactory("GovernanceToken");
  const RewardDistributor = await ethers.getContractFactory(
    "RewardDistributor"
  );

  const tokenInstance = await GovToken.attach(
    GOV_PROXY[CHAIN_IDS[NETWORK_NAME]]
  );
  const rewardsInstance = await RewardDistributor.attach(
    DISTRIBUTOR_ADDR[CHAIN_IDS[NETWORK_NAME]]
  );

  console.log(`APY Token Address: ${tokenInstance.address}`);
  console.log(`APY Reward Distributor Address: ${rewardsInstance.address}`);

  let apyBal = await tokenInstance.balanceOf(rewardsInstance.address);
  console.log(`Reward Distributor Balance: ${apyBal.toString()} APY`);

  const EMERGENCY_WITHDRAW_RECIPIENT = "FILL ME OUT!!!";

  console.log(`Emergency Recipient: ${EMERGENCY_WITHDRAW_RECIPIENT}`);

  const recipientNonce = await rewardsInstance.accountNonces(
    EMERGENCY_WITHDRAW_RECIPIENT
  );
  console.log(`Recipient Nonce: ${recipientNonce.toString()}`);

  const signature = await generateSignature(
    process.env.SIGNER,
    "APY Distribution",
    rewardsInstance.address,
    recipientNonce.toString(),
    EMERGENCY_WITHDRAW_RECIPIENT,
    apyBal.toString(),
    CHAIN_IDS[NETWORK_NAME]
  );

  await rewardsInstance.claim(
    [
      recipientNonce.toString(),
      EMERGENCY_WITHDRAW_RECIPIENT,
      apyBal.toString(),
    ],
    signature.v,
    signature.r,
    signature.s
  );

  console.log(
    `Funds Secured ${apyBal.toString()} APY -> ${EMERGENCY_WITHDRAW_RECIPIENT}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
