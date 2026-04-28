// background.js – Service Worker for NKY-Storage-Editor Extension

// Listen for extension installed or updated events
chrome.runtime.onInstalled.addListener(() => {
  console.log('NKY-Storage-Editor extension installed/updated');
});

// Optionally handle messages from other parts (e.g., keep-alive ping)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // No specific messages currently; placeholder for future use.
  return false; // no async response
});
