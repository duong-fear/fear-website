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
  ]
}

const login = async () => {
  // if(!vm.state.user) throw new Error("Already logged-in");
  const { code } = await auth2.grantOfflineAccess({
    'redirect_uri': googleLoginRedirectURI,
  });
  // login via 
  if(googleLoginRedirectURI) return;
  // login via popup
  const { id_token } = gapi.client.getToken();
  const { email, name, picture, } = JSON.parse(atob(id_token.split(".")[1]));
  console.log(`code email name picture`, code, email, name, picture);
  vm.state = {
    ...vm.state,
    user: {
      email,
      name,
      picture,
      idToken: id_token,
    }
  }
}

// const automaticLogin = () => {
//   const searchParams = new URLSearchParams(window.location.hash.substring(1));
//   const code = searchParams.get('code');
//   const idToken = searchParams.get('id_token');
//   if(!code || !idToken) return;
//   console.log(code, idToken)
//   const { email, } = JSON.parse(atob(idToken.split(".")[1]));
//   vm.state.user = {
//     email,
//     // name,
//     // picture,
//     idToken,
//   };
//   history.replaceState({}, '', window.location.pathname);
// }

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
    },
    bootstrap: async () => {
      setInterval(() => {
        vm.epoch = getEpoch();
      }, 1000);
      
      await Promise.all([
        fetchInitialAppState(),
        // automaticLogin(),
      ]);
    },
  })
  window.vm = Alpine.store('vm');
  vm.bootstrap();
}