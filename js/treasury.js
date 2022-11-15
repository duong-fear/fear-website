let formatter = Intl.NumberFormat('en', { notation: 'compact' });

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

const boostrapApp = () => {
  Alpine.store("vm", {
    epoch: null,
    LOADING: {},
    bootstrap: async () => {
      // setInterval(() => {
      //   vm.epoch = getEpoch();
      // }, 1000);
      drawCharts1();
      drawCharts2();
    },
    stats: {
      totalHolders: 2537,
      daoWalletBalanceBN: ethers.utils.parseEther("3156"),
    },
  });
  window.vm = Alpine.store("vm");
  vm.bootstrap();
};
