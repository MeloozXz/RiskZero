/**
 * [DESATIVADO NA V2.0]
 * O gateway-bridge.js antigo executava MutationObserver e TreeWalker que causavam travamentos de abas.
 * Na V2.0, o tunelamento é realizado de forma autêntica através de chrome.proxy no background.js
 * e a geolocalização do Maps é interceptada de forma limpa e leve via content-script.js e inject-geolocation.js.
 */
