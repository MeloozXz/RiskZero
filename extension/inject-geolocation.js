/**
 * SeguranApp VPN - Spoofing de Geolocalização no MAIN World (Manifest V3)
 * Executa diretamente no contexto nativo da página (Google Maps, Uber, OpenStreetMap, HTML5 Geo).
 * 
 * - Sem injeção de tags <script> no DOM (zero violação de CSP).
 * - Sem MutationObservers pesados (zero lag / 0% CPU overhead).
 * - Retorno assíncrono natural via micro-delay imitando o hardware GPS/Wi-Fi.
 */
(function() {
  'use strict';

  // Evita reinjeção múltipla no mesmo contexto
  if (window.__seguranappGeoInjected) return;
  window.__seguranappGeoInjected = true;

  let activeSpoof = null;

  // 1. Tenta recuperar coordenadas síncronas gravadas no elemento raiz
  function syncFromDataset() {
    try {
      const el = document.documentElement;
      if (el && el.dataset && el.dataset.seguranappGeo) {
        activeSpoof = JSON.parse(el.dataset.seguranappGeo);
      }
    } catch (e) {}
  }

  syncFromDataset();

  // 2. Escuta sincronização em tempo real do content-script
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SEGURANAPP_GEO_SYNC') {
      activeSpoof = event.data.location;
      try {
        if (document.documentElement) {
          document.documentElement.dataset.seguranappGeo = JSON.stringify(activeSpoof);
        }
      } catch (e) {}
    }
  });

  if (!navigator.geolocation) return;

  const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

  function buildPositionResponse(loc) {
    const lat = (loc && typeof loc.lat === 'number') ? loc.lat : 50.1109; // Frankfurt default
    const lon = (loc && typeof loc.lon === 'number') ? loc.lon : 8.6821;
    return {
      coords: {
        latitude: lat,
        longitude: lon,
        accuracy: 14.5 + Math.random() * 4.0, // Alta precisão simulada (15m)
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };
  }

  // Intercepta getCurrentPosition
  navigator.geolocation.getCurrentPosition = function(successCb, errorCb, options) {
    syncFromDataset();
    if (activeSpoof && activeSpoof.active && activeSpoof.lat && activeSpoof.lon) {
      if (typeof successCb === 'function') {
        setTimeout(function() {
          successCb(buildPositionResponse(activeSpoof));
        }, 45); // Imita a latência natural do subsistema de rádio/GPS do SO
      }
      return;
    }
    return originalGetCurrentPosition(successCb, errorCb, options);
  };

  // Intercepta watchPosition
  navigator.geolocation.watchPosition = function(successCb, errorCb, options) {
    syncFromDataset();
    if (activeSpoof && activeSpoof.active && activeSpoof.lat && activeSpoof.lon) {
      const watchId = Math.floor(Math.random() * 100000) + 1;
      if (typeof successCb === 'function') {
        setTimeout(function() {
          successCb(buildPositionResponse(activeSpoof));
        }, 45);
      }
      return watchId;
    }
    return originalWatchPosition(successCb, errorCb, options);
  };

  navigator.geolocation.clearWatch = function(watchId) {
    return;
  };

  // Intercepta navigator.permissions para que a página saiba que a localização foi concedida
  if (navigator.permissions && navigator.permissions.query) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(param) {
      syncFromDataset();
      if (param && param.name === 'geolocation' && activeSpoof && activeSpoof.active) {
        return Promise.resolve({
          state: 'granted',
          name: 'geolocation',
          onchange: null
        });
      }
      return originalQuery(param);
    };
  }
})();
