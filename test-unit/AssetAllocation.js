const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, waffle } = hre;
const { deployMockContract } = waffle;
const timeMachine = require("ganache-time-traveler");
const { FAKE_ADDRESS } = require("../utils/helpers");

async function generateContractAddress(signer) {
  const mockContract = await deployMockContract(signer, []);
  return mockContract.address;
}

describe("Contract: AssetAllocation", () => {
  // contract factories
  let SimpleAssetAllocation;

  // deployed contracts
  let assetAllocation;

  // use EVM snapshots for test isolation
  let snapshotId;

  const token_0 = {
    token: undefined,
    symbol: "TOKEN",
    decimals: 6,
  };
  const token_1 = {
    token: undefined,
    symbol: "ANOTHER_TOKEN",
    decimals: 18,
  };

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before(async () => {
    const [deployer] = await ethers.getSigners();
    token_0.token = await generateContractAddress(deployer);
    token_1.token = await generateContractAddress(deployer);

    SimpleAssetAllocation = await ethers.getContractFactory(
      "SimpleAssetAllocation"
    );
    assetAllocation = await SimpleAssetAllocation.deploy([token_0, token_1]);
  });

  describe("Constructor", () => {
    it("Can call constructor with no tokens", async () => {
      const assetAllocation = await SimpleAssetAllocation.deploy([]);
      expect(await assetAllocation.tokens()).to.be.empty;
    });

    it("Constructor populates tokens correctly", async () => {
      const result = await assetAllocation.tokens();
      const expectedTokens = [token_0, token_1];
      // have to check in this cumbersome manner rather than a deep
      // equal, because Ethers returns each struct as an *array*
      // with struct fields set as properties
      expect(result[0].token).to.equal(expectedTokens[0].token);
      expect(result[0].symbol).to.equal(expectedTokens[0].symbol);
      expect(result[0].decimals).to.equal(expectedTokens[0].decimals);
      expect(result[1].token).to.equal(expectedTokens[1].token);
      expect(result[1].symbol).to.equal(expectedTokens[1].symbol);
      expect(result[1].decimals).to.equal(expectedTokens[1].decimals);
    });
  });

  describe("View functions read token info correctly", () => {
    it("symbolOf", async () => {
      expect(await assetAllocation.symbolOf(0)).to.equal(token_0.symbol);
      expect(await assetAllocation.symbolOf(1)).to.equal(token_1.symbol);
    });

    it("decimalsOf", async () => {
      expect(await assetAllocation.decimalsOf(0)).to.equal(token_0.decimals);
      expect(await assetAllocation.decimalsOf(1)).to.equal(token_1.decimals);
    });

    it("balanceOf", async () => {
      expect(await assetAllocation.balanceOf(FAKE_ADDRESS, 0)).to.equal(42);
    });
  });
});