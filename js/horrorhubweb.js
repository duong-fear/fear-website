// config
const googleLoginRedirectURI = undefined; //window.location.href
const fAPIEndpoint = `https://fearapi.azurewebsites.net/api/horrorhubweb`;
// const fAPIEndpoint = `http://localhost:7071/api/horrorhubweb`;

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

const formatEther = input => input instanceof ethers.BigNumber ? ethers.utils.formatEther(input).replace(/.0$/, '') : 'n/a';

const RPC_URL = {
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const RPC_PROVIDER = {
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}

const getRecommendedGasPrice = async (chainId) => {
  // +25% to base gas price to get recommended gas price
  return (await RPC_PROVIDER[chainId].getGasPrice()).mul(125).div(100);
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
    [POLYGON_CHAINID]: "0xfc4ac3c8961363ca5df6157c3fa4ef2d94bc318b",
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
    resolve(new ethers.Wallet(privKey))
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
    const { fearBalance } = vm.state.user;
    const { name, priceFear } = vm.state.games.find(g => g.id == productId);
    const priceFearBN = ethers.utils.parseEther(priceFear);
    if(priceFearBN.gt(fearBalance)) throw new Error("Insufficient FEAR balance");
    // const purchased = await getPurchasedGames(vm.state.user.refreshToken);
    vm.state.user.purchased = [];
    if(vm.state.user.purchased.includes(productId)) throw new Error("Product already purchased");
    const confirmed = await fearConfirm(
      `Are you sure want to pay ${priceFear} $FEAR to buy "${name}"?`
    );
    if(!confirmed) return;
    await sleep(1);
    // or refresh the purchased array
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
    const { name, priceMatic } = vm.state.games.find(g => g.id == productId);
    const { maticBalance } = vm.state.user;
    const priceMaticBN = ethers.utils.parseEther(priceMatic);
    // const purchased = await getPurchasedGames(vm.state.user.refreshToken);
    vm.state.user.purchased = [];
    if(vm.state.user.purchased.includes(productId)) throw new Error("Product already purchased");
    if(priceMaticBN.gt(maticBalance)) throw new Error("Insufficient MATIC balance");
    const confirmed = await fearConfirm(
      `Are you sure want to pay ${priceMatic} $MATIC to buy "${name}"?`
    );
    if(!confirmed) return;
    const gasPrice = await getRecommendedGasPrice(CHAINID);
    const estGasLimit = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(137).estimateGas.purchaseByMatic(productId, {
      value: priceMaticBN,
    })
    // +10% for est. gas limit
    const gasLimit = estGasLimit.mul(110).div(100);
    const gasFee = gasLimit.mul(gasPrice);
    console.log(`gasFee`, gasFee);
    // const tx = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(137).purchaseByMatic(
    //   productId,
    //   {
    //     value: priceMaticBN.sub(gasFee),
    //   },
    // )
    // await tx.wait();
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
    vm.state.running.DOWNLOAD_GAME = productId;
    const { url } = await axios.request({
      method: "POST",
      url: `https://fearapi.azurewebsites.net/api/horrorhubweb/getDownloadUrl`,
      data: {
        productId,
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

const getPurchasedGames = async (refresh_token) => {
  // const { purchased } = await axios.request({
  //   method: "POST",
  //   url: `https://fearapi.azurewebsites.net/api/horrorhubweb/getPurchased`,
  //   data: {
  //     token: refresh_token,
  //   },
  // }).then(r => r.data);
  return [];
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
const getOwnedProductsByAddress = async (address) => {
  const owned = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getPurchased(address);
  return owned;
}

const getMappedEthAddress = async (email) => {
  // const { address } = await axios.request({
  //   method: "POST",
  //   url: `${fAPIEndpoint}/exchangeEmailForEthAddress`,
  //   data: {
  //     email,
  //   },
  // }).then(r => r.data);
  // await sleep(0.2);
  return "0x3C3Aaa0291108f662d21ECf3C7e410c7865BB8AA";
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
    window.signer = idToken2Signer(email, id_token);
    const ethAddress = getMappedEthAddress(email);
    const [
      maticBalance,
      fearBalance,
      ownedProducts,
    ] = await Promise.all([
      getEthBalanceByAddress(ethAddress),
      getFearBalanceByAddress(ethAddress),
      getOwnedProductsByAddress(ethAddress),
    ]);
    console.log("maticBalance, fearBalance", [maticBalance, fearBalance].map(v => ethers.utils.formatEther(v)));
    console.log(`ownedProducts`, ownedProducts);
    if(googleLoginRedirectURI) return;
    const purchased = await getPurchasedGames(refresh_token);
    vm.state = {
      ...vm.state,
      user: {
        email,
        name,
        ethAddress,
        picture,
        refreshToken: refresh_token,
        idToken: id_token,
        purchased: purchased,
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
    qaList,
    stepList,
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      await Promise.all([
        fetchInitialAppState(),
      ]);
    },
    selectedGameIndex: null,
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}

const setSelectedGameIndex = (index) => {
  const htmlRootNode = document.querySelector("html");
  htmlRootNode.style.overflow = index != null ? 'hidden' : 'auto';
  vm.selectedGameIndex = index;
}