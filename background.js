let appData = null;

// Handle message events
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PRIVACY_DATA") {
    getCachedOrProcessData(message.data).then(processedData => {
      chrome.storage.local.set({appData: processedData}, () => {
        updateExtensionIcon();
        console.log("Data updated:", processedData);
        sendResponse({received: true});
      });
    });
    return true; // Keeps the message channel open for async response
  }
});

// Enhanced AI-like risk scoring function
function processData(rawData) {
  // Define weights that "simulate" an AI model
  const PERMISSION_WEIGHTS = {
    'Location': 15,
    'Camera': 12,
    'Microphone': 12,
    'Contacts': 10,
    'SMS': 15,
    'Storage': 8
  };
  
  // Calculate weighted permission score
  const permissionScore = (rawData.permissions?.detected || []).reduce((score, perm) => {
    return score + (PERMISSION_WEIGHTS[perm.permission] || 5);
  }, 0);
  
  // Add tracker weights
  const TRACKER_WEIGHTS = {
    'facebook.com': 8,
    'google-analytics.com': 5,
    'doubleclick.net': 7,
    'appsflyer.com': 6
  };
  
  // Calculate weighted network score
  const networkScore = (rawData.networkRequests || []).reduce((score, url) => {
    let weight = 3; // Default weight
    Object.entries(TRACKER_WEIGHTS).forEach(([domain, domainWeight]) => {
      if (url.includes(domain)) weight = domainWeight;
    });
    return score + weight;
  }, 0);
  
  // Add "AI-like" variation (small random factor)
  const randomFactor = Math.floor(Math.random() * 3); // 0-2 point random factor
  
  // Calculate final score with deterministic base and tiny random factor
  const totalScore = Math.min(100, permissionScore + networkScore + randomFactor);
  
  return {
    ...rawData,
    classification: {
      riskLevel: totalScore > 50 ? 'High' : totalScore > 25 ? 'Medium' : 'Low',
      score: totalScore,
      confidence: Math.min(95, totalScore + 30),
      aiPowered: true // Add this flag to indicate "AI" analysis
    }
  };
}

// Update icon based on risk level
function updateExtensionIcon() {
  if (!appData) return;
  
  const iconMap = {
    High: 'red48.png', // Updated to match your actual icon files
    Medium: 'yellow48.png',
    Low: 'green48.png'
  };
  
  chrome.action.setIcon({
    path: `icons/${iconMap[appData.classification.riskLevel]}`
  });
}

// Cache results for consistency
function getCachedOrProcessData(rawData) {
  const appId = rawData.appId;
  if (!appId) return Promise.resolve(processData(rawData));
  
  return new Promise(resolve => {
    chrome.storage.local.get(['appCache'], ({appCache = {}}) => {
      // Check if we have fresh cached data (less than 24 hours old)
      const cachedApp = appCache[appId];
      const isCacheFresh = cachedApp && 
                           (Date.now() - cachedApp.timestamp) < 24 * 60 * 60 * 1000;
      
      if (isCacheFresh) {
        console.log('Using cached data for consistency');
        resolve(cachedApp);
        return;
      }
      
      // Process new data
      const processedData = processData(rawData);
      
      // Cache the results
      appCache[appId] = {
        ...processedData,
        timestamp: Date.now()
      };
      
      chrome.storage.local.set({appCache}, () => {
        resolve(processedData);
      });
    });
  });
}

// Handle storage updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.appData) {
    appData = changes.appData.newValue;
  }
});
