/**
 * Web Worker dedicado para operações criptográficas pesadas.
 * Executa Argon2id, PBKDF2, derivação de PIN e TOTP fora da thread principal,
 * garantindo que a interface React mantenha 60 FPS contínuos.
 *
 * Comunicação via postMessage com protocolo tipado (CryptoWorkerRequest/Response).
 */

import { argon2id } from '@noble/hashes/argon2.js';
import type { CryptoWorkerRequest, CryptoWorkerResponse } from '../types/worker';

// ==========================================
// Helpers de conversão (duplicados do webcrypto.ts para isolamento do worker)
// ==========================================

function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array('buffer' in buffer ? buffer.buffer : buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return self.btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = self.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ==========================================
// Handlers de cada ação criptográfica
// ==========================================

/**
 * Deriva 32 bytes com Argon2id (RFC 9106).
 * Parâmetros OWASP: t=3, m=64MB (65536 KiB), p=1, dkLen=32.
 */
function handleDeriveKeyArgon2id(data: Record<string, unknown>): string {
  const password = data.password as string;
  const saltBase64 = data.saltBase64 as string;

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = base64ToArrayBuffer(saltBase64);

  const derivedBytes = argon2id(passwordBytes, saltBytes, {
    t: 3,
    m: 65536,
    p: 1,
    dkLen: 32,
  });

  return arrayBufferToBase64(derivedBytes);
}

/**
 * Deriva 32 bytes com PBKDF2-HMAC-SHA256 (600.000 iterações).
 * Fallback legado para migração transparente.
 */
async function handleDeriveKeyPBKDF2(data: Record<string, unknown>): Promise<string> {
  const password = data.password as string;
  const saltBase64 = data.saltBase64 as string;

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = base64ToArrayBuffer(saltBase64);

  const baseKey = await self.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await self.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as Uint8Array<ArrayBuffer>,
      iterations: 600000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  return arrayBufferToBase64(derivedBits);
}

/**
 * Deriva hash do PIN com Argon2id.
 * Parâmetros: t=2, m=16MB (16384 KiB), p=1, dkLen=32.
 */
function handleDerivePinHashArgon2id(data: Record<string, unknown>): string {
  const pin = data.pin as string;
  const saltBase64 = data.saltBase64 as string;

  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const saltBytes = base64ToArrayBuffer(saltBase64);

  const derivedBytes = argon2id(pinBytes, saltBytes, {
    t: 2,
    m: 16384,
    p: 1,
    dkLen: 32,
  });

  return arrayBufferToBase64(derivedBytes);
}

/**
 * Deriva hash do PIN com PBKDF2-HMAC-SHA256 (100.000 iterações).
 * Fallback legado para PINs antigos.
 */
async function handleDerivePinHashPBKDF2(data: Record<string, unknown>): Promise<string> {
  const pin = data.pin as string;
  const saltBase64 = data.saltBase64 as string;

  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const saltBytes = base64ToArrayBuffer(saltBase64);

  const baseKey = await self.crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await self.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as Uint8Array<ArrayBuffer>,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  return arrayBufferToBase64(derivedBits);
}

/**
 * Gera código TOTP de 6 dígitos (RFC 6238 / RFC 4226) via HMAC-SHA1.
 */
async function handleGenerateTOTP(data: Record<string, unknown>): Promise<string> {
  const secretBase32 = data.secretBase32 as string;
  const time = (data.time as number) ?? Date.now();

  // Decodifica Base32
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

  // Time step (30 segundos)
  const epoch = Math.floor(time / 1000);
  const timeStep = Math.floor(epoch / 30);

  const messageBytes = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    messageBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // HMAC-SHA1
  const cryptoKey = await self.crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signatureBuffer = await self.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageBytes as any
  );

  const hmacResult = new Uint8Array(signatureBuffer);

  // Dynamic Truncation
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
// Dispatcher principal do Worker
// ==========================================

self.onmessage = async (event: MessageEvent<CryptoWorkerRequest>) => {
  const { action, reqId, data } = event.data;

  const response: CryptoWorkerResponse = {
    reqId,
    success: false,
  };

  try {
    switch (action) {
      case 'DERIVE_KEY_ARGON2ID':
        response.result = handleDeriveKeyArgon2id(data);
        break;

      case 'DERIVE_KEY_PBKDF2':
        response.result = await handleDeriveKeyPBKDF2(data);
        break;

      case 'DERIVE_PIN_HASH_ARGON2ID':
        response.result = handleDerivePinHashArgon2id(data);
        break;

      case 'DERIVE_PIN_HASH_PBKDF2':
        response.result = await handleDerivePinHashPBKDF2(data);
        break;

      case 'GENERATE_TOTP':
        response.result = await handleGenerateTOTP(data);
        break;

      default:
        throw new Error(`Ação desconhecida no Crypto Worker: ${action}`);
    }

    response.success = true;
  } catch (err: any) {
    response.success = false;
    response.error = err?.message || 'Erro desconhecido no Crypto Worker.';
  }

  self.postMessage(response);
};
