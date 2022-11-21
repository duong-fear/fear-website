const showOrderSuccessNotification = async (orderData) => {
  const message = "Your order has been completed. Please check your wallet.";
  if(typeof Swal !== 'function') return alert(message);
  return await Swal.fire({
    icon: 'success',
    title: 'Success',
    text: message,
    confirmButtonText: 'OK',
  });
}

function launchTransak(){
  let transakInstance = new TransakSDK.default({
    apiKey: "80f00610-32cc-4d01-8eb0-dfc825c2ef53",
    environment: "PRODUCTION",
    // apiKey: "7d6a06fa-223f-481d-b6d3-268aac4c86ad",
    // environment: "STAGING",
    cryptoCurrencyCode: "FEAR",
    network: 'polygon',
    themeColor:"000000",
    email: "",
    redirectURL: "",
    hostURL: window.location.origin,
    widgetHeight:"550px",
    widgetWidth:"450px",
  });
  transakInstance.init();
  transakInstance.on(transakInstance.ALL_EVENTS, (data) => {
    console.log("transak EVENTS", data)
  });
  transakInstance.on(transakInstance.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (orderData) => {
    console.log("transak TRANSAK_ORDER_SUCCESSFUL", orderData);
    showOrderSuccessNotification(orderData);
  });
  transakInstance.on(transakInstance.EVENTS.TRANSAK_WIDGET_CLOSE,() => {
    console.log("TRANSAK_WIDGET_CLOSE");
    transakInstance.close();
  },);
}

window.onload = function(){
  $("#transakLink").on("click", launchTransak);
};