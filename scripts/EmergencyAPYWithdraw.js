require("dotenv").config();
const { ethers, network } = require("@nomiclabs/buidler");
const { generateSignature } = require("./generate_signature")
const { CHAIN_IDS, DEPLOYS_JSON } = require("../utils/constants.js");
const APY_GOV_PROXY = require(DEPLOYS_JSON["APYGovernanceTokenProxy"]);
const APY_DISTRIBUTOR_ADDR = require(DEPLOYS_JSON["APYRewardDistributor"]);

async function main() {
  const NETWORK_NAME = network.name.toUpperCase();
  console.log(`${NETWORK_NAME} selected`);

  const APYGovToken = await ethers.getContractFactory("APYGovernanceToken");
  const APYRewardDistributor = await ethers.getContractFactory("APYRewardDistributor");

  const tokenInstance = await APYGovToken.attach(APY_GOV_PROXY[CHAIN_IDS[NETWORK_NAME]])
  const rewardsInstance = await APYRewardDistributor.attach(APY_DISTRIBUTOR_ADDR[CHAIN_IDS[NETWORK_NAME]])

  let apyBal = await tokenInstance.balanceOf(rewardsInstance.address)
  console.log(`Contract Balance: ${apyBal.toString()} APY`)

  const EMERGENCY_WITHDRAW_RECIPIENT = ""

  const recipientNonce = await rewardsInstance.accountNonces(EMERGENCY_WITHDRAW_RECIPIENT)
  console.log(`Recipient Nonce: ${recipientNonce.toString()}`)

  console.log(tokenInstance.address)
  console.log(rewardsInstance.address)
  console.log(EMERGENCY_WITHDRAW_RECIPIENT)

  const signature = await generateSignature(
    process.env.SIGNER.toLowerCase(),
    "APY Distribution",
    rewardsInstance.address,
    recipientNonce.toString(),
    EMERGENCY_WITHDRAW_RECIPIENT.toLowerCase(),
    apyBal.toString(),
    CHAIN_IDS[NETWORK_NAME]
  );

  await rewardsInstance.claim(
    [
      recipientNonce.toString(),
      EMERGENCY_WITHDRAW_RECIPIENT,
      apyBal.toString()
    ],
    signature.v,
    signature.r,
    signature.s
  )

  console.log("Funds Secured")
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
