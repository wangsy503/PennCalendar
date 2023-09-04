const extractButton = document.getElementById('extractButton');

extractButton.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const activeTabId = tabs[0].id;
        console.log('Sending start extraction message to tab id: ' + activeTabId);
        chrome.runtime.sendMessage({tabId: activeTabId, action: 'startExtraction' });
    });
});

  
  