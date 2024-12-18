import browser from 'webextension-polyfill';

browser.runtime.onMessage.addListener((message: any) => {
  console.log('HELLO MESSAGE', message);
  if (message.action === 'insertFolkCanvas') {
    // Inject 'injected.js' into the page context
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('injected.js');
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
  return true;
});
