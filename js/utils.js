const getEpoch = () => Number.parseInt((new Date()).getTime()/1000);
const sleep = seconds => new Promise((resolve) => {
  setTimeout(resolve, seconds*1000);
})
