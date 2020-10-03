const { ethers, artifacts, contract } = require("@nomiclabs/buidler");
const { defaultAbiCoder: abiCoder } = ethers.utils;
const {
  BN,
  constants,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const timeMachine = require("ganache-time-traveler");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const MockContract = artifacts.require("MockContract");
const ProxyAdmin = artifacts.require("ProxyAdmin");
const APYTokenProxy = artifacts.require("APYProxy");
const APYToken = artifacts.require("APY");
const IERC20 = new ethers.utils.Interface(artifacts.require("IERC20").abi);
const ERC20 = new ethers.utils.Interface(artifacts.require("ERC20").abi);

contract("APYToken Unit Test", async (accounts) => {
  const [owner, instanceAdmin, randomUser, randomAddress] = accounts;

  let proxyAdmin;
  let logic;
  let proxy;
  let instance;
  let mockToken;

  // use EVM snapshots for test isolation
  let snapshotId;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before(async () => {
    proxyAdmin = await ProxyAdmin.new({ from: owner });
    logic = await APYToken.new({ from: owner });
    proxy = await APYTokenProxy.new(logic.address, proxyAdmin.address, {
      from: owner,
    });
    instance = await APYToken.at(proxy.address);
  });

  describe("Test Constructor", async () => {
    it("Test params invalid admin", async () => {
      await expectRevert.unspecified(
        APYTokenProxy.new(logic.address, ZERO_ADDRESS, {
          from: owner,
        })
      );
    });
  });

  describe("Test Defaults", async () => {
    it("Test Owner", async () => {
      assert.equal(await instance.owner.call(), owner);
    });

    it("Test TOTAL_SUPPLY", async () => {
      assert.equal(await instance.TOTAL_SUPPLY.call(), 1e8);
    });

    it("Test Pool Token Name", async () => {
      assert.equal(await instance.name.call(), "APY Governance Token");
    });

    it("Test Pool Symbol", async () => {
      assert.equal(await instance.symbol.call(), "APY");
    });

    it("Test Pool Decimals", async () => {
      assert.equal(await instance.decimals.call(), 18);
    });

    it("Test sending Ether", async () => {
      await expectRevert(instance.send(10), "DONT_SEND_ETHER");
    });
  });

  describe("Test setAdminAdddress", async () => {
    it("Test setAdminAddress pass", async () => {
      await instance.setAdminAddress(instanceAdmin, { from: owner });
      assert.equal(await instance.proxyAdmin.call(), instanceAdmin);
    });

    it("Test setAdminAddress invalid admin", async () => {
      await expectRevert.unspecified(
        instance.setAdminAddress(ZERO_ADDRESS, { from: owner })
      );
    });

    it("Test setAdminAddress fail", async () => {
      await expectRevert.unspecified(
        instance.setAdminAddress(instanceAdmin, { from: randomUser })
      );
    });
  });
});
