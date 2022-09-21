const wallet = {
    signer: null,
    accounts: null,
    signatureData: null,
    authenticated: false,
    getTimestamp: () => Math.floor(Date.now() / 1e3),
    requestAccounts: async function(){
        let accounts = await blockchain.provider.listAccounts();
        return accounts;
    },
    afterNetworkConfirmed: async function() {
        let vm = Alpine.store("vm");
        
        wallet.accounts = await this.requestAccounts();
        
        if (this.accounts.length == 0){
            vm.setWarning("No Accounts found to connect to.");
            return;
        }

        let account = this.accounts[0];
        let addressSummary = account.substr(0, 4) + ".." + account.substr(account[0].length - 3);

        vm.addressSummary = addressSummary;
        vm.setStatus("Connected to " + addressSummary);
        
        await blockchain.listenToEvents(account);

        vm.walletConnected = true;
    },
    connect: async function () {
        let vm = Alpine.store("vm");

        try {
            const Web3Modal = window.Web3Modal.default;
            const WalletConnectProvider = window.WalletConnectProvider.default;

            const providerOptions = {
                walletconnect: {
                    package: WalletConnectProvider,
                    options: {
                        rpc: {
                            137: "https://rpc-mainnet.maticvigil.com/"
                        }
                    }
                }
            };

            const web3Modal = new Web3Modal({
                network: "mainnet", // optional
                cacheProvider: true, // optional
                providerOptions // required
            });

            let web3ModalProvider = blockchain.web3ModalProvider = await web3Modal.connect();
            
            web3ModalProvider.on("accountsChanged", (chainId) => {
                window.location.reload();
            });

            web3ModalProvider.on("chainChanged", async function (chainId) {
                let vm = Alpine.store("vm");

                try {
                    if (!vm.walletConnected && chainId === blockchain.polygonChainId) {            
                        const provider = blockchain.provider = new ethers.providers.Web3Provider(blockchain.web3ModalProvider);
                        const network = await provider.getNetwork();
                        wallet.signer = provider.getSigner();
                        blockchain.web3 = new Web3(provider);

                        await wallet.afterNetworkConfirmed();
                        vm.setBusy(true, "2. Refreshing FEAR Claim Stats...");
                        await vm.refreshTokenStats();
                    }
    
                    if (chainId !== blockchain.polygonChainId){
                        window.location.reload();
                    }    
                }
                catch (e) {
                    if (e) {
                        vm.setWarning(e);
                    }
        
                    vm.setBusy(false, "");
                    vm.setStatus("");
                }
            });

            const provider = blockchain.provider = new ethers.providers.Web3Provider(web3ModalProvider);
            const network = await provider.getNetwork();
            wallet.signer = provider.getSigner();
            blockchain.web3 = new Web3(provider);
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (!isMobile && network.chainId !== 137) {
                await wallet.switchToPolygon();
            } else {
                if (isMobile && network.chainId !== 137) {
                    vm.setWarning("Please change your network to Polygon and reload the Vesting Page");
                    vm.setBusy(false, "");
                    return;
                }

                await wallet.afterNetworkConfirmed();
                vm.setBusy(true, "2. Refreshing FEAR Claim Stats...");
                await vm.refreshTokenStats();
            }
        } catch (e) {
            if (e) {
                vm.setWarning(e);
            }

            vm.setBusy(false, "");
            vm.setStatus("");
        }
    },
    switchToPolygon: async function(){
        let vm = Alpine.store("vm");
        
        try {
            await blockchain.provider.send("wallet_switchEthereumChain", [{ chainId: blockchain.polygonChainId }]);
        }
        catch (e) {

            const params = [{
                chainId: blockchain.polygonChainId,
                chainName: "Matic(Polygon) Mainnet",
                nativeCurrency: {
                    name: "MATIC",
                    symbol: "MATIC",
                    decimals: 18
                },
                rpcUrls: ["https://rpc-mainnet.matic.network"],
                blockExplorerUrls: ["https://polygonscan.com"]
            }];

            if (e.code === 4902) {
                return await blockchain.provider.send("wallet_addEthereumChain", params);
            }

            throw(e);
        }
    }
};