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
const BICONOMY_FEAR_METATRANSACTION_APPID = {
  [POLYGON_CHAINID]: 'dea3e094-2ff5-4190-9b07-f15885cdaf8d',
  [MUMBAI_CHAINID]: '',
}

const RPC_PROVIDER = {
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}

const getRecommendedGasPrice = async () => {
  // +25% to base gas price to get recommended gas price
  const gasPrice = (await RPC_PROVIDER[CHAINID].getGasPrice()).mul(125).div(100);
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

const biconomyExecTransaction = async (apiId, params, gasLimit) => {
  const { data } = await axios.post(
    biconomyNativeTxEndpoint,
    {
      userAddress: vm.state.user.ethAddress,
      apiId,
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
    functionSignature: transferSignature,
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

const getReviewsForProduct = async _productId => {
  vm.state.reviews = null;
  const productId = _productId || +vm.page || 0;
  const url = `${fAPIEndpoint}/productReview/${productId}`;
  const _reviews = await axios.request({
    method: "GET",
    url,
  }).then(r => r.data);
  if(!_productId) vm.state.reviews = _reviews;
  return _reviews;
}

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

const refreshUserStats = async () => {
  const { ethAddress } = vm.state.user;
  const [
    maticBalance,
    fearBalance,
    // purchased,
  ] = await Promise.all([
    getEthBalanceByAddress(ethAddress),
    getFearBalanceByAddress(ethAddress),
    // getPurchasedProducts(ethAddress),
  ]);
  vm.state.user.maticBalance = maticBalance;
  vm.state.user.fearBalance = fearBalance;
  // vm.state.user.purchased = purchased;
}

const fetchInitialAppState = async () => {  
  const [
    priceForAllProducts,
    { productList },
    exchangeRate,
  ] = await Promise.all([
    getPriceForAllProducts(),
    getProductList(),
    getExchangeRate(),
  ]);
  vm.state.exchangeRate = exchangeRate;
  const games = productList.map(p => ({
    ...p,
    id: +p.rowKey,
    priceUsd: formatEther( priceForAllProducts[+p.rowKey].usd ),
    priceMatic: formatEther( priceForAllProducts[+p.rowKey].matic ),
    priceFear: formatEther( priceForAllProducts[+p.rowKey].fear ),
  }));
  games.forEach(product => {
    games[`_${product.id}`] = product;
  });
  vm.state.games = games;
}

const getExchangeRate = async () => {
  const [fear2Usd, matic2Usd] = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getExchangeRate();
  return {
    fear2Usd,
    matic2Usd,
  };
}

const getProductList = async () => {
  return await axios.get(`${fAPIEndpoint}/getProductList`).then(r => r.data);
}

const qaList = [
  {
    q: "Who or What is FEAR?",
    a: "FEAR is a horror gaming company owned by <b>Netcreeper Media Ltd</b>. Netcreeper Media is owned by brothers <b>Patrick</b> and <b>Jonathan Carey</b> who have been involved in the game development and publishing industry for over two decades.<br/>The most notable games developed and published by Netcreeper are the famous <b>Whack IT</b> games - a series of dark humored horror games which went viral in 2015 accruing over 300 million combined views, downloads and interactions.",
    opened: false,
  },
  {
    q: "What is the Horror Hub?",
    a: "A place where horror fans and gamers can gather to experience the most viral, horrific and hilarious FEAR games, films and animations. Later editions will allow the sharing and reviewing of FEAR content and beyond in the outer horror world!<br/>The Horror Hub is first launching for mobile web and Windows/MAC desktops and will later launch on the playstore and apple store.<br/>FEAR develops and owns all the property and rights of the Horror Hub and promises never to censor or water down the content on our platform. We own the platform and therefore our content is not owned BY the platform!",
    opened: false,
  },
  {
    q: "Why aren't your games in the play store?",
    a: "The Whack It games available at the launch of the horror hub are not available in the playstore because they were previously banned or censored by Google because of their crazy or violent content.<br/>We have since begun to bring out updated games that are less shocking and these will become available in the playstore. However the originals are in our opinion the best and can be accessed through the Horror Hub!<br/>Some of our other games we look to monetise in game content using our FEAR crypto currency and NFTs and Google policies are not clear around this area. Until policy and regulation settles down any games blockchain related will remain exclusively available in our Horror Hub!",
    opened: false,
  },
  {
    q: "Crypto currency and NFTs you say... Aren't they all scams or risky things to purchase?",
    a: "When you buy our games in the Horror Hub you don't have to hold our FEAR crypto currency. You simply top up your FEAR balance to the correct amount of USD and use it to purchase our games.<br/>In addition FEAR crypto currency is owned and supported by Netcreeper Media Ltd. We are a two decade old company famous for publishing casual horror games with a sterling reputation for transparency and honesty!<br/>You can find us cited in many notable online publications including <a class='font-bold text-cyan-400' href='https://forbes.mc/article/bravely-walking-into-the-world-of-fear' target='_blank'>Forbes</a> and <a class='font-bold text-cyan-400' href='https://cointelegraph.com/news/horror-gaming-project-integrates-metaverse-nfts-and-p2e-to-cause-extreme-fear' target='_blank'>CoinTelegraph</a>.",
    opened: false,
  },
  {
    q: "If I do wish to own FEAR crypto currency what are the benefits?",
    a: "All our blockchain related content requires FEAR to be purchased. This means eventually our token may become rarer depending on the demand of our games and film media. By holding a small amount of FEAR you may also become entitled to exclusive benefits such as unique in-game asset ownership and content made exclusively available to FEAR holders.<br/>Please note this is not financial advice nor do we promote in anyway owning our token as an investment.",
    opened: false,
  },
  {
    q: "Is it safe to purchase games using my credit card and who are Transak?",
    a: "Yes. Our credit card purchases are handled on our behalf by Transak - One of the largest crypto payment processes in the world who work with blue chip blockchain gaming firms such as FEAR, Sand and Decentraland.<br/>When you make your purchase there'll be a slight delay before your FEAR balance is credited. At which point you can purchase our games. All payments you make are tracked in our Horror Hub under <b>Account</b> -> <b>Payment History</b> section so you can check back on the progress of your payment.",
    opened: false,
    showBuyButton: true,
  },
  {
    q: "Why is the minimum credit card purchase $30",
    a: "Crypto payment processing via credit card/bank transfer is still a little on the costly side due to increasing regulation and a shifting landscape in blockchain technology. Our partner Transak is working hard to bring the minimum spending requirement down to a lower level.<br/>However for now we have a feature whereby you can gift your FEAR credit to friends and other gamers via their google email.<br/>We also will be offering cashback bundles on FEAR purchases of a certain amount.",
    opened: false,
  },
  {
    q: "How do I install an APK?",
    a: "Our games are not provided through the Play Store and therefore your android phone will not recognise the source of the games. In order to allow the games to be installed you must allow installs from unknown sources. This is common practice for third party game publishers providing games on market places outside of the Play Store.<br/>Follow the guide below to enable installs from unknown sources:<br/><a class='font-bold text-cyan-400' href='https://blog.appaloosa.io/en/guides/how-to-install-apps-from-unknown-sources-in-android' target='_blank'>https://blog.appaloosa.io/en/guides/how-to-install-apps-from-unknown-sources-in-android</a>",
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
    if(priceFearBN.gt(fearBalance)) {
      setTimeout(() => {
        vm.selectedGameIndex = null;
        vm.page = '/account';
        vm.tab = 'buy';
      }, 0)
      throw new Error("Insufficient FEAR balance");
    }
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
    const gasPrice = await getRecommendedGasPrice();
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
      BICONOMY_PURCHASE_BY_FEAR_TRANSFER_APPID[CHAINID],
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
    await refreshUserStats();
    fearSuccess(`You owned '${name}'`, {
      title: "Payment Successful",
    });
  } catch(exception) {
    console.error("payWithFear() error", exception);
    fearError(getExceptionDetails(exception).message);
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
    if(priceMaticBN.gt(maticBalance)) {
      setTimeout(() => {
        vm.selectedGameIndex = null;
        vm.page = '/account';
        vm.tab = 'buy';
      }, 0)
      throw new Error("Insufficient MATIC balance");
    }
    const confirmed = await fearConfirm(
      `Are you sure want to pay ${priceMatic} $MATIC to buy "${name}"?`
    );
    if(!confirmed) return;
    const gasPrice = await getRecommendedGasPrice();
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
    await refreshUserStats();
    fearSuccess(`You owned '${name}'`, {
      title: "Payment Successful",
    });
  } catch(exception) {
    console.error("payWithMatic() error", exception);
    fearError(getExceptionDetails(exception).message);
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

const _transakPurchaseHistory = [
  {
    "id":"9151faa1-e69b-4a36-b959-3c4f894afb68",
    // "walletAddress":"0x86349020e9394b2BE1b1262531B0C3335fc32F20",
    "createdAt": 1671304939,
    "status": "COMPLETED",
    "fiatCurrency": "USD",
    "userId": "65317131-cd95-419a-a50c-747d142f83e9",
    "cryptocurrency": "MATIC",
    "isBuyOrSell": "BUY",
    "fiatAmount": 30,
    "commissionDecimal": 0.0075,
    // "fromWalletAddress":"0x085ee67132ec4297b85ed5d1b4c65424d36fda7d",
    // "walletLink":"https://rinkeby.etherscan.io/address/0x86349020e9394b2BE1b1262531B0C3335fc32F20#tokentxns",
    "amountPaid": 30,
    // "partnerOrderId":"2183721893",
    // "partnerCustomerId":"2183721893",
    // "redirectURL":"https://google.com",
    "conversionPrice": 0.071,
    "cryptoAmount": 36.3,
    "totalFee": 5.52652,
    "paymentOption":[],
    "autoExpiresAt": 1671304939,
    "referenceCode": 226056
  },
  {
    "id":"9151faa1-e69b-4a36-b959-3c4f894afb68",
    // "walletAddress":"0x86349020e9394b2BE1b1262531B0C3335fc32F20",
    "createdAt": 1671341339,
    "status": "AWAITING_PAYMENT_FROM_USER",
    "fiatCurrency": "USD",
    "userId": "65317131-cd95-419a-a50c-747d142f83e9",
    "cryptocurrency": "FEAR",
    "isBuyOrSell": "BUY",
    "fiatAmount": 50,
    "commissionDecimal": 0.0075,
    // "fromWalletAddress":"0x085ee67132ec4297b85ed5d1b4c65424d36fda7d",
    // "walletLink":"https://rinkeby.etherscan.io/address/0x86349020e9394b2BE1b1262531B0C3335fc32F20#tokentxns",
    "amountPaid": 0,
    "partnerOrderId":"2183721893",
    "partnerCustomerId":"2183721893",
    // "redirectURL":"https://google.com",
    "conversionPrice": 0.071,
    "cryptoAmount": 681.2,
    "totalFee": 5.52652,
    "paymentOption":[],
    "autoExpiresAt": 1671344939,
    "referenceCode": 226056
  }
];

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
        transakPurchaseHistory: _transakPurchaseHistory,
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

const lookupEthAddressGiftModal = async () => {
  vm.state.running.GIFT_MODAL_FIND_ETH_ADDRESS = true;
  try {
    if(!isValidEmailAddress(vm.state.giftModal.email)) throw new Error("Please input a valid email address");
    vm.state.giftModal.ethAddress = '';
    const verifier = config[CHAINID].torus.verifier;
    const network = config[CHAINID].torus.network;
    const verifierId = vm.state.giftModal.email;
    const pubAddress = await email2TorusAddress(network, verifier, verifierId);
    vm.state.giftModal.ethAddress = pubAddress;
    setGiftToken('fear');
  } catch(exception) {
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.GIFT_MODAL_FIND_ETH_ADDRESS = false;
  }
}

const sendFear = async (toAddress, amountBN) => {
  const { functionSignature, r, s, v, } = await generateFearTransferMetaSignature(
    toAddress,
    amountBN,
  );
  const estGasLimit = await CONTRACT.FEAR_TOKEN.instanceForChain(CHAINID).estimateGas.executeMetaTransaction(
    vm.state.user.ethAddress,
    functionSignature,
    r,
    s,
    v,
  );
  const gasLimit = estGasLimit.mul(120).div(100);
  const txHash = await biconomyExecTransaction(
    BICONOMY_FEAR_METATRANSACTION_APPID[CHAINID],
    [
      vm.state.user.ethAddress,
      functionSignature,
      r,
      s,
      v,
    ],
    gasLimit.toNumber(),
  );
  return txHash;
}

const sendGift = async () => {
  try {
    vm.state.running.GIFT_MODAL_SEND = true;
    const { fearBalance, maticBalance } = vm.state.user;
    const { email, token, amount, ethAddress } = vm.state.giftModal;
    if(!ethers.utils.isAddress(ethAddress)) throw new Error("Invalid recipient address");
    if(!isValidEtherAmount(amount)) throw new Error("Invalid send amount");
    const amountBN = ethers.utils.parseEther(amount);
    if(token === 'fear') {
      if(amountBN.gt(fearBalance)) return fearError("Insufficient $FEAR balance");
      const confirmed = await fearConfirm('Are you sure ?', `You are sending ${formatEther(amountBN)} $FEAR to "${email}"`);
      if(!confirmed) return;
      const txHash = await sendFear(ethAddress, amountBN);
      fearSuccess(`You sent ${formatEther(amountBN)} $FEAR to "${email}"`);
    }
    if(token === 'matic') {
      if(amountBN.gt(maticBalance)) {
        return fearError("Insufficient $MATIC balance");
      }
      const ETH_TRANSFER_GAS_LIMIT = ethers.BigNumber.from(21_000);
      const gasPrice = await getRecommendedGasPrice();
      const gasFeeBN = gasPrice.mul(ETH_TRANSFER_GAS_LIMIT);
      if(!amountBN.gt(gasFeeBN)) {
        return fearError(`Send amount must greater than ${formatEther(gasFeeBN)} $MATIC to cover network fee`);
      }
      const transferAmountBN = amountBN.sub(gasFeeBN);
      const confirmed = await fearConfirm('Are you sure ?', `You are sending ${formatEther(amountBN)} $MATIC to "${email}", your friend will receive ${formatEther(transferAmountBN)} $MATIC (network fee included)`);
      if(!confirmed) return;
      const tx = await window.signer.sendTransaction({
        to: ethAddress,
        value: transferAmountBN,
        gasPrice,
        gasLimit: ETH_TRANSFER_GAS_LIMIT,
      });
      console.log(`tx hash`, tx.hash);
      await tx.wait();
      fearSuccess(`You sent ${formatEther(amountBN)} $MATIC to "${email}"`);
    }
    await refreshUserStats();
  } catch(exception) {
    console.error("sendGift() error", exception);
    fearError(getExceptionDetails(exception));
  }
  finally {
    vm.state.running.GIFT_MODAL_SEND = false;
  }
}

const setGiftToken = (token) => {
  vm.state.giftModal.token = token;
  if(token === 'fear') vm.state.giftModal.amount = formatEther(vm.state.user.fearBalance);
  if(token === 'matic') vm.state.giftModal.amount = formatEther(vm.state.user.maticBalance);
}

const _giftModal = {
  visible: false,
  email: null,
  ethAddress: null,
  amount: null,
  token: null, // 'fear' or 'matic'
};

const refreshTransakPurchaseHistory = async () => {
  vm.state.user.transakPurchaseHistory = null;
  const { ethAddress } = vm.state.user;
  // const ethAddress = '0x6f59e2b0b7d0d68ed7c733ff8f84e33d8aa4e647';
  const { orders } = await axios.request({
    method: "GET",
    url: `https://fearapi.azurewebsites.net/api/toolbox/orderHistory/${ethAddress}`,
  }).then(r => r.data);
  vm.state.user.transakPurchaseHistory = orders.sort((x, y) => {
    const dx = dayjs(x.createdAt);
    const dy = dayjs(y.createdAt);
    if(dx.isBefore(dy)) return -1;
    if(dx.isAfter(dy)) return 1;
    return 0;
  }).reverse();
}

const showTransakHistoryTab = () => {
  refreshTransakPurchaseHistory();
  vm.tab = 'history';
}

const boostrapApp = () => {
  Alpine.store('vm', {
    epoch: null,
    state: {
      exchangeRate: null,
      games: null,
      user: null,
      reviews: null,
      giftModal: { ..._giftModal },
      running: {
        GOOGLE_LOGIN: false,
        PURCHASE_GAME: false,
        DOWNLOAD_GAME: false,
        PAY_WITH_FEAR: false,
        PAY_WITH_MATIC: false,
        GIFT_MODAL_FIND_ETH_ADDRESS: false,
        GIFT_MODAL_SEND: false,
      },
    },
    page: '/', // '/' or `/faqs` or `/guide` or `:productId` (product page)
    tab: 'balance', // `Account` page (also avaiable: `history`, ``)
    showGiftModal: false,
    qaList,
    stepList,
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      await Promise.all([
        // fetchInitialAppState(),
      ]);
      // mock data
      const signer = (new ethers.Wallet('f564652d82500e9d69c617af7a6411031a7c9b95fcc586263cbb048902dc15dc')).connect(RPC_PROVIDER[CHAINID]);
      const games = JSON.parse(`[{"etag":"W/\\"datetime'2022-12-11T03%3A31%3A27.3141724Z'\\"","partitionKey":"game","rowKey":"1","timestamp":"2022-12-11T03:31:27.3141724Z","description":"Clucking Hell is a live action survival game where you need to defend yourself and farm land from paraytical flesh eating animals and humans!","isAndroidGame":false,"isDesktopGame":false,"isWebGame":true,"name":"Clucking Hell","splash":"https://www.fear.io/images/games/clucking-hell/clucking-hell-portrait-1.jpg","url":"https://www.fear.io/games/clucking-hell/","id":1,"priceUsd":"0.01","priceMatic":"0.010995318","priceFear":"0.1166301657"},{"etag":"W/\\"datetime'2022-12-11T03%3A32%3A18.6395807Z'\\"","partitionKey":"game","rowKey":"2","timestamp":"2022-12-11T03:32:18.6395807Z","description":"Whack Your Undead Neighbour is the crazy interactive animation by Whack It Games soaked in blood and watched by an audience of millions of blood thirsty viewers. Watch as everyone's favourite violent family, Patrick, Lisa and Whisky embark upon a killing spree taking out their zombie neighbour and granny to boot!","isAndroidGame":true,"isDesktopGame":false,"isWebGame":false,"name":"Whack Your Undead Neighbour","splash":"https://www.fear.io/images/games/wyun/wyun-square.png","url":"https://www.fear.io/games/wyun/","id":2,"priceUsd":"0.02","priceMatic":"0.021990636","priceFear":"0.2332603314"},{"etag":"W/\\"datetime'2022-12-11T03%3A26%3A43.9867384Z'\\"","partitionKey":"game","rowKey":"3","timestamp":"2022-12-11T03:26:43.9867384Z","description":"The Crypt is a devious idle farming and management game being developed for Fear by Evil Twin Studio coming in Q3 2022 to PC and Android. The player becomes a Crypt Keeper in the Underworld.\\\\nYou summon evil characters from the depths of hell to harvest dark resources and capture human souls. These humans are in return tormented through various soul harvesting devices in the crypts to summon new evil and demonic creatures.\\\\nA first of it's kind \\"farming\\" game, you will be able to collect \\"Souls\\" while your sleeping by relying on your Evil Demon Overseers to keep harvesting while your offline. You will have a chance to convert those souls into our real tokens.","isAndroidGame":false,"isDesktopGame":true,"isWebGame":false,"name":"The Crypt","splash":"https://www.fear.io/images/games/the-crypt/the-crypt-square.jpg","url":"https://www.fear.io/games/the-crypt/","id":3,"priceUsd":"0.05","priceMatic":"0.05497659","priceFear":"0.5831508285"},{"etag":"W/\\"datetime'2022-12-11T03%3A27%3A42.9409807Z'\\"","partitionKey":"game","rowKey":"4","timestamp":"2022-12-11T03:27:42.9409807Z","name":"Araya","description":"Araya is a 3D action horror game coming to the Fear ecosystem with 50 million Youtube views and millions of players made by Mad VR Studios.\\\\n Originally known for its fame on Steam as a serious creepy jump scare game, we have converted this unique horror survival title into an experience where gamers have the chance to earn FEAR tokens by progressing in the game. But be warned, it won't be easy to solve the puzzles and survive the underlying evil that is haunting the hospital!","url":"https://www.fear.io/games/araya/","isDesktopGame":true,"isWebGame":false,"isAndroidGame":false,"splash":"https://www.fear.io/images/games/araya/araya-square.jpg","id":4,"priceUsd":"0.1","priceMatic":"0.109953181","priceFear":"1.166301657"}]`);
      games.forEach(g => {
        games[`_${g.id}`] = g;
      })
      window.signer = signer;
      vm.state = {
        ...vm.state,
        games,
        user: {
          email: 'duong@fear.io',
          name: 'Duong Fear',
          ethAddress: '0x3C3Aaa0291108f662d21ECf3C7e410c7865BB8AA',
          picture: 'https://lh3.googleusercontent.com/a/AEdFTp6SdLJIrnIupuDIzdvmHEt9ahfYkNrXy6Zrcbdt=s96-c',
          purchased: [1,2,3],
          maticBalance: ethers.utils.parseEther('0.120152393785011723'),
          fearBalance: ethers.utils.parseEther('9.925238666545487877'),
          transakPurchaseHistory: null,
        },
        exchangeRate: {
          fear2Usd: ethers.utils.parseEther('0.077'),
          matic2Usd: ethers.utils.parseEther('0.8'),
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
  const { email } = vm.state.user;
  const transakOption = {
    apiKey: "80f00610-32cc-4d01-8eb0-dfc825c2ef53",
    cryptoCurrencyList: "FEAR,MATIC",
    hostURL: window.location.href,
    network: 'polygon',
    sdkVersion: '1.0.29',
    // themeColor: 'fafafa',
    walletAddress: _.get(vm, 'state.user.ethAddress', ''),
    email,
    isAutoFillUserData: true,
  };
  const urlParams = (new URLSearchParams(transakOption)).toString();
  return `${transakBaseUrl}/?${urlParams}`
}

const ORDER_STATUS_CLASSES_ENUM = {
  COMPLETED: 'text-green-500 font-bold',
  FAILED: 'text-red-500 font-bold',
  EXPIRED: 'text-red-500 font-bold',
  PROCESSING: 'text-yellow-500 font-bold',
  PENDING_DELIVERY_FROM_TRANSAK: 'text-cyan-500 font-bold',
  PAYMENT_DONE_MARKED_BY_USER: 'text-blue-500 font-bold',
  CANCELLED: 'text-red-500 font-bold',
  AWAITING_PAYMENT_FROM_USER: 'text-neutral-300 font-bold',
}

const setSelectedGameIndex = (index) => {
  const htmlRootNode = document.querySelector("html");
  htmlRootNode.style.overflow = index != null ? 'hidden' : 'auto';
  setTimeout(() => {
    vm.selectedGameIndex = index;
  }, 0)
}

const getNetworth = () => {
  try {
    const OneEtherBN = ethers.utils.parseUnits('1', 'ether');
    const { fear2Usd, matic2Usd } = vm.state.exchangeRate;
    const { fearBalance, maticBalance } = vm.state.user;
    const networthBN = fear2Usd.mul(fearBalance).div(OneEtherBN).add( matic2Usd.mul(maticBalance).div(OneEtherBN) );
    return `$ ${formatEtherHuman(networthBN)}`;
  } catch {
    return '$ n/a';
  }
}

// UI event handler
const uiOpenTokenPurchase = () => {
  setTimeout(() => {
    vm.page = '/account';
    vm.tab = 'buy';
    vm.selectedGameIndex = null;
  }, 0)
}

const copyAddress2Clipboard = () => {
  var clipboard = new ClipboardJS('#ethAddress');
  clipboard.on('success', () => {
    fearSuccess("Address copied to clipboard");
  });
  document.getElementById('ethAddress').click();
}

// MOCK DATA
const product = {
  title: 'Clucking Hell',
  description: `My Hotpot Restaurant is a Restaurant Management game.<br/>
  In this game you will play the role of a hot pot restaurant owner, developing various hot pot dishes, making daily purchase plans, serving customers, training chefs and waiters, purchasing restaurant stuffs, opening a chain of stores, etc.<br/>
  <b>Game features</b><br/>
  1、Multiple ways to run the business freely.<br/>
  2、Feel the fun of running a hot pot restaurant and enjoy all kinds of delicious food,Especially Chinese ingredients.<br/>`,
  rating: 5, // up to 5
  reviews: [
    {
      name: 'Ciny',
      email: 'ciny@gmail.com',
      avatar: 'https://play-lh.googleusercontent.com/a-/AD5-WCk-zZqTuYvAFI9DgwCu-jNV_yTTI9LwYaWvDeyW=s32-rw',
      content: 'this game is awesome',
      time: 'November 26, 2022',
      rating: 5,
    },
    {
      author: 'Chao',
      avatar: 'https://play-lh.googleusercontent.com/a-/AD5-WCm2rJMne_5vAJNWzLzvbBYMwqRPBUor_kEvcVry1g=s32-rw',
      content: 'I absolutely love this game',
      date: 'November 26, 2022',
      rating: 5,
      email: '',
    },
    {
      author: 'Ashley Johnston',
      avatar: 'https://play-lh.googleusercontent.com/a-/AD5-WCmXXCO4inYUeHd7NKC9_zQwJDG9uxv0pMX3WPm5UQ=s32-rw',
      content: "For the most part this is a fun game. It's aesthetic and the ads are unobtrusive. The biggest downside is that sometimes when you watch an ad to get gems the game will freeze and not give you the gems after you've already watched the ad. I find the ad issue frustrating but not enough to quit playing...it just takes more time to build up your restaurant.",
      date: 'November 27, 2022',
      rating: 4,
      email: '',
    }
  ],
}