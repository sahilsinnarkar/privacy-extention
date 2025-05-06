const RISKY_PERMISSIONS = {
  'Location': { risk: 9, reason: 'Tracks physical movements' },
  'Camera': { risk: 8, reason: 'Potential visual surveillance' },
  'Microphone': { risk: 8, reason: 'Audio recording capability' },
  'Contacts': { risk: 7, reason: 'Access to personal network' },
  'SMS': { risk: 9, reason: 'Read sensitive messages' },
  'Storage': { risk: 6, reason: 'Access to personal files' }
};

const OBSERVED_DOMAINS = [
  'facebook.com', 'google-analytics.com', 'doubleclick.net',
  'appsflyer.com', 'adjust.com', 'branch.io', 'exelator.com'
];

function analyzePermissions() {
  const permissionElements = Array.from(
    document.querySelectorAll(".qQX7N, .fQ6Kb, .VfPpkd-BIzmGd, [itemprop='permissions'] div")
  );

  const detected = [];
  let totalRisk = 0;

  permissionElements.forEach(el => {
    const permText = el.textContent.trim().replace(/[·•]/g, '');
    if (RISKY_PERMISSIONS[permText]) {
      detected.push({
        permission: permText,
        ...RISKY_PERMISSIONS[permText]
      });
      totalRisk += RISKY_PERMISSIONS[permText].risk;
    }
  });

  return { detected, totalRisk };
}

function analyzeNetworkRequests() {
  try {
    const resources = performance.getEntriesByType("resource");
    const scripts = Array.from(document.querySelectorAll('script[src], iframe[src]'));

    const detected = [
      ...resources.filter(r => OBSERVED_DOMAINS.some(d => r.name.includes(d))),
      ...scripts.filter(s => OBSERVED_DOMAINS.some(d => s.src.includes(d)))
    ].map(item => item.name || item.src);

    return [...new Set(detected)]; // Remove duplicates
  } catch (error) {
    console.error("Network analysis failed:", error);
    return [];
  }
}

function initialize() {
  let retries = 0;
  const maxRetries = 3;

  function runAnalysis() {
    try {
      const permissions = analyzePermissions();
      const networkRequests = analyzeNetworkRequests();

      chrome.runtime.sendMessage({
        type: "PRIVACY_DATA",
        data: {
          permissions,
          networkRequests,
          appId: new URLSearchParams(window.location.search).get('id'),
          timestamp: Date.now()
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          if (retries < maxRetries) {
            retries++;
            setTimeout(runAnalysis, 1000);
          }
        }
      });
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  }

  runAnalysis();

  const debouncedAnalysis = debounce(runAnalysis, 1000);

  const observer = new MutationObserver(debouncedAnalysis);
  observer.observe(document.body, { childList: true, subtree: true, attributes: false, characterData: false, });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
function debounce(func, delay) {
  let debounceTimer;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}