const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, waffle, artifacts } = hre;
const { deployMockContract } = waffle;
const timeMachine = require("ganache-time-traveler");
const {
  tokenAmountToBigNumber,
  FAKE_ADDRESS,
  ANOTHER_FAKE_ADDRESS,
} = require("../utils/helpers");
const AggregatorV3Interface = artifacts.require("AggregatorV3Interface");

describe("Contract: OracleAdapter", () => {
  // signers
  let deployer;
  let randomUser;

  // contract factories
  let OracleAdapter;

  // deployed contracts
  let oracleAdapter;

  // mocks and constants
  let tvlAggMock;
  let assetAggMock_1;
  let assetAggMock_2;
  const assetAddress_1 = FAKE_ADDRESS;
  const assetAddress_2 = ANOTHER_FAKE_ADDRESS;
  const stalePeriod = 86400;

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
    [deployer, randomUser] = await ethers.getSigners();

    const addressRegistryMock = await deployMockContract(deployer, []);

    tvlAggMock = await deployMockContract(deployer, AggregatorV3Interface.abi);
    assetAggMock_1 = await deployMockContract(
      deployer,
      AggregatorV3Interface.abi
    );
    assetAggMock_2 = await deployMockContract(
      deployer,
      AggregatorV3Interface.abi
    );
    const assets = [assetAddress_1, assetAddress_2];
    const sources = [assetAggMock_1.address, assetAggMock_2.address];

    OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy(
      addressRegistryMock.address,
      tvlAggMock.address,
      assets,
      sources,
      stalePeriod
    );
    await oracleAdapter.deployed();
  });

  describe("Constructor", () => {
    it("Revert on non-contract source address", async () => {
      const agg = await deployMockContract(deployer, []);
      const token_1 = await deployMockContract(deployer, []);
      const token_2 = await deployMockContract(deployer, []);

      const assets = [token_1.address, token_2.address];
      const sources = [FAKE_ADDRESS, agg.address];
      const stalePeriod = 100;
      await expect(
        OracleAdapter.deploy(assets, sources, tvlAggMock.address, stalePeriod)
      ).to.be.revertedWith("INVALID_SOURCE");
    });

    it("Revert on zero stalePeriod", async () => {
      const assets = [];
      const sources = [];
      const stalePeriod = 0;
      await expect(
        OracleAdapter.deploy(assets, sources, tvlAggMock.address, stalePeriod)
      ).to.be.revertedWith("INVALID_STALE_PERIOD");
    });
  });

  describe("Defaults", () => {
    it("Owner is set to deployer", async () => {
      expect(await oracleAdapter.owner()).to.equal(deployer.address);
    });

    it("Sources are set", async () => {
      expect(await oracleAdapter.getTvlSource()).to.equal(tvlAggMock.address);
      expect(await oracleAdapter.getAssetSource(assetAddress_1)).to.equal(
        assetAggMock_1.address
      );
      expect(await oracleAdapter.getAssetSource(assetAddress_2)).to.equal(
        assetAggMock_2.address
      );
    });

    it("stalePeriod is set", async () => {
      expect(await oracleAdapter.getChainlinkStalePeriod()).to.equal(
        stalePeriod
      );
    });
  });

  describe("setTvlSource", () => {
    it("Cannot set to non-contract address", async () => {
      await expect(
        oracleAdapter.connect(deployer).setTvlSource(FAKE_ADDRESS)
      ).to.be.revertedWith("INVALID_SOURCE");
    });

    it("Owner can set", async () => {
      const dummyContract = await deployMockContract(deployer, []);
      await oracleAdapter.connect(deployer).setTvlSource(dummyContract.address);
      expect(await oracleAdapter.getTvlSource()).to.equal(
        dummyContract.address
      );
    });

    it("Revert when non-owner calls", async () => {
      const dummyContract = await deployMockContract(deployer, []);
      await expect(
        oracleAdapter.connect(randomUser).setTvlSource(dummyContract.address)
      ).to.be.reverted;
    });
  });

  describe("setAssetSources", () => {
    it("Cannot set to non-contract address", async () => {
      const assets = [FAKE_ADDRESS];
      const sources = [ANOTHER_FAKE_ADDRESS];
      await expect(
        oracleAdapter.connect(deployer).setAssetSources(assets, sources)
      ).to.be.revertedWith("INVALID_SOURCE");
    });

    it("Owner can set", async () => {
      const assets = [FAKE_ADDRESS];
      const dummyContract = await deployMockContract(deployer, []);
      const sources = [dummyContract.address];

      await oracleAdapter.connect(deployer).setAssetSources(assets, sources);
      expect(await oracleAdapter.getAssetSource(FAKE_ADDRESS)).to.equal(
        dummyContract.address
      );
    });

    it("Revert when non-owner calls", async () => {
      const assets = [FAKE_ADDRESS];
      const dummyContract = await deployMockContract(deployer, []);
      const sources = [dummyContract.address];

      await expect(
        oracleAdapter.connect(randomUser).setAssetSources(assets, sources)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setChainlinkStalePeriod", () => {
    it("Cannot set to 0", async () => {
      await expect(
        oracleAdapter.connect(deployer).setChainlinkStalePeriod(0)
      ).to.be.revertedWith("INVALID_STALE_PERIOD");
    });

    it("Owner can set", async () => {
      const period = 100;
      await oracleAdapter.connect(deployer).setChainlinkStalePeriod(period);
      expect(await oracleAdapter.getChainlinkStalePeriod()).to.equal(period);
    });

    it("Revert when non-owner calls", async () => {
      await expect(
        oracleAdapter.connect(randomUser).setChainlinkStalePeriod(14400)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setLock / isLocked", () => {
    it("Owner can set", async () => {
      const period = 1;
      await oracleAdapter.connect(deployer).setLock(period);
      expect(await oracleAdapter.isLocked()).to.be.true;
    });

    it("Revert when non-owner calls", async () => {
      await expect(
        oracleAdapter.connect(randomUser).setLock(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Can unlock", async () => {
      await oracleAdapter.connect(deployer).setLock(0);
      expect(await oracleAdapter.isLocked()).to.be.false;
    });
  });

  describe("setTvl", () => {
    it("Owner can set", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(2);
      await expect(oracleAdapter.connect(deployer).setTvl(value, period)).to.not
        .be.reverted;
    });

    it("Revert when non-owner calls", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(2);
      await expect(
        oracleAdapter.connect(randomUser).setTvl(value, period)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Revert when unlocked", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(0); // unlocks
      await expect(
        oracleAdapter.connect(deployer).setTvl(value, period)
      ).to.be.revertedWith("ORACLE_UNLOCKED");
    });
  });

  describe("setAssetValue", () => {
    it("Owner can set", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(2);
      await expect(
        oracleAdapter
          .connect(deployer)
          .setAssetValue(assetAddress_1, value, period)
      ).to.not.be.reverted;
    });

    it("Revert when non-owner calls", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(2);
      await expect(
        oracleAdapter
          .connect(randomUser)
          .setAssetValue(assetAddress_1, value, period)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Revert when unlocked", async () => {
      const value = 1;
      const period = 5;
      await oracleAdapter.setLock(0); // unlocks
      await expect(
        oracleAdapter
          .connect(deployer)
          .setAssetValue(assetAddress_1, value, period)
      ).to.be.revertedWith("ORACLE_UNLOCKED");
    });
  });

  describe("getTvl", () => {
    it("Revert when TVL is non-positive", async () => {
      const updatedAt = (await ethers.provider.getBlock()).timestamp;

      let price = -1;
      // setting the mock mines a block and advances time by 1 sec
      await tvlAggMock.mock.latestRoundData.returns(0, price, 0, updatedAt, 0);
      await expect(oracleAdapter.getTvl()).to.be.revertedWith(
        "MISSING_ASSET_VALUE"
      );

      price = 0;
      // setting the mock mines a block and advances time by 1 sec
      await tvlAggMock.mock.latestRoundData.returns(0, price, 0, updatedAt, 0);
      await expect(oracleAdapter.getTvl()).to.be.revertedWith(
        "MISSING_ASSET_VALUE"
      );
    });

    it("Revert when update is too old", async () => {
      const stalePeriod = await oracleAdapter.getChainlinkStalePeriod();
      const updatedAt = (await ethers.provider.getBlock()).timestamp;

      // setting the mock mines a block and advances time by 1 sec
      await tvlAggMock.mock.latestRoundData.returns(
        0,
        tokenAmountToBigNumber(50e6, 8),
        0,
        updatedAt,
        0
      );
      await ethers.provider.send("evm_increaseTime", [stalePeriod / 2]);
      await ethers.provider.send("evm_mine");
      await expect(oracleAdapter.getTvl()).to.not.be.reverted;

      await ethers.provider.send("evm_increaseTime", [stalePeriod / 2]);
      await ethers.provider.send("evm_mine");
      await expect(oracleAdapter.getTvl()).to.be.revertedWith(
        "CHAINLINK_STALE_DATA"
      );
    });

    it("Revert when locked", async () => {
      await oracleAdapter.setLock(1);
      await expect(oracleAdapter.getTvl()).to.be.revertedWith("ORACLE_LOCKED");

      const updatedAt = (await ethers.provider.getBlock()).timestamp;
      // setting the mock mines a block
      await tvlAggMock.mock.latestRoundData.returns(
        0,
        tokenAmountToBigNumber(50e6, 8),
        0,
        updatedAt,
        0
      );
      await expect(oracleAdapter.getTvl()).to.not.be.reverted;
    });

    it("Use manual submission when active", async () => {
      const chainlinkValue = tokenAmountToBigNumber(110e6, 8);
      const manualValue = tokenAmountToBigNumber(75e6, 8);

      const updatedAt = (await ethers.provider.getBlock()).timestamp;
      // setting the mock mines a block and advances time by 1 sec
      await tvlAggMock.mock.latestRoundData.returns(
        0,
        chainlinkValue,
        0,
        updatedAt,
        0
      );
      expect(await oracleAdapter.getTvl()).to.equal(chainlinkValue);

      await oracleAdapter.setLock(5);
      const activePeriod = 2;
      await oracleAdapter.setTvl(manualValue, activePeriod); // advances 1 block

      // TVL lock takes precedence over manual submission
      await expect(oracleAdapter.getTvl()).to.be.reverted;

      await oracleAdapter.setLock(0); // unlock; advances 1 block
      // Manual submission takes precedence over Chainlink
      expect(await oracleAdapter.getTvl()).to.equal(manualValue);

      // Fallback to Chainlink when manual submission expires
      await ethers.provider.send("evm_mine"); // advances block past expiry
      expect(await oracleAdapter.getTvl()).to.equal(chainlinkValue);
    });
  });

  describe("getAssetPrice", () => {
    it("Revert when price is non-positive", async () => {
      const updatedAt = (await ethers.provider.getBlock()).timestamp;
      let price = -1;
      // setting the mock mines a block and advances time by 1 sec
      await assetAggMock_1.mock.latestRoundData.returns(
        0,
        price,
        0,
        updatedAt,
        0
      );
      await expect(
        oracleAdapter.getAssetPrice(assetAddress_1)
      ).to.be.revertedWith("MISSING_ASSET_VALUE");

      price = 0;
      // setting the mock mines a block and advances time by 1 sec
      await assetAggMock_1.mock.latestRoundData.returns(
        0,
        price,
        0,
        updatedAt,
        0
      );
      await expect(
        oracleAdapter.getAssetPrice(assetAddress_1)
      ).to.be.revertedWith("MISSING_ASSET_VALUE");
    });

    it("Revert when update is too old", async () => {
      const stalePeriod = await oracleAdapter.getChainlinkStalePeriod();
      const updatedAt = (await ethers.provider.getBlock()).timestamp;

      // setting the mock mines a block and advances time by 1 sec
      await assetAggMock_1.mock.latestRoundData.returns(
        0,
        tokenAmountToBigNumber(50e6, 8),
        0,
        updatedAt,
        0
      );
      await ethers.provider.send("evm_increaseTime", [stalePeriod / 2]);
      await ethers.provider.send("evm_mine");
      await expect(oracleAdapter.getAssetPrice(assetAddress_1)).to.not.be
        .reverted;

      await ethers.provider.send("evm_increaseTime", [stalePeriod / 2]);
      await ethers.provider.send("evm_mine");
      await expect(
        oracleAdapter.getAssetPrice(assetAddress_1)
      ).to.be.revertedWith("CHAINLINK_STALE_DATA");
    });

    it("Use manual submission when active", async () => {
      const chainlinkValue = tokenAmountToBigNumber(1.07, 8);
      const manualValue = tokenAmountToBigNumber(1, 8);

      const updatedAt = (await ethers.provider.getBlock()).timestamp;
      // setting the mock mines a block and advances time by 1 sec
      await assetAggMock_1.mock.latestRoundData.returns(
        0,
        chainlinkValue,
        0,
        updatedAt,
        0
      );
      expect(await oracleAdapter.getAssetPrice(assetAddress_1)).to.equal(
        chainlinkValue
      );

      await oracleAdapter.setLock(5);
      const activePeriod = 2;
      await oracleAdapter.setAssetValue(
        assetAddress_1,
        manualValue,
        activePeriod
      ); // advances 1 block

      // TVL lock takes precedence over manual submission
      await expect(oracleAdapter.getAssetPrice(assetAddress_1)).to.be.reverted;

      await oracleAdapter.setLock(0); // unlock; advances 1 block
      // Manual submission takes precedence over Chainlink
      expect(await oracleAdapter.getAssetPrice(assetAddress_1)).to.equal(
        manualValue
      );

      // Fallback to Chainlink when manual submission expires
      await ethers.provider.send("evm_mine"); // advances block past expiry
      expect(await oracleAdapter.getAssetPrice(assetAddress_1)).to.equal(
        chainlinkValue
      );
    });
  });
});
