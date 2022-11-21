// self.clients.matchAll().then(function(clients) {
//   clients.forEach(function(client) {
//     console.log("client", client);
//     client.postMessage('The service worker just started up.');
//   });
// });

// self.addEventListener('install', function(event) {
//   event.waitUntil(self.skipWaiting());
//   console.log("service worker installed");
// });

// self.addEventListener('activate', function(event) {
//   event.waitUntil(self.clients.claim());
//   console.log("service worker activated");
// });

// self.addEventListener('message', function(event) {
//   console.log('service worker got message:', event);
// });