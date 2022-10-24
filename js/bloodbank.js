const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const BSC_CHAINID = 56;

let ACTIVATED_CHAINID = MUMBAI_CHAINID;
const SUPPORTED_CHAINS = [
  POLYGON_CHAINID,
  MUMBAI_CHAINID,
  BSC_CHAINID,
];

const RPC_URL = {
  [BSC_CHAINID]: 'https://rpc.ankr.com/bsc',
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const formatEther = (amountBN) => (amountBN instanceof ethers.BigNumber) ? ethers.utils.formatEther(amountBN).replace(/\.0$/, '') : 'n/a';
const parseEther = ethers.utils.parseEther;
const ZeroBN = ethers.constants.Zero;

const RPC_PROVIDER = {
  [BSC_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[BSC_CHAINID]),
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}

// wallet connect functions
const connectMetamask = async () => {
  if(vm.wallet.address) return;
  const metamaskProvider = _.get(window, 'web3.currentProvider');
  if(!metamaskProvider) throw new Error("Metamask not avaiable");
  const provider = new ethers.providers.Web3Provider(metamaskProvider);
  const { name, chainId, } = await provider.getNetwork();
  let accountList = await provider.listAccounts();
  if(accountList.length == 0) {
    await metamaskProvider.request({ method: 'eth_requestAccounts' });
  }
  const signer = provider.getSigner();
  window.provider = provider;
  window.signer = signer;
  accountList = await provider.listAccounts();
  console.log(`accountList`, accountList, `chainId`, chainId);
  const walletAddress = accountList.shift();
  await updateBalances(walletAddress);
  vm.wallet.address = walletAddress;
  vm.wallet.shortAddress = `${walletAddress.substr(0, 6)}..${walletAddress.substr(-4)}`;
}

const updateBalances = async (_walletAddress) => {
  const walletAddress = _walletAddress || vm.wallet.address;
  const [
    fearBalanceBN,
    stakedAmountBN,
    rewardAmountBN,
    lockedAmountBN,
    unlockedAmountBN
  ] = await Promise.all([
    CONTRACT.FEAR_TOKEN.instance.balanceOf(walletAddress),
    CONTRACT.STAKE_POOL.instance.getMyStakeAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyRewardAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyLockedAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyClaimableAmount({ from: walletAddress }),
  ]);
  vm.wallet.fearBalanceBN = fearBalanceBN;
  vm.wallet.stakedAmountBN = stakedAmountBN;
  vm.wallet.rewardAmountBN = rewardAmountBN;
  vm.wallet.lockedAmountBN = lockedAmountBN;
  vm.wallet.unlockedAmountBN = unlockedAmountBN;
}

// stake + unstake function
const stakeFear = async ($event, amount = '1') => {
  const amountBN = ethers.utils.parseEther(amount);
  const walletAddress = vm.wallet.address;
  const [
    allowanceBN,
  ] = await Promise.all([
    CONTRACT.FEAR_TOKEN.instance.allowance(walletAddress, CONTRACT.STAKE_POOL.instance.address),
    await updateBalances(),
  ]);
  if(amountBN.gt(vm.wallet.fearBalanceBN)) {
    throw new Error("Insufficient FEAR balance");
  }
  console.log(`allowanceBN`, formatEther(allowanceBN));
  if(allowanceBN.lt(amountBN)) {
    const tx = await CONTRACT.FEAR_TOKEN.instance.approve(CONTRACT.STAKE_POOL.instance.address, ethers.constants.MaxUint256);
    await tx.wait();
  }
  console.log('staking');
  const tx = await CONTRACT.STAKE_POOL.instance.stake(amountBN);
  await tx.wait();
  console.log('staked');
  await Promise.all([
    updateGlobalStakingStats(),
    updateBalances(),
  ]);
}

const unstakeFear = async ($event, amount = '1') => {
  const amountBN = ethers.utils.parseEther(amount);
  await updateBalances();
  if(vm.wallet.stakedAmountBN.lt(amountBN)) throw new Error("Unstake amount greater than staked amount");
  console.log("unstaking");
  const tx = await CONTRACT.STAKE_POOL.instance.unstake(amountBN);
  await tx.wait();
  console.log("unstaked");
  await Promise.all([
    updateGlobalStakingStats(),
    updateBalances(),
  ]);
}

// withdraw
const withdrawUnlockedFear = async ($event) => {
  await updateBalances();
  if(vm.wallet.unlockedAmountBN.eq(ZeroBN)) throw new Error("Nothing to withdraw");
  console.log("withdraw in progress");
  const tx = await CONTRACT.STAKE_POOL.instance.claimUnlocked();
  await tx.wait();
  console.log("withdraw-ed");
  await Promise.all([
    updateGlobalStakingStats(),
    updateBalances(),
  ]);
}

// instant unstake
const instantUnstake = async ($event, amount = '3') => {
  const amountBN = ethers.utils.parseEther(amount);
  await updateBalances();
  if(vm.wallet.lockedAmountBN.eq(ZeroBN)) throw new Error("You have no locked token");
  if(amountBN.gt(vm.wallet.lockedAmountBN)) throw new Error("Unstake amount greater than locked amount");
  const tx = await CONTRACT.STAKE_POOL.instance.flashUnstake(amountBN);
  await tx.wait();
  console.log("instantUnstake done");
  await Promise.all([
    updateGlobalStakingStats(),
    updateBalances(),
  ]);
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
        window.signer || RPC_PROVIDER[ACTIVATED_CHAINID],
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
        window.signer || RPC_PROVIDER[ACTIVATED_CHAINID],
      );
    }
  },
};

const updateGlobalStakingStats = async () => {
  const [
    stakerCountBN,
    totalStakedAmountBN,
    currentStakingEpoch,
  ] = await Promise.all([
    CONTRACT.STAKE_POOL.instance.getStakersCount(),
    CONTRACT.STAKE_POOL.instance.getTotalStakedAmount(),
    CONTRACT.STAKE_POOL.instance.getCurrentStakingEpoch(),

  ]);
  vm.stakingStats.global.stakerCount = stakerCountBN.toNumber();
  vm.stakingStats.global.tvl = formatEther(totalStakedAmountBN);
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
      user: {
        stakedAmount: undefined,
        rewardAmount: undefined,
        lockedAmount: undefined,
        unlockedAmount: undefined,
      },
    },
    loading: {

    },
    wallet: {
      address: null,
      shortAddress: null,
      fearBalance: null,
      fearBalanceBN: null,
      stakedAmountBN: null,
      rewardAmountBN: null,
      lockedAmountBN: null,
      unlockedAmountBN: null,
    },
    bootstrap: async () => {
      console.log(`bootstrap app`);
      window.ethers = ethers.ethers;
      await connectMetamask();
      await Promise.all([
        updateGlobalStakingStats(),
      ]);
    }
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}