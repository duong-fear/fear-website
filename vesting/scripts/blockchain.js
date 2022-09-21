const blockchain = {
    web3: null,
    provider: null,
    web3ModalProvider: null,
    network: null,
    polygonChainId: "0x89",
    abi: {},
    cachedContracts: {},
    walletConnectData: {},
    addresses: {
        fearVesting : "0xD9595949fD88A3274433318a78f793Ad410b5202"
    },
    listenToEvents: async function(walletAddress){
        const fearVesting = await this.getContract("fearVesting");
        let that = this;

        fearVesting.on("RewardPaid", async (account, reward) => {
            try {
                if (account.toUpperCase() === walletAddress.toUpperCase()){
                    let vm = Alpine.store("vm");
                    vm.setStatus(that.formatFear(reward) + " FEAR claimed.");
                    vm.setBusy(true, "2. Refreshing FEAR Claim Stats...");
                    await vm.refreshTokenStats();
                }
            }
            catch (e){
                let vm = Alpine.store("vm");
                vm.setWarning(e);
                vm.setBusy(false, "");
            }
        });
    },
    getContract: async function(prefix) {
        let abiCode = abi[prefix];
        let address = this.addresses[prefix];
        
        if (this.cachedContracts[prefix]){
            return this.cachedContracts[prefix];
        }

        this.cachedContracts[prefix] = new ethers.Contract(
            address,
            abiCode,
            wallet.signer
        );

        return this.cachedContracts[prefix];
    },
    claimTokens: async function(){
        let vm = Alpine.store("vm");
        
        try {
            let fv = await this.getContract("fearVesting");
            await fv.getReward();
        }
        catch (e) {
            vm.setWarning(e);
            vm.setBusy(false, "");
        }
    },
    formatFear: function(fear){
        try {
            fear = ethers.utils.formatEther(fear);
            return parseFloat(fear).toFixed(2);
        }
        catch (e){
            let vm = Alpine.store("vm");
            vm.setWarning(e);
            vm.setBusy(false, "");
        }
    },
    claimed: async function (){
        try {
            let account = wallet.accounts[0];
            let fv = await this.getContract("fearVesting");
            let fear = await fv.payouts(account);
            return fear;
        }
        catch (e) {
            let vm = Alpine.store("vm");
            vm.setWarning(e);
            vm.setBusy(false, "");
        }
    },
    earned: async function (){
        try {
            let account = wallet.accounts[0];
            let fv = await this.getContract("fearVesting");
            let fear = await fv.earned(account);
            return fear;
        }
        catch (e) {
            let vm = Alpine.store("vm");
            vm.setWarning(e);
            vm.setBusy(false, "");
        }
    },
    totalTokens: async function (){
        try {
            let account = wallet.accounts[0];
            let fv = await this.getContract("fearVesting");
            let fear = await fv.rewards(account);
            return fear;
        }
        catch (e) {
            let vm = Alpine.store("vm");
            vm.setWarning(e);
            vm.setBusy(false, "");
        }
    },
};