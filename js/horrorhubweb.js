// config
const googleLoginRedirectURI = undefined; //window.location.href

const matic2Fear = 10.844;

const matic2Usd = 0.837;
const fear2Usd = 0.075;

const loremText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
const fetchInitialAppState = async () => {  
  sleep(0.5);
  vm.state.games = [
    {
      name: "Clucking Hell",
      splash: "https://placekitten.com/400/400?image=1",
      isDesktopGame: true,
      priceUsd: "3",
    },
    {
      name: "Whack The Demon",
      splash: "https://placekitten.com/400/400?image=2",
      isDesktopGame: false,
      priceUsd: "5",
    },
    {
      name: "Whack Your Undead Neighbour",
      splash: "https://placekitten.com/400/400?image=3",
      isDesktopGame: false,
      priceUsd: "10",
    },
    {
      name: "Whack Your Neighbour Extreme Edition",
      splash: "https://placekitten.com/400/400?image=4",
      priceUsd: "15",
    },
    {
      name: "Whack The Burglars",
      splash: "https://placekitten.com/400/400?image=5",
      isDesktopGame: false,
      priceUsd: "5",
    },
    {
      name: "Whack The Creeps Game",
      splash: "https://placekitten.com/400/400?image=6",
      isDesktopGame: false,
      priceUsd: "6",
    },
    {
      name: "Whack the Serial Killer",
      splash: "https://placekitten.com/400/400?image=7",
      isDesktopGame: false,
      priceUsd: "6",
    },
  ].map((g, index) => ({
    ...g,
    id: index,
    // user got discount when pay with $FEAR
    // this calculation may be wrong !!
    priceMatic: +(g.priceUsd / matic2Usd).toFixed(3),
    priceFear: +(0.9 * g.priceUsd / fear2Usd).toFixed(3),
  }))
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

const purchaseGame = async id => {
  if(vm.state.running.PURCHASE_GAME == id) return;
  try {
    vm.state.running.PURCHASE_GAME = id;
    const { hubToken } = vm.state.user;
    const game = vm.state.games.find(g => g.id == id);
    const ownedGames = await getPurchasedGames(vm.state.user.hubToken);
    vm.state.user.ownedGames = ownedGames;
    if(ownedGames.includes(id)) throw new Error("Already purchased");
    const result = await axios.request({
      method: "POST",
      url: `https://hubfunctions-prd.azurewebsites.net/api/purchase/${id}`,
      headers: {
        "x-zumo-auth": hubToken,
      },
    }).then(r => r.data);
    vm.state.user.ownedGames.push(id);
    fearSuccess(`You owned '${game.name}'`);
  } catch(exception) {
    console.error("purchaseGame() error", exception);
    fearError(getExceptionDetails(exception));
  } finally {
    vm.state.running.PURCHASE_GAME = false;
  }
}

const downloadGame = async () => {
  await fearError("Download function is not implemented yet :D");
}

const getHubAPIToken = async (googleIdToken) => {
  try {
    const { authenticationToken } = await axios.request({
      method: "POST",
      url: `https://hubfunctions-prd.azurewebsites.net/.auth/login/google`,
      data: {
        id_token: googleIdToken,
      },
    }).then(r => r.data);
    return authenticationToken;
  } catch {
    throw new Error("Can't contact Horror Hub app");
  }
}

const getPurchasedGames = async (refresh_token) => {
  const { purchased } = await axios.request({
    method: "POST",
    url: `https://fearapi.azurewebsites.net/api/horrorhubweb/getPurchased`,
    data: {
      token: refresh_token,
    },
  }).then(r => r.data);
  return purchased;
}

const exchangeCodeForToken = async (code) => {
  const tokens = await axios.request({
    method: "POST",
    url: `https://fearapi.azurewebsites.net/api/horrorhubweb/exchangeCodeForTokens`,
    data: {
      code,
    },
  }).then(r => r.data);
  return tokens;
}

const login = async () => {
  if(vm.state.running.GOOGLE_LOGIN) return;
  try {
    vm.state.running.GOOGLE_LOGIN = true;
    // if(!vm.state.user) throw new Error("Already logged-in");
    const { code } = await auth2.grantOfflineAccess({
      'redirect_uri': googleLoginRedirectURI,
    });
    const { id_token, refresh_token} = await exchangeCodeForToken(code);
    if(googleLoginRedirectURI) return;
    const purchased = await getPurchasedGames(refresh_token);
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
    console.log(`email name picture`, email, name, picture);
    vm.state = {
      ...vm.state,
      user: {
        email,
        name,
        picture,
        refreshToken: refresh_token,
        idToken: id_token,
        ownedGames: purchased, // polyfill
        purchased: purchased,
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
      client_id: '701735735157-cdgkv7di5ihom5mdp0pflphvh2p7hjjq.apps.googleusercontent.com',
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
      running: {
        GOOGLE_LOGIN: false,
        PURCHASE_GAME: false,
        DOWNLOAD_GAME: false,
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