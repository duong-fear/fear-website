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
const OneEtherBN = ethers.utils.parseEther("1");
const OneFinneyBN = ethers.utils.parseUnits('1', 'finney');

const bn = input => {
  try {
    if(input instanceof ethers.BigNumber) return input;
    if(typeof input == 'number') return ethers.BigNumber.from(Number.parseInt(input));
    if(typeof input == 'string') return ethers.utils.parseEther(input);
  } catch(exception) {
    console.error(`bn() invalid input`, input);
  }
  return ZeroBN;
};

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

const bnInputValidator = (input, max) => {
  try {
    const bnValue = ethers.utils.parseEther(input);
    if(!bnValue.gt(ZeroBN)) return "Amount must greater than zero";
    if(max && bnValue.gt(bn(max))) return `Amount excess maximum value (${formatEther(bn(max))})`;
    return null;
  } catch {
    return input.trim() === '' ? "Please enter an amount" : "Invalid amount";
  }
}

// stake + unstake function
const stakeFear = async ($event) => {
  const amount = await fearAsk("Stake FEAR", "Enter the amount you want to stake:", input => bnInputValidator(input, vm.wallet.fearBalanceBN), { inputValue: formatEther(vm.wallet.fearBalanceBN) });
  if(!amount) return;
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

const unstakeFear = async ($event) => {
  const amount = await fearAsk("Unstake FEAR", "Enter the amount you want to unstake:", input => bnInputValidator(input, vm.wallet.stakedAmountBN), { inputValue: formatEther(vm.wallet.stakedAmountBN) });
  if(!amount) return;
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

const claimReward = async ($event) => {
  alert("Not implemented");
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
const instantUnstake = async ($event) => {
  const instantUnstakeFeePercentage = vm.stakingStats.global.instantUnstakeFeePercentage;
  const amount = await fearAsk(
    "⚠️ Instant Unstake",
    null,
    input => bnInputValidator(input, vm.wallet.lockedAmountBN),
    {
      inputValue: formatEther(vm.wallet.lockedAmountBN),
      html: `Enter the amount you want to unstake:<br/><span class='text-red-400'>⛔️ You will only get ${100 - instantUnstakeFeePercentage}% of your unstake amount (the rest will be burned 🔥)</span>`,
    },
  );
  if(!amount) return;
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
    instantUnstakeFeePercentageBN,
  ] = await Promise.all([
    CONTRACT.STAKE_POOL.instance.getStakersCount(),
    CONTRACT.STAKE_POOL.instance.getTotalStakedAmount(),
    CONTRACT.STAKE_POOL.instance.getCurrentStakingEpoch(),
    CONTRACT.STAKE_POOL.instance.flashUnstakeFeePercentage(),
  ]);
  vm.stakingStats.global.stakerCount = stakerCountBN.toNumber();
  vm.stakingStats.global.tvlBN = totalStakedAmountBN;
  vm.stakingStats.global.apr = +(currentStakingEpoch.apr.toNumber() / 100);
  vm.stakingStats.global.releaseTimeDays = currentStakingEpoch.lockParts.toNumber() * currentStakingEpoch.lockPeriod.toNumber() / (24*3600);
  vm.stakingStats.global.instantUnstakeFeePercentage = instantUnstakeFeePercentageBN.toNumber() / 100;
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
        tvlBN: undefined,
        // number of stakers
        stakerCount: undefined,
        // annual percent yeild
        apr: undefined,
        releaseTimeDays: undefined,
        instantUnstakeFeePercentage: null,
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

const fearAsk = async (title, message, inputValidator, options) => {
  const { isConfirmed, value, } = await Swal.fire({
    title,
    input: 'text',
    inputLabel: message,
    inputValue: "",
    showCancelButton: true,
    confirmButtonText: "Confirm",
    inputValidator: typeof inputValidator === 'function' ? inputValidator : () => false,
    allowOutsideClick: false,
    ...options,
  });
  return isConfirmed ? value : undefined;
}

const formatTVL = tvlBN => {
  try {
    if(!(tvlBN instanceof ethers.BigNumber)) return 'n/a';
    const OneThousandEtherBN = ethers.utils.parseEther("1000");
    const OneMillionEtherBN = ethers.utils.parseEther("1000000");
    if(tvlBN.gte(OneMillionEtherBN)) return formatEther(tvlBN.div(1_000_000).div(OneFinneyBN).mul(OneFinneyBN)) + "M";
    if(tvlBN.gte(OneThousandEtherBN)) return formatEther(tvlBN.div(1_000).div(OneFinneyBN).mul(OneFinneyBN)) + "K";
    return formatEther(tvlBN.div(OneFinneyBN).mul(OneFinneyBN));
  } catch(exception) {
    console.error(`formatTVL`, exception);
    return 'n/a';
  }
}