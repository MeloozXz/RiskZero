/**
 * SeguranApp VPN - Popup Logic (V2.0 com Tunelamento Real & Geolocalização)
 */

let timerInterval = null;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTimer(connectedAt) {
  const timerEl = document.getElementById('timerValue');
  if (!connectedAt) {
    timerEl.textContent = '00:00:00';
    if (timerInterval) clearInterval(timerInterval);
    return;
  }

  const tick = () => {
    const elapsed = Math.floor((Date.now() - connectedAt) / 1000);
    timerEl.textContent = formatTime(Math.max(0, elapsed));
  };

  tick();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

function renderUI(state) {
  const powerBtn = document.getElementById('powerBtn');
  const powerText = document.getElementById('powerText');
  const pulseRing = document.getElementById('pulseRing');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const serverSelect = document.getElementById('serverSelect');
  const customSection = document.getElementById('customConfigSection');

  if (state.isConnected) {
    powerBtn.classList.add('connected');
    powerText.textContent = 'DESLIGAR';
    pulseRing.classList.remove('hidden');

    statusBadge.className = 'status-badge connected';
    const countryName = (state.selectedServer && state.selectedServer.country) 
      ? state.selectedServer.country.toUpperCase() 
      : 'ALEMANHA';
    statusText.textContent = `PROTEGIDO • ${countryName}`;
  } else {
    powerBtn.classList.remove('connected');
    powerText.textContent = 'LIGAR';
    pulseRing.classList.add('hidden');

    statusBadge.className = 'status-badge disconnected';
    statusText.textContent = 'VPN DESCONECTADA';
  }

  if (state.selectedServer && state.selectedServer.id) {
    serverSelect.value = state.selectedServer.id;
    if (state.selectedServer.id === 'custom') {
      customSection.classList.remove('hidden');
    } else {
      customSection.classList.add('hidden');
    }
  }

  updateTimer(state.connectedAt);
}

function loadCustomProxyForm() {
  chrome.storage.local.get(['customProxyConfig'], (res) => {
    if (res && res.customProxyConfig) {
      const cfg = res.customProxyConfig;
      if (cfg.scheme) document.getElementById('customScheme').value = cfg.scheme;
      if (cfg.host) document.getElementById('customHost').value = cfg.host;
      if (cfg.port) document.getElementById('customPort').value = cfg.port;
      if (cfg.username) document.getElementById('customUser').value = cfg.username;
      if (cfg.password) document.getElementById('customPass').value = cfg.password;
    } else {
      const schemeEl = document.getElementById('customScheme');
      if (schemeEl) schemeEl.value = 'https';
      const portEl = document.getElementById('customPort');
      if (portEl) portEl.value = '443';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCustomProxyForm();

  // Recupera estado inicial
  chrome.storage.local.get(['vpnState'], (res) => {
    if (res && res.vpnState) {
      renderUI(res.vpnState);
    }
  });

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
    if (res && res.state) {
      renderUI(res.state);
    }
  });

  function reloadIpTabs() {
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((t) => {
          if (t.url && /meuip|meu-ip|whatismyip|ipleak|ipinfo/i.test(t.url)) {
            chrome.tabs.reload(t.id);
          }
        });
      });
    } catch (e) {}
  }

  // Botão LIGAR / DESLIGAR
  document.getElementById('powerBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_CONNECT' }, (res) => {
      if (res && res.state) {
        renderUI(res.state);
        reloadIpTabs();
      }
    });
  });

  // Seletor de país
  const serverSelect = document.getElementById('serverSelect');
  serverSelect.addEventListener('change', (e) => {
    const serverId = e.target.value;
    const customSection = document.getElementById('customConfigSection');

    if (serverId === 'custom') {
      customSection.classList.remove('hidden');
    } else {
      customSection.classList.add('hidden');
    }

    chrome.runtime.sendMessage({ type: 'SET_SERVER', serverId }, (res) => {
      if (res && res.state) {
        renderUI(res.state);
        reloadIpTabs();
      }
    });
  });

  // Salvar configuração de proxy próprio
  document.getElementById('saveCustomBtn').addEventListener('click', () => {
    const scheme = document.getElementById('customScheme').value;
    const host = document.getElementById('customHost').value.trim();
    const port = document.getElementById('customPort').value.trim();
    const username = document.getElementById('customUser').value.trim();
    const password = document.getElementById('customPass').value.trim();

    if (!host || !port) {
      alert('Por favor informe o Host e a Porta do seu servidor.');
      return;
    }

    const saveBtn = document.getElementById('saveCustomBtn');
    saveBtn.textContent = 'Salvando...';

    const customProxy = {
      scheme,
      host,
      port,
      username,
      password,
      lat: 40.7128,
      lon: -74.0060,
      country: 'Personalizado',
      city: 'Servidor Próprio'
    };

    chrome.runtime.sendMessage({ type: 'SAVE_CUSTOM_PROXY', customProxy }, (res) => {
      saveBtn.textContent = 'Configuração salva';
      setTimeout(() => {
        saveBtn.textContent = 'Salvar Configuração';
      }, 2000);
    });
  });

  // Testar no meuip.com.br
  document.getElementById('testIpBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.meuip.com.br/' });
  });

  // Testar no Google Maps
  document.getElementById('testMapsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://maps.google.com/' });
  });

  // Abrir painel SeguranApp Web
  const auditBtn = document.getElementById('testAppAuditBtn');
  if (auditBtn) {
    auditBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:5173/vpn' });
    });
  }

  // Botão de Emergência: Restaurar Conexão Direta
  const resetBtn = document.getElementById('resetProxyBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetBtn.innerHTML = '<span>⏳ Destravando Conexão...</span>';
      chrome.runtime.sendMessage({ type: 'FORCE_RESET_PROXY' }, (res) => {
        setTimeout(() => {
          resetBtn.innerHTML = '<span>Conexão direta restaurada</span>';
          if (res && res.state) {
            renderUI(res.state);
          }
          setTimeout(() => {
            resetBtn.innerHTML = '<span>Restaurar conexão direta</span>';
          }, 3000);
        }, 300);
      });
    });
  }
});
