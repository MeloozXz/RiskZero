import { workerGenerateTOTP } from '../workers/cryptoWorkerClient';

/**
 * Decodifica uma string Base32 para um Uint8Array (necessário para ler o segredo TOTP).
 */
export function decodeBase32(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error('Caractere Base32 inválido na chave secreta.');
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

/**
 * Gera um segredo aleatório codificado em Base32 de comprimento parametrizado.
 */
export function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[array[i] % alphabet.length];
  }
  return secret;
}

/**
 * Calcula o código TOTP de 6 dígitos a partir de um segredo Base32 e um tempo (timestamp) via Web Worker.
 */
export async function generateTOTP(secretBase32: string, time = Date.now()): Promise<string> {
  return await workerGenerateTOTP(secretBase32, time);
}

/**
 * Valida se um token fornecido pelo usuário corresponde ao segredo local.
 * Suporta uma janela de tolerância de tempo (ex: -1, 0, +1 passos de 30s)
 * para mitigar dessincronizações de relógio do celular do usuário.
 */
export async function verifyTOTP(
  token: string,
  secretBase32: string,
  windowTolerance = 1
): Promise<boolean> {
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || isNaN(Number(cleanToken))) {
    return false;
  }

  const now = Date.now();
  // Verifica o passo atual e passos vizinhos baseados na tolerância
  for (let i = -windowTolerance; i <= windowTolerance; i++) {
    const computed = await generateTOTP(secretBase32, now + i * 30 * 1000);
    if (computed === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai o segredo Base32 a partir de uma chave pura ou de uma URL otpauth:// padrão de QR Code.
 */
export function parseOtpAuthUrl(uriOrSecret: string): string {
  const trimmed = uriOrSecret.trim();
  if (trimmed.startsWith('otpauth://')) {
    try {
      const url = new URL(trimmed);
      const secret = url.searchParams.get('secret');
      if (secret) return secret.toUpperCase().replace(/\s/g, '');
    } catch {
      // Fallback
    }
  }
  return trimmed.toUpperCase().replace(/\s/g, '');
}
