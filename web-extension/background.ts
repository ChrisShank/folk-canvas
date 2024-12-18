import browser from 'webextension-polyfill';

browser.browserAction.onClicked.addListener((tab) => {
  if (tab.id) {
    browser.tabs.sendMessage(tab.id, { action: 'insertFolkCanvas' });
  }
});
