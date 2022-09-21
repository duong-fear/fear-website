const wallet = {
    _signature: null,
    get signature() {
        return this._signature;
    },
    set signature(value) {
        this._signature = value;
        vm.authenticated = !!value;
    },
    getTimestamp: () => Math.floor(Date.now() / 1e3),

    requestSignature: async function(chainId, onSuccess) {
        const message =  "Please confirm you are who you say you are! " + this.getTimestamp();
        const domain = {
            name:"FEAR",
            version: "1.0",
            chainId: chainId,
            verifyingContract: CONTRACTS.fear_token[chainId].address,
        };
        const types = {
            MetaTransaction: [
                { name: "message", type: "string" }
            ]
        };
        const value = { message };
        const signature = await blockchain.signer._signTypedData(domain, types, value);
        const address = ethers.utils.verifyTypedData(domain, types, value, signature);
        if(address !== blockchain.address) throw new Error("Invalid signature")
        this.signature = {
            signature,
            message,
            address,
            chainId,
        };
        let addressSummary = address.substr(0, 4) + ".." + address.substr(-2);
        vm.addressSummary = addressSummary;
        vm.setStatus("Connected to " + addressSummary);
        await onSuccess();
    },

    afterNetworkConfirmed: async function(chainId, onSuccess) {
        await wallet.requestSignature(chainId, onSuccess);
    },

    connect: async function (onSuccess) {
        let vm = Alpine.store("vm");
        let onWeb3ModalConnected = async () => {
            if (!blockchain.isChainSupported(blockchain.chainId)) {
                return showNetworkSelectDialog();
            }
            await wallet.afterNetworkConfirmed(blockchain.chainId, onSuccess);
        }
        try {
            if(blockchain.web3ModalProvider) {
                // already connected
                return await onWeb3ModalConnected();
            }

            const Web3Modal = window.Web3Modal.default;
            const providerOptions = {
            };
            const web3Modal = new Web3Modal({
                network: "mainnet", // optional
                cacheProvider: true, // optional
                providerOptions // required
            });

            let web3ModalProvider = blockchain.web3ModalProvider = await web3Modal.connect();
            await blockchain.refresh();

            web3ModalProvider.on("accountsChanged", async () => {
                window.location.reload();
            });

            web3ModalProvider.on("chainChanged", async function (chainId) {
                // when wallet connected, reload page on chain changed
                if(wallet.signature !== null) {
                    dialogBusy("Network changed! Reloading ...");
                    window.location.reload();
                    return;
                }
                vm.reset();
                await blockchain.refresh();
                chainId = +chainId;
                wallet.signature = null;
                if(!blockchain.isChainSupported(chainId)) {
                    bootbox.hideAll();
                    bootbox.dialog({ 
                        message: `<div class="text-center">Please switch the network to ${CHAINS.map(c => `<b>${c.name}</b>`).join(" or ")}</div>`, 
                        closeButton: false,
                        centerVertical: true,
                        className: 'web3-switch-account-modal',
                    });
                    return;
                }
                try {
                    bootbox.hideAll();
                    bootbox.dialog({ 
                        message: '<div class="text-center">Please approve signature request</div>', 
                        closeButton: false,
                        centerVertical: true,
                        className: 'web3-switch-account-modal',
                    });
                    await wallet.afterNetworkConfirmed(chainId, () => {
                        bootbox.hideAll();
                        onSuccess()
                    });
                }
                catch (e) {
                    bootbox.hideAll()
                    vm.setWarning(e);
                    vm.setBusy(false, "");
                    vm.setStatus("");
                }
            });

            await onWeb3ModalConnected();
        } catch (e) {
            vm.setWarning(e);
            vm.setBusy(false);
            vm.setStatus("");
        }
    },

    switchToChosenNetwork: async function(chainId){
        try {
            await blockchain.provider.send("wallet_switchEthereumChain", [{ chainId: `0x${chainId.toString(16)}` }]);
        }
        catch (e) {
            let network = blockchain.getNetwork(chainId);
            const params = [{
                chainId: network.chainId,
                chainName: network.name,
                nativeCurrency: network.nativeCurrency,
                rpcUrls: [network.rpc],
                blockExplorerUrls: [network.blockExplorer]
            }];
            if (e.code === 4902) {
                await blockchain.provider.send("wallet_addEthereumChain", params);
                // if user added new ETH chain but decide NOT to switch, no exception will be thrown :O
                await blockchain.provider.send("wallet_switchEthereumChain", [{ chainId: `0x${chainId.toString(16)}` }]);
                return;
            }
            throw(e);
        }
    }

};
