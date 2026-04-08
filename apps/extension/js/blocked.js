// Blocked page logic - displays blocked domain info

(function() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || 'unknown site';
  const limit = parseInt(params.get('limit') || '0', 10);

  document.getElementById('blockedDomain').textContent = domain;

  if (limit > 0) {
    const hours = Math.floor(limit / 3600);
    const minutes = Math.floor((limit % 3600) / 60);
    let limitText = '';
    if (hours > 0) limitText += `${hours}h `;
    if (minutes > 0) limitText += `${minutes}m`;
    document.getElementById('dailyLimit').textContent = limitText.trim() || '0m';
  }
})();
