import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log('Installed!');
});

browser.browserAction.onClicked.addListener((tab) => {
  if (tab.id) {
    browser.tabs.sendMessage(tab.id, { action: 'insertFolkCanvas' });
  }
});
