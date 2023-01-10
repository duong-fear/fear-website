// config
const googleLoginRedirectURI = undefined; //window.location.href
const fAPIEndpoint = `https://fearapi.azurewebsites.net/api/horrorhubweb`;
// const fAPIEndpoint = `http://localhost:7071/api/horrorhubweb`;
const biconomyNativeTxEndpoint = "https://api.biconomy.io/api/v2/meta-tx/native";

const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const CHAINID = MUMBAI_CHAINID;

const ZeroBN = ethers.constants.Zero;

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
      // client_id: "701735735157-pfasbrqls3p9eb8edbn7bjjbsflsqmvk.apps.googleusercontent.com",
      client_id: "701735735157-cdgkv7di5ihom5mdp0pflphvh2p7hjjq.apps.googleusercontent.com",
    },
    torus: {
      network: "mainnet",
      verifier: "fear-wallet-prd",
    },
  }
}

const RPC_URL = {
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};

const BICONOMY_API_KEY = {
  [POLYGON_CHAINID]: 'y9lbpk5lO.40482d7f-f2d5-44e6-a24d-cf898ad97727',
  [MUMBAI_CHAINID]: 'IgDy9onQW.43854a64-3411-4d26-9947-664adaffc913',
}

const BICONOMY_PURCHASE_BY_FEAR_TRANSFER_APPID = {
  [POLYGON_CHAINID]: '',
  [MUMBAI_CHAINID]: 'e2874dd7-def1-4c88-beb7-c233e0151f43',
}
const BICONOMY_FEAR_METATRANSACTION_APPID = {
  [POLYGON_CHAINID]: 'dea3e094-2ff5-4190-9b07-f15885cdaf8d',
  [MUMBAI_CHAINID]: 'caff8745-6960-4921-a25d-86f457b4e936',
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
    [POLYGON_CHAINID]: "",
    [MUMBAI_CHAINID]: '0x9E247845dBAe2F1A76CB8aAD7EBf31E1fb425595',
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
  const message = _.get(data, 'message');
  const flag = _.get(data, 'flag');
  const log = _.get(data, 'log');
  if(txHash) {
    console.log(`biconomy txHash`, txHash);
    await RPC_PROVIDER[CHAINID].waitForTransaction(txHash, 2);
    return txHash;
  }
  throw new Error(error || `unknown biconomy error ( message: ${message} / log: ${log} )`);
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
      {
        signer: (new ethers.Wallet(privKey)).connect(RPC_PROVIDER[CHAINID]),
        pk: privKey,
      }
    )
  } catch(exception) {
    reject(exception);
  }
})

const getReviewsForProduct = async productId => {
  const _reviews = await axios.request({
    method: "GET",
    url: `${fAPIEndpoint}/productReview/${productId}`,
  }).then(r => r.data);
  const reviews = _reviews.map(r => ({
    ...r,
    content: r.content.replace(badWordsPattern, "***"),
  }));
  return reviews;
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
    productList,
    exchangeRate,
    totalSoldStats,
  ] = await Promise.all([
    getPriceForAllProducts(),
    getProductList(),
    getExchangeRate(),
    getTotalSoldStats(),
  ]);
  vm.state.exchangeRate = exchangeRate;
  const games = productList.map(p => {
    const _priceUsd = formatEther( priceForAllProducts[+p.rowKey].usd );
    const { status } = p;

    return {
      ...p,
      id: +p.rowKey,
      priceUsd: status === "FREE" ? 0 : ( status === "COMING_SOON" ? null : _priceUsd),
      priceMatic: formatEther( priceForAllProducts[+p.rowKey].matic ),
      priceFear: formatEther( priceForAllProducts[+p.rowKey].fear ),
      totalSold: totalSoldStats[+p.rowKey],
      images: (p.images || '').trim().split(',').filter(Boolean).map(i => i.trim()) || [],
      videos: (p.videos || '').trim().split(',').filter(Boolean).map(i => i.trim()) || [],
    };
  });
  vm.state.games = _.zipObject(
    games.map(g => g.id),
    games,
  );
  console.log(`vm.state.games`, vm.state.games);
}

const getExchangeRate = async () => {
  const [fear2Usd, matic2Usd] = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getExchangeRate();
  console.log(`fear2Usd = ${formatEther(fear2Usd)} matic2Usd = ${formatEther(matic2Usd)}`);
  return {
    fear2Usd,
    matic2Usd,
  };
}

const getProductList = async (updateState = false) => {
  const { productList } = await axios.get(`${fAPIEndpoint}/getProductList`).then(r => r.data);
  if(updateState) {
    productList.forEach(p => {
      const productId = +p.rowKey;
      vm.state.games[productId].avgRating = p.avgRating;
    })
  }
  return productList;
}

const getTotalSoldStats = async () => {
  const result = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getProductsTotalSold();
  return _.zipObject(...result.map(a => a.map(b => b.toNumber())))
}

const qaList = [
  {
    q: "Who or What is FEAR?",
    a: "FEAR is a horror gaming company owned by <b>Netcreeper Media Ltd</b>. Netcreeper Media is owned by brothers <b>Patrick</b> and <b>Jonathan Carey</b> who have been involved in the game development and publishing industry for over two decades.<br/><br/>The most notable games developed and published by Netcreeper are the famous <b>Whack IT</b> games - a series of dark humored horror games which went viral in 2015 accruing over 300 million combined views, downloads and interactions.",
    opened: false,
  },
  {
    q: "What is the Horror Hub?",
    a: "A place where horror fans and gamers can gather to experience the most viral, horrific and hilarious FEAR games, films and animations. Later editions will allow the sharing and reviewing of FEAR content and beyond in the outer horror world!<br/><br/>The Horror Hub is first launching for mobile web and Windows/MAC desktops and will later launch on the playstore and apple store.<br/><br/>FEAR develops and owns all the property and rights of the Horror Hub and promises never to censor or water down the content on our platform. We own the platform and therefore our content is not owned BY the platform!",
    opened: false,
  },
  {
    q: "Why aren't your games in the play store?",
    a: "The Whack It games available at the launch of the horror hub are not available in the playstore because they were previously banned or censored by Google because of their crazy or violent content.<br/><br/>We have since begun to bring out updated games that are less shocking and these will become available in the playstore. However the originals are in our opinion the best and can be accessed through the Horror Hub!<br/><br/>Some of our other games we look to monetise in game content using our FEAR crypto currency and NFTs and Google policies are not clear around this area. Until policy and regulation settles down any games blockchain related will remain exclusively available in our Horror Hub!",
    opened: false,
  },
  {
    q: "Crypto currency and NFTs you say... Aren't they all scams or risky things to purchase?",
    a: "When you buy our games in the Horror Hub you don't have to hold our FEAR crypto currency. You simply top up your FEAR balance to the correct amount of USD and use it to purchase our games.<br/><br/>In addition FEAR crypto currency is owned and supported by Netcreeper Media Ltd. We are a two decade old company famous for publishing casual horror games with a sterling reputation for transparency and honesty!<br/><br/>You can find us cited in many notable online publications including <a class='font-bold text-cyan-400' href='https://forbes.mc/article/bravely-walking-into-the-world-of-fear' target='_blank'>Forbes</a> and <a class='font-bold text-cyan-400' href='https://cointelegraph.com/news/horror-gaming-project-integrates-metaverse-nfts-and-p2e-to-cause-extreme-fear' target='_blank'>CoinTelegraph</a>.",
    opened: false,
  },
  {
    q: "If I do wish to own FEAR crypto currency what are the benefits?",
    a: "All our blockchain related content requires FEAR to be purchased. This means eventually our token may become rarer depending on the demand of our games and film media. By holding a small amount of FEAR you may also become entitled to exclusive benefits such as unique in-game asset ownership and content made exclusively available to FEAR holders.<br/><br/>Please note this is not financial advice nor do we promote in anyway owning our token as an investment.",
    opened: false,
  },
  {
    q: "Is it safe to purchase games using my credit card and who are Transak?",
    a: "Yes. Our credit card purchases are handled on our behalf by Transak - One of the largest crypto payment processes in the world who work with blue chip blockchain gaming firms such as FEAR, Sand and Decentraland.<br/><br/>When you make your purchase there'll be a slight delay before your FEAR balance is credited. At which point you can purchase our games. All payments you make are tracked in our Horror Hub under <b>Account</b> -> <b>Payment History</b> section so you can check back on the progress of your payment.",
    opened: false,
    showBuyButton: true,
  },
  {
    q: "Why is the minimum credit card purchase $30",
    a: "Crypto payment processing via credit card/bank transfer is still a little on the costly side due to increasing regulation and a shifting landscape in blockchain technology. Our partner Transak is working hard to bring the minimum spending requirement down to a lower level.<br/><br/>However for now we have a feature whereby you can gift your FEAR credit to friends and other gamers via their google email.<br/><br/>We also will be offering cashback bundles on FEAR purchases of a certain amount.",
    opened: false,
  },
  {
    q: "How do I install an APK?",
    a: "Our games are not provided through the Play Store and therefore your android phone will not recognise the source of the games. In order to allow the games to be installed you must allow installs from unknown sources. This is common practice for third party game publishers providing games on market places outside of the Play Store.<br/><br/>Follow the guide below to enable installs from unknown sources:<br/><a class='font-bold text-cyan-400' href='https://blog.appaloosa.io/en/guides/how-to-install-apps-from-unknown-sources-in-android' target='_blank'>https://blog.appaloosa.io/en/guides/how-to-install-apps-from-unknown-sources-in-android</a>",
    opened: false,
  },
];

const payWithFear = async (productId, receiverOptions = {}) => {
  if(vm.state.running.PAY_WITH_FEAR === productId) return;
  try {
    vm.state.running.PAY_WITH_FEAR = productId;
    const { fearBalance, ethAddress, email } = vm.state.user;
    const receiverAddress = _.get(receiverOptions, 'ethAddress', ethAddress);
    const receiverEmail = _.get(receiverOptions, 'email', email); // gift product
    const { name, priceFear, priceUsd } = vm.state.games[productId];
    const priceFearBN = ethers.utils.parseEther(priceFear);
    if(priceFearBN.gt(fearBalance)) {
      const { isConfirmed } = await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: "Insufficient FEAR balance",
        showCancelButton: true,
        cancelButtonText: 'Close',
        showConfirmButton: true,
        confirmButtonText: 'Buy FEAR',
        allowOutsideClick: false,
        reverseButtons: true,
      });
      if(isConfirmed) {
        setTimeout(uiOpenTokenPurchase, 0);
      }
      return;
    }
    const ownedProductByReceiver = await getPurchasedProducts(receiverAddress);
    if(ownedProductByReceiver.includes(productId)) throw new Error("The receiver already owned the product");
    const confirmed = await fearConfirm(
      `Confirm ${receiverEmail == email ? 'Purchase' : 'Gift'} of ${name} ${receiverEmail == email ? '' : `to ${receiverEmail} `}for \$${(+priceUsd).toFixed(2)} (${(+formatEtherHuman(priceFearBN)).toFixed(2)} FEAR) ?`
    );
    if(!confirmed) return;
    const { a, r, s, v, } = await generateFearTransferMetaSignature(
      // should send to fee reciever address
      "0xAf98aE477c5C2394b92aC75767753cbDaF152f12",
      priceFearBN,
    );
    const estGasLimit = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).estimateGas.purchaseByTransferMeta(productId, a, receiverAddress, r, s, v);
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
    // await tx.wait(2);
    // method 2: via biconomy
    await biconomyExecTransaction(
      BICONOMY_PURCHASE_BY_FEAR_TRANSFER_APPID[CHAINID],
      [
        productId,
        a,
        receiverAddress,
        r,
        s,
        v,
      ],
      gasLimit.toNumber(),
    );
    vm.state.games[productId].totalSold += 1;
    if(receiverEmail == email) vm.state.user.purchased.push(productId);
    await refreshBalance();
    fearSuccess(
      receiverEmail == email ? `You purchased ${name}` : `Gift has sent to ${receiverEmail}`,
      {
      title: "Payment Successful",
      },
    );
  } catch(exception) {
    console.error("payWithFear() error", exception);
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.PAY_WITH_FEAR = false;
  }
}

const payWithMatic = async (productId, receiverOptions = {}) => {
  if(vm.state.running.PAY_WITH_MATIC === productId) return;
  try {
    vm.state.running.PAY_WITH_MATIC = productId;
    const signer = window.signer;
    const { name, priceMatic, priceUsd } = vm.state.games[productId];
    const { maticBalance, ethAddress, email } = vm.state.user;
    const receiverAddress = _.get(receiverOptions, 'ethAddress', ethAddress);
    const receiverEmail = _.get(receiverOptions, 'email', email); // gift product
    const priceMaticBN = ethers.utils.parseEther(priceMatic);
    const ownedProductByReceiver = await getPurchasedProducts(receiverAddress);
    if(ownedProductByReceiver.includes(productId)) throw new Error("The receiver already owned the product");
    if(priceMaticBN.gt(maticBalance)) {
      const { isConfirmed } = await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: "Insufficient MATIC balance",
        showCancelButton: true,
        cancelButtonText: 'Close',
        showConfirmButton: true,
        confirmButtonText: 'Buy MATIC',
        allowOutsideClick: false,
        reverseButtons: true,
      });
      if(isConfirmed) {
        setTimeout(uiOpenTokenPurchase, 0);
      }
      return;
    }
    const confirmed = await fearConfirm(
      `Confirm ${receiverEmail === email ? 'Purchase' : 'Gift'} of ${name} ${receiverEmail == email ? '' : `to ${receiverEmail} `}for \$${(+priceUsd).toFixed(2)} (${(+formatEtherHuman(priceMatic)).toFixed(2)} MATIC) ?`
    );
    if(!confirmed) return;
    const gasPrice = await getRecommendedGasPrice();
    const estGasLimit = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).estimateGas.purchaseByMatic(productId, receiverAddress, {
      value: priceMaticBN,
    })
    // +10% for est. gas limit
    const gasLimit = estGasLimit.mul(110).div(100);
    const gasFee = gasLimit.mul(gasPrice);
    console.log(`gasFee`, gasFee);
    const tx = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).connect(signer).purchaseByMatic(
      productId,
      receiverAddress,
      {
        value: priceMaticBN.sub(gasFee),
        gasLimit,
        gasPrice,
      },
    );
    console.log(`payWithMatic txHash`, tx.hash);
    await tx.wait(2);
    if(receiverEmail == email) vm.state.user.purchased.push(productId);
    vm.state.games[productId].totalSold += 1;
    await refreshBalance();
    fearSuccess(
      receiverEmail == email ? `You owned '${name}'` : `Gift has sent to ${receiverEmail}`,
      {
      title: "Payment Successful",
      },
    );
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
    // const signer = window.signer;
    // const address = signer.address
    // const epoch = getEpoch();
    // const sig = await signer.signMessage(`${address}:${epoch}`);
    vm.state.running.DOWNLOAD_GAME = productId;
    // const { url } = await axios.request({
    //   method: "POST",
    //   url: `${fAPIEndpoint}/getDownloadUrl`,
    //   // url: `http://localhost:7071/api/horrorhubweb/getDownloadUrl`,
    //   data: {
    //     productId,
    //     epoch,
    //     address,
    //     sig,
    //   },
    // }).then(r => r.data);
    // window.location.href = url;
    await sleep(1);
    window.location.href = 'https://f004.backblazeb2.com/file/fear-public/2048/2048_3.0.apk';
  } catch (exception) {
    console.error("downloadGame() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.DOWNLOAD_GAME = false;
  }
}

const getPurchasedProducts = async (ethAddress) => {
  const purchasedBN = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getPurchased(ethAddress);
  const purchased = purchasedBN.map(p => p.toNumber());
  return purchased;
}

const exchangeCodeForToken = async (code) => {
  const tokens = await axios.request({
    method: "POST",
    url: `${fAPIEndpoint}/exchangeCodeForTokens`,
    data: {
      code,
      mainnet: true,
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
  if(vm.state.running.GOOGLE_LOGIN || vm.state.user) return;
  try {
    vm.state.running.GOOGLE_LOGIN = true;
    // if(!vm.state.user) throw new Error("Already logged-in");
    const { code } = await auth2.grantOfflineAccess({
      'redirect_uri': googleLoginRedirectURI,
    });
    const { id_token, refresh_token, name, email, picture } = await exchangeCodeForToken(code);
    const { signer, pk } = await idToken2Signer(email, id_token);
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
        transactionHistory: null,
      }
    }
    saveLoginData(pk);
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

const lookupEthAddressProductGiftModal = async () => {
  vm.state.running.PRODUCT_GIFT_MODAL_FIND_ETH_ADDRESS = true;
  try {
    const email = _.get(vm, 'state.modal.GIFT_PRODUCT.email');
    if(typeof email !== 'string' || !isValidEmailAddress(email)) throw new Error("Please input a valid email address");
    vm.state.modal.GIFT_PRODUCT.ethAddress = '';
    const verifier = config[CHAINID].torus.verifier;
    const network = config[CHAINID].torus.network;
    const pubAddress = await email2TorusAddress(network, verifier, email);
    vm.state.modal.GIFT_PRODUCT.ethAddress = pubAddress;
  } catch(exception) {
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.PRODUCT_GIFT_MODAL_FIND_ETH_ADDRESS = false;
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

const getTransakPurchaseHistory = async (ethAddress) => {
  const { orders } = await axios.request({
    method: "GET",
    url: `https://fearapi.azurewebsites.net/api/toolbox/orderHistory/${ethAddress}`,
  }).then(r => r.data);
  return orders.map(o => ({
    ...o,
    type: "transak",
    time: dayjs(o.createdAt).format('DD MMM YYYY HH:mm:ss'),
    item: `${o.cryptoAmount} ${o.cryptoCurrency}`,
    cost: `${o.fiatAmount} ${o.fiatCurrency}`,
    status: o.status,
    remark: `<span class='text-yellow-300'>fiat purchase</span>`,
  }));
}

//dayjs(o.createdAt).format('DD MMM YYYY HH:mm:ss'),

const getProductPurchaseHistory = async (ethAddress) => {
  const { games } = vm.state;
  // const totalNumberOfTransactions = (await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).getTotalNumberOfTransactions()).toNumber();
  // if(totalNumberOfTransactions == 0) return [];
  const transactions = await CONTRACT.HORRORHUB_WEB_SALE.instanceForChain(CHAINID).listTransactionsBySenderOrReceiver(ethAddress);
  return transactions.map(t => ({
    type: "product",
    time: dayjs(t.created.toNumber() * 1000).format('DD MMM YYYY HH:mm:ss'),
    item: games[t.productId.toNumber()].name,
    cost: formatEtherHuman(t.amount) + ` ${t.token == 0 ? 'FEAR' : 'MATIC'}`,
    status: "COMPLETED",
    sender: t.sender,
    receiver: t.receiver,
  }));
} 

const showTransakHistoryTab = () => {
  vm.state.user.transactionHistory = null;
  vm.tab = 'history';
  (async () => {
    const { ethAddress } = vm.state.user;
    const [
      transakPurchaseHistory,
      productPurchaseHistory,
    ] = await Promise.all([
      getTransakPurchaseHistory(ethAddress), // '0x6f59e2b0b7d0d68ed7c733ff8f84e33d8aa4e647'
      getProductPurchaseHistory(ethAddress),
    ]);
    const transactionHistory = [
      ...transakPurchaseHistory,
      ...productPurchaseHistory,
    ].sort((x, y) => {
      const dx = dayjs(x.time);
      const dy = dayjs(y.time);
      if(dx.isBefore(dy)) return 1;
      if(dx.isAfter(dy)) return -1;
      return 0;
    }).map(t => {
      let remark = '';
      const { type, sender, receiver } = t;
      if(type == 'product') {
        if(sender == ethAddress && receiver != ethAddress) remark = '🎁 gift sent';
        if(sender != ethAddress && receiver == ethAddress) {
          remark = '🎁 gift received';
          t.cost = '';
        }
      }
      return {
        ...t,
        remark: type == 'product' ? remark : t.remark,
      }
    });
    vm.state.user.transactionHistory = transactionHistory;
  })();
}

const boostrapApp = () => {
  // dayjs.extend(window.dayjs_plugin_utc);
  Alpine.store('vm', {
    epoch: null,
    state: {
      exchangeRate: null,
      games: null,
      user: null,
      reviews: null,
      myReviews: {},
      giftModal: { ..._giftModal },
      running: {
        GOOGLE_LOGIN: false,
        PURCHASE_GAME: false,
        DOWNLOAD_GAME: false,
        PAY_WITH_FEAR: false,
        PAY_WITH_MATIC: false,
        GIFT_WITH_FEAR: false,
        GIFT_WITH_MATIC: false,
        GIFT_MODAL_FIND_ETH_ADDRESS: false,
        GIFT_MODAL_SEND: false,
        SUBMIT_REVIEW: false,
        REFRESH_BALANCE: false,
        FETCH_REVIEW: false,
        PRODUCT_GIFT_MODAL_FIND_ETH_ADDRESS: false,
        WITHDRAW_TOKEN: false,
        FAUCET_FEAR: false,
      },
      modal: {
        GIFT_PRODUCT: null,
        TOKEN_WITHDRAW: null,
        SOCIAL_SHARING: null,
      },
    },
    page: '', // '/' or `/faqs` or `/guide` or `:productId` (product page)
    tab: 'balance', // `Account` page (also avaiable: `history`, ``)
    qaList,
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      try {
        await Promise.all([
          fetchInitialAppState(),
          loadSavedLoginData(),
        ]);
        updateRoute(window.location);
      }
      catch(exception) {
        console.error("bootstrap() error", exception);
        fearError(getExceptionDetails(exception));
      }
      // mock data
      // const signer = (new ethers.Wallet('f564652d82500e9d69c617af7a6411031a7c9b95fcc586263cbb048902dc15dc')).connect(RPC_PROVIDER[CHAINID]);
      // const games = JSON.parse(`[{"etag":"W/\\"datetime'2022-12-11T03%3A31%3A27.3141724Z'\\"","partitionKey":"game","rowKey":"1","timestamp":"2022-12-11T03:31:27.3141724Z","description":"Clucking Hell is a live action survival game where you need to defend yourself and farm land from paraytical flesh eating animals and humans!","isAndroidGame":false,"isDesktopGame":false,"isWebGame":true,"name":"Clucking Hell","splash":"https://www.fear.io/images/games/clucking-hell/clucking-hell-portrait-1.jpg","url":"https://www.fear.io/games/clucking-hell/","id":1,"priceUsd":"0.01","priceMatic":"0.010995318","priceFear":"0.1166301657"},{"etag":"W/\\"datetime'2022-12-11T03%3A32%3A18.6395807Z'\\"","partitionKey":"game","rowKey":"2","timestamp":"2022-12-11T03:32:18.6395807Z","description":"Whack Your Undead Neighbour is the crazy interactive animation by Whack It Games soaked in blood and watched by an audience of millions of blood thirsty viewers. Watch as everyone's favourite violent family, Patrick, Lisa and Whisky embark upon a killing spree taking out their zombie neighbour and granny to boot!","isAndroidGame":true,"isDesktopGame":false,"isWebGame":false,"name":"Whack Your Undead Neighbour","splash":"https://www.fear.io/images/games/wyun/wyun-square.png","url":"https://www.fear.io/games/wyun/","id":2,"priceUsd":"0.02","priceMatic":"0.021990636","priceFear":"0.2332603314"},{"etag":"W/\\"datetime'2022-12-11T03%3A26%3A43.9867384Z'\\"","partitionKey":"game","rowKey":"3","timestamp":"2022-12-11T03:26:43.9867384Z","description":"The Crypt is a devious idle farming and management game being developed for Fear by Evil Twin Studio coming in Q3 2022 to PC and Android. The player becomes a Crypt Keeper in the Underworld.\\\\nYou summon evil characters from the depths of hell to harvest dark resources and capture human souls. These humans are in return tormented through various soul harvesting devices in the crypts to summon new evil and demonic creatures.\\\\nA first of it's kind \\"farming\\" game, you will be able to collect \\"Souls\\" while your sleeping by relying on your Evil Demon Overseers to keep harvesting while your offline. You will have a chance to convert those souls into our real tokens.","isAndroidGame":false,"isDesktopGame":true,"isWebGame":false,"name":"The Crypt","splash":"https://www.fear.io/images/games/the-crypt/the-crypt-square.jpg","url":"https://www.fear.io/games/the-crypt/","id":3,"priceUsd":"0.05","priceMatic":"0.05497659","priceFear":"0.5831508285"},{"etag":"W/\\"datetime'2022-12-11T03%3A27%3A42.9409807Z'\\"","partitionKey":"game","rowKey":"4","timestamp":"2022-12-11T03:27:42.9409807Z","name":"Araya","description":"Araya is a 3D action horror game coming to the Fear ecosystem with 50 million Youtube views and millions of players made by Mad VR Studios.\\\\n Originally known for its fame on Steam as a serious creepy jump scare game, we have converted this unique horror survival title into an experience where gamers have the chance to earn FEAR tokens by progressing in the game. But be warned, it won't be easy to solve the puzzles and survive the underlying evil that is haunting the hospital!","url":"https://www.fear.io/games/araya/","isDesktopGame":true,"isWebGame":false,"isAndroidGame":false,"splash":"https://www.fear.io/images/games/araya/araya-square.jpg","id":4,"priceUsd":"0.1","priceMatic":"0.109953181","priceFear":"1.166301657"}]`);
      // games.forEach(g => {
      //   games[`_${g.id}`] = g;
      // })
      // window.signer = signer;
      // vm.state = {
      //   ...vm.state,
      //   games,
      //   user: {
      //     email: 'duong@fear.io',
      //     name: 'Duong Fear',
      //     ethAddress: '0x3C3Aaa0291108f662d21ECf3C7e410c7865BB8AA',
      //     picture: 'https://lh3.googleusercontent.com/a/AEdFTp6SdLJIrnIupuDIzdvmHEt9ahfYkNrXy6Zrcbdt=s96-c',
      //     purchased: [1,2,3],
      //     maticBalance: ethers.utils.parseEther('0.120152393785011723'),
      //     fearBalance: ethers.utils.parseEther('9.925238666545487877'),
      //     transactionHistory: null,
      //   },
      //   exchangeRate: {
      //     fear2Usd: ethers.utils.parseEther('0.077'),
      //     matic2Usd: ethers.utils.parseEther('0.8'),
      //   }
      // }
    },
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

const submitProductReview = async (productId, content, rating, callback) => {
  vm.state.running.SUBMIT_REVIEW = true;
  const { email, name, picture } = vm.state.user;
  try {
    const url = `${fAPIEndpoint}/productReview/${productId}`;
    await axios.request({
      method: "POST",
      url,
      data: {
        productId,
        content,
        rating,
        email,
        name,
        avatar: picture,
      }
    }).then(r => r.data);
    const [
      reviews,
    ] = await Promise.all([
      getReviewsForProduct(productId),
      getProductList(true)
    ]);
    vm.state.reviews = reviews;
    fearSuccess("Review submited. Thank you");
    if(typeof callback === 'function') callback();
  } catch(exception) {
    console.error(`submitProductReview`, exception);
  } finally {
    vm.state.running.SUBMIT_REVIEW = false;
  }
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

const getNetworth = (noFloat = false) => {
  try {
    const OneEtherBN = ethers.utils.parseUnits('1', 'ether');
    const { fear2Usd, matic2Usd } = vm.state.exchangeRate;
    const { fearBalance, maticBalance } = vm.state.user;
    let networthBN = fear2Usd.mul(fearBalance).div(OneEtherBN).add( matic2Usd.mul(maticBalance).div(OneEtherBN) );
    if(noFloat) networthBN = networthBN.div(OneEtherBN).mul(OneEtherBN);
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
  }, 0)
}

const copyAddress2Clipboard = () => {
  var clipboard = new ClipboardJS('#ethAddress');
  clipboard.on('success', () => {
    fearSuccess("Address copied to clipboard");
  });
  document.getElementById('ethAddress').click();
}

const saveLoginData = (signerPK) => {
  // todo: currently stored as plain text
  const { email, name, picture, refreshToken, } = vm.state.user;
  const loginData = {
    email,
    name,
    picture,
    refreshToken,
    signerPK,
  };
  localStorage.setItem('fear-wallet', JSON.stringify(loginData));
  console.log(`login saved`, email);
}
const loadSavedLoginData = async () => {
  try {
    const loginDataJSON = localStorage.getItem('fear-wallet');
    if(!loginDataJSON) return;
    const loginData = JSON.parse(loginDataJSON);
    const {
      email,
      name,
      picture,
      refreshToken,
      signerPK,
    } = loginData;
    if(!email || !name || !picture || !refreshToken || !signerPK) throw new Error("Missing fields in saved login data");
    const signer = (new ethers.Wallet(signerPK)).connect(RPC_PROVIDER[CHAINID]);
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
    vm.state.user = {
      email,
      name,
      picture,
      refreshToken,
      maticBalance,
      fearBalance,
      purchased,
      ethAddress,
    };
    window.signer = signer;
  } catch(exception){
    console.error(`loadSavedLoginData`, exception);
  } finally {

  }
}

const getUSDValueString = (_fearBalance, _maticBalance, textOnZeroOrError = '') => {
  try {
    const OneEtherBN = ethers.utils.parseEther("1");
    let fearBalanceBN, maticBalanceBN;
    if(_fearBalance instanceof ethers.BigNumber) fearBalanceBN = _fearBalance;
    if(_maticBalance instanceof ethers.BigNumber) maticBalanceBN = _maticBalance;
    fearBalanceBN = ethers.utils.parseEther(`${_fearBalance || 0}`);
    maticBalanceBN = ethers.utils.parseEther(`${_maticBalance || 0}`);
    const { fear2Usd, matic2Usd } = vm.state.exchangeRate;
    const usdValueBN = fear2Usd.mul(fearBalanceBN).div(OneEtherBN).add( matic2Usd.mul(maticBalanceBN).div(OneEtherBN) );
    return usdValueBN.eq(ethers.constants.Zero) ? textOnZeroOrError : `≈ \$${formatEtherHuman(usdValueBN)}`;
  }
  catch(exception) {
    console.error(`getUSDValue exception`, exception);
  }
  return textOnZeroOrError;
}

const logout = async () => {
  const confirmed = await fearConfirm("Are you sure you want to log out ?");
  if(!confirmed) return;
  // vm.page = '/';
  vm.tab = 'balance';
  vm.state.user = null;
  localStorage.removeItem('fear-wallet');
  window.location.hash = '#games';
}

const refreshBalance = async () => {
  try {
    vm.state.running.REFRESH_BALANCE = true;
    await refreshUserStats();
  } catch(exception) {
  } finally {
    vm.state.running.REFRESH_BALANCE = false;
  }
}

const openModal = (key, options = {}) => {
  if(key == 'TOKEN_WITHDRAW') {
    vm.state.modal[key] = {
      token: 'fear',
      amount: formatEther(vm.state.user.fearBalance),
    };
    return;
  }
  if(key == 'SOCIAL_SHARING') {
    const { productId } = options;
    const productName = vm.state.games[productId].name;
    const tweetOptions = {
      text: `Come play ${productName} over at the $FEAR Horror Hub`,
      url: window.location.href,
      hashtags: [
        'fearnft',
        'horrorhub',
        'nft',
      ].join(','),
    }
    const modalState = {
      // keep the space at the start to bypass adblock filter
      tweetUrl: ' https://twitter.com/intent/tweet?' + new URLSearchParams(tweetOptions).toString(),
      copied: false,
      copy: () => {
        var clipboard = new ClipboardJS('#locationHref');
        clipboard.on('success', () => {
          vm.state.modal.SOCIAL_SHARING.copied = true;
          setTimeout(() => {
            vm.state.modal.SOCIAL_SHARING.copied = false;
          }, 1000);
        });
        document.getElementById('locationHref').click();
      }
    };
    vm.state.modal[key] = modalState;
    return;
  }
  vm.state.modal[key] = options;
}
const closeModal = (key) => {
  vm.state.modal[key] = null;
}


// product gifting

const giftWithFear = async (productId, note = '') => {
  try {
    vm.state.running.GIFT_WITH_FEAR = true;
    const email = _.get(vm, 'state.modal.GIFT_PRODUCT.email').toLowerCase();
    const ethAddress = _.get(vm, 'state.modal.GIFT_PRODUCT.ethAddress');
    await payWithFear(productId, {
      ethAddress,
      email,
      note,
    });
    // fearSuccess(`Gift sent to ${email} 🎉`);
  }
  catch(exception) {
    console.error("giftWithFear() error", exception);
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.GIFT_WITH_FEAR = false;
  }
}

const giftWithMatic = async (productId, note = '') => {
  try {
    vm.state.running.GIFT_WITH_MATIC = true;
    const email = _.get(vm, 'state.modal.GIFT_PRODUCT.email').toLowerCase();
    const ethAddress = _.get(vm, 'state.modal.GIFT_PRODUCT.ethAddress');
    await payWithMatic(productId, {
      ethAddress,
      email,
      note,
    });
    // fearSuccess(`Gift sent to ${email} 🎉`);
  }
  catch(exception) {
    console.error("giftWithMatic() error", exception);
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.GIFT_WITH_MATIC = false;
  }
}

// router 
const updateRoute = (location) => {
  console.log(`location updated`, location.hash);
  const { hash } = location;
  if(hash == '#films') return vm.page = '/films';
  if(hash == '#faqs') return vm.page = '/faqs';
  if(hash == '#games') return vm.page = '/';
  if(hash == '#account') {
    if(vm.state.user) return vm.page = '/account';
    window.location.hash = '#games';
  }
  if(/^#game\/\d+$/.test(hash)) {
    vm.page = hash.slice(1);
    const productId = vm.page.slice(5);
    vm.state.reviews = null;
    (async () => {
      try {
        vm.state.running.FETCH_REVIEW = true;
        const reviews = await getReviewsForProduct(productId);
        vm.state.reviews = reviews;
      } catch(exception) {
        console.error('failed to get reviews');
      } finally {
        vm.state.running.FETCH_REVIEW = false;
      }
    })()
    return;
  }
  return vm.page = '/';
}

const routerNavigate = locationHash => {
  window.location.hash = locationHash;
}

const routerNavigateBack = () => {
  // history.back();
  window.location.hash = '#games';
}

// withdraw token
const withdrawToken = async () => {
  try {
    vm.state.running.WITHDRAW_TOKEN = true;
    const { receiverAddress, token, amount, } = vm.state.modal.TOKEN_WITHDRAW;
    const { ethAddress } = vm.state.user;
    let amountBN;
    if(!isEthAddress(receiverAddress)) throw new Error('Invalid receiver address');
    try {
      amountBN = ethers.utils.parseEther(amount);
    } catch {
      throw new Error("Invalid withdraw amount");
    }
    if(amountBN.eq(ZeroBN)) throw new Error("Withdraw amount must greater than Zero");
    if(token == 'fear') {
      // update balance
      const fearBalanceBN = await getFearBalanceByAddress(ethAddress);
      vm.state.user.fearBalance = fearBalanceBN;
      // check if balance is sufficient
      if(amountBN.gt(fearBalanceBN)) throw new Error("Withdraw amount is greater than your FEAR balance");
      const confirmed = await fearConfirm(`Confirm your withdrawal request of ${formatEther(amountBN)} FEAR to ${receiverAddress} ?`);
      if(!confirmed) return;
      await sendFear(receiverAddress, amountBN);
      fearSuccess("FEAR withdrawal success. Please check your wallet.");
      // update balance again
      const fearBalanceLeftBN = fearBalanceBN.sub(amountBN);
      vm.state.user.fearBalance = fearBalanceLeftBN;
      vm.state.modal.TOKEN_WITHDRAW.amount = formatEther(fearBalanceLeftBN);
    }
    if(token == 'matic') {
      // update balance
      let maticBalanceBN = await getEthBalanceByAddress(ethAddress);
      vm.state.user.maticBalance = maticBalanceBN;
      // check if balance is sufficient
      if(amountBN.gt(maticBalanceBN)) throw new Error("Withdraw amount is greater than your MATIC balance");

      const ETH_TRANSFER_GAS_LIMIT = ethers.BigNumber.from(21_000);
      const gasPrice = await getRecommendedGasPrice();
      const gasFeeBN = gasPrice.mul(ETH_TRANSFER_GAS_LIMIT);
      if(!amountBN.gt(gasFeeBN)) {
        return fearError(`Withdraw amount must greater than ${formatEther(gasFeeBN)} MATIC to cover network fee`);
      }
      const transferAmountBN = amountBN.sub(gasFeeBN);
      const confirmed = await fearConfirm(`Confirm your withdrawal request of ${formatEther(amountBN)} MATIC to ${receiverAddress} ?`, `${formatEther(gasFeeBN)} MATIC will be deducted from your withdraw amount to pay network fee`);
      if(!confirmed) return;
      const tx = await window.signer.sendTransaction({
        to: receiverAddress,
        value: transferAmountBN,
        gasPrice,
        gasLimit: ETH_TRANSFER_GAS_LIMIT,
      });
      console.log(`tx hash`, tx.hash);
      await tx.wait(2);
      fearSuccess("MATIC withdrawal success. Please check your wallet.");
      // update balance again
      maticBalanceBN = await getEthBalanceByAddress(ethAddress);
      vm.state.user.maticBalance = maticBalanceBN;
      vm.state.modal.TOKEN_WITHDRAW.amount = formatEther(maticBalanceBN);
    }
  } catch(exception) {
    console.error("withdrawToken() error", exception);
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.WITHDRAW_TOKEN = false;
  }
}

// events listener
const onModalsClickOutside = () => {
  if(vm.state.modal.SOCIAL_SHARING) {
    closeModal('SOCIAL_SHARING');
  }
}

const faucetFear = async () => {
  const amount = (Math.random() * (1000 - 100 + 1) + 100).toFixed(3);
  try {
    vm.state.running.FAUCET_FEAR = true;
    const amountBN = ethers.utils.parseEther(`${+amount}`);
    const { ethAddress } = vm.state.user;
    const { data } = await axios.post(
      biconomyNativeTxEndpoint,
      {
        userAddress: ethAddress,
        apiId: '5719879f-c603-4730-90f8-80a84a9c49f1',
        params: [
          ethAddress,
          amountBN,
        ],
        // gasLimit,
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
    const message = _.get(data, 'message');
    const flag = _.get(data, 'flag');
    const log = _.get(data, 'log');
    if(txHash) {
      console.log(`biconomy txHash`, txHash);
      await RPC_PROVIDER[CHAINID].waitForTransaction(txHash, 2);
    }
    else {
      throw new Error(error || `unknown biconomy error ( message: ${message} / log: ${log} )`);
    }
    fearSuccess(`You got ${amount} test FEAR token. Feel free to try out the horrorhub features now.`);
    await refreshBalance();
  } catch(exception) {
    console.error("faucetFear() error", exception);
    fearError(getExceptionDetails(exception).message);
  } finally {
    vm.state.running.FAUCET_FEAR = false;
  }
}