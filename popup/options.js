document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('apiKey');
    const btn = document.getElementById('save');
  
    // Load existing
    chrome.storage.sync.get('geminiKey', ({ geminiKey }) => {
      if (geminiKey) input.value = geminiKey;
    });
  
    btn.addEventListener('click', () => {
      chrome.storage.sync.set({ geminiKey: input.value }, () => {
        btn.textContent = 'Saved!';
        setTimeout(() => btn.textContent = 'Save', 1500);
      });
    });
  });
  