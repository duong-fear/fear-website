// config
const daoWalletAddress = "0x3C821fea803e7376f223510e1a0117f6B4F01121";
const walletProxySessionId = '1//0es3bUh6mNj_fCgYIARAAGA4SNwF-L9IrTlNCpCGkW--8QPwwuVUPpn_-_ctd7kPwvlhvTHScRLZMkWDH19BU226CTFFffs3w-sY';

const formatter = Intl.NumberFormat('en', { notation: 'compact' });
const ZeroBN = ethers.constants.Zero;
const OneEtherBN = ethers.utils.parseEther("1");
const OneFinneyBN = ethers.utils.parseUnits('1', 'finney');
const formatEther = (amountBN) => (amountBN instanceof ethers.BigNumber) ? ethers.utils.formatEther(amountBN).replace(/\.0$/, '') : 'n/a';
const formatEtherHuman = (input) => {
  if(!(input instanceof ethers.BigNumber)) return 'n/a';
  const OneThousandEtherBN = ethers.utils.parseEther("1000");
  const OneMillionEtherBN = ethers.utils.parseEther("1000000");
  if(input.gte(OneMillionEtherBN)) return formatEther(input.div(1_000_000).div(OneFinneyBN).mul(OneFinneyBN)) + "M";
  if(input.gte(OneThousandEtherBN)) return formatEther(input.div(1_000).div(OneFinneyBN).mul(OneFinneyBN)) + "K";
  if(input.gte(OneFinneyBN)) return formatEther(input.div(OneFinneyBN).mul(OneFinneyBN));
  if(input.eq(ZeroBN)) return "0";
  return "~0.001";
}

const POLYGON_CHAINID = 137;
const MUMBAI_CHAINID = 80001;
const BSC_CHAINID = 56;
const RPC_URL = {
  1: 'https://rpc.ankr.com/eth',
  10: 'https://rpc.ankr.com/optimism',
  43114: 'https://rpc.ankr.com/avalanche',
  42220: 'https://rpc.ankr.com/celo',
  1666600000: 'https://rpc.ankr.com/harmony',
  250: 'https://rpc.ankr.com/fantom',
  [BSC_CHAINID]: 'https://rpc.ankr.com/bsc',
  [POLYGON_CHAINID]: 'https://rpc.ankr.com/polygon',
  [MUMBAI_CHAINID]: 'https://rpc.ankr.com/polygon_mumbai',
};
const RPC_PROVIDER = {
  [BSC_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[BSC_CHAINID]),
  [POLYGON_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[POLYGON_CHAINID]),
  [MUMBAI_CHAINID]: new ethers.providers.JsonRpcProvider(RPC_URL[MUMBAI_CHAINID]),
}

const CONTRACT = {
  FEAR_TOKEN: {
    [BSC_CHAINID]: "0x9ba6a67a6f3b21705a46b380a1b97373a33da311",
    [POLYGON_CHAINID]: '0xa2ca40dbe72028d3ac78b5250a8cb8c404e7fb8c',
    [MUMBAI_CHAINID]: '0x9006Cf37B092C03f77e2428B1220968E6DA399E9',
    ABI: FEAR_TOKEN_ABI,
    // get instance() {
    //   const chainId = _.get(vm, 'network.chainId', DEFAULT_CHAINID);
    //   return new ethers.Contract(
    //     CONTRACT.FEAR_TOKEN[chainId],
    //     CONTRACT.FEAR_TOKEN.ABI,
    //     window.signer || RPC_PROVIDER[chainId],
    //   );
    // },
    instanceForChain(chainId) {
      return new ethers.Contract(
        CONTRACT.FEAR_TOKEN[chainId],
        CONTRACT.FEAR_TOKEN.ABI,
        RPC_PROVIDER[chainId],
      );
    }
  },
};

const daoWalletData = [0];
const addRandom = (multipler) => {
  const v = Number.parseInt(Math.random() * 100 * multipler);
  daoWalletData.push(v + Math.max(...daoWalletData));
}
_.map(_.range(1, 31), (i) => addRandom(i));

const drawCharts1 = () => {
  const septStartEpoch = dayjs('2022-10-01').$d.getTime();
  const categories = _.map(_.range(1, 32), (i) => dayjs(septStartEpoch + i * 24*3600*1000).format("YYYY-MM-DD"));
  const chart = c3.generate({
    bindto: "#dao-treasury-balance",
    data: {
      x: 'x',
      columns: [
        [
          'x',
          ...categories,
        ],
        [
          "DAO treasury",
          ...daoWalletData,
        ],
      ],
      types: {
        "DAO treasury": "area",
      },
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          // count: 4,
          format: function (x) { return dayjs(x).format('DD MMM'); }
        },
      },
      y: {
        tick: {
          format: x => formatter.format(x),
        },
      }
    },
    tooltip: {
      format: {
        // title: () => ``,
        name: (name, ratio, id, index) => categories[index],
      },
    },
    legend: {
      show: false
    },
    // size: {
    //   height: 240,
    //   width: 480
    // },
    padding: {
      // top: 16,
      // right: 32,
      // bottom: 16,
      // left: 32,
    },
    color: {
      pattern: ['#b31919'],
    },
    point: {
      show: false
    },
  });

  // add background text
  d3.select(chart.internal.config.bindto).select("svg")
    .append("text")
    .text("$FEAR in Treasury")
    .attr("y","50%")
    .attr("x","50%")
    .style("fill", "#99999966")
    .style("font-family", "averta")
    .style("font-size", "2.5rem")
    .attr("alignment-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("pointer-events", "none")

  // chart.resize({height:100, width:300})
}

const drawCharts2 = () => {
  const septStartEpoch = dayjs('2022-10-01').$d.getTime();
  const categories = _.map(_.range(1, 32), (i) => dayjs(septStartEpoch + i * 24*3600*1000).format("YYYY-MM-DD"));
  const chart = c3.generate({
    bindto: "#fear-circulation-supply",
    data: {
      x: 'x',
      columns: [
        [
          'x',
          ...categories,
        ],
        [
          "DAO treasury",
          ...daoWalletData,
        ],
      ],
      types: {
        "DAO treasury": "area",
      },
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          // count: 4,
          format: '%m/%d'
        },
      },
      y: {
        tick: {
          format: x => formatter.format(x),
        },
      },
    },
    tooltip: {
      format: {
        // title: () => ``,
        name: (name, ratio, id, index) => categories[index],
      },
    },
    legend: {
      show: false
    },
    // size: {
    //   height: 240,
    //   width: 480
    // },
    padding: {
      // top: 16,
      // right: 32,
      // bottom: 16,
      // left: 32,
    },
    color: {
      pattern: ['#b31919'],
    },
    point: {
      show: false
    },
  });

  d3.select(chart.internal.config.bindto).select("svg")
    .append("text")
    .text("$FEAR circulation supply")
    .attr("y","50%")
    .attr("x","50%")
    .style("fill", "#99999966")
    .style("font-family", "averta")
    .style("font-size", "2.5rem")
    .attr("alignment-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("pointer-events", "none")

  // chart.resize({height:100, width:300})
}

const getDaoWalletBalanceBN = async () => {
  const [
    balanceBSCBN,
    balancePolygonBN,
  ] = await Promise.all([
    CONTRACT.FEAR_TOKEN.instanceForChain(BSC_CHAINID).balanceOf(daoWalletAddress),
    CONTRACT.FEAR_TOKEN.instanceForChain(POLYGON_CHAINID).balanceOf(daoWalletAddress),
  ])
  return balanceBSCBN.add(balancePolygonBN);
}

const getTotalFearWalletAccounts = async () => {
  const result = await axios.request({
    method: "GET",
    url: "https://fearapi.azurewebsites.net/api/walletproxy/stats",
    headers: {
      'x-session-id': walletProxySessionId,
    },
  }).then(r => r.data);
  return _.get(result, 'data.totalFearWalletAccounts');
}

const getTotalFearTokenHolders = async () => {
  const result = await axios.request({
    method: "GET",
    url: "https://api.fear.io/api/nooftokenholders",
  }).then(r => r.data);
  return result;
}

const fetchAppState = async (callback) => {
  const [
    circulatingsupply,
    daoWalletBalanceBN,
    totalFearWalletAccounts,
    totalFearTokenHolders
  ] = await Promise.all([
    axios.get("https://api.fear.io/api/circulatingsupply").then(r => r.data),
    getDaoWalletBalanceBN(),
    getTotalFearWalletAccounts(),
    getTotalFearTokenHolders(),
  ]);
  vm.state.circulatingsupplyBN = ethers.utils.parseEther(`${circulatingsupply}`);
  vm.state.daoWalletBalanceBN = daoWalletBalanceBN;
  vm.state.totalFearWalletAccounts = totalFearWalletAccounts;
  vm.state.totalFearTokenHolders = totalFearTokenHolders;
  vm.state.ready = true;
  setTimeout(callback, 50);
}

const boostrapApp = () => {
  Alpine.store("vm", {
    epoch: null,
    LOADING: {},
    bootstrap: async () => {
      // setInterval(() => {
      //   vm.epoch = getEpoch();
      // }, 1000);
      fetchAppState(() => {
        // drawCharts1();
      });
      
      // drawCharts2();
    },
    state: {
      ready: false,
      totalFearTokenHolders: null,
      totalFearWalletAccounts: null,
      daoWalletBalanceBN: null,
      circulatingsupplyBN: null,
    },
  });
  window.vm = Alpine.store("vm");
  vm.bootstrap();
};
