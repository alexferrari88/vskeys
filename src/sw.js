// src/sw.js
// src/sw.js
console.log("VS Keys service worker starting."); // Log when SW starts

chrome.runtime.onInstalled.addListener((details) => {
  console.log("VS Keys extension installed/updated. Reason:", details.reason);
  // You could set up initial storage or context menus here if needed.
  // For example, to ensure storage is initialized:
  // chrome.storage.sync.get(null, (items) => {
  //   if (Object.keys(items).length === 0) {
  //     console.log("VS Keys SW: Initializing default settings on install.");
  //     // Potentially set defaults here if not handled by options page first load
  //   }
  // });
});

// This event fires when the service worker is first activated or reactivated
// after being terminated.
self.addEventListener('activate', (event) => {
  console.log('VS Keys service worker activated.');
  // event.waitUntil(clients.claim()); // Ensures SW takes control of pages immediately, might be useful for some scenarios
});

// A simple message listener can also help keep it active if messages are sent to it,
// and provides a way to check if it's responsive.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log("VS Keys SW received message:", message);
    if (message.type === "PING_SW") {
        console.log("VS Keys SW received PING_SW, sending PONG_SW.");
        sendResponse({ ack: "PONG_SW", status: "Service worker is active." });
        return true; // Indicates you wish to send a response asynchronously (important for sendResponse)
    }
    // Return false or undefined if not handling the message or not sending an async response
});

// Log to confirm the script is fully parsed and listeners are attached.
// console.log("VS Keys service worker script fully parsed and listeners attached.");