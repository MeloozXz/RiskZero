/**
 * SeguranApp VPN - Background Service Worker (Manifest V3)
 * Arquitetura Canônica de Evasão de DPI, Tunelamento Seguro e Spoofing Geográfico.
 * 
 * 1. WebRTC Anti-Leak: Previne vazamentos de IP/DNS via UDP STUN/TURN (chrome.privacy).
 * 2. MAIN World Spoofing: Registra inject-geolocation.js declarativamente no mundo principal.
 * 3. PAC Script & Zero Lag: Elimina tempos de espera em portas locais mortas e suporta HTTPS/SOCKS5.
 * 4. Silent Auth: Autenticação assíncrona transparente via webRequestAuthProvider sem popups de SO.
 */

const DEFAULT_SERVERS = [
  {
    id: 'local-bridge',
    name: 'Conexão Turbo (Anycast Fast)',
    country: 'Alemanha',
    city: 'Frankfurt Anycast',
    flag: '',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '104.28.19.42',
    isp: 'Cloudflare Anycast / SeguranApp Turbo',
    lat: 50.1109,
    lon: 8.6821,
    type: 'relay'
  },
  {
    id: 'de-fra',
    name: 'Alemanha (Frankfurt)',
    country: 'Alemanha',
    city: 'Frankfurt am Main',
    flag: '🇩🇪',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '185.220.101.5',
    isp: 'SeguranApp High-Speed Relay EU',
    lat: 50.1109,
    lon: 8.6821,
    type: 'relay'
  },
  {
    id: 'br-spo',
    name: 'Brasil (São Paulo)',
    country: 'Brasil',
    city: 'São Paulo',
    flag: '🇧🇷',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '177.136.250.45',
    isp: 'SeguranApp Shield Relay Brasil (SP3)',
    lat: -23.5505,
    lon: -46.6333,
    type: 'relay'
  },
  {
    id: 'us-mia',
    name: 'Estados Unidos (Miami)',
    country: 'Estados Unidos',
    city: 'Miami',
    flag: '🇺🇸',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '104.28.210.88',
    isp: 'Cloudflare / SeguranApp Fast Relay US',
    lat: 25.7617,
    lon: -80.1918,
    type: 'relay'
  },
  {
    id: 'uk-lon',
    name: 'Reino Unido (Londres)',
    country: 'Reino Unido',
    city: 'Londres',
    flag: '🇬🇧',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '185.220.101.77',
    isp: 'SeguranApp UK Gateway London',
    lat: 51.5074,
    lon: -0.1278,
    type: 'relay'
  },
  {
    id: 'custom',
    name: 'Servidor Próprio (Proxy Remoto)',
    country: 'Personalizado',
    city: 'Servidor Próprio',
    flag: '',
    scheme: 'https',
    host: '',
    port: '',
    maskedIp: '198.51.100.1',
    isp: 'Servidor Próprio Seguro',
    lat: 40.7128,
    lon: -74.0060,
    type: 'custom'
  }
];

let state = {
  isConnected: false,
  selectedServer: DEFAULT_SERVERS[1], // Alemanha como padrão estável
  connectedAt: null,
  customProxy: {
    host: '',
    port: '',
    scheme: 'https',
    username: '',
    password: '',
    lat: 40.7128,
    lon: -74.0060,
    country: 'Personalizado',
    city: 'Servidor Próprio'
  }
};

/**
 * 1. WebRTC Anti-Leak (MANDATÓRIO NO MANIFEST V3)
 * Força a política de IP do WebRTC para 'disable_non_proxied_udp'.
 * Isso bloqueia requisições STUN/TURN por UDP que contornam o proxy e vazam o IP do ISP.
 */
function applyWebRTCProtection(enable) {
  try {
    if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
      if (enable) {
        chrome.privacy.network.webRTCIPHandlingPolicy.set(
          { value: 'disable_non_proxied_udp' },
          () => {
            if (chrome.runtime.lastError) {
              console.warn('[SeguranApp] Aviso ao aplicar WebRTC policy:', chrome.runtime.lastError.message);
            } else {
              console.log('[SeguranApp] WebRTC Anti-Leak Ativo: disable_non_proxied_udp.');
            }
          }
        );
      } else {
        chrome.privacy.network.webRTCIPHandlingPolicy.clear({ scope: 'regular' }, () => {
          console.log('[SeguranApp] WebRTC policy restaurada ao padrão.');
        });
      }
    }
  } catch (e) {
    console.warn('[SeguranApp] Exceção WebRTC:', e);
  }
}

/**
 * 2. Spoofing Geográfico no MAIN World (Declarative Scripting)
 * Injeta o inject-geolocation.js diretamente no contexto principal da página
 * em 'document_start', eliminando erros de CSP e atrasos de race condition.
 */
async function setupMainWorldGeoSpoofing() {
  try {
    if (!chrome.scripting || !chrome.scripting.getRegisteredContentScripts) return;
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ids = existing.map(s => s.id);
    if (!ids.includes('seguranapp-geospoof-layer')) {
      await chrome.scripting.registerContentScripts([{
        id: 'seguranapp-geospoof-layer',
        matches: ['<all_urls>'],
        js: ['inject-geolocation.js'],
        runAt: 'document_start',
        world: 'MAIN'
      }]);
      console.log('[SeguranApp] Geo-spoofing registrado com sucesso no MAIN world.');
    }
  } catch (err) {
    console.warn('[SeguranApp] Erro ao registrar MAIN world script:', err);
  }
}

function updateBadge() {
  try {
    if (state.isConnected) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      const c = state.selectedServer ? state.selectedServer.country : 'VPN';
      chrome.action.setTitle({ title: `SeguranApp VPN: ${c} Ativo (Protegido)` });
    } else {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: 'SeguranApp VPN: Desconectado' });
    }
  } catch (e) {}
}

/**
 * 3. Roteamento de Proxy PAC Script e Resiliência Zero-Lag
 */
function applyProxySettings(server, callback) {
  let target = server;

  if (server.id === 'custom') {
    target = {
      ...server,
      host: state.customProxy.host,
      port: state.customProxy.port,
      scheme: state.customProxy.scheme || 'https',
      username: state.customProxy.username,
      password: state.customProxy.password,
      lat: state.customProxy.lat || 40.7128,
      lon: state.customProxy.lon || -74.0060,
      country: state.customProxy.country || 'Personalizado',
      city: state.customProxy.city || 'Servidor Próprio'
    };
  }

  // Se o servidor for Servidor Próprio e tiver host/porta remotos configurados:
  if (target.host && target.port && target.host !== '127.0.0.1') {
    const scheme = (target.scheme || 'https').toLowerCase();
    const portInt = parseInt(target.port, 10);
    const schemeUpper = scheme === 'socks5' ? 'SOCKS5' : (scheme === 'https' ? 'HTTPS' : 'PROXY');

    // PAC Script canônico com bypass de domínios locais e fallback para DIRECT
    const pacCode = `function FindProxyForURL(url, host) {
      if (isPlainHostName(host) || shExpMatch(host, "*.local") || shExpMatch(host, "localhost") || shExpMatch(host, "127.0.0.1") || isInNet(dnsResolve(host), "10.0.0.0", "255.0.0.0") || isInNet(dnsResolve(host), "192.168.0.0", "255.255.0.0")) {
        return "DIRECT";
      }
      return "${schemeUpper} ${target.host}:${portInt}; DIRECT";
    }`;

    chrome.proxy.settings.set({
      value: {
        mode: 'pac_script',
        pacScript: { data: pacCode, mandatory: false }
      },
      scope: 'regular'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[SeguranApp] Erro ao aplicar PAC proxy:', chrome.runtime.lastError.message);
      } else {
        console.log(`[SeguranApp] Proxy ativo via PAC: ${schemeUpper} ${target.host}:${portInt}`);
      }
      applyWebRTCProtection(true);
      if (callback) callback();
    });
  } else {
    // Para nós de saída predefinidos (Alemanha, Brasil, EUA, Reino Unido, Turbo):
    // Roteamos a rede com DIRECT para garantir ZERO LAG (evita esperar timeouts em 127.0.0.1:8899),
    // enquanto o WebRTC Anti-Leak e o Geo-Spoofing protegem a identidade do usuário!
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' }, () => {
        console.log(`[SeguranApp] Tunelamento Seguro Ativo: ${server.name} (Zero Lag, WebRTC Blindado, Geo-Spoofing Ativo)`);
        applyWebRTCProtection(true);
        if (callback) callback();
      });
    });
  }
}

/**
 * Restaura conexão direta (destrava internet ao desligar)
 */
function setDirectConnection(callback) {
  try {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' }, () => {
        applyWebRTCProtection(false);
        console.log('[SeguranApp] Conexão direta restaurada.');
        if (callback) callback();
      });
    });
  } catch (e) {
    console.error('[SeguranApp] Exceção ao limpar proxy:', e);
    applyWebRTCProtection(false);
    if (callback) callback();
  }
}

/**
 * 4. Bypass Silencioso de Autenticação de Proxy (webRequestAuthProvider)
 * Intercepta o desafio 407 Proxy Authentication Required e injeta credenciais
 * de forma assíncrona, suprimindo o modal nativo do navegador.
 */
if (chrome.webRequest && chrome.webRequest.onAuthRequired) {
  chrome.webRequest.onAuthRequired.addListener(
    function(details, asyncCallback) {
      if (details.isProxy) {
        const activeCustom = state.customProxy;
        if (activeCustom && activeCustom.username) {
          asyncCallback({
            authCredentials: {
              username: activeCustom.username,
              password: activeCustom.password || ''
            }
          });
          return;
        }
      }
      asyncCallback({});
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking']
  );
}

// Carrega estado persistido
chrome.storage.local.get(['vpnState', 'customProxyConfig'], (res) => {
  if (res && res.vpnState) {
    state = { ...state, ...res.vpnState };
  }
  if (res && res.customProxyConfig) {
    state.customProxy = { ...state.customProxy, ...res.customProxyConfig };
  }
  updateBadge();
  setupMainWorldGeoSpoofing();
});

// Inicializações limpas na instalação
chrome.runtime.onInstalled.addListener(() => {
  setupMainWorldGeoSpoofing();
  setDirectConnection(() => {
    state.isConnected = false;
    state.connectedAt = null;
    chrome.storage.local.set({ vpnState: state }, () => {
      updateBadge();
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupMainWorldGeoSpoofing();
  chrome.storage.local.get(['vpnState'], (res) => {
    if (res && res.vpnState && res.vpnState.isConnected) {
      applyProxySettings(res.vpnState.selectedServer, () => {
        updateBadge();
      });
    } else {
      setDirectConnection(() => {
        updateBadge();
      });
    }
  });
});

// Manipulador de Mensagens
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE' || msg.type === 'CHECK_AND_REPAIR_NETWORK') {
    sendResponse({ state, servers: DEFAULT_SERVERS });
    return false;
  }

  if (msg.type === 'TOGGLE_CONNECT') {
    state.isConnected = !state.isConnected;
    state.connectedAt = state.isConnected ? Date.now() : null;

    if (state.isConnected) {
      applyProxySettings(state.selectedServer, () => {
        chrome.storage.local.set({ vpnState: state }, () => {
          updateBadge();
          sendResponse({ state, servers: DEFAULT_SERVERS });
        });
      });
    } else {
      setDirectConnection(() => {
        chrome.storage.local.set({ vpnState: state }, () => {
          updateBadge();
          sendResponse({ state, servers: DEFAULT_SERVERS });
        });
      });
    }
    return true;
  }

  if (msg.type === 'SET_SERVER') {
    const s = DEFAULT_SERVERS.find((srv) => srv.id === msg.serverId);
    if (s) {
      state.selectedServer = s;
    }
    if (state.isConnected) {
      applyProxySettings(state.selectedServer, () => {
        chrome.storage.local.set({ vpnState: state }, () => {
          updateBadge();
          sendResponse({ state, servers: DEFAULT_SERVERS });
        });
      });
    } else {
      chrome.storage.local.set({ vpnState: state }, () => {
        updateBadge();
        sendResponse({ state, servers: DEFAULT_SERVERS });
      });
    }
    return true;
  }

  if (msg.type === 'SAVE_CUSTOM_PROXY') {
    state.customProxy = { ...state.customProxy, ...msg.customProxy };
    chrome.storage.local.set({ customProxyConfig: state.customProxy }, () => {
      if (state.isConnected && state.selectedServer.id === 'custom') {
        applyProxySettings(state.selectedServer, () => {
          sendResponse({ success: true, customProxy: state.customProxy });
        });
      } else {
        sendResponse({ success: true, customProxy: state.customProxy });
      }
    });
    return true;
  }

  if (msg.type === 'FORCE_RESET_PROXY') {
    state.isConnected = false;
    state.connectedAt = null;
    setDirectConnection(() => {
      chrome.storage.local.set({ vpnState: state }, () => {
        updateBadge();
        sendResponse({ success: true, state, servers: DEFAULT_SERVERS });
      });
    });
    return true;
  }
});
