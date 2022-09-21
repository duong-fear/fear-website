const MATIC_CHAINID = 137;
const MATIC_TESTNET_CHAINID = 80001;
const BSC_CHAINID = 56;
const DEFAULT_CHAINID = MATIC_CHAINID; // default chain, when not loged in

const CHAINS = [
    // {
    //     mainnet: false,
    //     chainId: `0x${MATIC_TESTNET_CHAINID.toString(16)}`,
    //     rpc: 'https://matic-mumbai.chainstacklabs.com',
    //     name: 'Polygon Testnet Mumbai',
    //     shortName: 'Polygon',
    //     nativeCurrency: {
    //         name: 'MATIC',
    //         symbol: 'MATIC',
    //         decimals: 18,
    //     },
    //     blockExplorer: 'https://mumbai.polygonscan.com/',
    // },
    {
        mainnet: true,
        chainId: `0x${MATIC_CHAINID.toString(16)}`,
        rpc: 'https://polygon-rpc.com',
        name: 'Matic(Polygon) Mainnet',
        shortName: 'Polygon',
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
        },
        blockExplorer: 'https://polygonscan.com',
    },
    {
        mainnet: true,
        chainId: `0x${BSC_CHAINID.toString(16)}`,
        rpc: 'https://bsc-dataseed.binance.org/',
        name: 'Binance Smart Chain Mainnet',
        shortName: 'Binance Smart Chain',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
        },
        blockExplorer: 'https://bscscan.com/',
    },
]

const CONTRACTS = {
    fear_nft: {
        [MATIC_CHAINID]: {
            address: "0xB9aeE1Ad85bed213B53329F060A13328EB26b7a0",
            abi: abi.nft,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    fear_p2e: {
        [BSC_CHAINID]: {
            address: "0x7DA595A5573CC6e27Ae89E25293DA3beEFeE16Ae",
            abi: abi.playToEarn,
        },
        [MATIC_CHAINID]: {
            address: "0x7DA595A5573CC6e27Ae89E25293DA3beEFeE16Ae",
            abi: abi.playToEarn,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    fear_p2eV4: {
        [BSC_CHAINID]: {
            address: "0xc3b92420b3F762ffcaf3686358d98bDCA6BF49EA",
            abi: abi.playToEarnV4,
        },
        [MATIC_CHAINID]: {
            address: "0x8c651cc6cc07abe69f14b776eaefeb5c40172894",
            abi: abi.playToEarnV4,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    fear_token: {
        [BSC_CHAINID]: {
            address: "0x9Ba6a67a6F3b21705a46B380A1B97373a33da311",
            abi: abi.fear,
        },
        [MATIC_CHAINID]: {
            address: "0xa2CA40DBe72028D3Ac78B5250a8CB8c404e7Fb8C",
            abi: abi.fear,
        },
        // [MATIC_TESTNET_CHAINID]: {
        //     address: '0x60811c63e312427bb25bea168ae5228abf0797ce',
        //     abi: abi.fear,
        // },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    fear_muon: {
        [BSC_CHAINID]: {
            address: "0x4993Edc494622b013F0968948C0AB78f55a81c5C",
            abi: abi.muonFearGame,
        },
        [MATIC_CHAINID]: {
            address: "0x8b39e4B52CbF308b10Fcd72a1f172f816da33Ade",
            abi: abi.muonFearGame,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    exchange: {
        [MATIC_CHAINID]: {
            address: "0xFB83316537de13dF7E8fb8ec1B42A39844A1Ca5f",
            abi: abi.exchange,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    },
    bloodcup: {
        [MATIC_CHAINID]: {
            address: "0x3D00F37fCF501BBFf880705156ca2f5B1D456011",
            abi: abi.bloodcup,
        },
        get address() {
            return this[blockchain.chainId].address
        },
    }
};

const fear = (contract) => {
    const { chainId, signer } = blockchain
    const { address, abi } = CONTRACTS[contract][chainId]
    return new ethers.Contract(address, abi, signer);
};
  
const blockchain = {
    web3ModalProvider: null,
    get provider() {
        return new ethers.providers.Web3Provider(this.web3ModalProvider)
    },
    get signer() {
        return this.provider.getSigner()
    },
    address: null,
    chainId: null,
    async refresh() {
        this.chainId = (await this.provider.getNetwork()).chainId;
        this.address = await blockchain.signer.getAddress();
    },
    get apiChainId() {
        return this.getApiChain(this.chainId);
    },
    isChainSupported(chainId) {
        const supportedChainIds = _.map(CHAINS, n => +n.chainId);
        return supportedChainIds.includes(+chainId);
    },
    getNetwork(chainId) {
        return this.isChainSupported(chainId) ? _.find(CHAINS, n => +n.chainId == +chainId) : null;
    },
    getApiChain(chainId) {
        return {
            1: 1,
            137: 2,
            56: 4
        }[chainId] || null
    },
    isAddress: function (address) {
        return ethers.utils.isAddress(address);
    },
    unstakeFromP2Ev4: async () => {
        const waitForStakeUpdated = (contractInstance) => new Promise((resolve, reject) => {
            contractInstance.on("StakeUpdated", (account) => {
                try {
                    if(account !== blockchain.address) return;
                    contractInstance.removeAllListeners();
                    resolve();
                }
                catch (e){
                    reject(e);
                }
            });
        })
        try {
            vm.setStatus("");
            vm.setWarning("");
            vm.setBusy(false);
            setLoading("V4_UNSTAKE", true);
            const v4 = fear("fear_p2eV4");
            const amount = vm.withFear.stakedAmountBNInV4;
            await v4.unstakeFear(1, amount);
            await waitForStakeUpdated(v4);
            await Promise.all([
                vm.getFearStakedInP2Ev4(),
                vm.getFearStakingStats(),
            ]);
            dialogAlert("✅ Unstaked. Balance updated!");
        }
        catch(err){
            vm.setWarning(err);
        }
        finally {
            setLoading("V4_UNSTAKE", false);
        }
    },
};
