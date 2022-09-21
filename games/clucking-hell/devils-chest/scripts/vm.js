function setupVm() {
    Alpine.store("wallet", wallet);
    Alpine.store("blockchain", blockchain);
    
    const nftTabs = [
        { name: "My NFTs", visible: false},
    ];
    
    Alpine.store("vm", {
        epoch: getEpoch(),
        chainId: null,
        loading: {
            BC: true,
            BC_LEADERBOARD: false,
            BC_BUY_BLOOD: false,
            BC_SELL_BLOOD: false,
            BC_JOIN: false,
            V4_UNSTAKE: false,
            BC_USER: false,
            BC_CLAIM: false,
            P2E_STAKE: false,
            P2E_UNSTAKE: false,
            P2E_CLAIM: false,
            MODAL: false,
        },
        nftTabs: nftTabs,
        tabs: [
            { name: "How to Play to Earn", visible: true },
            { name: "Blood Cup 🏆", visible: true  },
            { name: "Your Stats", visible: true  },
            { name: "FEAR Stakers", visible: true  },
            ... nftTabs,
        ],
        busy: false,
        disableWalletConnect: false,
        selectedTab: "Blood Cup 🏆",
        playerStats: null,
        getPlayerStats: function() {
            vm.playerStats = null;
            const chainId = blockchain.getApiChain(blockchain.chainId);
            api.getPlayerStats(chainId, function(ps) {
                vm.playerStats = ps;
            });
        },
        setBusy: function(val, statusText = "") {
            if (val){
                vm.setWarning("");
            }
            vm.busy = val;
            vm.progressStatus = statusText;
        },
        selectTab: function(tab) {
            vm.selectedTab = tab;
        },
        warning: "",
        progressStatus: "",
        status: "",
        // #note dont manual modify this variable
        authenticated: false,
        addressSummary: null,
        withFear: {
            stakeLockPeriodBN: ZeroBN,
            stakeLockExpirationBN: ZeroBN,
            unstakeFeeBN: ZeroBN,
            stakeCap: ZeroBN,
            stakedAmountBNInV4: ZeroBN,
            fearStakedBN: ZeroBN,
            fearBalanceBN: ZeroBN,
            remainingStakeQuotaBN: ZeroBN,
            fearToStake: null,
            fearToUnstake: null,
            stakeFear: async function(amountBN) {
                try {
                    vm.setWarning("");
                    setLoading("P2E_STAKE", true);
                    const accepted =  await dialogConfirm([
                        `Are you sure you want to stake <rb>${formatEther(amountBN, false)}</rb> $FEAR ?`,
                        `Your new unlock time will approximate <rb>${formatDate(getEpoch() + (+vm.withFear.stakeLockPeriodBN) * 86400)}</rb>`,
                    ].join("<br/>"));
                    if(accepted == false) return;
                    const allowance = await fear("fear_token").allowance(blockchain.address, CONTRACTS.fear_p2e.address);
                    if(allowance.lt(amountBN)) {
                        await dialogBusy("Approving", async () => {
                            const tx = await fear("fear_token").approve(CONTRACTS.fear_p2e.address, MaxInt256);
                            await tx.wait();
                        });
                    }
                    await dialogBusy("Staking", async () => {
                        const tx = await fear("fear_p2e").playToEarnWithFear(1, amountBN);
                        await tx.wait(MIN_TX_CONFIRMATIONS);
                    });
                    await dialogBusy("Refreshing stats", async () => {
                        await vm.getFearStakingStats();
                    });
                }
                catch(err) {
                    vm.setWarning(err);
                }
                finally {
                    setLoading("P2E_STAKE", false);
                }
            },
            unstakeFear: async function(amountBN) {
                try {
                    vm.setWarning("");
                    setLoading("P2E_UNSTAKE", true);
                    const fee = vm.withFear.unstakeFeeBN;
                    const outputAmount = amountBN.sub(amountBN.mul(fee).div(1000));
                    const accepted =  await dialogConfirm([
                        `Are you sure you want to unstake <rb>${formatEther(amountBN, false)}</rb> $FEAR ?`,
                        `Your will get <rb>${formatEther(outputAmount, false)}</rb> $FEAR (${formatFeePercent(fee)}% unstake fee)`,
                    ].join("<br/>"));
                    if(accepted == false) return;
                    await dialogBusy("Unstaking", async () => {
                        const tx = await fear("fear_p2e").unstakeFear(1, amountBN);
                        await tx.wait(MIN_TX_CONFIRMATIONS);
                    });
                    await dialogBusy("Refreshing stats", async () => {
                        await vm.getFearStakingStats();
                    });
                }
                catch(err) {
                    vm.setWarning(err);
                }
                finally {
                    setLoading("P2E_UNSTAKE", false);
                }
            },
        },
        getFearStakingStats: async function() {
            [
                vm.withFear.stakeCap,
                vm.withFear.remainingStakeQuotaBN,
                vm.withFear.fearBalanceBN,
                vm.withFear.fearStakedBN,
                vm.withFear.stakeLockPeriodBN,
                vm.withFear.stakeLockExpirationBN,
                vm.withFear.unstakeFeeBN,
            ] = await Promise.all([
                fear("fear_p2e").getMilestoneStakeCap(1),
                fear("fear_p2e").fearAllowanceRemaining(blockchain.address, 1),
                fear("fear_token").balanceOf(blockchain.address),
                fear("fear_p2e").getPlayerFearStake(blockchain.address, 1),
                fear("fear_p2e").stakeLockPeriod(),
                fear("fear_p2e").getStakeLockExpiration(blockchain.address),
                fear("fear_p2e").feePercentage(),
            ])
            vm.withFear.fearToStake = formatEther(
                BNMin(vm.withFear.fearBalanceBN, vm.withFear.remainingStakeQuotaBN),
                false
            );
            vm.withFear.fearToUnstake = formatEther(vm.withFear.fearStakedBN, false);
        },
        getStakingStats: async function() {
            vm.setBusy(true, "Getting your stats");
            try {
                await Promise.all([
                    vm.getFearStakingStats(),
                    vm.getFearStakedInP2Ev4(),
                    vm.fetchNFTsBalance(),
                ])
            }
            catch(err) {
                vm.setWarning(err);
            }
            vm.setBusy(false, "");
        },
        setWarning: function(e) {
            if(e === null || e === undefined) return;
            if(e instanceof Error) console.error(e);
            vm.warning = _.get(e, "data.message") || _.get(e, "message") || e;
        },

        // Dec 2021 Contract migration
        getFearStakedInP2Ev4: async () => {
            vm.withFear.stakedAmountBNInV4 = await fear("fear_p2eV4").getPlayerFearStake(blockchain.address, 1);
        },

        setProgressStatus: function(ps){
            vm.progressStatus = ps;
        },
        setStatus: function(st){
            vm.status = st;
        },
        showWarning: function(){
            return vm.warning !== null && vm.warning.length > 0;
        },
        showStatus: function() {
            return vm.status !== null && $.trim(vm.status) !== "";
        },
        walletConnect: async function(){
            vm.setBusy(true, "Connecting your wallet ...");
            
            vm.promptNetwork(async function(){
                vm.updateTabVisibility();
                vm.getStakingStats();
                vm.getPlayerStats();
                vm.fetchBloodCupUserStats(true);
            });
        },
        claimFear: async function(_amount) {
            try {
                vm.setWarning('');
                setLoading("P2E_CLAIM", true);
                const claimCap = +formatEther(await fear("fear_muon").maxPerTX());
                const amount = Math.min(_amount || vm.playerStats.rb, claimCap || 500);
                const chainId = blockchain.getApiChain(blockchain.chainId);
                const _muon = new muon('https://node1.muon.net/v1/');
                const jsonData = await _muon
                .app("fear_game")
                .method("claim", {
                    address: wallet.signature.address,
                    signature: wallet.signature.signature,
                    message: wallet.signature.message,
                    amount: amount,
                    chain: chainId
                })
                .call();
                if (!jsonData.confirmed) {
                    return vm.setWarning("Your request has been failed. Please try again in 30 minutes or contact the FEAR team");
                }
                const requestId = jsonData.reqId;
                const sigs = jsonData.sigs;
                const trackingId = jsonData.data.result.trackingId;
                const muonFearGame = fear("fear_muon");
                await dialogBusy(`Claiming ${amount} $FEAR`, async () => {
                    const tx = await muonFearGame.claim(
                        wallet.signature.address,
                        jsonData.data.result.reward,
                        trackingId,
                        await muonFearGame.chainId(),
                        jsonData.data.result.muonTimestamp,
                        requestId,
                        sigs
                    );
                    await tx.wait(MIN_TX_CONFIRMATIONS);
                })
                await dialogBusy("Refreshing stats", async () => {
                    await Promise.all([
                        vm.getPlayerStats(),
                        vm.getFearStakingStats(),
                    ]);
                });
            }
            catch (err){
                vm.setWarning(err);
            }
            finally {
                setLoading("P2E_CLAIM", false);
            }
        },
        updateTabVisibility: function(){
            if(blockchain.chainId != MATIC_CHAINID) return;
            vm.nftTabs.forEach(t => {
                t.visible = t.name == "My NFTs";
            })
        },
        promptNetwork: function(onSuccess){
            wallet.connect(() => {
                vm.chainId = blockchain.chainId;
                onSuccess();
            })
        },
        // #todo discard active connections
        reset: function() {
            _.assign(vm, vm.initialState);
        },

        // NFTs
        nfts: null,
        openOpenSea: (tokenId) => {
            window.open(`https://opensea.io/assets/matic/0xb9aee1ad85bed213b53329f060a13328eb26b7a0/${tokenId}`, 'blank')
        },
        fetchNFTsBalance: async () => {
            if (blockchain.chainId !== MATIC_CHAINID) return;
            const tokenIds = NFTsMetadata.map(n => n.id);
            let result = await fear("fear_nft").balanceOfBatch(
                _.times(3, _.constant(blockchain.address)),
                tokenIds
            );
            const balanceByTokenIds = _.zipObject(tokenIds, result.map(n => n.toNumber()));
            vm.nfts = NFTsMetadata.map(n => {
                return {
                    ...n,
                    balance: balanceByTokenIds[n.id],
                }
            })
        },

        // bloodcup tab
        bloodcup: {
            // competition
            current: {
                title: undefined,
                id: undefined,
                start: undefined,
                end: undefined,
                buyin: undefined,
                bonus: undefined,
                participantsCount: undefined,
                finalized: undefined,
                // user
                joined: undefined,
                unclaimed: undefined,
                // winners reward
                payouts: undefined,
            },
            // leaderboard
            leaderboard: undefined,
            leaderboardTotalPages: undefined,
            leaderboardTotalPlayers: undefined,
            leaderboardCurrentPage: 0,
            // blood nft
            user: {
                bloodBalanceBN: undefined,
                fearBalanceBN: undefined,
            },
            blood: {
                tokenId: 17,
                fearPriceBN: undefined,
                sellingFeeBN: undefined,
            },
        },
        fetchBloodCupStats: async () => {
            setLoading("BC", true);
            try {
                await vm.fetchCurrentCompetition();
                await vm.fetchLeaderboard(0);
            }
            catch(err) {
                vm.setWarning(err);
            }
            finally {
                setLoading("BC", false);
            }
        },
        fetchBloodCupUserStats: async (showLoadingAnimation = false) => {
            if(blockchain.chainId != MATIC_CHAINID) return;
            vm.setWarning("");
            try {
                if(showLoadingAnimation) setLoading("BC_USER", true);
                const bloodTokenId = vm.bloodcup.blood.tokenId;
                const [
                    _bloodBalanceBN,
                    _fearBalanceBN,
                    _bloodSellingFeeBN,
                    _joined,
                    _unclaimed,
                ] = await Promise.all([
                    fear("fear_nft").balanceOf(blockchain.address, bloodTokenId),
                    fear("fear_token").balanceOf(blockchain.address),
                    fear('exchange').feePercentage(),
                    fear("bloodcup").checkCurrentCompetitionParticipation(),
                    fear("bloodcup").getRewardBalance(),
                ])
                vm.bloodcup.user.bloodBalanceBN = _bloodBalanceBN;
                vm.bloodcup.user.fearBalanceBN = _fearBalanceBN;
                vm.bloodcup.blood.sellingFeeBN = _bloodSellingFeeBN;
                vm.bloodcup.current.joined = _joined;
                vm.bloodcup.current.unclaimed = _unclaimed[1].length == 0 ? 0 : _unclaimed[1].reduce((x,y) => x.add(y)).toNumber();
            }
            catch(err){
                vm.setWarning(err);
            }
            finally {
                if(showLoadingAnimation) setLoading("BC_USER", false);
            }
        },
        fetchCurrentCompetition: async () => {
            let bcContract, exContract;
            if(vm.authenticated === true) {
                bcContract = fear('bloodcup');
                exContract = fear('exchange');
            }
            else {
                const rpcUrl = CHAINS.find(c => +c.chainId === DEFAULT_CHAINID).rpc;
                const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
                const { address: bcAddress, abi: bcAbi } = CONTRACTS['bloodcup'][DEFAULT_CHAINID];
                bcContract = new ethers.Contract(bcAddress, bcAbi, provider);
                const { address: exAddress, abi: exAbi } = CONTRACTS['exchange'][DEFAULT_CHAINID];
                exContract = new ethers.Contract(exAddress, exAbi, provider);
            }
            const [
                _current,
                _bloodPriceInFear,
                _sellingFeeBN,
            ] = await Promise.all([
                bcContract.getCurrentCompetition(),
                getBloodPriceInFear(exContract),
                exContract.feePercentage(),
            ])
            vm.bloodcup.current = {
                ...vm.bloodcup.current,
                ..._current,
            };
            vm.bloodcup.current.payouts = _current.participantsCount == 0 ? [] : await bcContract.getCurrentCompetitionPayouts();
            vm.bloodcup.blood = {
                ...vm.bloodcup.blood,
                fearPriceBN: _bloodPriceInFear,
                sellingFeeBN: _sellingFeeBN,
            };
            // #hardcode
            if(getEpoch() < firstCampaignEndEpoch) vm.bloodcup.current = {
                ...vm.bloodcup.current,
                start: ethers.BigNumber.from(firstCampaignStartEpoch),
                end: ethers.BigNumber.from(firstCampaignEndEpoch),
            }
        },
        fetchLeaderboard: async (page = 0) => {
            vm.bloodcup.leaderboardCurrentPage = page;
            try {
                setLoading("BC_LEADERBOARD", true);
                const { leaders: leaderboard, p, pc } = await api.getLeaderBoard(page);
                vm.bloodcup.leaderboardTotalPlayers = pc;
                vm.bloodcup.leaderboardTotalPages = p;
                const payouts = getPayouts(+vm.bloodcup.current.participantsCount, +vm.bloodcup.current.buyin, +vm.bloodcup.current.bonus, +vm.bloodcup.current.equalLimit, +vm.bloodcup.current.itmPercentage);
                vm.bloodcup.leaderboard = leaderboard.map(p => ({
                    ...p,
                    a: (p.a && p.a != "Patrick" ? p.a : p.adds).substring(0, 24),
                    lpe: formatDate(p.lpe),
                    1: p.nfts !== null && p.nfts.split(",").includes("1"),
                    2: p.nfts !== null && p.nfts.split(",").includes("2"),
                    3: p.nfts !== null && p.nfts.split(",").includes("3"),
                    prize: payouts[p.o-1] || '',
                    prizeInFear: payouts[p.o-1] == undefined ? '' : formatEther(vm.bloodcup.blood.fearPriceBN.mul(payouts[p.o-1])),
                    o: medals[p.o-1] || `#${p.o}`,
                    void: p.v,
                }));
            }
            catch(err) {
                vm.setWarning(err);
            }
            finally {
                setLoading("BC_LEADERBOARD", false);
            }
        },
        bloodBuyAmount: '',
        buyBlood: async () => {
            if(!BC_ENABLED) {
                dialogAlert("Blood Cup 🏆 is temporary closed until the next game update");
                return;
            }
            setLoading("BC_BUY_BLOOD", true);
            vm.setWarning("");
            const waitForEvent = (_account, _id, _amount) => new Promise((resolve) => {
                const contract = fear('exchange');
                contract.on("NftBought", (account, id, amount) => {
                    if(account != _account || !id.eq(_id) || !amount.eq(_amount)) return;
                    contract.removeAllListeners();
                    resolve();
                });
            });
            try {
                const buyAmountBN = ethers.BigNumber.from(vm.bloodBuyAmount);
                if(!buyAmountBN.gte(OneBN)) return;
                // refresh balance if needed
                const bloodTokenId = vm.bloodcup.blood.tokenId;
                const fearBalanceBN = vm.bloodcup.user.fearBalanceBN;
                const bloodPriceBN = vm.bloodcup.blood.fearPriceBN;
                const fearBalanceRequired = buyAmountBN.mul(bloodPriceBN);
                if(fearBalanceBN.lt(fearBalanceRequired)) {
                    return dialogAlert(`
                        ⚠️ Insufficient FEAR balance <br/>
                        Required balance: <rb>${formatEther(fearBalanceRequired)}</rb> <br/>
                        Your balance: <rb>${formatEther(fearBalanceBN)}</rb> <br/>
                    `);
                }
                const confirm = await dialogConfirm(`
                    You are spending <rb>${formatEther(fearBalanceRequired)}</rb> FEAR to buy <rb>${buyAmountBN.toString()}</rb> Blood Vial<br/>
                    Are you sure 🤔 ?
                `);
                if(confirm === false) return;
                const fearAllowanceBN = await fear('fear_token').allowance(blockchain.address, CONTRACTS.exchange.address);
                if(fearAllowanceBN.lt(fearBalanceRequired)) {
                    await dialogBusy("Approving", async () => {
                        const tx = await fear("fear_token").approve(CONTRACTS.exchange.address, MaxInt256);
                        await tx.wait();
                    });
                }
                await dialogBusy("Buying", async () => {
                    const tx = await fear("exchange").buyNft(bloodTokenId, buyAmountBN);
                    // await waitForEvent(blockchain.address, bloodTokenId, buyAmountBN);
                    await tx.wait(3); // better wait for confirmations
                    await vm.fetchBloodCupUserStats();
                })
                vm.bloodBuyAmount = '';
                dialogAlert(`✅ You've bought ${buyAmountBN.toString()} Blood Vial`);
                vm.getFearStakingStats();
            }
            catch(err) {
                vm.setWarning(err)
            }
            finally {
                setLoading("BC_BUY_BLOOD", false);
            }
        },
        bloodSellAmount: '',
        sellBlood: async () => {
            setLoading("BC_SELL_BLOOD", true);
            vm.setWarning('');
            const waitForEvent = (_account, _id, _amount) => new Promise((resolve) => {
                const contract = fear('exchange');
                contract.on("NftSold", (account, id, amount) => {
                    if(account != _account || !id.eq(_id) || !amount.eq(_amount)) return;
                    contract.removeAllListeners();
                    resolve();
                });
            });
            try {
                const sellAmountBN = ethers.BigNumber.from(vm.bloodSellAmount);
                if(!sellAmountBN.gte(OneBN)) return;
                // refresh balance if needed
                const bloodBalanceBN = vm.bloodcup.user.bloodBalanceBN;
                const bloodPriceBN = vm.bloodcup.blood.fearPriceBN;
                const bloodTokenId = vm.bloodcup.blood.tokenId;
                if(bloodBalanceBN.lt(sellAmountBN)) {
                    return dialogAlert(`
                        ⚠️ Insufficient Blood Vial balance <br/>
                        Sell amount: <rb>${sellAmountBN.toString()}</rb> <br/>
                        Your balance: <rb>${bloodBalanceBN.toString()}</rb> <br/>
                    `);
                }
                const feePercentageBN = vm.bloodcup.blood.sellingFeeBN;
                const commissionBN = bloodPriceBN.mul(sellAmountBN).div(1000).mul(feePercentageBN);
                const fearAmountOutputBN = bloodPriceBN.mul(sellAmountBN).sub(commissionBN)
                const confirm = await dialogConfirm(`
                    You are selling <rb>${sellAmountBN.toString()}</rb> Blood Vial<br/>
                    You will get <rb>${formatEther(fearAmountOutputBN)}</rb> FEAR <br/>
                    Are you sure 🤔 ?
                `);
                if(confirm === false) return;
                const bloodSpendingAllowed = await fear("fear_nft").isApprovedForAll(blockchain.address, CONTRACTS.exchange.address);
                if(!bloodSpendingAllowed) {
                    await dialogBusy("Approving", async () => {
                        const tx = await fear("fear_nft").setApprovalForAll(CONTRACTS.exchange.address, true);
                        await tx.wait();
                    })
                }
                await dialogBusy(`Selling`, async () => {
                    const tx = await fear("exchange").sellNft(bloodTokenId, sellAmountBN);
                    // await waitForEvent(blockchain.address, bloodTokenId, sellAmountBN);
                    await tx.wait(3); // better wait for confirmations
                    await vm.fetchBloodCupUserStats();
                })
                vm.bloodSellAmount = '';
                dialogAlert(`✅ You've sold ${sellAmountBN.toString()} Blood Vial`);
                vm.getFearStakingStats();
            }
            catch(err) {
                vm.setWarning(err);
            }
            finally {
                setLoading("BC_SELL_BLOOD", false);
            }
        },
        joinBloodCup: async () => {
            if(!BC_ENABLED) {
                dialogAlert("Blood Cup 🏆 is temporary closed until the next game update");
                return;
            }
            setLoading("BC_JOIN", true);
            vm.setWarning("");
            try {
                const bloodBalanceBN = vm.bloodcup.user.bloodBalanceBN;
                const buyinBN = vm.bloodcup.current.buyin;
                if( bloodBalanceBN.lt(buyinBN) ) return dialogAlert(`
                    ⚠️ Insufficient balance <br/>
                    Required: <rb>${buyinBN.toString()}</rb> Blood Vial
                `);
                const confirm = await dialogConfirm(`
                    You are committing <rb>${buyinBN.toString()}</rb> Blood Vial to join Blood Cup<br/>
                    Are you sure 🤔 ?
                `);
                if( confirm === false ) return;
                const bloodSpendingAllowed = await fear("fear_nft").isApprovedForAll(blockchain.address, CONTRACTS.bloodcup.address);
                if(!bloodSpendingAllowed) {
                    await dialogBusy("Approving", async () => {
                        const tx = await fear("fear_nft").setApprovalForAll(CONTRACTS.bloodcup.address, true);
                        await tx.wait();
                    });
                }
                await dialogBusy("Joining", async () => {
                    const tx = await fear("bloodcup").enterCurrentCompetition();
                    await tx.wait();
                    await vm.fetchCurrentCompetition();
                    await vm.fetchBloodCupUserStats();
                });
                dialogAlert(`Welcome to Blood Cup 🏆`);
                vm.getFearStakingStats();
            }
            catch(err) {
                vm.setWarning(err);
            }
            finally {
                setLoading("BC_JOIN", false);
            }
        },
        claimBloodCupReward: async () => {
            setLoading("BC_CLAIM", true);
            vm.setWarning("");
            const waitForEvent = (_account) => new Promise((resolve) => {
                const contract = fear('bloodcup');
                contract.on("RewardsClaimed", (account, ids, amounts) => {
                    if(account != _account) return;
                    contract.removeAllListeners();
                    resolve();
                });
            });
            try {
                await dialogBusy("Claiming", async () => {
                    const tx = await fear("bloodcup").claimRewards();
                    // await waitForEvent(blockchain.address);
                    await tx.wait(3);
                    await vm.fetchCurrentCompetition();
                    await vm.fetchBloodCupUserStats();
                });
                dialogAlert(`✅ Reward claimed`);
                vm.getFearStakingStats();
            }
            catch(err){
                vm.setWarning(err);
            }
            finally {
                setLoading("BC_CLAIM", false);
            }
        },

        xParticipantsCount: undefined,
        xBuyin: undefined,
        xBonus: undefined,
        rewardTable: undefined,
        setCalculatorVisible: async (visible = true) => {
            vm.xParticipantsCount = +vm.bloodcup.leaderboardTotalPlayers || 100;
            vm.xBuyin = +vm.bloodcup.current.buyin || 5;
            vm.xBonus = +vm.bloodcup.current.bonus || 0;
            if(visible == false) return vm.rewardTable = null;
            vm.updateBCRewardTable();
        },
        updateBCRewardTable: async () => {
            const { xParticipantsCount, xBuyin, xBonus } = vm;
            const equalLimit = vm.bloodcup.current.equalLimit;
            const itmPercentage = vm.bloodcup.current.itmPercentage;
            const payouts = getPayouts(+xParticipantsCount, +xBuyin, +xBonus, +equalLimit, +itmPercentage);
            vm.rewardTable = payouts.map((reward, index) => {
                return [medals[index] || `#${index+1}`, +reward, formatEther(vm.bloodcup.blood.fearPriceBN.mul(reward))];
            });
        },

        // nft transfer
        _nftTransfer: async (nftDetail) => {
            const fearNFT = fear('fear_nft');
            const waitForTransferEvent = (from, to, id, amount) => new Promise((resolve, reject) => {
                fearNFT.on("TransferSingle", (_operator, _from, _to, _id, _amount) => {
                    try {
                        if(
                            _from !== from ||
                            _to !== to ||
                            _id.toNumber() !== id ||
                            _amount.toNumber() !== amount
                        ) return;
                        fearNFT.removeAllListeners();
                        resolve();
                    }
                    catch (e){
                        reject(e);
                    }
                });
            })
            const { id, balance, name } = nftDetail;
            const toAddress = await dialogPrompt("Transfer to");
            if(toAddress === null) return;
            if(
                !/^0x[a-fA-F0-9]{40}$/.test(toAddress) || !ethers.utils.isAddress(toAddress)
            ) return dialogAlert("⚠️ Invalid address !");
            const _amount = await dialogPrompt("Transfer amount", 1);
            if(_amount === null) return;
            const amount = +_amount;
            if(! (amount >=1 && amount <= balance ) ) {
                return dialogAlert("⚠️ Transfer amount invalid or excess balance !");
            }
            await dialogBusy(`Transfering <rb>${amount}</rb> "${name}" to <rb>${toAddress}</rb>`, async () => {
                const tx = await fearNFT.safeTransferFrom(blockchain.address, toAddress, id, amount, 0);
                await tx.wait(MIN_TX_CONFIRMATIONS);
                // await waitForTransferEvent(blockchain.address, toAddress, id, amount);
                await vm.fetchNFTsBalance();
            });
            dialogAlert("✅ Transfer completed");
        },
        nftTransfer: async (nftDetail) => {
            try {
                vm.setWarning("");
                await vm._nftTransfer(nftDetail);
            }
            catch(err) {
                vm.setWarning(err);
            }
        }
    });

    vm = Alpine.store("vm");

    if (!window.ethereum){
        vm.disableWalletConnect = true;
        vm.setWarning("Please install Metamask Wallet to use the Devil's Chest");
    }

    vm.initialState = _.cloneDeep(
        _.fromPairs(
            _.toPairs(vm).filter(
                ([k, v]) => !_.isFunction(v)
            )
        )
    );

    vm.fetchBloodCupStats();
    // update Epoch
    setInterval(() => {
        vm.epoch = getEpoch();
        if(vm.epoch == firstCampaignStartEpoch) window.location.reload();
    }, 1000);
}
