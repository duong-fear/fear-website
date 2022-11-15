const formatter = Intl.NumberFormat('en', { notation: 'compact' });
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

const fetchAppState = async (callback) => {
  const [
    circulatingsupply
  ] = await Promise.all([
    axios.get("https://api.fear.io/api/circulatingsupply").then(r => r.data),
  ]);
  vm.state.circulatingsupplyBN = ethers.utils.parseEther(`${circulatingsupply}`);
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
        drawCharts1();
      });
      
      // drawCharts2();
    },
    state: {
      ready: false,
      totalHolders: 2537,
      daoWalletBalanceBN: ethers.utils.parseEther("3156"),
      circulatingsupplyBN: null,
    },
  });
  window.vm = Alpine.store("vm");
  vm.bootstrap();
};
