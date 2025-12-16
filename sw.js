self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // If the request is for the Azure API, we want the browser (and Playwright) to handle it naturally 
  // so that Playwright's network interception can catch it. 
  // However, if the SW handles it with fetch(event.request), Playwright usually still sees it.
  // But to be safe, let's just ignore non-navigation, non-local requests?
  // Or just pass through.
  event.respondWith(fetch(event.request));
});
