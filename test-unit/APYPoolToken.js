const { assert, expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const timeMachine = require("ganache-time-traveler");
const {
  ZERO_ADDRESS,
  FAKE_ADDRESS,
  tokenAmountToBigNumber,
} = require("../utils/helpers");
const { deployMockContract } = require("ethereum-waffle");
const { BigNumber } = require("ethers");

const AggregatorV3Interface = artifacts.require("AggregatorV3Interface");
const IDetailedERC20 = artifacts.require("IDetailedERC20");

describe.only("Contract: APYPoolToken", () => {
  let deployer;
  let admin;
  let randomUser;

  let MockContract;
  let ProxyAdmin;
  let APYPoolTokenProxy;
  let APYPoolToken;

  let underlyerMock;
  let priceAggMock;
  let proxyAdmin;
  let logic;
  let proxy;
  let poolToken;

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
    [deployer, admin, randomUser] = await ethers.getSigners();

    MockContract = await ethers.getContractFactory("MockContract");
    ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    APYPoolTokenProxy = await ethers.getContractFactory("APYPoolTokenProxy");
    APYPoolToken = await ethers.getContractFactory("TestAPYPoolToken");

    underlyerMock = await deployMockContract(deployer, IDetailedERC20.abi);
    priceAggMock = await deployMockContract(
      deployer,
      AggregatorV3Interface.abi
    );
    proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.deployed();
    logic = await APYPoolToken.deploy();
    await logic.deployed();
    proxy = await APYPoolTokenProxy.deploy(
      logic.address,
      proxyAdmin.address,
      underlyerMock.address,
      priceAggMock.address
    );
    await proxy.deployed();
    poolToken = await APYPoolToken.attach(proxy.address);
  });

  describe("Constructor", async () => {
    it("Revert when admin address is zero ", async () => {
      await expect(
        APYPoolTokenProxy.deploy(
          logic.address,
          ZERO_ADDRESS,
          underlyerMock.address,
          priceAggMock.address
        )
      ).to.be.reverted;
    });

    it("Revert when token address is zero", async () => {
      await expect(
        APYPoolTokenProxy.deploy(
          logic.address,
          proxyAdmin.address,
          ZERO_ADDRESS,
          priceAggMock.address
        )
      ).to.be.reverted;
    });

    it("Revert when agg address is zero", async () => {
      await expect(
        APYPoolTokenProxy.deploy(
          logic.address,
          proxyAdmin.address,
          underlyerMock.address,
          ZERO_ADDRESS
        )
      ).to.be.reverted;
    });
  });

  describe("Defaults", async () => {
    it("Owner set to deployer", async () => {
      assert.equal(await poolToken.owner(), deployer.address);
    });

    it("DEFAULT_APT_TO_UNDERLYER_FACTOR set to correct value", async () => {
      assert.equal(await poolToken.DEFAULT_APT_TO_UNDERLYER_FACTOR(), 1000);
    });

    it("Name set to correct value", async () => {
      assert.equal(await poolToken.name(), "APY Pool Token");
    });

    it("Symbol set to correct value", async () => {
      assert.equal(await poolToken.symbol(), "APT");
    });

    it("Decimals set to correct value", async () => {
      assert.equal(await poolToken.decimals(), 18);
    });

    it("Block ether transfer", async () => {
      await expect(
        deployer.sendTransaction({ to: poolToken.address, value: "10" })
      ).to.be.revertedWith("DONT_SEND_ETHER");
    });
  });

  describe("Admin setting", async () => {
    it("Owner can set admin", async () => {
      await poolToken.connect(deployer).setAdminAddress(admin.address);
      assert.equal(await poolToken.proxyAdmin(), admin.address);
    });

    it("Revert on setting to zero address", async () => {
      await expect(poolToken.connect(deployer).setAdminAddress(ZERO_ADDRESS)).to
        .be.reverted;
    });

    it("Revert when non-owner attempts to set address", async () => {
      await expect(poolToken.connect(randomUser).setAdminAddress(admin.address))
        .to.be.reverted;
    });
  });

  describe("Price aggregator setting", async () => {
    it("Revert when agg address is zero", async () => {
      await expect(
        poolToken.setPriceAggregator(ZERO_ADDRESS)
      ).to.be.revertedWith("INVALID_AGG");
    });

    it("Revert when non-owner attempts to set agg", async () => {
      await expect(
        poolToken.connect(randomUser).setPriceAggregator(FAKE_ADDRESS)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Owner can set agg", async () => {
      const setPromise = poolToken
        .connect(deployer)
        .setPriceAggregator(FAKE_ADDRESS);
      const trx = await setPromise;
      await trx.wait();

      const priceAgg = await poolToken.priceAgg();

      assert.equal(priceAgg, FAKE_ADDRESS);
      await expect(setPromise)
        .to.emit(poolToken, "PriceAggregatorChanged")
        .withArgs(FAKE_ADDRESS);
    });
  });

  describe("mAPT setting", async () => {
    it("Owner can set admin address", async () => {
      const mockContract = await deployMockContract(deployer, []);
      const mockContractAddress = mockContract.address;
      await poolToken.connect(deployer).setMetaPoolToken(mockContractAddress);
      assert.equal(await poolToken.mApt(), mockContractAddress);
    });

    it("Revert on setting to non-contract address", async () => {
      await expect(poolToken.connect(deployer).setMetaPoolToken(FAKE_ADDRESS))
        .to.be.reverted;
    });

    it("Revert when non-owner attempts to set address", async () => {
      await expect(
        poolToken.connect(randomUser).setMetaPoolToken(admin.address)
      ).to.be.reverted;
    });
  });

  describe("getDeployedValue", async () => {
    let mAptMock;

    before(async () => {
      const APYMetaPoolToken = artifacts.require("APYMetaPoolToken");
      mAptMock = await deployMockContract(deployer, APYMetaPoolToken.abi);
      await poolToken.connect(deployer).setMetaPoolToken(mAptMock.address);
    });

    it("Return 0 if zero mAPT supply", async () => {
      await mAptMock.mock.totalSupply.returns(0);
      await mAptMock.mock.balanceOf.withArgs(poolToken.address).returns(0);
      expect(await poolToken.getDeployedValue()).to.equal(0);
    });

    it("Return 0 if zero mAPT balance", async () => {
      await mAptMock.mock.totalSupply.returns(1000);
      await mAptMock.mock.balanceOf.withArgs(poolToken.address).returns(0);
      expect(await poolToken.getDeployedValue()).to.equal(0);
    });
  });

  describe("addLiquidity", async () => {
    let mAptMock;

    before(async () => {
      const APYMetaPoolToken = artifacts.require("APYMetaPoolToken");
      mAptMock = await deployMockContract(deployer, APYMetaPoolToken.abi);
      await poolToken.connect(deployer).setMetaPoolToken(mAptMock.address);
      await mAptMock.mock.balanceOf.returns(0);
      await mAptMock.mock.totalSupply.returns(0);
    });

    it("Revert if deposit is zero", async () => {
      await expect(poolToken.addLiquidity(0)).to.be.revertedWith(
        "AMOUNT_INSUFFICIENT"
      );
    });

    it("Revert if allowance is less than deposit", async () => {
      await underlyerMock.mock.allowance.returns(0);
      await expect(poolToken.addLiquidity(1)).to.be.revertedWith(
        "ALLOWANCE_INSUFFICIENT"
      );
    });

    it("User can deposit with correct results", async () => {
      await underlyerMock.mock.decimals.returns(0);
      await underlyerMock.mock.allowance.returns(1);
      await underlyerMock.mock.balanceOf.returns(1);
      await underlyerMock.mock.transferFrom.returns(true);
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      const addLiquidityPromise = poolToken.connect(randomUser).addLiquidity(1);
      const trx = await addLiquidityPromise;
      await trx.wait();

      const balance = await poolToken.balanceOf(randomUser.address);
      assert.equal(balance.toNumber(), 1000);
      // this is the mint transfer
      await expect(addLiquidityPromise)
        .to.emit(poolToken, "Transfer")
        .withArgs(ZERO_ADDRESS, randomUser.address, BigNumber.from(1000));
      await expect(addLiquidityPromise)
        .to.emit(poolToken, "DepositedAPT")
        .withArgs(
          randomUser.address,
          underlyerMock.address,
          BigNumber.from(1),
          BigNumber.from(1000),
          BigNumber.from(1),
          BigNumber.from(1)
        );

      // https://github.com/nomiclabs/hardhat/issues/1135
      // expect("safeTransferFrom")
      //   .to.be.calledOnContract(underlyerMock)
      //   .withArgs(randomUser.address, poolToken.address, BigNumber.from(1000));
    });

    it("Owner can lock and unlock addLiquidity", async () => {
      await underlyerMock.mock.decimals.returns(0);
      await underlyerMock.mock.allowance.returns(1);
      await underlyerMock.mock.balanceOf.returns(1);
      await underlyerMock.mock.transferFrom.returns(true);

      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      await expect(poolToken.connect(deployer).lockAddLiquidity()).to.emit(
        poolToken,
        "AddLiquidityLocked"
      );

      await expect(
        poolToken.connect(randomUser).addLiquidity(1)
      ).to.be.revertedWith("LOCKED");

      await expect(poolToken.connect(deployer).unlockAddLiquidity()).to.emit(
        poolToken,
        "AddLiquidityUnlocked"
      );

      await poolToken.connect(randomUser).addLiquidity(1);
    });

    it("Revert if non-owner attempts to lock or unlock", async () => {
      await expect(
        poolToken.connect(randomUser).lockAddLiquidity()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        poolToken.connect(randomUser).unlockAddLiquidity()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("getPoolTotalEthValue", async () => {
    it("Test getPoolTotalEthValue returns expected", async () => {
      await underlyerMock.mock.decimals.returns(0);
      await underlyerMock.mock.balanceOf.returns(100);

      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      const val = await poolToken.getPoolTotalEthValue.call();
      assert.equal(val.toNumber(), 100);
    });
  });

  describe("getAPTEthValue", async () => {
    it("Test getAPTEthValue when insufficient total supply", async () => {
      await expect(poolToken.getAPTEthValue(10)).to.be.revertedWith(
        "INSUFFICIENT_TOTAL_SUPPLY"
      );
    });

    it("getAPTEthValue returns expected", async () => {
      await poolToken.mint(randomUser.address, 100);
      await underlyerMock.mock.decimals.returns(0);
      await underlyerMock.mock.balanceOf.returns(100);

      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      const val = await poolToken.getAPTEthValue(10);
      assert.equal(val.toNumber(), 10);
    });
  });

  describe("getTokenAmountFromEthValue", async () => {
    it("Test getEthValueFromTokenAmount returns expected amount", async () => {
      await underlyerMock.mock.decimals.returns(0);
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 25, 0, 0, 0);
      await poolToken.setPriceAggregator(mockAgg.address);
      // ((10 ^ 0) * 100) / 25
      const tokenAmount = await poolToken.getTokenAmountFromEthValue(100);
      assert.equal(tokenAmount.toNumber(), 4);
    });
  });

  describe("getEthValueFromTokenAmount", async () => {
    it("Test getEthValueFromTokenAmount returns 0 with 0 amount", async () => {
      const val = await poolToken.getEthValueFromTokenAmount(0);
      assert.equal(val.toNumber(), 0);
    });

    it("getEthValueFromTokenAmount returns expected amount", async () => {
      await underlyerMock.mock.decimals.returns(1);
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 2, 0, 0, 0);
      await poolToken.setPriceAggregator(mockAgg.address);

      // 50 * (2 / 10 ^ 1)
      const val = await poolToken.getEthValueFromTokenAmount(50);
      assert.equal(val.toNumber(), 10);
    });
  });

  describe("getTokenEthPrice", async () => {
    it("Test getTokenEthPrice returns unexpected", async () => {
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 0, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);
      await expect(poolToken.getTokenEthPrice.call()).to.be.revertedWith(
        "UNABLE_TO_RETRIEVE_ETH_PRICE"
      );
    });

    it("Test getTokenEthPrice returns expected", async () => {
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 100, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);
      const price = await poolToken.getTokenEthPrice();
      assert.equal(price, 100);
    });
  });

  describe("redeem", async () => {
    it("Test redeem insufficient amount", async () => {
      await expect(poolToken.redeem(0)).to.be.revertedWith(
        "AMOUNT_INSUFFICIENT"
      );
    });

    it("Test redeem insufficient balance", async () => {
      await poolToken.mint(randomUser.address, 1);
      await expect(poolToken.connect(randomUser).redeem(2)).to.be.revertedWith(
        "BALANCE_INSUFFICIENT"
      );
    });

    it("Test redeem pass", async () => {
      const aptAmount = tokenAmountToBigNumber("1000");
      await poolToken.mint(randomUser.address, aptAmount);

      await underlyerMock.mock.decimals.returns(0);
      await underlyerMock.mock.allowance.returns(1);
      await underlyerMock.mock.balanceOf.returns(1);
      await underlyerMock.mock.transfer.returns(true);

      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      const redeemPromise = poolToken.connect(randomUser).redeem(aptAmount);
      await (await redeemPromise).wait();

      const bal = await poolToken.balanceOf(randomUser.address);
      expect(bal).to.equal("0");
      await expect(redeemPromise)
        .to.emit(poolToken, "Transfer")
        .withArgs(randomUser.address, ZERO_ADDRESS, aptAmount);
      await expect(redeemPromise).to.emit(poolToken, "RedeemedAPT").withArgs(
        randomUser.address,
        underlyerMock.address,
        BigNumber.from(1),
        aptAmount,
        BigNumber.from(1),
        BigNumber.from(1)
        //this value is a lie, but it's due to token.balance() = 1 and mockAgg.getLastRound() = 1
      );
    });

    it("Test locking/unlocking redeem by owner", async () => {
      await poolToken.mint(randomUser.address, 100);
      const mockAgg = await MockContract.deploy();
      await poolToken.setPriceAggregator(mockAgg.address);

      await expect(poolToken.connect(deployer).lockRedeem()).to.emit(
        poolToken,
        "RedeemLocked"
      );

      await expect(poolToken.connect(randomUser).redeem(50)).to.be.revertedWith(
        "LOCKED"
      );

      await expect(poolToken.connect(deployer).unlockRedeem()).to.emit(
        poolToken,
        "RedeemUnlocked"
      );
    });

    it("Test locking/unlocking contract by not owner", async () => {
      await poolToken.mint(randomUser.address, 100);
      const mockAgg = await MockContract.deploy();
      await poolToken.setPriceAggregator(mockAgg.address);

      await expect(poolToken.connect(deployer).lock()).to.emit(
        poolToken,
        "Paused"
      );

      await expect(poolToken.connect(randomUser).redeem(50)).to.revertedWith(
        "Pausable: paused"
      );

      await expect(poolToken.connect(deployer).unlock()).to.emit(
        poolToken,
        "Unpaused"
      );
    });

    it("Test locking/unlocking redeem by not owner", async () => {
      await expect(
        poolToken.connect(randomUser).lockRedeem()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        poolToken.connect(randomUser).unlockRedeem()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("calculateMintAmount", async () => {
    it("Test calculateMintAmount when token is 0 and total supply is 0", async () => {
      // total supply is 0
      await underlyerMock.mock.decimals.returns("0");
      await underlyerMock.mock.balanceOf.withArgs(poolToken.address).returns(0);

      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);

      const mintAmount = await poolToken.calculateMintAmount(1000);
      assert.equal(mintAmount.toNumber(), 1000000);
    });

    it("calculateMintAmount when balanceOf > 0 and total supply is 0", async () => {
      // total supply is 0
      await underlyerMock.mock.decimals.returns("0");
      await underlyerMock.mock.balanceOf.returns(9999);
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);
      await poolToken.setPriceAggregator(mockAgg.address);

      const mintAmount = await poolToken.calculateMintAmount(1000);
      assert.equal(mintAmount.toNumber(), 1000000);
    });

    it("Test calculateMintAmount returns expected amount when total supply > 0", async () => {
      await underlyerMock.mock.decimals.returns("0");
      await underlyerMock.mock.balanceOf.returns(9999);
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);
      await poolToken.setPriceAggregator(mockAgg.address);

      await poolToken.mint(randomUser.address, 900);
      // (1000/9999) * 900 = 90.0090009001 ~= 90
      const mintAmount = await poolToken.calculateMintAmount(1000);
      assert.equal(mintAmount.toNumber(), 90);
    });

    it("Test calculateMintAmount returns expected amount when total supply is 0", async () => {
      await underlyerMock.mock.decimals.returns("0");
      await underlyerMock.mock.balanceOf.returns("9999");
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 1, 0, 0, 0);
      await poolToken.setPriceAggregator(mockAgg.address);

      // 90 * 1000 = 90000
      const mintAmount = await poolToken.calculateMintAmount(90);
      assert.equal(mintAmount.toNumber(), 90000);
    });
  });

  describe("getUnderlyerAmount", async () => {
    it("Test getUnderlyerAmount when divide by zero", async () => {
      await expect(poolToken.getUnderlyerAmount(100)).to.be.revertedWith(
        "INSUFFICIENT_TOTAL_SUPPLY"
      );
    });

    it("Test getUnderlyerAmount returns expected amount", async () => {
      await underlyerMock.mock.balanceOf.returns("1");
      await underlyerMock.mock.decimals.returns("1");
      const mockAgg = await deployMockContract(
        deployer,
        AggregatorV3Interface.abi
      );
      await mockAgg.mock.latestRoundData.returns(0, 10, 0, 0, 0);

      await poolToken.setPriceAggregator(mockAgg.address);
      await poolToken.mint(randomUser.address, 1);
      const underlyerAmount = await poolToken.getUnderlyerAmount("1");
      expect(underlyerAmount).to.equal("1");
    });
  });
});
