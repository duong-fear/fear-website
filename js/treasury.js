const daoWalletData = [0];
const addRandom = (multipler) => {
  const v = Number.parseInt(Math.random() * 100 * multipler);
  daoWalletData.push(v + Math.max(...daoWalletData));
}
_.map(_.range(1, 31), (i) => addRandom(i));

const drawCharts = () => {
  const categories = _.map(_.range(1, 32), (i) => `${i}th`);
  return c3.generate({
    bindto: "#token-release-chart",
    data: {
      columns: [
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
        type: 'category',
        categories,
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
      drawCharts();
    },
    sdd: "testt",
    stats: {
      totalHolders: 2537,
      daoWalletBalanceBN: ethers.utils.parseEther("3156"),
    },
  });
  window.vm = Alpine.store("vm");
  vm.bootstrap();
};
