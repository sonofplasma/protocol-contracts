const { ethers, web3, artifacts, contract } = require("@nomiclabs/buidler");
const {
  BN,
  ether,
  balance,
  send,
  constants,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const {
  erc20,
  dai,
  mintERC20Tokens,
  getERC20Balance,
  undoErc20,
} = require("./utils");

const IOneSplit = artifacts.require("IOneSplit");
const Comptroller = artifacts.require("Comptroller");
const cDAI = artifacts.require("cDAI");
const IMintableERC20 = artifacts.require("IMintableERC20");
const DAI3Strategy = artifacts.require("DAI3Strategy");

// latest version: https://etherscan.io/address/1split.eth
// const ONE_INCH_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E";
//beta version: https://etherscan.io/address/1proto.eth
const ONE_INCH_ADDRESS = "0x50FDA034C0Ce7a8f7EFDAebDA7Aa7cA21CC1267e";

// https://changelog.makerdao.com/releases/mainnet/latest/contracts.json
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // MCD_DAI
const DAI_MINTER_ADDRESS = "0x9759A6Ac90977b93B58547b4A71c78317f391A28"; // MCD_JOIN_DAI

const COMPTROLLER_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b";
const CDAI_ADDRESS = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const BAL_ADDRESS = "0xba100000625a3754423978a60c9317c58a424e3D";

const timeout = 20000; // in millis

contract("DAI3 Strategy", async (accounts) => {
  const [deployer, wallet, other] = accounts;

  let oneInch;
  let comptroller;
  let cDaiToken;
  let dai3Strategy;
  let daiToken;

  beforeEach(async () => {
    oneInch = await IOneSplit.at(ONE_INCH_ADDRESS);
    comptroller = await Comptroller.at(COMPTROLLER_ADDRESS);
    cDaiToken = await cDAI.at(CDAI_ADDRESS);
    daiToken = await IMintableERC20.at(DAI_ADDRESS);
    dai3Strategy = await DAI3Strategy.new();

    await mintERC20Tokens(
      DAI_ADDRESS,
      dai3Strategy.address,
      DAI_MINTER_ADDRESS,
      dai("10000")
    );
  });

  it("should borrow DAI", async () => {
    const daiBalance = await daiToken.balanceOf(dai3Strategy.address);
    console.log("       --->  DAI balance:", daiBalance.toString() / 1e18);

    const amount = dai("1000");
    console.log("       --->  DAI deposit:", daiBalance.toString() / 1e18);
    const borrows = await dai3Strategy.depositAndBorrow.call(
      amount,
      amount.divn(2)
    );
    console.log("       --->  DAI borrow:", borrows.toString() / 1e18);

    await dai3Strategy.borrowDai(dai("10"), { from: wallet, gasPrice: 0 });
  }).timeout(timeout);
});
