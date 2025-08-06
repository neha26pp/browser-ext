document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleBtn');
  
  // Get current state
  const result = await chrome.storage.sync.get(['enabled']);
  const isEnabled = result.enabled !== false; // Default to true
  
  updateButton(isEnabled);
  
  toggleBtn.addEventListener('click', async () => {
    const newState = !isEnabled;
    await chrome.storage.sync.set({ enabled: newState });
    updateButton(newState);
    
    // Tell content script about the change
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'toggle', enabled: newState });
  });
  
  function updateButton(enabled) {
    toggleBtn.textContent = enabled ? 'Disable' : 'Enable';
    toggleBtn.className = enabled ? 'enabled' : 'disabled';
  }
});