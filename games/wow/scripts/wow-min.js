async function checkForWowNft(e){let t=await getContract("nft"),n=await t.functions.balanceOf(e.address,12);if(!(0===n.length||n[0].toNumber()<=0))return $("#status").css("color","red").html("Downloading for: "+e.address.substr(0,4)+".."+e.address.substr(e.address.length-3)),$("#address").val(e.address),$("#signature").val(e.signature),$("#message").val(e.message),$("#wowForm").submit();$("#status").css("color","red").html("WORLD OF WHACK IT NFT NOT FOUND YOU CHEEKY DEVIL!")}async function onSigningFailure(){$("#status").css("color","red").html("YOU ARE NOT WHO YOU SAY YOU ARE YOU CHEEKY DEVIL!")}async function connectWallet(){if(window.ethereum)try{provider=new ethers.providers.Web3Provider(window.ethereum);let e=await provider.getNetwork();if(137!=(e=e.chainId))return void $("#status").css("color","red").html("PLEASE CONNECT TO THE POLYGON NETWORK TO DOWNLOAD WORLD OF WHACK IT");signer=provider.getSigner(),web3=new Web3(window.ethereum),accounts=await web3.eth.getAccounts(),await ethereum.request({method:"eth_requestAccounts"});await getCoinbase();await metaMaskSigning(137,"0xB9aeE1Ad85bed213B53329F060A13328EB26b7a0","Confirm you are who you say you are!",checkForWowNft,onSigningFailure)}catch(e){console.log(e.message),console.log(e),$("#status").css("color","red").html("YOU DENIED THE WALLET CONNECTION")}else $("#status").css("color","red").html("NO WALLET DETECTED! PLEASE INSTALL METAMASK.")}window.config={nftAddress:"0xB9aeE1Ad85bed213B53329F060A13328EB26b7a0"},window.nftAbi=[{inputs:[{internalType:"address",name:"account",type:"address"},{internalType:"uint256",name:"id",type:"uint256"}],name:"balanceOf",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"}],window.cachedContracts={};const getTimestamp=()=>Math.floor(Date.now()/1e3);window.ethereum.on("chainChanged",function(e){window.location.reload()}),window.ethereum.on("accountsChanged",async function(e){window.location.reload()});