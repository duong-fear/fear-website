const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const BSC_CHAINID = 56;

let ACTIVATED_CHAINID = MUMBAI_CHAINID;

const RPC_URL = {
  [BSC_CHAINID]: 'https://rpc.ankr.com/bsc',
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const RPC_PROVIDER = {
  [BSC_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[BSC_CHAINID]),
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}


const CONTRACT = {
  FEAR_TOKEN: {
    [BSC_CHAINID]: "0x9ba6a67a6f3b21705a46b380a1b97373a33da311",
    [POLYGON_CHAINID]: '0xa2ca40dbe72028d3ac78b5250a8cb8c404e7fb8c',
    [MUMBAI_CHAINID]: '0x9006Cf37B092C03f77e2428B1220968E6DA399E9',
    ABI: FEAR_TOKEN_ABI,
    get instance() {
      return new ethers.Contract(
        CONTRACT.FEAR_TOKEN[ACTIVATED_CHAINID],
        CONTRACT.FEAR_TOKEN.ABI,
        RPC_PROVIDER[ACTIVATED_CHAINID],
      );
    }
  },
  STAKE_POOL: {
    [BSC_CHAINID]: undefined,
    [POLYGON_CHAINID]: undefined,
    [MUMBAI_CHAINID]: '0xE229da8F5619538D57d6D5970dbcd9A174B570ff',
    ABI: FEAR_STAKE_POOL_ABI,
    get instance() {
      return new ethers.Contract(
        CONTRACT.STAKE_POOL[ACTIVATED_CHAINID],
        CONTRACT.STAKE_POOL.ABI,
        RPC_PROVIDER[ACTIVATED_CHAINID],
      );
    }
  },
};

const updateGlobalStakingStats = async () => {
  const [
    stakerCountBN,
    getTotalStakedAmountBN,
    currentStakingEpoch,
  ] = await Promise.all([
    CONTRACT.STAKE_POOL.instance.getStakersCount(),
    CONTRACT.STAKE_POOL.instance.getTotalStakedAmount(),
    CONTRACT.STAKE_POOL.instance.getCurrentStakingEpoch(),

  ]);
  vm.stakingStats.global.stakerCount = stakerCountBN.toNumber();
  vm.stakingStats.global.tvl = getTotalStakedAmountBN.toNumber();
  vm.stakingStats.global.apr = +(currentStakingEpoch.apr.toNumber() / 100);
  vm.stakingStats.global.releaseTimeDays = currentStakingEpoch.lockParts.toNumber() * currentStakingEpoch.lockPeriod.toNumber() / (24*3600);
}


const boostrapApp = () => {
  Alpine.store('vm', {
    tabList: [
      "The Crypt",
      "The Tomb",
    ],
    activeTabId: 0,
    stakingStats: {
      global: {
        // total value locked
        tvl: undefined,
        // number of stakers
        stakerCount: undefined,
        // annual percent yeild
        apr: undefined,
        releaseTimeDays: undefined,
      },
      mine: {
        walletAddress: undefined,
        fearBalance: undefined,
        etherBalance: undefined,
        stakedAmount: undefined,
        rewardAmount: undefined,
        lockedAmount: undefined,
        unlockedAmount: undefined,
      },
    },
    bootstrap: async () => {
      console.log(`bootstrap app`);
      window.ethers = ethers.ethers;
      await Promise.all([
        updateGlobalStakingStats(),
      ]);
    }
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}