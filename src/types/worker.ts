/**
 * Protocolo de mensagens tipado para comunicação entre a Main Thread e o Crypto Web Worker.
 * Utiliza union discriminada por `action` para garantir type-safety em ambos os lados.
 */

/**
 * Ações suportadas pelo Web Worker criptográfico.
 */
export type CryptoWorkerAction =
  | 'DERIVE_KEY_ARGON2ID'
  | 'DERIVE_KEY_PBKDF2'
  | 'DERIVE_PIN_HASH_ARGON2ID'
  | 'DERIVE_PIN_HASH_PBKDF2'
  | 'GENERATE_TOTP';

/**
 * Mensagem enviada da Main Thread para o Worker.
 * Cada `reqId` é um UUID único para correlacionar request/response via Promise.
 */
export interface CryptoWorkerRequest {
  action: CryptoWorkerAction;
  reqId: string;
  data: Record<string, unknown>;
}

/**
 * Mensagem enviada do Worker de volta para a Main Thread.
 */
export interface CryptoWorkerResponse {
  reqId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
