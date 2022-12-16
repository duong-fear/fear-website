// config
const googleLoginRedirectURI = undefined; //window.location.href
const fAPIEndpoint = `https://fearapi.azurewebsites.net/api/horrorhubweb`;
// const fAPIEndpoint = `http://localhost:7071/api/horrorhubweb`;
const biconomyNativeTxEndpoint = "https://api.biconomy.io/api/v2/meta-tx/native";

const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const CHAINID = POLYGON_CHAINID;

const config = {
  [POLYGON_CHAINID]: {
    google: {
      client_id: "701735735157-cdgkv7di5ihom5mdp0pflphvh2p7hjjq.apps.googleusercontent.com",
    },
    torus: {
      network: "mainnet",
      verifier: "fear-wallet-prd",
    },
  },
  [MUMBAI_CHAINID]: {
    google: {
      client_id: "701735735157-pfasbrqls3p9eb8edbn7bjjbsflsqmvk.apps.googleusercontent.com",
    },
    torus: {
      network: "testnet",
      verifier: "fear-wallet-dev",
    },
  }
}

const matic2Usd = 0.837;
const fear2Usd = 0.075;

const RPC_URL = {
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const BICONOMY_API_KEY = {
  [POLYGON_CHAINID]: 'y9lbpk5lO.40482d7f-f2d5-44e6-a24d-cf898ad97727',
  [MUMBAI_CHAINID]: '',
}

const BICONOMY_PURCHASE_BY_FEAR_TRANSFER_APPID = {
  [POLYGON_CHAINID]: 'f9d89d0a-be38-4996-8345-df04220354b1',
  [MUMBAI_CHAINID]: '',
}

const RPC_PROVIDER = {
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}

const getRecommendedGasPrice = async (chainId) => {
  // +25% to base gas price to get recommended gas price
  const gasPrice = (await RPC_PROVIDER[chainId].getGasPrice()).mul(125).div(100);
  console.log(`RecommendedGasPrice`, ethers.utils.formatUnits(gasPrice, 'gwei'));
  return gasPrice;
}

const CONTRACT = {
  FEAR_TOKEN: {
    [POLYGON_CHAINID]: '0xa2ca40dbe72028d3ac78b5250a8cb8c404e7fb8c',
    [MUMBAI_CHAINID]: '0x9006Cf37B092C03f77e2428B1220968E6DA399E9',
    ABI: FEAR_TOKEN_ABI,
    instanceForChain(chainId) {
      return new ethers.Contract(
        CONTRACT.FEAR_TOKEN[chainId],
        CONTRACT.FEAR_TOKEN.ABI,
        RPC_PROVIDER[chainId],
      );
    }
  },
  HORRORHUB_WEB_SALE: {
    [POLYGON_CHAINID]: "0x3fac9fabfe02a83945d733c72bd871cd940e8395",
    [MUMBAI_CHAINID]: '0xCD46A312F947266730d9DB460685369E70c34D96',
    ABI: HORRORHUB_WEB_SALE_ABI,
    instanceForChain(chainId) {
      return new ethers.Contract(
        CONTRACT.HORRORHUB_WEB_SALE[chainId],
        CONTRACT.HORRORHUB_WEB_SALE.ABI,
        RPC_PROVIDER[chainId],
      );
    }
  },
};

const biconomyExecTransaction = async (params, gasLimit) => {
  const { data } = await axios.post(
    biconomyNativeTxEndpoint,
    {
      userAddress: vm.state.user.ethAddress,
      apiId: BICONOMY_PURCHASE_BY_FEAR_TRANSFER_APPID[CHAINID],
      params,
      gasLimit,
    },
    {
      headers: {
        'x-api-key': BICONOMY_API_KEY[CHAINID],
      },
      validateStatus: () => true,
    }
  );
  const txHash = _.get(data, 'txHash');
  const error = _.get(data, 'error');
  const flag = _.get(data, 'flag');
  const log = _.get(data, 'log');
  if(txHash) {
    console.log(`biconomy txHash`, txHash);
    RPC_PROVIDER[CHAINID].waitForTransaction(txHash, 2);
    return txHash;
  }
  throw new Error(error || `unknown biconomy error ( flag: ${flag} / log: ${log} )`);
}

const generateFearTransferMetaSignature = async (toAddress, amountBN) => {
  const walletSigner = window.signer;
  const walletAddress = await walletSigner.getAddress();
  const erc20Interface = new ethers.utils.Interface(FEAR_TOKEN_ABI);
  const transferSignature = erc20Interface.encodeFunctionData(
    "transfer",
    [
      toAddress,
      amountBN,
    ],
  );
  const signature = await walletSigner._signTypedData(
    // domain data
    {
      name: "Fear NFTs (PoS)",
      version: "1",
      verifyingContract: CONTRACT.FEAR_TOKEN[CHAINID],
      salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(CHAINID), 32),
    },
    {
      MetaTransaction: [
        { name: "nonce", type: "uint256" },
        { name: "from", type: "address" },
        { name: "functionSignature", type: "bytes" },
      ],
    },
    {
      nonce: await CONTRACT.FEAR_TOKEN.instanceForChain(CHAINID).getNonce(walletAddress),
      from: walletAddress,
      functionSignature: transferSignature,
    },
  );
  return {
    a: walletAddress,
    ..._.pick(ethers.utils.splitSignature(signature), ['r', 's', 'v']),
  };
}

const idToken2Signer = (email, idToken) => new Promise(async (resolve, reject) => {
  try {
    const fetchNodeDetails = new window.FetchNodeDetails.default();
    const TorusUtils = window.TorusUtils.default;
    const verifier = config[CHAINID].torus.verifier;
    const torus = new TorusUtils({
      network: config[CHAINID].torus.network,
    });
    const { torusNodeEndpoints, torusNodePub, torusIndexes } = await fetchNodeDetails.getNodeDetails({
      verifier,
      verifierId: email,
    })
    const { ethAddress, privKey, } = await torus.retrieveShares(
      torusNodeEndpoints,
      torusIndexes,
      verifier,
      {
        verifier_id: email,
      },
      idToken,
    );
    resolve(
      (new ethers.Wallet(privKey)).connect(RPC_PROVIDER[CHAINID])
    )
  } catch(exception) {
    reject(exception);
  }
})

const getPriceForAllProducts = async () => {
  const [
    productIds,
    usdQuotes,
    fearQuotes,
    maticQuotes,
  ] = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getPrices([]);
  // todo use lodash
  const output = {};
  productIds.forEach((idBN, index) => {
    const id = idBN.toNumber();
    output[id] = {
      usd: usdQuotes[index],
      fear: fearQuotes[index],
      matic: maticQuotes[index],
    };
  });
  return output;
}

const fetchInitialAppState = async () => {  
  const [priceForAllProducts] = await Promise.all([
    getPriceForAllProducts(),
  ]);
  const { productList } = await getProductList();
  vm.state.games = productList.map(p => ({
    ...p,
    id: +p.rowKey,
    priceUsd: formatEther( priceForAllProducts[+p.rowKey].usd ),
    priceMatic: formatEther( priceForAllProducts[+p.rowKey].matic ),
    priceFear: formatEther( priceForAllProducts[+p.rowKey].fear ),
  }))
}

// const updateExchangeRate = async () => {
//   const [fear2Usd, matic2Usd] = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(80001).getExchangeRate();
//   vm.state.exchangeRate = {
//     fear2Usd,
//     matic2Usd,
//   };
// }

const getProductList = async () => {
  return await axios.get(`${fAPIEndpoint}/getProductList`).then(r => r.data);
}

const qaList = [
  {
    q: "What payment methods do you accept?",
    a: "Only in <span class='text-red-600 font-bold'>$FEAR</span> token",
    opened: false,
  },
  {
    q: "What is your refund policy?",
    a: "We dont have it. All sales are final.",
    opened: false,
  },
  {
    q: "Do you offer technical support?",
    a: "Of course not 😂",
    opened: false,
  },
  {
    q: "How to report a bug or request a feature?",
    a: "Please contact our staff on <a class='text-cyan-400' href='https://t.me/fearcoin' target='_blank'>telegram</a> or any of our social media (kindly check out links at bottom of this page)",
    opened: false,
  },
];

const stepList = [
  {
    q: "How to get $FEAR token?",
    a: "#todo",
    opened: false,
  },
  {
    q: "How to purchase game?",
    a: "#todo",
    opened: false,
  },
  {
    q: "How to download apk file for the game?",
    a: "#todo",
    opened: false,
  },
  {
    q: "How to install apk file on your phone?",
    a: "#todo",
    opened: false,
  },
  {
    q: "How to start playing?",
    a: "Open the app you just installed. That's all. Hope you having fun and thank you for your purchase 😍",
    opened: false,
  },
].map((item, index) => ({
  ...item,
  q: `Step ${index+1}: ${item.q}`,
}));

const payWithFear = async productId => {
  if(vm.state.running.PAY_WITH_FEAR === productId) return;
  try {
    vm.state.running.PAY_WITH_FEAR = productId;
    const signer = window.signer;
    const { fearBalance } = vm.state.user;
    const { name, priceFear } = vm.state.games.find(g => g.id == productId);
    const priceFearBN = ethers.utils.parseEther(priceFear);
    if(priceFearBN.gt(fearBalance)) throw new Error("Insufficient FEAR balance");
    if(vm.state.user.purchased.includes(productId)) throw new Error("Product already purchased");
    const confirmed = await fearConfirm(
      `Are you sure want to pay ${priceFear} $FEAR to buy "${name}"?`
    );
    if(!confirmed) return;
    const { a, r, s, v, } = await generateFearTransferMetaSignature(
      // should send to fee reciever address
      "0xAf98aE477c5C2394b92aC75767753cbDaF152f12",
      priceFearBN,
    );
    const gasPrice = await getRecommendedGasPrice(CHAINID);
    const estGasLimit = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).estimateGas.purchaseByTransferMeta(productId, a, r, s, v);
    // +10% for est. gas limit
    const gasLimit = estGasLimit.mul(110).div(100);
    // method 1: directly via user wallet
    // const tx = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).connect(signer).purchaseByTransferMeta(
    //   productId,
    //   a, r, s, v,
    //   {
    //     gasLimit,
    //     gasPrice,
    //   },
    // );
    // console.log(`payWithFear txHash`, tx.hash);
    // await tx.wait(2);
    // method 2: via biconomy
    await biconomyExecTransaction(
      [
        productId,
        a,
        r,
        s,
        v,
      ],
      gasLimit.toNumber(),
    );
    vm.state.user.purchased.push(productId);
    fearSuccess(`You owned '${name}'`, {
      title: "Payment Successful",
    });
  } catch(exception) {
    console.error("payWithFear() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.PAY_WITH_FEAR = false;
  }
}

const payWithMatic = async productId => {
  if(vm.state.running.PAY_WITH_MATIC === productId) return;
  try {
    vm.state.running.PAY_WITH_MATIC = productId;
    const signer = window.signer;
    const { name, priceMatic } = vm.state.games.find(g => g.id == productId);
    const { maticBalance } = vm.state.user;
    const priceMaticBN = ethers.utils.parseEther(priceMatic);
    if(vm.state.user.purchased.includes(productId)) throw new Error("Product already purchased");
    if(priceMaticBN.gt(maticBalance)) throw new Error("Insufficient MATIC balance");
    const confirmed = await fearConfirm(
      `Are you sure want to pay ${priceMatic} $MATIC to buy "${name}"?`
    );
    if(!confirmed) return;
    const gasPrice = await getRecommendedGasPrice(CHAINID);
    const estGasLimit = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).estimateGas.purchaseByMatic(productId, {
      value: priceMaticBN,
    })
    // +10% for est. gas limit
    const gasLimit = estGasLimit.mul(110).div(100);
    const gasFee = gasLimit.mul(gasPrice);
    console.log(`gasFee`, gasFee);
    const tx = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).connect(signer).purchaseByMatic(
      productId,
      {
        value: priceMaticBN.sub(gasFee),
        gasLimit,
        gasPrice,
      },
    );
    console.log(`payWithMatic txHash`, tx.hash);
    await tx.wait(2);
    vm.state.user.purchased.push(productId);
    fearSuccess(`You owned '${name}'`, {
      title: "Payment Successful",
    });
  } catch(exception) {
    console.error("payWithMatic() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.PAY_WITH_MATIC = false;
  }
}

const downloadGame = async (productId) => {
  if(vm.state.running.DOWNLOAD_GAME === productId) return;
  try {
    const signer = window.signer;
    const address = signer.address
    const epoch = getEpoch();
    const sig = await signer.signMessage(`${address}:${epoch}`);
    vm.state.running.DOWNLOAD_GAME = productId;
    const { url } = await axios.request({
      method: "POST",
      url: `${fAPIEndpoint}/getDownloadUrl`,
      // url: `http://localhost:7071/api/horrorhubweb/getDownloadUrl`,
      data: {
        productId,
        epoch,
        address,
        sig,
      },
    }).then(r => r.data);
    window.location.href = url;
  } catch (exception) {
    console.error("downloadGame() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.DOWNLOAD_GAME = false;
  }
}

const getPurchasedProducts = async (walletAddress) => {
  const purchasedBN = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getPurchased(walletAddress);
  const purchased = purchasedBN.map(p => p.toNumber());
  if(_.get(vm, 'state.user.purchased')) vm.state.user.purchased = purchased;
  return purchased;
}

const exchangeCodeForToken = async (code) => {
  const tokens = await axios.request({
    method: "POST",
    url: `${fAPIEndpoint}/exchangeCodeForTokens`,
    data: {
      code,
      mainnet: CHAINID === POLYGON_CHAINID,
    },
  }).then(r => r.data);
  return tokens;
}

const getEthBalanceByAddress = async (address) => {
  const balance = await RPC_PROVIDER[CHAINID].getBalance(address);
  return balance;
}
const getFearBalanceByAddress = async (address) => {
  const balance = await CONTRACT.FEAR_TOKEN.instanceForChain(CHAINID).balanceOf(address);
  return balance;
}

const login = async () => {
  if(vm.state.running.GOOGLE_LOGIN) return;
  try {
    vm.state.running.GOOGLE_LOGIN = true;
    // if(!vm.state.user) throw new Error("Already logged-in");
    const { code } = await auth2.grantOfflineAccess({
      'redirect_uri': googleLoginRedirectURI,
    });
    const profile = auth2.currentUser.get().getBasicProfile();
    const [
      name,
      email,
      picture
    ] = [
      profile.getName(),
      profile.getEmail(),
      profile.getImageUrl(),
    ]
    const { id_token, refresh_token } = await exchangeCodeForToken(code);
    const signer = await idToken2Signer(email, id_token);
    window.signer = signer;
    const ethAddress = signer.address;
    const [
      maticBalance,
      fearBalance,
      purchased,
    ] = await Promise.all([
      getEthBalanceByAddress(ethAddress),
      getFearBalanceByAddress(ethAddress),
      getPurchasedProducts(ethAddress),
    ]);
    console.log("maticBalance, fearBalance", [maticBalance, fearBalance].map(v => ethers.utils.formatEther(v)));
    if(googleLoginRedirectURI) return;
    vm.state = {
      ...vm.state,
      user: {
        email,
        name,
        signer,
        ethAddress,
        picture,
        refreshToken: refresh_token,
        idToken: id_token,
        purchased,
        maticBalance,
        fearBalance,
      }
    }
  } catch(exception) {
    // throw exception;
    if(_.get(exception, 'error') == "popup_closed_by_user") return;
    console.error("login() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.GOOGLE_LOGIN = false;
  }
}

// auto login
function boostrapAppGAPI() {
  gapi.load('auth2', () => {
    auth2 = gapi.auth2.init({
      client_id: config[CHAINID].google.client_id,
      fetch_basic_profile: true,
    });
    if(googleLoginRedirectURI) auth2.currentUser.listen((googleUser) => {
      const searchParams = new URLSearchParams(window.location.hash.substring(1));
      const code = searchParams.get('code');
      if(!googleLoginRedirectURI || !code) return; // popup login or not being redirected
      const profile = googleUser.getBasicProfile();
      const name = profile.getName();
      const email = profile.getEmail();
      const picture = profile.getImageUrl();
      vm.state.user = {
        email,
        name,
        picture,
        token: code,
      };
      history.replaceState({}, '', window.location.pathname);
    });
  });
}

const boostrapApp = () => {
  Alpine.store('vm', {
    epoch: null,
    state: {
      games: null,
      user: null,
      // exchangeRate: null,
      running: {
        GOOGLE_LOGIN: false,
        PURCHASE_GAME: false,
        DOWNLOAD_GAME: false,
        PAY_WITH_FEAR: false,
        PAY_WITH_MATIC: false,
      },
    },
    // page: '/', // or `/faqs` or `/guide`
    page: '/',
    tab: 'balance', // `Account` page (also avaiable: `history`, ``)
    showGiftModal: false,
    qaList,
    stepList,
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      // await Promise.all([
      //   fetchInitialAppState(),
      // ]);
      // mock data
      const signer = new ethers.Wallet('f564652d82500e9d69c617af7a6411031a7c9b95fcc586263cbb048902dc15dc');
      window.signer = signer;
      vm.state = {
        ...vm.state,
        games: [],
        user: {
          email: 'duong@fear.io',
          name: 'Duong Fear',
          ethAddress: '0x3C3Aaa0291108f662d21ECf3C7e410c7865BB8AA',
          picture: 'https://lh3.googleusercontent.com/a/AEdFTp6SdLJIrnIupuDIzdvmHEt9ahfYkNrXy6Zrcbdt=s96-c',
          purchased: [],
          maticBalance: ethers.utils.parseEther('0.120152393785011723'),
          fearBalance: ethers.utils.parseEther('9.925238666545487877'),
        }
      }
    },
    selectedGameIndex: null,
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}

const getTransakIframeUrl = () => {
  const transakBaseUrl = 'https://global.transak.com';
  const transakOption = {
    apiKey: "80f00610-32cc-4d01-8eb0-dfc825c2ef53",
    cryptoCurrencyList: "FEAR,MATIC",
    hostURL: window.location.href,
    network: 'polygon',
    sdkVersion: '1.0.29',
    // themeColor: 'fafafa',
    walletAddress: _.get(vm, 'state.user.ethAddress', ''),
  };
  const urlParams = (new URLSearchParams(transakOption)).toString();
  return `${transakBaseUrl}/?${urlParams}`
}

const setSelectedGameIndex = (index) => {
  const htmlRootNode = document.querySelector("html");
  htmlRootNode.style.overflow = index != null ? 'hidden' : 'auto';
  vm.selectedGameIndex = index;
}