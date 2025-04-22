let appData = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PRIVACY_DATA") {
    appData = processData(message.data);
    chrome.storage.local.set({appData}, () => {
      updateExtensionIcon();
      console.log("Data updated:", appData);
    });
  }
  sendResponse({received: true});
});

function processData(rawData) {
  const permissionScore = rawData.permissions?.totalRisk || 0;
  const networkScore = rawData.networkRequests?.length * 5 || 0;
  const totalScore = Math.min(100, permissionScore + networkScore);
  
  return {
    ...rawData,
    classification: {
      riskLevel: totalScore > 50 ? 'High' : totalScore > 25 ? 'Medium' : 'Low',
      score: totalScore,
      confidence: Math.min(95, totalScore + 30)
    }
  };
}

function updateExtensionIcon() {
  if (!appData) return;
  
  const iconMap = {
    High: 'icon-red.png',
    Medium: 'icon-yellow.png',
    Low: 'icon-green.png'
  };
  
  chrome.action.setIcon({
    path: `assets/${iconMap[appData.classification.riskLevel]}`
  });
}

// Handle storage updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.appData) {
    appData = changes.appData.newValue;
  }
});
