import { EncryptedData, KdfAlgorithm } from '../types';
import {
  workerDeriveKeyArgon2id,
  workerDeriveKeyPBKDF2,
  workerDerivePinHashArgon2id,
  workerDerivePinHashPBKDF2
} from '../workers/cryptoWorkerClient';

/**
 * Utilitários auxiliares de conversão de dados
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array('buffer' in buffer ? buffer.buffer : buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * Gera um salt criptograficamente seguro e retorna como string Base64.
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

/**
 * Deriva uma CryptoKey AES-256 a partir de uma senha e um salt usando Argon2id (RFC 9106) via Web Worker.
 * Padrão moderno e resistente a ataques acelerados por GPU/ASIC e ataques de canal lateral.
 * Parâmetros OWASP recomendados: t=3, m=64MB (65536 KiB), p=1, dkLen=32 bytes (256 bits).
 */
export async function deriveKeyArgon2id(password: string, saltBase64: string): Promise<CryptoKey> {
  // Delega derivação pesada para o Web Worker
  const derivedB64 = await workerDeriveKeyArgon2id(password, saltBase64);
  const derivedBytes = base64ToArrayBuffer(derivedB64);

  // Importa a chave derivada bruta para a Web Crypto API (AES-GCM)
  return await window.crypto.subtle.importKey(
    'raw',
    derivedBytes as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM', length: 256 },
    true, // Permite exportação segura para persistência de sessão e backup
    ['encrypt', 'decrypt']
  );
}

/**
 * Deriva uma CryptoKey AES-256 a partir de uma senha e um salt usando PBKDF2-HMAC-SHA256 (600.000 iterações) via Web Worker.
 * Mantido como fallback de retrocompatibilidade para migração transparente de contas antigas.
 */
export async function deriveKeyPBKDF2(password: string, saltBase64: string): Promise<CryptoKey> {
  // Delega derivação pesada para o Web Worker
  const derivedB64 = await workerDeriveKeyPBKDF2(password, saltBase64);
  const derivedBytes = base64ToArrayBuffer(derivedB64);

  return await window.crypto.subtle.importKey(
    'raw',
    derivedBytes as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exporta uma CryptoKey AES-GCM para string Base64 bruta de 256 bits.
 */
export async function exportRawKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Importa uma string Base64 bruta de 256 bits de volta para CryptoKey AES-GCM.
 */
export async function importRawKey(base64Raw: string): Promise<CryptoKey> {
  const rawBytes = base64ToArrayBuffer(base64Raw);
  return await window.crypto.subtle.importKey(
    'raw',
    rawBytes as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Função principal de derivação de chave: usa Argon2id por padrão e permite fallback para PBKDF2.
 */
export async function deriveKey(
  password: string, 
  saltBase64: string, 
  algorithm: KdfAlgorithm = 'argon2id'
): Promise<CryptoKey> {
  if (algorithm === 'pbkdf2') {
    return await deriveKeyPBKDF2(password, saltBase64);
  }
  return await deriveKeyArgon2id(password, saltBase64);
}

/**
 * Criptografa uma string usando AES-256-GCM com a CryptoKey derivada.
 */
export async function encryptData(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // IV de 12 bytes recomendado para o modo AES-GCM
  const ivBytes = new Uint8Array(12);
  window.crypto.getRandomValues(ivBytes);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(ivBytes.buffer)
  };
}

/**
 * Decriptografa dados usando AES-256-GCM com a CryptoKey derivada.
 */
export async function decryptData(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
  const ciphertextBytes = base64ToArrayBuffer(encryptedData.ciphertext);
  const ivBytes = base64ToArrayBuffer(encryptedData.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Gera um Hash SHA-256 (Base64) de um texto.
 */
export async function hashSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Deriva um Hash robusto com Salt para o PIN de 6 dígitos usando Argon2id (RFC 9106) via Web Worker.
 * Parâmetros: t=2, m=16MB (16384 KiB), p=1, dkLen=32 bytes.
 */
export async function derivePinHashArgon2id(pin: string, saltBase64: string): Promise<string> {
  return await workerDerivePinHashArgon2id(pin, saltBase64);
}

/**
 * Deriva um Hash robusto com Salt para o PIN de 6 dígitos usando PBKDF2-HMAC-SHA256 (100.000 iterações) via Web Worker.
 * Mantido como fallback para PINs legados.
 */
export async function derivePinHashPBKDF2(pin: string, saltBase64: string): Promise<string> {
  return await workerDerivePinHashPBKDF2(pin, saltBase64);
}

/**
 * Função unificada de derivação de hash para PIN com suporte a Argon2id e PBKDF2.
 */
export async function derivePinHash(
  pin: string, 
  saltBase64: string, 
  algorithm: KdfAlgorithm = 'argon2id'
): Promise<string> {
  if (algorithm === 'pbkdf2') {
    return await derivePinHashPBKDF2(pin, saltBase64);
  }
  return await derivePinHashArgon2id(pin, saltBase64);
}

/**
 * Gera uma nova Data Encryption Key (DEK) aleatória de 256 bits (AES-GCM) para o cofre.
 */
export async function generateDEK(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // Extraível para permitir o Envelope Wrapping pela KEK
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra a chave DEK utilizando a KEK (derivada da senha mestra) no padrão Envelope Encryption.
 */
export async function wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<EncryptedData> {
  const exportedRaw = await window.crypto.subtle.exportKey('raw', dek);
  const rawBytes = new Uint8Array(exportedRaw);

  const ivBytes = new Uint8Array(12);
  window.crypto.getRandomValues(ivBytes);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    kek,
    rawBytes
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(ivBytes.buffer)
  };
}

/**
 * Decifra a chave DEK a partir do envelope cifrado usando a KEK.
 */
export async function unwrapDEK(wrappedDek: EncryptedData, kek: CryptoKey): Promise<CryptoKey> {
  const ciphertextBytes = base64ToArrayBuffer(wrappedDek.ciphertext);
  const ivBytes = base64ToArrayBuffer(wrappedDek.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    kek,
    ciphertextBytes
  );

  return await window.crypto.subtle.importKey(
    'raw',
    decryptedBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Utilitário de Memory Scrubbing: Sobrescreve buffers de memória volátil com zeros.
 */
export function zeroMemory(target: Uint8Array | ArrayBuffer | any): void {
  try {
    if (!target) return;
    if (target instanceof Uint8Array) {
      target.fill(0);
    } else if (target instanceof ArrayBuffer) {
      new Uint8Array(target).fill(0);
    }
  } catch {
    // Silencioso em caso de buffers já desalocados
  }
}


