const boostrapApp = () => {
  Alpine.store('vm', {
    tabList: [
      "The Crypt",
      "The Tomb",
    ],
    activeTabId: 0,
    update() {
      this.text = '2nd';
    }
  })
  window.vm = Alpine.store('vm');
  console.log("boostrap finished");
}