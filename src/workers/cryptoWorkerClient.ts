/**
 * Cliente assíncrono (Promise-based) para comunicação com o Crypto Web Worker.
 *
 * Cada chamada gera um reqId UUID único, envia a mensagem ao worker via postMessage,
 * e retorna uma Promise que resolve/rejeita quando o worker responde com o mesmo reqId.
 *
 * Fallback transparente: Se Web Workers não estiverem disponíveis (SSR, Vitest/JSDOM,
 * ambientes sem suporte), executa as operações diretamente na thread principal.
 */

import type { CryptoWorkerAction, CryptoWorkerRequest, CryptoWorkerResponse } from '../types/worker';

// ==========================================
// Singleton do Worker e mapa de requisições pendentes
// ==========================================

let worker: Worker | null = null;
let workerFailed = false;

const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}>();

/**
 * Gera um identificador UUID v4 para correlacionar request/response.
 */
function generateReqId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Inicializa o Web Worker singleton (lazy). Retorna null se não disponível.
 */
function getWorker(): Worker | null {
  if (workerFailed) return null;

  if (worker) return worker;

  try {
    if (typeof Worker === 'undefined') {
      workerFailed = true;
      return null;
    }

    worker = new Worker(
      new URL('./crypto.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<CryptoWorkerResponse>) => {
      const { reqId, success, result, error } = event.data;
      const pending = pendingRequests.get(reqId);
      if (!pending) return;

      pendingRequests.delete(reqId);

      if (success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error || 'Erro desconhecido no Crypto Worker.'));
      }
    };

    worker.onerror = (err) => {
      console.error('[CryptoWorkerClient] Erro fatal no Worker:', err);
      // Rejeita todas as requisições pendentes
      for (const [reqId, pending] of pendingRequests.entries()) {
        pending.reject(new Error('Worker encerrou inesperadamente.'));
        pendingRequests.delete(reqId);
      }
      workerFailed = true;
      worker = null;
    };

    return worker;
  } catch (err) {
    console.warn('[CryptoWorkerClient] Worker não disponível, usando fallback na thread principal:', err);
    workerFailed = true;
    return null;
  }
}

/**
 * Envia uma mensagem para o Worker e retorna uma Promise com o resultado.
 */
function sendToWorker(action: CryptoWorkerAction, data: Record<string, unknown>): Promise<unknown> {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error('WORKER_NOT_AVAILABLE'));
  }

  const reqId = generateReqId();

  return new Promise((resolve, reject) => {
    // Timeout de segurança: 60 segundos
    const timeout = setTimeout(() => {
      pendingRequests.delete(reqId);
      reject(new Error(`Timeout de 60s excedido para ação ${action} (reqId: ${reqId}).`));
    }, 60000);

    pendingRequests.set(reqId, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (reason) => {
        clearTimeout(timeout);
        reject(reason);
      },
    });

    const request: CryptoWorkerRequest = { action, reqId, data };
    w.postMessage(request);
  });
}

// ==========================================
// Imports lazy dos módulos de fallback (thread principal)
// ==========================================

async function fallbackDeriveKeyArgon2id(password: string, saltBase64: string): Promise<string> {
  const { argon2id } = await import('@noble/hashes/argon2.js');

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const binaryString = atob(saltBase64);
  const saltBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    saltBytes[i] = binaryString.charCodeAt(i);
  }

  const derivedBytes = argon2id(passwordBytes, saltBytes, { t: 3, m: 65536, p: 1, dkLen: 32 });

  let binary = '';
  for (let i = 0; i < derivedBytes.byteLength; i++) {
    binary += String.fromCharCode(derivedBytes[i]);
  }
  return btoa(binary);
}

async function fallbackDeriveKeyPBKDF2(password: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const binaryString = atob(saltBase64);
  const saltBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    saltBytes[i] = binaryString.charCodeAt(i);
  }

  const baseKey = await crypto.subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes as Uint8Array<ArrayBuffer>, iterations: 600000, hash: 'SHA-256' },
    baseKey,
    256
  );

  let binary = '';
  const bytes = new Uint8Array(derivedBits);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fallbackDerivePinHashArgon2id(pin: string, saltBase64: string): Promise<string> {
  const { argon2id } = await import('@noble/hashes/argon2.js');

  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const binaryString = atob(saltBase64);
  const saltBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    saltBytes[i] = binaryString.charCodeAt(i);
  }

  const derivedBytes = argon2id(pinBytes, saltBytes, { t: 2, m: 16384, p: 1, dkLen: 32 });

  let binary = '';
  for (let i = 0; i < derivedBytes.byteLength; i++) {
    binary += String.fromCharCode(derivedBytes[i]);
  }
  return btoa(binary);
}

async function fallbackDerivePinHashPBKDF2(pin: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const binaryString = atob(saltBase64);
  const saltBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    saltBytes[i] = binaryString.charCodeAt(i);
  }

  const baseKey = await crypto.subtle.importKey('raw', pinBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes as Uint8Array<ArrayBuffer>, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    256
  );

  let binary = '';
  const bytes = new Uint8Array(derivedBits);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fallbackGenerateTOTP(secretBase32: string, time: number): Promise<string> {
  const clean = secretBase32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error('Caractere Base32 inválido na chave secreta.');
    }
    bits += val.toString(2).padStart(5, '0');
  }
  const keyBytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }

  const epoch = Math.floor(time / 1000);
  const timeStep = Math.floor(epoch / 30);

  const messageBytes = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    messageBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes as any);
  const hmacResult = new Uint8Array(signatureBuffer);

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

// ==========================================
// API pública do cliente
// ==========================================

/**
 * Deriva 32 bytes com Argon2id via Worker. Retorna Base64 dos bytes derivados.
 */
export async function workerDeriveKeyArgon2id(password: string, saltBase64: string): Promise<string> {
  try {
    const result = await sendToWorker('DERIVE_KEY_ARGON2ID', { password, saltBase64 });
    return result as string;
  } catch (err: any) {
    if (err?.message === 'WORKER_NOT_AVAILABLE') {
      return fallbackDeriveKeyArgon2id(password, saltBase64);
    }
    throw err;
  }
}

/**
 * Deriva 32 bytes com PBKDF2 via Worker. Retorna Base64 dos bytes derivados.
 */
export async function workerDeriveKeyPBKDF2(password: string, saltBase64: string): Promise<string> {
  try {
    const result = await sendToWorker('DERIVE_KEY_PBKDF2', { password, saltBase64 });
    return result as string;
  } catch (err: any) {
    if (err?.message === 'WORKER_NOT_AVAILABLE') {
      return fallbackDeriveKeyPBKDF2(password, saltBase64);
    }
    throw err;
  }
}

/**
 * Deriva hash do PIN com Argon2id via Worker. Retorna Base64.
 */
export async function workerDerivePinHashArgon2id(pin: string, saltBase64: string): Promise<string> {
  try {
    const result = await sendToWorker('DERIVE_PIN_HASH_ARGON2ID', { pin, saltBase64 });
    return result as string;
  } catch (err: any) {
    if (err?.message === 'WORKER_NOT_AVAILABLE') {
      return fallbackDerivePinHashArgon2id(pin, saltBase64);
    }
    throw err;
  }
}

/**
 * Deriva hash do PIN com PBKDF2 via Worker. Retorna Base64.
 */
export async function workerDerivePinHashPBKDF2(pin: string, saltBase64: string): Promise<string> {
  try {
    const result = await sendToWorker('DERIVE_PIN_HASH_PBKDF2', { pin, saltBase64 });
    return result as string;
  } catch (err: any) {
    if (err?.message === 'WORKER_NOT_AVAILABLE') {
      return fallbackDerivePinHashPBKDF2(pin, saltBase64);
    }
    throw err;
  }
}

/**
 * Gera código TOTP de 6 dígitos via Worker.
 */
export async function workerGenerateTOTP(secretBase32: string, time: number = Date.now()): Promise<string> {
  try {
    const result = await sendToWorker('GENERATE_TOTP', { secretBase32, time });
    return result as string;
  } catch (err: any) {
    if (err?.message === 'WORKER_NOT_AVAILABLE') {
      return fallbackGenerateTOTP(secretBase32, time);
    }
    throw err;
  }
}
