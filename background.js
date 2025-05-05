console.log('Background service worker loaded');
let appData = null;
const explainCache = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRIVACY_DATA') {
    getCachedOrProcessData(message.data).then(processedData => {
      chrome.storage.local.set({ appData: processedData }, () => {
        appData = processedData;
        updateExtensionIcon();
        console.log('Data updated:', processedData);
        sendResponse({ received: true });
      });
    });
    return true;
  }
});

async function processData(rawData) {
  const PERMISSION_WEIGHTS = { Location: 15, Camera: 12, Microphone: 12, Contacts: 10, SMS: 15, Storage: 8 };
  const permissionScore = (rawData.permissions?.detected || []).reduce((sum, p) => sum + (PERMISSION_WEIGHTS[p.permission] || 5), 0);
  const TRACKER_WEIGHTS = { 'facebook.com': 8, 'google-analytics.com': 5, 'doubleclick.net': 7, 'appsflyer.com': 6 };

  const networkScore = (rawData.networkRequests || []).reduce((sum, url) => {
    let w = 3;
    Object.entries(TRACKER_WEIGHTS).forEach(([d, wt]) => { if (url.includes(d)) w = wt; });
    return sum + w;
  }, 0);

  const randomFactor = Math.floor(Math.random() * 3);
  const totalScore = Math.min(100, permissionScore + networkScore + randomFactor);

  const detailedPermissions = await Promise.all(
    (rawData.permissions.detected || []).map(async perm => ({
      ...perm,
      nlExplanation: await explainPermissionWithGemini(perm)
    }))
  );

  return {
    ...rawData,
    permissions: { ...rawData.permissions, detected: detailedPermissions },
    classification: {
      riskLevel: totalScore > 50 ? 'High' : totalScore > 25 ? 'Medium' : 'Low',
      score: totalScore,
      confidence: Math.min(95, totalScore + 30),
      aiPowered: true
    }
  };
}

function updateExtensionIcon() {
  if (!appData) return;
  const icons = { High: 'assets/red48.png', Medium: 'assets/yellow48.png', Low: 'assets/green48.png' };
  const path = icons[appData.classification.riskLevel] || 'assets/risk-icon.png';
  chrome.action.setIcon({ path });
}

function getCachedOrProcessData(rawData) {
  const appId = rawData.appId;
  if (!appId) return processData(rawData);

  return new Promise(resolve => {
    chrome.storage.local.get(['appCache'], ({ appCache = {} }) => {
      const cached = appCache[appId];
      if (cached && Date.now() - cached.timestamp < 24*60*60*1000) {
        console.log('Using cached data');
        resolve(cached);
      } else {
        processData(rawData).then(result => {
          appCache[appId] = { ...result, timestamp: Date.now() };
          chrome.storage.local.set({ appCache }, () => resolve(result));
        });
      }
    });
  });
}

chrome.storage.onChanged.addListener(changes => {
  if (changes.appData) appData = changes.appData.newValue;
});

async function explainPermissionWithGemini(permissionItem) {
  if (explainCache[permissionItem.permission]) return explainCache[permissionItem.permission];
  const { geminiKey } = await chrome.storage.sync.get('geminiKey');
  if (!geminiKey) return permissionItem.reason;
  const prompt = `You are a mobile privacy expert. Explain in 2-3 sentences why granting the "${permissionItem.permission}" permission is risky. Context: ${permissionItem.reason}`;
  const resp = await fetch('https://gemini.googleapis.com/v1beta/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${geminiKey}` },
    body: JSON.stringify({ model: 'gemini-pro', prompt, max_output_tokens: 150 })
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.text?.trim() || permissionItem.reason;
  explainCache[permissionItem.permission] = text;
  return text;
}