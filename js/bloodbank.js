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
  vm.LOADING.CONNECT_WALLET = true;
  try {
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
  } catch (exception) {
    console.error("connectMetamask error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.CONNECT_WALLET = false;
  }
}

const updateBalances = async (_walletAddress) => {
  const walletAddress = _walletAddress || vm.wallet.address;
  const [
    fearBalanceBN,
    stakedAmountBN,
    rewardAmountBN,
    lockedAmountBN,
    unlockedAmountBN,
    stakePoolAllowanceBN,
  ] = await Promise.all([
    CONTRACT.FEAR_TOKEN.instance.balanceOf(walletAddress),
    CONTRACT.STAKE_POOL.instance.getMyStakeAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyRewardAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyLockedAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyWithdrawableAmount({ from: walletAddress }),
    CONTRACT.FEAR_TOKEN.instance.allowance(walletAddress, CONTRACT.STAKE_POOL.instance.address),
  ]);
  vm.wallet.fearBalanceBN = fearBalanceBN;
  vm.wallet.stakedAmountBN = stakedAmountBN;
  vm.wallet.rewardAmountBN = rewardAmountBN;
  vm.wallet.lockedAmountBN = lockedAmountBN;
  vm.wallet.unlockedAmountBN = unlockedAmountBN;
  vm.wallet.stakePoolAllowanceBN = stakePoolAllowanceBN;
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
  vm.LOADING.STAKE = true;
  try {
    const amount = await fearAsk("Stake FEAR", "Enter the amount you want to stake:", input => bnInputValidator(input, vm.wallet.fearBalanceBN), { inputValue: formatEther(vm.wallet.fearBalanceBN) });
    if(!amount) return;
    const amountBN = ethers.utils.parseEther(amount);
    await updateBalances();
    const { fearBalanceBN, stakePoolAllowanceBN } = vm.wallet;
    if(amountBN.gt(fearBalanceBN)) {
      throw new Error(`Stake amount greater than your balance (${formatEther(fearBalanceBN)})`);
    }
    if(stakePoolAllowanceBN.lt(amountBN)) {
      const tx = await CONTRACT.FEAR_TOKEN.instance.approve(CONTRACT.STAKE_POOL.instance.address, ethers.constants.MaxUint256);
      console.log(`approving FEAR spend txHash`, tx.hash);
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
    fearSuccess(`${formatEther(amountBN)} FEAR staked`);
  } catch(exception) {
    console.error("stakeFear error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  }
  finally {
    vm.LOADING.STAKE = false;
  }
}

const unstakeFear = async ($event) => {
  vm.LOADING.UNSTAKE = true;
  try {
    const amount = await fearAsk(
      "Unstake FEAR",
      "Enter the amount you want to unstake:",
      input => bnInputValidator(input, vm.wallet.stakedAmountBN),
      {
        inputValue: formatEther(vm.wallet.stakedAmountBN),
      },
    );
    if(!amount) return;
    const amountBN = ethers.utils.parseEther(amount);
    await updateBalances();
    if(amountBN.gt(vm.wallet.stakedAmountBN)) throw new Error("Unstake amount greater than staked amount");
    // const estGasLimit = await CONTRACT.STAKE_POOL.instance.estimateGas.unstake(amountBN);
    const tx = await CONTRACT.STAKE_POOL.instance.unstake(amountBN);
    console.log(`unstakeFear txHash`, tx.hash);
    await tx.wait();
    await Promise.all([
      updateGlobalStakingStats(),
      updateBalances(),
    ]);
    fearSuccess(`${formatEther(amountBN)} FEAR unstaked`);
  } catch (exception) {
    console.error("unstakeFear error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.UNSTAKE = false;
  }
}

const claimReward = async ($event) => {
  vm.LOADING.CLAIM = true;
  try {
    await updateBalances();
    if(vm.wallet.rewardAmountBN.eq(ZeroBN)) throw new Error("You have no reward to claim");
    const tx = await CONTRACT.STAKE_POOL.instance.claimReward();
    console.log(`claimReward txHash`, tx.hash);
    await tx.wait();
    await Promise.all([
      updateGlobalStakingStats(),
      updateBalances(),
    ]);
    fearSuccess(`FEAR reward claimed`);
  } catch (exception) {
    console.error("claimReward error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.CLAIM = false;
  }
}

// withdraw
const withdrawUnlockedFear = async ($event) => {
  await updateBalances();
  if(vm.wallet.unlockedAmountBN.eq(ZeroBN)) throw new Error("Nothing to withdraw");
  console.log("withdraw in progress");
  const tx = await CONTRACT.STAKE_POOL.instance.withdrawUnlocked();
  await tx.wait();
  console.log("withdraw-ed");
  await Promise.all([
    updateGlobalStakingStats(),
    updateBalances(),
  ]);
}

// instant unstake
const instantUnstake = async ($event) => {
  vm.LOADING.INSTANT_UNSTAKE = true;
  try {
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
    const tx = await CONTRACT.STAKE_POOL.instance.instantUnstake(amountBN);
    console.log(`instantUnstake txHash`, tx.hash);
    await tx.wait();
    await Promise.all([
      updateGlobalStakingStats(),
      updateBalances(),
    ]);
    fearSuccess(`${formatEther(amountBN)} FEAR unstaked`);
  } catch (exception) {
    console.error("instantUnstake error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.INSTANT_UNSTAKE = false;
  }
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
    [MUMBAI_CHAINID]: '0xcEDec5902C5491b1A50057FC30f8717AcF3052e4',
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
    CONTRACT.STAKE_POOL.instance.instantUnstakeFeePercentage(),
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
    LOADING: {
      CONNECT_WALLET: false,
      STAKE: false,
      UNSTAKE: false,
      INSTANT_UNSTAKE: false,
      CLAIM: false, // ... reward
      WITHDRAW: false, // ... unlocked
    },
    wallet: {
      address: null,
      shortAddress: null,
      fearBalanceBN: null,
      stakedAmountBN: null,
      rewardAmountBN: null,
      lockedAmountBN: null,
      unlockedAmountBN: null,
      stakePoolAllowanceBN: null,
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

const fearAsk = async (title, message, inputValidator, options = {}) => {
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

const fearSuccess = async (message, options = {}) => {
  await Swal.fire({
    icon: 'success',
    title: 'Done',
    text: message,
    confirmButtonText: 'Great 🎉',
    ...options
  });
}

const fearError = async (message, options = {}) => {
  const msg = _.get(message, 'message') || message;
  const stack = _.get(message, 'stack');
  const code = _.get(message, 'code');
  if(code === 4001 || code === "ACTION_REJECTED") return; // metamask reject error
  await Swal.fire({
    icon: 'error',
    title: typeof message === "string" ? 'Error' : msg,
    text: msg,
    showCancelButton: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    cancelButtonText: 'Dismiss',
    html: stack ? `<pre class='text-left whitespace-normal'>${stack}</pre>`.trim() : undefined,
    ...options
  });
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

const getExceptionDetails = (ex) => {
	const message = _.get(ex, "reason") || _.get(ex, "error.data.message") || _.get(ex, "error.message") || _.get(ex, "data.message") || _.get(ex, "message") || (typeof ex == "string" && ex) || (Object.hasOwn(ex, 'toString') ? ex.toString() : '<unknown exception>');
	const stack = _.get(ex, "error.stack") || _.get(ex, "stack") || "<no stack>";
  const code = _.get(ex, "code");
  return { message, stack, code, };
	//.replace(/^execution reverted\: /i, '');
}

const createSpinner = (classes = 'text-white') => `
<svg class="h-4 w-4 animate-spin ${classes}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
`.trim();
