export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  // Возвращаем HTML страницу
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Key Management Dashboard</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { background: #0a0a0f; color: #e0e0e0; padding: 20px; margin: 0; display: flex; justify-content: center; }
    .container { max-width: 900px; width: 100%; }
    h1 { color: #fff; font-weight: 400; border-bottom: 1px solid #2a2a3a; padding-bottom: 10px; }
    .password-section { margin: 20px 0; background: #181825; padding: 20px; border-radius: 12px; }
    .password-section input { width: 70%; padding: 12px; border-radius: 8px; border: 1px solid #333; background: #0f0f1a; color: #fff; }
    .password-section button { padding: 12px 24px; border-radius: 8px; border: none; background: #6c5ce7; color: #fff; font-weight: bold; cursor: pointer; margin-left: 10px; }
    .toolbar { display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap; }
    .toolbar input { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #0f0f1a; color: #fff; min-width: 150px; }
    .toolbar button { padding: 10px 20px; border-radius: 8px; border: none; background: #6c5ce7; color: #fff; font-weight: bold; cursor: pointer; }
    .toolbar button.danger { background: #e74c3c; }
    .key-list { list-style: none; padding: 0; }
    .key-item { display: flex; align-items: center; justify-content: space-between; background: #181825; padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #6c5ce7; }
    .key-item .key-name { font-family: monospace; font-size: 14px; flex: 1; word-break: break-all; padding-right: 10px; }
    .key-item .status { font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-right: 10px; }
    .key-item .status.link { background: #2ecc71; color: #0a0a0f; }
    .key-item .status.unlink { background: #e74c3c; color: #fff; }
    .key-item .actions button { margin-left: 6px; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; }
    .key-item .actions .toggle { background: #f39c12; color: #0a0a0f; }
    .key-item .actions .delete { background: #e74c3c; color: #fff; }
    .key-item .actions .copy { background: #3498db; color: #fff; }
    .status-message { margin-top: 20px; padding: 12px; border-radius: 8px; background: #2c3e50; color: #ecf0f1; display: none; }
    .status-message.error { background: #c0392b; display: block; }
    .status-message.success { background: #27ae60; display: block; }
    .loading { text-align: center; padding: 40px; color: #888; }
  </style>
</head>
<body>
<div class="container">
  <h1>🔑 Key Management</h1>
  
  <div class="password-section">
    <input type="password" id="adminPassword" placeholder="Enter admin password..." />
    <button id="unlockBtn">Unlock Dashboard</button>
  </div>

  <div id="dashboard" style="display: none;">
    <div class="toolbar">
      <input type="text" id="newKeyInput" placeholder="New key (optional, auto-generate if empty)" />
      <button id="createKeyBtn">➕ Create Key (link)</button>
      <button id="refreshBtn" class="secondary">🔄 Refresh</button>
    </div>
    <div id="keyListContainer">
      <div class="loading">Loading keys...</div>
    </div>
  </div>

  <div id="message" class="status-message"></div>
</div>

<script>
  let adminPassword = '';
  let currentKeys = {};

  // DOM refs
  const passwordInput = document.getElementById('adminPassword');
  const unlockBtn = document.getElementById('unlockBtn');
  const dashboard = document.getElementById('dashboard');
  const keyListContainer = document.getElementById('keyListContainer');
  const newKeyInput = document.getElementById('newKeyInput');
  const createKeyBtn = document.getElementById('createKeyBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const messageDiv = document.getElementById('message');

  function showMessage(text, type = 'success') {
    messageDiv.textContent = text;
    messageDiv.className = 'status-message ' + type;
    messageDiv.style.display = 'block';
    setTimeout(() => { messageDiv.style.display = 'none'; }, 4000);
  }

  async function fetchKeys(password) {
    try {
      const resp = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to fetch keys');
      }
      const data = await resp.json();
      return data.keys || {};
    } catch (e) {
      showMessage('Error fetching keys: ' + e.message, 'error');
      return {};
    }
  }

  function renderKeys(keys) {
    const entries = Object.entries(keys);
    if (entries.length === 0) {
      keyListContainer.innerHTML = '<p style="color: #666; text-align: center;">No keys found. Create one!</p>';
      return;
    }
    let html = '<ul class="key-list">';
    for (const [key, status] of entries) {
      const statusClass = status === 'link' ? 'link' : 'unlink';
      const statusLabel = status === 'link' ? '✅ Link' : '❌ Unlink';
      html += \`
        <li class="key-item" data-key="\${key}">
          <span class="key-name">\${key}</span>
          <span class="status \${statusClass}">\${statusLabel}</span>
          <div class="actions">
            <button class="copy" data-key="\${key}">📋 Copy</button>
            <button class="toggle" data-key="\${key}" data-status="\${status}">🔄 Toggle</button>
            <button class="delete" data-key="\${key}">🗑️ Delete</button>
          </div>
        </li>
      \`;
    }
    html += '</ul>';
    keyListContainer.innerHTML = html;

    // Attach event listeners to buttons
    document.querySelectorAll('.copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = btn.dataset.key;
        navigator.clipboard.writeText(key).then(() => {
          showMessage('Key copied!', 'success');
        }).catch(() => {
          // Fallback
          const input = document.createElement('input');
          input.value = key;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          input.remove();
          showMessage('Key copied!', 'success');
        });
      });
    });

    document.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = btn.dataset.key;
        const currentStatus = btn.dataset.status;
        const newStatus = currentStatus === 'link' ? 'unlink' : 'link';
        await updateKeyStatus(key, newStatus);
        await loadKeys();
      });
    });

    document.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = btn.dataset.key;
        if (!confirm(\`Delete key "\${key}"?\`)) return;
        await deleteKey(key);
        await loadKeys();
      });
    });
  }

  async function updateKeyStatus(key, newStatus) {
    try {
      const resp = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          action: 'setKey',
          key,
          status: newStatus
        })
      });
      const data = await resp.json();
      if (data.success) {
        showMessage(\`Key "\${key}" status updated to \${newStatus}\`, 'success');
      } else {
        showMessage(data.error || 'Failed to update status', 'error');
      }
    } catch (e) {
      showMessage('Error: ' + e.message, 'error');
    }
  }

  async function deleteKey(key) {
    try {
      const resp = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          action: 'deleteKey',
          key
        })
      });
      const data = await resp.json();
      if (data.success) {
        showMessage(\`Key "\${key}" deleted\`, 'success');
      } else {
        showMessage(data.error || 'Failed to delete key', 'error');
      }
    } catch (e) {
      showMessage('Error: ' + e.message, 'error');
    }
  }

  async function createKey(customKey) {
    try {
      // If customKey empty, generate random 16-char alphanumeric
      const key = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 18);
      const resp = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          action: 'setKey',
          key,
          status: 'link'
        })
      });
      const data = await resp.json();
      if (data.success) {
        showMessage(\`Key "\${key}" created with status link\`, 'success');
        newKeyInput.value = '';
        await loadKeys();
      } else {
        showMessage(data.error || 'Failed to create key', 'error');
      }
    } catch (e) {
      showMessage('Error: ' + e.message, 'error');
    }
  }

  async function loadKeys() {
    keyListContainer.innerHTML = '<div class="loading">Loading keys...</div>';
    const keys = await fetchKeys(adminPassword);
    currentKeys = keys;
    renderKeys(keys);
  }

  // Unlock dashboard
  unlockBtn.addEventListener('click', async () => {
    const pass = passwordInput.value.trim();
    if (!pass) {
      showMessage('Please enter password', 'error');
      return;
    }
    // Test password by trying to fetch keys
    try {
      const testKeys = await fetchKeys(pass);
      if (testKeys !== undefined) {
        adminPassword = pass;
        dashboard.style.display = 'block';
        passwordInput.disabled = true;
        unlockBtn.disabled = true;
        await loadKeys();
        showMessage('Dashboard unlocked!', 'success');
      } else {
        showMessage('Invalid password', 'error');
      }
    } catch (e) {
      showMessage('Invalid password or server error', 'error');
    }
  });

  // Create key
  createKeyBtn.addEventListener('click', async () => {
    const customKey = newKeyInput.value;
    await createKey(customKey);
  });

  // Refresh
  refreshBtn.addEventListener('click', async () => {
    await loadKeys();
  });

  // Auto-unlock if password saved in localStorage (optional)
  // We'll just let user type for security.

  // Allow Enter key on password field
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockBtn.click();
  });
  newKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createKeyBtn.click();
  });

</script>
</body>
</html>
  `);
}
