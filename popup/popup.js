document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['appData'], ({ appData }) => {
      if (!appData) {
          renderError("No app data available. Please visit a Google Play Store app page.");
          return;
      }

      renderRiskBadge(appData.classification);
      renderPermissions(appData.permissions);
      renderNetworkRequests(appData.networkRequests);
      renderSummary(appData);
  });
});

function renderRiskBadge(classification) {
  const riskBadge = document.getElementById('risk-badge');
  if (!classification) {
      riskBadge.innerHTML = '<div class="risk-unknown">Risk: Unknown</div>';
      return;
  }

  const riskClasses = {
      'High': 'risk-high',
      'Medium': 'risk-medium',
      'Low': 'risk-low'
  };

  riskBadge.innerHTML = `
    <div class="risk-badge ${riskClasses[classification.riskLevel]}">
      <span class="risk-level">${classification.riskLevel} Risk</span>
      <span class="risk-score">Score: ${classification.score}/100</span>
      <span class="risk-confidence">Confidence: ${classification.confidence}%</span>
    </div>
  `;
}

function renderPermissions(permissions) {
  const container = document.getElementById('permissions-container');
  if (!permissions || !permissions.detected.length) {
    container.innerHTML = '<p class="no-risks">No risky permissions detected</p>';
    return;
  }

  container.innerHTML = `
    <div class="permissions-list">
      ${permissions.detected.map(perm => `
        <div class="permission-item">
          <div class="permission-header">
            <span class="permission-name">${perm.permission}</span>
            <span class="permission-risk">Risk: ${perm.risk}/10</span>
          </div>
          <p class="permission-reason">${perm.reason}</p>
          <p class="permission-explanation">${perm.nlExplanation}</p>
        </div>
      `).join('')}
    </div>
  `;
}


function renderNetworkRequests(requests) {
  const container = document.getElementById('network-container');
  if (!requests || !requests.length) {
      container.innerHTML = '<p class="no-risks">No suspicious network activity detected</p>';
      return;
  }

  container.innerHTML = `
    <div class="warning-banner">
      ⚠️ ${requests.length} tracking connections detected
    </div>
    <ul class="requests-list">
      ${requests.map(req => `
        <li class="request-item">
          <span class="domain">${new URL(req).hostname}</span>
          <span class="full-url">${req}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderSummary(data) {
  const container = document.getElementById('summary-container');
  const { classification, permissions, networkRequests } = data;
  

  container.innerHTML = `
    <div class="summary-card">
      <h3>Recommendation</h3>
      <p class="recommendation">
        ${getRecommendation(classification.riskLevel)}
      </p>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${permissions.detected.length}</span>
          <span class="stat-label">Risky Permissions</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${networkRequests.length}</span>
          <span class="stat-label">Tracking Requests</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${classification.score}</span>
          <span class="stat-label">Total Risk Score</span>
        </div>
      </div>
    </div>
  `;

  // Add AI explanation section
  const aiExplanation = document.createElement('div');
  aiExplanation.className = 'ai-explanation';
  aiExplanation.innerHTML = `
    <h4>AI Risk Analysis</h4>
    <p>Our AI has analyzed this app's permissions, network activity, and behavior patterns.</p>
    <p>Key risk factors:</p>
    <ul>
      ${data.permissions.detected.map(p => 
        `<li>${p.permission} - ${p.reason}</li>`
      ).join('')}
      ${data.networkRequests.length > 0 ? 
        `<li>Detected ${data.networkRequests.length} tracking connections</li>` : ''}
    </ul>
  `;
  container.appendChild(aiExplanation);
}

function getRecommendation(riskLevel) {
  const recommendations = {
      'High': '❌ Do not install this app - significant privacy risks detected',
      'Medium': '⚠️ Proceed with caution - this app collects sensitive data',
      'Low': '✅ Safe to install - minimal privacy concerns detected'
  };
  return recommendations[riskLevel] || 'Unable to determine risk level';
}

function renderError(message) {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <div class="error-state">
      <h2>⚠️ Error</h2>
      <p>${message}</p>
      <button id="retry-btn">Retry Analysis</button>
    </div>
  `;

  document.getElementById('retry-btn').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.reload(tabs[0].id);
      });
  });
}
