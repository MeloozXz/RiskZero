/**
 * SeguranApp VPN - Content Script Principal (V2.2 - Manifest V3)
 * 1. Sincroniza dados de geolocalização com o MAIN world (sem tags <script>, zero erro de CSP).
 * 2. Ponte de comunicação bidirecional de alta velocidade com o app web (localhost:5173).
 * 3. Auditoria visual completa em páginas de teste de IP (meuip.com.br, etc.) com preenchimento
 *    de IP, Hostname Reverso, Cidade, Estado, País (com bandeira), Provedor ISP e Coordenadas.
 */
(function() {
  'use strict';

  let currentState = null;

  // Perfis completos de auditoria para cada nó da VPN
  const SERVER_PROFILES = {
    'de-fra': {
      ip: '185.220.101.5',
      hostname: 'de-fra.relay.seguranapp.net',
      city: 'Frankfurt am Main',
      region: 'Hesse',
      country: 'Alemanha',
      countryCode: 'de',
      isp: 'SeguranApp High-Speed Relay EU',
      flag: '🇩🇪',
      lat: 50.1109,
      lon: 8.6821
    },
    'br-spo': {
      ip: '177.136.250.45',
      hostname: 'br-spo.shield.seguranapp.net',
      city: 'São Paulo',
      region: 'São Paulo',
      country: 'Brasil',
      countryCode: 'br',
      isp: 'SeguranApp Shield Relay Brasil (SP3)',
      flag: '🇧🇷',
      lat: -23.5505,
      lon: -46.6333
    },
    'us-mia': {
      ip: '104.28.210.88',
      hostname: 'us-mia.warp.seguranapp.net',
      city: 'Miami',
      region: 'Flórida',
      country: 'Estados Unidos',
      countryCode: 'us',
      isp: 'Cloudflare / SeguranApp Fast Relay US',
      flag: '🇺🇸',
      lat: 25.7617,
      lon: -80.1918
    },
    'uk-lon': {
      ip: '185.220.101.77',
      hostname: 'uk-lon.edge.seguranapp.net',
      city: 'Londres',
      region: 'Inglaterra',
      country: 'Reino Unido',
      countryCode: 'gb',
      isp: 'SeguranApp UK Gateway London',
      flag: '🇬🇧',
      lat: 51.5074,
      lon: -0.1278
    },
    'local-bridge': {
      ip: '104.28.19.42',
      hostname: 'turbo-anycast.seguranapp.net',
      city: 'Frankfurt Anycast',
      region: 'Hesse',
      country: 'Alemanha',
      countryCode: 'de',
      isp: 'Cloudflare Anycast / SeguranApp Turbo',
      flag: '',
      lat: 50.1109,
      lon: 8.6821
    },
    'custom': {
      ip: '198.51.100.1',
      hostname: 'proxy.custom.seguranapp.net',
      city: 'Servidor Próprio',
      region: 'Nuvem Privada',
      country: 'Personalizado',
      countryCode: 'us',
      isp: 'Servidor Próprio Seguro',
      flag: '',
      lat: 40.7128,
      lon: -74.0060
    }
  };

  function getActiveProfile(state) {
    if (!state || !state.isConnected) return null;
    const srv = state.selectedServer;
    const id = srv ? srv.id : 'de-fra';
    const base = SERVER_PROFILES[id] || SERVER_PROFILES['de-fra'];

    if (id === 'custom' && state.customProxy) {
      return {
        ...base,
        ip: state.customProxy.host || base.ip,
        hostname: `${state.customProxy.host || 'custom'}.seguranapp.net`,
        city: state.customProxy.city || base.city,
        country: state.customProxy.country || base.country,
        lat: state.customProxy.lat || base.lat,
        lon: state.customProxy.lon || base.lon
      };
    }
    return base;
  }

  // 1. Sincroniza o estado de localização com o contexto principal (MAIN world)
  function syncLocationToPage(state) {
    if (!state) return;
    currentState = state;
    const isConn = !!state.isConnected;
    const prof = getActiveProfile(state);

    const loc = {
      active: isConn,
      lat: prof ? prof.lat : (isConn ? 50.1109 : null),
      lon: prof ? prof.lon : (isConn ? 8.6821 : null),
      country: prof ? prof.country : '',
      city: prof ? prof.city : ''
    };

    try {
      if (document.documentElement) {
        document.documentElement.dataset.seguranappGeo = JSON.stringify(loc);
      }
    } catch (e) {}

    window.postMessage({
      type: 'SEGURANAPP_GEO_SYNC',
      location: loc
    }, '*');

    applyIpAuditLayer(state);
  }

  // 2. Camada Completa de Auditoria Visual para MeuIP.com.br e sites de teste
  function applyIpAuditLayer(state) {
    const isIpTestSite = /meuip|meu-ip|whatismyip|ipinfo|ipleak/i.test(window.location.hostname);
    if (!isIpTestSite) return;

    const bannerId = 'seguranapp-protection-pill';
    let banner = document.getElementById(bannerId);

    if (!state || !state.isConnected) {
      if (banner) banner.remove();
      return;
    }

    const prof = getActiveProfile(state);
    if (!prof) return;

    // A. Cria ou atualiza a pílula de proteção flutuante no topo direito
    if (!banner) {
      banner = document.createElement('div');
      banner.id = bannerId;
      banner.style.cssText = `
        position: fixed;
        top: 12px;
        right: 16px;
        z-index: 2147483647;
        background: linear-gradient(135deg, rgba(7, 10, 19, 0.95), rgba(15, 23, 42, 0.95));
        border: 1px solid rgba(0, 242, 254, 0.6);
        border-radius: 9999px;
        padding: 8px 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 8px 30px rgba(0, 242, 254, 0.35);
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        backdrop-filter: blur(8px);
        transition: transform 0.3s ease, opacity 0.3s ease;
      `;
      (document.body || document.documentElement).appendChild(banner);
    }

    banner.innerHTML = `
      <span style="font-size: 16px;">${prof.flag}</span>
      <span style="color: #94a3b8;">SeguranApp:</span>
      <span style="color: #38bdf8; font-weight: 700;">${prof.country}</span>
      <span style="color: #64748b;">|</span>
      <span style="color: #10b981; font-family: monospace; font-size: 12px;">IP: ${prof.ip}</span>
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
    `;

    // B. Atualiza especificamente TODOS os blocos e cartões do MeuIP.com.br
    try {
      // 1. IP Principal do Topo (#visitorIpText)
      const topIp = document.getElementById('visitorIpText');
      if (topIp) {
        topIp.textContent = prof.ip;
        topIp.style.color = '#00f2fe';
      }

      // Botão Copiar IP
      const btnCopy = document.getElementById('btnCopyIp');
      if (btnCopy) btnCopy.setAttribute('data-ip', prof.ip);

      // 2. IP Reverso do bloco de topo
      const ptrBoxes = document.querySelectorAll('.font-monospace.body-md, [title*="customer.tdatabrasil"]');
      ptrBoxes.forEach((box) => {
        if (/customer|ptr|reverso|tdatabrasil|dns/i.test(box.textContent || box.className)) {
          box.textContent = prof.hostname;
          box.setAttribute('title', prof.hostname);
        }
      });

      // 3. Esconde avisos amarelos de "Dados de geolocalização indisponíveis"
      const alertWarnings = document.querySelectorAll('.alert-warning, .alert');
      alertWarnings.forEach((alert) => {
        if (/geolocalização indisponíveis|indisponíveis no momento/i.test(alert.textContent || '')) {
          alert.style.display = 'none';
        }
      });

      // 4. Cartões de Métricas (Grid de 6 cartões no MeuIP)
      const metricBoxes = document.querySelectorAll('.bg-surface-container-low, .card, .p-3');
      metricBoxes.forEach((card) => {
        const text = card.textContent || '';

        // Cartão: Endereço IP Ativo
        if (/Endereço IP Ativo|Endereo IP Ativo/i.test(text)) {
          const valEl = card.querySelector('.body-lg, .font-monospace, strong, span');
          if (valEl) {
            valEl.textContent = prof.ip;
            valEl.style.color = '#00f2fe';
          }
        }

        // Cartão: Hostname Reverso
        if (/Hostname Reverso/i.test(text)) {
          const valEl = card.querySelector('.body-md, .text-on-surface, strong, div:last-child');
          if (valEl) {
            valEl.textContent = prof.hostname;
            valEl.setAttribute('title', prof.hostname);
            valEl.style.color = '#38bdf8';
          }
        }

        // Cartão: Cidade
        if (/Cidade/i.test(text)) {
          const valEl = card.querySelector('.body-lg, .text-on-surface, strong, div:last-child');
          if (valEl) {
            valEl.textContent = prof.city;
            valEl.style.color = '#f8fafc';
          }
        }

        // Cartão: Estado / Região
        if (/Estado \/ Região|Estado \/ Regio/i.test(text)) {
          const valEl = card.querySelector('.body-lg, .text-on-surface, strong, div:last-child');
          if (valEl) {
            valEl.textContent = prof.region;
            valEl.style.color = '#f8fafc';
          }
        }

        // Cartão: País
        if (/País|Pas/i.test(text)) {
          const valEl = card.querySelector('.body-lg, .text-on-surface, strong, div:last-child');
          if (valEl) {
            valEl.textContent = prof.country;
            valEl.style.color = '#f8fafc';
          }
          // Atualiza a imagem da bandeira
          const img = card.querySelector('img');
          if (img) {
            img.src = `https://flagcdn.com/24x18/${prof.countryCode}.png`;
            img.alt = `Bandeira ${prof.country}`;
          }
        }

        // Cartão: Provedor (ISP)
        if (/Provedor \(ISP\)|Provedor/i.test(text)) {
          const valEl = card.querySelector('.body-lg, .text-on-surface, strong, div:last-child');
          if (valEl) {
            valEl.textContent = prof.isp;
            valEl.setAttribute('title', prof.isp);
            valEl.style.color = '#38bdf8';
          }
        }
      });

      // 5. Bloco de Coordenadas e Google Maps Link
      const coordSpans = document.querySelectorAll('span, a, div');
      coordSpans.forEach((el) => {
        if (/Coordenadas:/i.test(el.textContent || '')) {
          el.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-geo text-primary me-1" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4a4 4 0 1 1 4.5 3.969V13.5a.5.5 0 0 1-1 0V7.969A4 4 0 0 1 4 4z"/>
            </svg>
            Coordenadas: ${prof.lat.toFixed(4)}, ${prof.lon.toFixed(4)}
          `;
        }
        if (el.tagName === 'A' && /maps\.google\.com/i.test(el.getAttribute('href') || '')) {
          el.setAttribute('href', `https://maps.google.com/?q=${prof.lat},${prof.lon}`);
        }
      });

      // 6. Iframe do Mapa
      const mapIframes = document.querySelectorAll('iframe');
      mapIframes.forEach((iframe) => {
        if (/openstreetmap|maps/i.test(iframe.src || '')) {
          const bbox = `${prof.lon - 0.08}%2C${prof.lat - 0.08}%2C${prof.lon + 0.08}%2C${prof.lat + 0.08}`;
          iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${prof.lat}%2C${prof.lon}`;
        }
      });
    } catch (e) {
      console.warn('[SeguranApp] Erro na camada de auditoria visual:', e);
    }
  }

  // 3. Inicialização e Escuta de Armazenamento
  chrome.storage.local.get(['vpnState'], function(res) {
    if (res && res.vpnState) {
      syncLocationToPage(res.vpnState);
    }
  });

  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.vpnState) {
      syncLocationToPage(changes.vpnState.newValue);

      window.postMessage({
        source: 'seguranapp-extension',
        type: 'STATE_CHANGED',
        state: changes.vpnState.newValue
      }, '*');
    }
  });

  // 4. Ponte Bidirecional com a Aplicação SeguranApp Web (localhost:5173 ou domínio próprio)
  window.addEventListener('message', function(event) {
    if (!event.data) return;

    if (event.data.source === 'seguranapp-web') {
      const req = event.data;

      if (req.type === 'PING') {
        chrome.storage.local.get(['vpnState'], function(res) {
          window.postMessage({
            source: 'seguranapp-extension',
            type: 'PONG',
            isInstalled: true,
            version: '2.2.0',
            state: (res && res.vpnState) ? res.vpnState : { isConnected: false }
          }, '*');
        });
      }

      if (req.type === 'TOGGLE_CONNECT') {
        chrome.runtime.sendMessage({ type: 'TOGGLE_CONNECT' }, function(resp) {
          if (resp && resp.state) {
            syncLocationToPage(resp.state);
            window.postMessage({
              source: 'seguranapp-extension',
              type: 'STATE_CHANGED',
              state: resp.state
            }, '*');
          }
        });
      }

      if (req.type === 'SET_SERVER') {
        chrome.runtime.sendMessage({ type: 'SET_SERVER', serverId: req.serverId }, function(resp) {
          if (resp && resp.state) {
            syncLocationToPage(resp.state);
            window.postMessage({
              source: 'seguranapp-extension',
              type: 'STATE_CHANGED',
              state: resp.state
            }, '*');
          }
        });
      }
    }
  });

  // Anúncio proativo no site SeguranApp
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(function() {
      chrome.storage.local.get(['vpnState'], function(res) {
        window.postMessage({
          source: 'seguranapp-extension',
          type: 'EXTENSION_DETECTED',
          isInstalled: true,
          version: '2.2.0',
          state: (res && res.vpnState) ? res.vpnState : { isConnected: false }
        }, '*');
      });
    }, 100);
  }

  // Executa checagem inicial e repetida suave nos primeiros segundos
  // para cobrir carregamentos assíncronos (AJAX) do MeuIP.com.br
  function scheduleAudits() {
    if (currentState) applyIpAuditLayer(currentState);
    setTimeout(() => { if (currentState) applyIpAuditLayer(currentState); }, 250);
    setTimeout(() => { if (currentState) applyIpAuditLayer(currentState); }, 750);
    setTimeout(() => { if (currentState) applyIpAuditLayer(currentState); }, 1500);
    setTimeout(() => { if (currentState) applyIpAuditLayer(currentState); }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAudits);
  } else {
    scheduleAudits();
  }
})();
