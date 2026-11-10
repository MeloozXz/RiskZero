const VIEWPORTS = [
  { name: '360px-mobile-sm', width: 360, height: 800 },
  { name: '414px-mobile-lg', width: 414, height: 896 },
  { name: '768px-tablet', width: 768, height: 1024 },
  { name: '1280px-notebook', width: 1280, height: 800 },
  { name: '1920px-desktop', width: 1920, height: 1080 },
];

const ROUTES = [
  { slug: 'vault-empty', path: '/vault' },
  { slug: 'vault-add', path: '/vault/add' },
  { slug: 'home', path: '/home' },
  { slug: 'vpn', path: '/vpn' },
  { slug: 'breach', path: '/breach' },
  { slug: 'link-detector', path: '/link-detector' },
  { slug: 'analysis', path: '/analysis' },
  { slug: 'hardening', path: '/hardening' },
  { slug: 'biometrics', path: '/biometric-settings' },
  { slug: 'education', path: '/education' },
  { slug: 'settings', path: '/settings' },
  { slug: 'plans', path: '/plans' },
];

function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function seedAuthenticatedSession(win: Window) {
  const salt = 'cypress_orbital_salt_2026';
  const rawSalt = new TextEncoder().encode(`seguranapp_device_session_salt_${salt}`);
  const hash = await win.crypto.subtle.digest('SHA-256', rawSalt);
  const protectorKey = await win.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const masterKeyBytes = new Uint8Array(32);
  masterKeyBytes.fill(42);
  const payload = JSON.stringify({
    email: 'operador@riskzero.sec',
    key: toB64(masterKeyBytes),
    timestamp: Date.now(),
  });

  const iv = new Uint8Array(12);
  iv.fill(7);
  const encryptedBuf = await win.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    protectorKey,
    new TextEncoder().encode(payload)
  );

  const encryptedStr = JSON.stringify({
    ciphertext: toB64(new Uint8Array(encryptedBuf)),
    iv: toB64(iv),
  });

  const setBoth = (k: string, v: string) => {
    win.localStorage.setItem(k, v);
    win.localStorage.setItem(`CapacitorStorage.${k}`, v);
  };

  setBoth('zk_device_protector_salt', salt);
  setBoth('zk_remember_session', 'true');
  setBoth('zk_persisted_session', encryptedStr);
  setBoth('zk_security_terms_accepted', 'true');
}

describe('RiskZero — Redesign Orbital (Multi-Resolution Audit)', () => {
  it('1. Captura AuthPage em 360px, 414px, 768px, 1280px e 1920px sem overflow horizontal', () => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.contains(/RISK ZERO|Criar Cofre|Entrar/i, { timeout: 15000 }).should('be.visible');

    for (const vp of VIEWPORTS) {
      cy.viewport(vp.width, vp.height);
      cy.wait(250);
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth).to.be.lte(vp.width + 1);
      });
      cy.screenshot(`01-auth-${vp.name}`, { capture: 'viewport' });
    }
  });

  it('2. Captura todas as telas autenticadas e navegação em 360px, 414px, 768px, 1280px e 1920px', () => {
    cy.visit('/home', {
      onBeforeLoad(win) {
        return seedAuthenticatedSession(win);
      },
    });

    cy.get('.rz-shell', { timeout: 15000 }).should('exist');

    for (const route of ROUTES) {
      cy.visit(route.path, {
        onBeforeLoad(win) {
          return seedAuthenticatedSession(win);
        },
      });
      cy.get('.rz-shell', { timeout: 15000 }).should('exist');
      cy.wait(350);

      for (const vp of VIEWPORTS) {
        cy.viewport(vp.width, vp.height);
        cy.wait(200);
        cy.document().then((doc) => {
          expect(doc.documentElement.scrollWidth).to.be.lte(vp.width + 1);
        });
        cy.screenshot(`02-${route.slug}-${vp.name}`, { capture: 'viewport' });
      }
    }

    // Verifica também os Bottom Sheets mobile (Defesa & Conta) em 360px e 414px
    cy.viewport(360, 800);
    cy.visit('/home', {
      onBeforeLoad(win) {
        return seedAuthenticatedSession(win);
      },
    });
    cy.get('.rz-bottombar', { timeout: 10000 }).should('be.visible');
    cy.contains('.rz-bottombar .rz-tab', 'Defesa').click();
    cy.get('.rz-sheet').should('be.visible');
    cy.wait(250);
    cy.screenshot('03-mobile-sheet-defesa-360px', { capture: 'viewport' });

    cy.viewport(414, 896);
    cy.contains('.rz-bottombar .rz-tab', 'Conta').click();
    cy.get('.rz-sheet').should('be.visible');
    cy.wait(250);
    cy.screenshot('03-mobile-sheet-conta-414px', { capture: 'viewport' });
  });
});
