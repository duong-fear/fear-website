const getEpoch = () => Number.parseInt((new Date()).getTime()/1000);

let STAKING_AVAILABLE_EPOCH = 1668157200;

const isStakingAvaiable = () => {
  return !!vm && !!STAKING_AVAILABLE_EPOCH && vm.epoch >= STAKING_AVAILABLE_EPOCH;
}
const NUMBER_OF_CONFIRMATIONS_NEEDED = 2;

const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const BSC_CHAINID = 56;

const DEFAULT_CHAINID = POLYGON_CHAINID;

const SUPPORTED_CHAINS = [
  POLYGON_CHAINID,
  MUMBAI_CHAINID,
  BSC_CHAINID,
];

const RPC_URL = {
  1: 'https://rpc.ankr.com/eth',
  10: 'https://rpc.ankr.com/optimism',
  43114: 'https://rpc.ankr.com/avalanche',
  42220: 'https://rpc.ankr.com/celo',
  1666600000: 'https://rpc.ankr.com/harmony',
  250: 'https://rpc.ankr.com/fantom',
  [BSC_CHAINID]: 'https://rpc.ankr.com/bsc',
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const CHAINS = [
  {
    mainnet: true,
    chainId: `0x${POLYGON_CHAINID.toString(16)}`,
    rpc: RPC_URL[POLYGON_CHAINID],
    name: "Polygon Mainnet",
    nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18,
    },
    blockExplorer: "https://polygonscan.com",
  },
  {
    mainnet: true,
    chainId: `0x${BSC_CHAINID.toString(16)}`,
    rpc: RPC_URL[BSC_CHAINID],
    name: "Binance Smart Chain",
    nativeCurrency: {
        name: "BNB",
        symbol: "BNB",
        decimals: 18,
    },
    blockExplorer: "https://bscscan.com",
  },
  {
    mainnet: false,
    chainId: `0x${MUMBAI_CHAINID.toString(16)}`,
    rpc: RPC_URL[MUMBAI_CHAINID],
    name: "Mumbai Testnet",
    nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18,
    },
    blockExplorer: "https://mumbai.polygonscan.com",
  },
];

const getChainNameById = (chainId) => {
  const c = CHAINS.find(c => +chainId == +c.chainId);
  return c ? `(${c.name})` : ``;
}

const reloadPage = () => window.location.reload();
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

const switchToNetwork = async (chainId) => {
  const web3Provider = new ethers.providers.Web3Provider(window.web3ModalInstance);
  const { provider } = web3Provider;
  try {
    vm.LOADING.SWITCH_NETWORK = true;
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: `0x${chainId.toString(16)}`,
        },
      ],
    });
  } catch (e) {
    let network = CHAINS.find((c) => +c.chainId == +chainId);
    if (e.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainId,
            chainName: network.name,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: [network.rpc],
            blockExplorerUrls: [network.blockExplorer],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: `0x${chainId.toString(16)}`,
          },
        ],
      });
      return;
    }
    throw e;
  } finally {
    vm.LOADING.SWITCH_NETWORK = false;
  }
};

// execute on connected to supported network 
const connectAccount = async (web3Provider) => {
  try {
    updateGlobalStakingStats();
    vm.LOADING.CONNECT_WALLET = true;
    let accountList = await web3Provider.listAccounts();
    if(accountList.length == 0) {
      await web3Provider.provider.request({ method: 'eth_requestAccounts' });
    }
    accountList = await web3Provider.listAccounts();
    const walletAddress = accountList.shift();
    await updateUserStats(walletAddress);
    vm.wallet.address = walletAddress;
    vm.wallet.shortAddress = `${walletAddress.substr(0, 6)}..${walletAddress.substr(-4)}`;
    vm.wallet.isWalletConnect = !!_.get(window, 'web3ModalInstance.isWalletConnect');
    vm.wallet.isMetaMask = !!_.get(window, 'web3ModalInstance.isMetaMask');
    window.provider = web3Provider;
    window.signer = web3Provider.getSigner();
    web3Provider.provider.on("accountsChanged", (params) => {
      console.info("accountsChanged", params);
      const [address] = params;
      if(address == vm.wallet.address) return;
      reloadPage();
    });
    web3Provider.provider.on("chainChanged", async (chainIdHex) => {
      console.info("chainId", +chainIdHex);
      reloadPage();
    });
  }
  finally {
    vm.LOADING.CONNECT_WALLET = false;
  }
}

const disconnectWC = async () => {
  try {
    await window.web3ModalInstance.close();
  }
  finally {
    reloadPage();
  }
}

// wallet connect functions
const connectWallet = async () => {
  vm.LOADING.CONNECT_WALLET = true;
  try {
    const Web3Modal = window.Web3Modal.default;
    const WalletConnectProvider = window.WalletConnectProvider.default;
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          rpc: RPC_URL,
        }
      },
    };
    const web3Modal = new Web3Modal({
      cacheProvider: false,
      providerOptions,
      disableInjectedProvider: false,
    });
    const web3ModalInstance = await web3Modal.connect();
    window.web3ModalInstance = web3ModalInstance;
    const web3Provider = new ethers.providers.Web3Provider(web3ModalInstance);
    const { chainId } = await web3Provider.getNetwork();
    vm.network.chainId = +chainId;
    if(SUPPORTED_CHAINS.includes(chainId)) {
      return await connectAccount(web3Provider);
    }
    web3Provider.provider.on("chainChanged", async (chainIdHex) => {
      const chainId = +chainIdHex;
      console.info(`chainChanged`, chainId);
      vm.network.chainId = chainId;
      if(!SUPPORTED_CHAINS.includes(chainId)) return;
      await connectAccount(new ethers.providers.Web3Provider(web3ModalInstance));
    });
  } catch (exception) {
    const exceptionDetails = getExceptionDetails(exception);
    const ignoredExceptionList = [
      "Modal closed by user",
      "User closed modal",
    ];
    if(ignoredExceptionList.includes(exceptionDetails.message)) return;
    console.error("connectWallet error", exception);
    // throw exception;
    fearError(exceptionDetails);
  } finally {
    vm.LOADING.CONNECT_WALLET = false;
  }
}

const updateUserStats = async (_walletAddress) => {
  const walletAddress = _walletAddress || vm.wallet.address;
  const [
    fearBalanceBN,
    stakedAmountBN,
    rewardAmountBN,
    lockedAmountBN,
    unlockedAmountBN,
    stakePoolAllowanceBN,
    allMyLocks,
  ] = await Promise.all([
    CONTRACT.FEAR_TOKEN.instance.balanceOf(walletAddress),
    CONTRACT.STAKE_POOL.instance.getMyStakeAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyRewardAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyLockedAmount({ from: walletAddress }),
    CONTRACT.STAKE_POOL.instance.getMyWithdrawableAmount({ from: walletAddress }),
    CONTRACT.FEAR_TOKEN.instance.allowance(walletAddress, CONTRACT.STAKE_POOL.instance.address),
    CONTRACT.STAKE_POOL.instance.getAllMyLocks({ from: walletAddress }),
  ]);
  vm.wallet.fearBalanceBN = fearBalanceBN;
  vm.wallet.stakedAmountBN = stakedAmountBN;
  vm.wallet.rewardAmountBN = rewardAmountBN;
  vm.wallet.lockedAmountBN = lockedAmountBN;
  vm.wallet.unlockedAmountBN = unlockedAmountBN;
  vm.wallet.stakePoolAllowanceBN = stakePoolAllowanceBN;
  vm.wallet.allMyLocks = _.chunk(
    allMyLocks.map(e => [e.amount, e.unlockDate.toNumber()]),
    4,
  )
  .map(l =>  [
    l.map(t => t[0]).reduce((x, y) => x.add(y)), // unstaked amount
    ...l.map(t => t[1]), // release time array for each part
  ]);
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
    await updateUserStats();
    const { fearBalanceBN, stakePoolAllowanceBN } = vm.wallet;
    if(amountBN.gt(fearBalanceBN)) {
      throw new Error(`Stake amount greater than your balance (${formatEther(fearBalanceBN)})`);
    }
    if(stakePoolAllowanceBN.lt(amountBN)) {
      const tx = await CONTRACT.FEAR_TOKEN.instance.approve(CONTRACT.STAKE_POOL.instance.address, ethers.constants.MaxUint256);
      console.log(`approving FEAR spend txHash`, tx.hash);
      await tx.wait();
    }
    const tx = await CONTRACT.STAKE_POOL.instance.stake(amountBN);
    console.log(`stakeFear txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
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
    await updateUserStats();
    if(amountBN.gt(vm.wallet.stakedAmountBN)) throw new Error("Unstake amount greater than staked amount");
    // const estGasLimit = await CONTRACT.STAKE_POOL.instance.estimateGas.unstake(amountBN);
    const tx = await CONTRACT.STAKE_POOL.instance.unstake(amountBN);
    console.log(`unstakeFear txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
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
    await updateUserStats();
    if(vm.wallet.rewardAmountBN.eq(ZeroBN)) throw new Error("You have no reward to claim");
    const tx = await CONTRACT.STAKE_POOL.instance.claimReward();
    console.log(`claimReward txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
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
  vm.LOADING.WITHDRAW = true;
  try {
    await updateUserStats();
    const unlockedAmountBN = vm.wallet.unlockedAmountBN;
    if(unlockedAmountBN.eq(ZeroBN)) throw new Error("Can't withdraw Zero");
    const tx = await CONTRACT.STAKE_POOL.instance.withdrawUnlocked();
    console.log(`withdrawUnlockedFear txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
    ]);
    fearSuccess(`${formatEther(unlockedAmountBN)} FEAR withdrawn`);
  } catch (exception) {
    console.error("withdrawUnlockedFear error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.WITHDRAW = false;
  }
}

const stakeBack = async () => {
  vm.LOADING.STAKE_BACK = true;
  try {
    await updateUserStats();
    const unlockedAmountBN = vm.wallet.unlockedAmountBN;
    const lockedAmountBN = vm.wallet.lockedAmountBN;
    if(lockedAmountBN.eq(ZeroBN)) throw new Error("lockedAmount = 0");
    const confirmed = await fearConfirm(
      `This will bring <span class='text-green-500'>${formatEtherHuman(unlockedAmountBN)} unlocked</span> $FEAR and <span class='text-main-color'>${formatEtherHuman(lockedAmountBN)} locked</span> $FEAR back to stake`,
      `Are you sure ?`,
    );
    if(!confirmed) return;
    const tx = await CONTRACT.STAKE_POOL.instance.stakeBack();
    console.log(`stakeBack txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
    ]);
    fearSuccess(`${formatEtherHuman(lockedAmountBN)} FEAR staked back`);
  } catch (exception) {
    console.error("stakeBack error", exception);
    // throw exception;
    fearError(getExceptionDetails(exception));
  } finally {
    vm.LOADING.STAKE_BACK = false;
  }
}

// instant unstake
const instantUnstake = async ($event) => {
  vm.LOADING.INSTANT_UNSTAKE = true;
  const { stakedAmountBN } = vm.wallet;
  try {
    const instantUnstakeFeePercentage = vm.global.instantUnstakeFeePercentage;
    const amount = await fearAsk(
      "⚠️ Instant Unstake",
      null,
      input => bnInputValidator(input, stakedAmountBN),
      {
        inputValue: formatEther(stakedAmountBN),
        html: `Enter the amount you want to unstake:<br/><span class='text-red-500'>⛔️ You will only get ${100 - instantUnstakeFeePercentage}% of your unstake amount (the rest will be burned 🔥)</span>`,
      },
    );
    if(!amount) return;
    const amountBN = ethers.utils.parseEther(amount);
    await updateUserStats();
    if(amountBN.gt(stakedAmountBN)) throw new Error("Unstake amount greater than staked amount");
    const tx = await CONTRACT.STAKE_POOL.instance.instantUnstake(amountBN);
    console.log(`instantUnstake txHash`, tx.hash);
    await tx.wait(NUMBER_OF_CONFIRMATIONS_NEEDED);
    await Promise.all([
      updateGlobalStakingStats(),
      updateUserStats(),
    ]);
    fearSuccess(`${formatEtherHuman(amountBN.mul(100-instantUnstakeFeePercentage).div(100))} FEAR unstaked & ${ formatEtherHuman(amountBN.mul(instantUnstakeFeePercentage).div(100)) } FEAR burnt`);
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
      const chainId = _.get(vm, 'network.chainId', DEFAULT_CHAINID);
      return new ethers.Contract(
        CONTRACT.FEAR_TOKEN[chainId],
        CONTRACT.FEAR_TOKEN.ABI,
        window.signer || RPC_PROVIDER[chainId],
      );
    }
  },
  STAKE_POOL: {
    [BSC_CHAINID]: "0x35ae9238f2eb224e239c710818aae7ecdb97ef59",
    [POLYGON_CHAINID]: "0x35ae9238f2eb224e239c710818aae7ecdb97ef59",
    // [MUMBAI_CHAINID]: '0x8Ae6CD7cDf43cC602F447e24ad8e0b08270FFF3D', // small unlock time
    // [MUMBAI_CHAINID]: '0x38cbaDe25f11b42e400a826CC4A72967977550f3', // countdown
    [MUMBAI_CHAINID]: '0x97EE14d79bdE9fc5301506c9610dD82F2b125cF8', // dimi
    ABI: FEAR_STAKE_POOL_ABI,
    get instance() {
      const chainId = _.get(vm, 'network.chainId', DEFAULT_CHAINID);
      return new ethers.Contract(
        CONTRACT.STAKE_POOL[chainId],
        CONTRACT.STAKE_POOL.ABI,
        window.signer || RPC_PROVIDER[chainId],
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
    totalSentToDaoAmountBN,
  ] = await Promise.all([
    CONTRACT.STAKE_POOL.instance.getStakersCount(),
    CONTRACT.STAKE_POOL.instance.getTotalStakedAmount(),
    CONTRACT.STAKE_POOL.instance.getCurrentStakingEpoch(),
    CONTRACT.STAKE_POOL.instance.instantUnstakeFeePercentage(),
    CONTRACT.STAKE_POOL.instance.totalSentToDaoAmount(),
  ]);
  vm.global.stakerCount = stakerCountBN.toNumber();
  vm.global.tvlBN = totalStakedAmountBN;
  vm.global.apr = +(currentStakingEpoch.apr.toNumber() / 100);
  vm.global.releaseTimeDays = currentStakingEpoch.lockParts.toNumber() * currentStakingEpoch.lockPeriod.toNumber() / (24*3600);
  vm.global.instantUnstakeFeePercentage = instantUnstakeFeePercentageBN.toNumber() / 100;
  vm.global.totalSentToDaoAmountBN = totalSentToDaoAmountBN;
}


const boostrapApp = () => {
  Alpine.store('vm', {
    epoch: null,
    LOADING: {
      SWITCH_NETWORK: false,
      CONNECT_WALLET: false,
      STAKE: false,
      UNSTAKE: false,
      INSTANT_UNSTAKE: false,
      CLAIM: false, // ... reward
      WITHDRAW: false, // ... unlocked
      STAKE_BACK: false,
    },
    tabList: [
      "The Crypt",
      "The Tomb",
    ],
    network: {
      chainId: DEFAULT_CHAINID,
      provider: undefined,
    },
    activeTabId: 0,
    global: {
      tvlBN: undefined,
      stakerCount: undefined,
      apr: undefined,
      releaseTimeDays: undefined,
      instantUnstakeFeePercentage: null,
      totalSentToDaoAmountBN: null,
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
      isWalletConnect: false,
      isMetaMask: false,
      allMyLocks: null,
    },
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      // window.ethers = ethers.ethers;
      // await connectWallet();
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

const fearConfirm = async (title, message) => {
  const { isConfirmed } = await Swal.fire({
    title,
    text: message,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Confirm',
  });
  return isConfirmed;
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

const polygonSVG = `
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 38.4 33.5" class="w-20 h-20" xml:space="preserve">
<style type="text/css">
	.st0{fill:#8247E5;}
</style>
<g>
	<path class="st0" d="M29,10.2c-0.7-0.4-1.6-0.4-2.4,0L21,13.5l-3.8,2.1l-5.5,3.3c-0.7,0.4-1.6,0.4-2.4,0L5,16.3
		c-0.7-0.4-1.2-1.2-1.2-2.1v-5c0-0.8,0.4-1.6,1.2-2.1l4.3-2.5c0.7-0.4,1.6-0.4,2.4,0L16,7.2c0.7,0.4,1.2,1.2,1.2,2.1v3.3l3.8-2.2V7
		c0-0.8-0.4-1.6-1.2-2.1l-8-4.7c-0.7-0.4-1.6-0.4-2.4,0L1.2,5C0.4,5.4,0,6.2,0,7v9.4c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7
		c0.7,0.4,1.6,0.4,2.4,0l5.5-3.2l3.8-2.2l5.5-3.2c0.7-0.4,1.6-0.4,2.4,0l4.3,2.5c0.7,0.4,1.2,1.2,1.2,2.1v5c0,0.8-0.4,1.6-1.2,2.1
		L29,28.8c-0.7,0.4-1.6,0.4-2.4,0l-4.3-2.5c-0.7-0.4-1.2-1.2-1.2-2.1V21l-3.8,2.2v3.3c0,0.8,0.4,1.6,1.2,2.1l8.1,4.7
		c0.7,0.4,1.6,0.4,2.4,0l8.1-4.7c0.7-0.4,1.2-1.2,1.2-2.1V17c0-0.8-0.4-1.6-1.2-2.1L29,10.2z"/>
</g>
</svg>`.trim();

const bscSVG = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 2496 2496" class="w-20 h-20" xml:space="preserve">
<g>
	<path style="fill-rule:evenodd;clip-rule:evenodd;fill:#F0B90B;" d="M1248,0c689.3,0,1248,558.7,1248,1248s-558.7,1248-1248,1248
		S0,1937.3,0,1248S558.7,0,1248,0L1248,0z"/>
	<path style="fill:#FFFFFF;" d="M685.9,1248l0.9,330l280.4,165v193.2l-444.5-260.7v-524L685.9,1248L685.9,1248z M685.9,918v192.3
		l-163.3-96.6V821.4l163.3-96.6l164.1,96.6L685.9,918L685.9,918z M1084.3,821.4l163.3-96.6l164.1,96.6L1247.6,918L1084.3,821.4
		L1084.3,821.4z"/>
	<path style="fill:#FFFFFF;" d="M803.9,1509.6v-193.2l163.3,96.6v192.3L803.9,1509.6L803.9,1509.6z M1084.3,1812.2l163.3,96.6
		l164.1-96.6v192.3l-164.1,96.6l-163.3-96.6V1812.2L1084.3,1812.2z M1645.9,821.4l163.3-96.6l164.1,96.6v192.3l-164.1,96.6V918
		L1645.9,821.4L1645.9,821.4L1645.9,821.4z M1809.2,1578l0.9-330l163.3-96.6v524l-444.5,260.7v-193.2L1809.2,1578L1809.2,1578
		L1809.2,1578z"/>
	<polygon style="fill:#FFFFFF;" points="1692.1,1509.6 1528.8,1605.3 1528.8,1413 1692.1,1316.4 1692.1,1509.6 	"/>
	<path style="fill:#FFFFFF;" d="M1692.1,986.4l0.9,193.2l-281.2,165v330.8l-163.3,95.7l-163.3-95.7v-330.8l-281.2-165V986.4
		L968,889.8l279.5,165.8l281.2-165.8l164.1,96.6H1692.1L1692.1,986.4z M803.9,656.5l443.7-261.6l444.5,261.6l-163.3,96.6
		l-281.2-165.8L967.2,753.1L803.9,656.5L803.9,656.5z"/>
</g>
</svg>`.trim();

const countdownText = (delta) => {
	if(delta < 0) delta = 0;
	const d = Math.floor( delta/86400 );
	const h = Math.floor( (delta - 86400*d) / 3600);
	const m = Math.floor( (delta - 86400*d - h*3600) / 60 );
	const s = delta - 86400*d - h*3600 - 60*m;
	return `${d}d ${h}h ${m}m ${s}s`
		.replace(/^0d 0h 0m 0s/, '')
		.replace(/^0d 0h 0m /, '')
		.replace(/^0d 0h /, '')
		.replace(/^0d /, '');
	// return ({
	// 	d: d,
	// 	h: h,
	// 	m: m,
	// 	s: s,
	// })
}

const formatDate = (epoch) => dayjs(epoch * 1000).format('DD MMM YYYY HH:mm:ss');

const formatEtherHuman = (input) => {
  if(!(input instanceof ethers.BigNumber)) return 'n/a';
  const OneThousandEtherBN = ethers.utils.parseEther("1000");
  const OneMillionEtherBN = ethers.utils.parseEther("1000000");
  if(input.gte(OneMillionEtherBN)) return formatEther(input.div(1_000_000).div(OneFinneyBN).mul(OneFinneyBN)) + "M";
  if(input.gte(OneThousandEtherBN)) return formatEther(input.div(1_000).div(OneFinneyBN).mul(OneFinneyBN)) + "K";
  if(input.gte(OneFinneyBN)) return formatEther(input.div(OneFinneyBN).mul(OneFinneyBN));
  if(input.eq(ZeroBN)) return "0";
  return "~0.001";
}