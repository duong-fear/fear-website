// config
const googleLoginRedirectURI = undefined; //window.location.href

const fetchInitialAppState = async () => {  
  sleep(0.5);
  vm.state.games = [
    {
      name: "Clucking Hell",
      splash: "https://placekitten.com/400/300?image=1",
      isDesktopGame: true,
      priceFear: "0",
    },
    {
      name: "Whack The Demon",
      splash: "https://placekitten.com/400/300?image=2",
      isDesktopGame: false,
      priceFear: "5",
    },
    {
      name: "Whack Your Undead Neighbour",
      splash: "https://placekitten.com/400/300?image=3",
      isDesktopGame: false,
      priceFear: "25",
    },
    {
      name: "Whack Your Neighbour Extreme Edition",
      splash: "https://placekitten.com/400/300?image=4",
      priceFear: "55",
    },
    {
      name: "Whack The Burglars",
      splash: "https://placekitten.com/400/300?image=5",
      isDesktopGame: false,
      priceFear: "65",
    },
    {
      name: "Whack The Creeps Game",
      splash: "https://placekitten.com/400/300?image=6",
      isDesktopGame: false,
      priceFear: "15",
    },
    {
      name: "Whack the Serial Killer",
      splash: "https://placekitten.com/400/300?image=7",
      isDesktopGame: false,
      priceFear: "35",
    },
  ].map((g, index) => ({
    ...g,
    id: index,
  }))
}

const purchaseGame = async id => {
  if(vm.state.running.PURCHASE_GAME == id) return;
  try {
    vm.state.running.PURCHASE_GAME = id;
    const { hubToken } = vm.state.user;
    const game = vm.state.games.find(g => g.id == id);
    const ownedGames = await getOwnedGames(vm.state.user.hubToken);
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

const getOwnedGames = async (hubToken) => {
  const { Purchased } = await axios.request({
    method: "GET",
    url: `https://hubfunctions-prd.azurewebsites.net/api/getUser`,
    headers: {
      "x-zumo-auth": hubToken,
    },
  }).then(r => r.data);
  return Purchased.map(id => +id);
}

const login = async () => {
  if(vm.state.running.GOOGLE_LOGIN) return;
  try {
    vm.state.running.GOOGLE_LOGIN = true;
    // if(!vm.state.user) throw new Error("Already logged-in");
    const { code } = await auth2.grantOfflineAccess({
      'redirect_uri': googleLoginRedirectURI,
    });
    // login via 
    if(googleLoginRedirectURI) return;
    // login via popup
    const { id_token } = await gapi.client.getToken();
    const hubToken = await getHubAPIToken(id_token);
    const ownedGames = await getOwnedGames(hubToken);
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
    console.log(`code email name picture`, code, email, name, picture);
    vm.state = {
      ...vm.state,
      user: {
        email,
        name,
        picture,
        refreshToken: code,
        idToken: id_token,
        hubToken,
        ownedGames,
      }
    }
  } catch(exception) {
    console.error("login() error", exception);
    // throw exception;
    if(_.get(exception, 'error') == "popup_closed_by_user") return;
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
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      await Promise.all([
        fetchInitialAppState(),
      ]);
    },
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}