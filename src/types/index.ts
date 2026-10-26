/**
 * Estrutura para dados criptografados localmente.
 * Armazena o ciphertext codificado e metadados necessários para a decriptação.
 */
export interface EncryptedData {
  ciphertext: string; // Conteúdo criptografado em formato Base64 ou Hex
  iv: string;         // Vetor de Inicialização em Base64 ou Hex
}

/**
 * Categorias suportadas para organização de credenciais e dados no Cofre.
 */
export type VaultCategory = 'LOGIN' | 'CARD' | 'NOTE' | 'IDENTITY' | 'OTHER';

/**
 * Histórico de alterações de uma credencial para fins de auditoria local.
 */
export interface PasswordHistoryItem {
  id: string;
  username: string;
  encryptedPassword: EncryptedData;
  updatedAt: string;
}

/**
 * Item de credencial armazenado no cofre (Vault).
 */
export interface VaultItem {
  id: string;
  title: string;
  username: string;
  encryptedPassword: EncryptedData;
  url: string;
  category?: VaultCategory;
  encryptedNotes?: EncryptedData;
  encryptedTotpSecret?: EncryptedData;
  updatedAt: string;
  history?: PasswordHistoryItem[];
  _plaintextPassword?: string;
  _plaintextNotes?: string;
  _plaintextTotpSecret?: string;
}

/**
 * Envelope Criptográfico do Cofre (Envelope Encryption: DEK + KEK).
 */
export interface VaultEnvelope {
  version: number;
  encryptedDek?: EncryptedData; // DEK de 256 bits cifrada pela KEK (derivada da senha mestra)
  items: VaultItem[];
}

export type KdfAlgorithm = 'argon2id' | 'pbkdf2';

/**
 * Níveis de Planos de Assinatura.
 */
export type PlanTier = 'FREE' | 'PRO' | 'ULTRA';

/**
 * Ciclos de Cobrança.
 */
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

/**
 * Detalhes da Assinatura do Usuário.
 */
export interface SubscriptionInfo {
  tier: PlanTier;
  billingCycle?: BillingCycle;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL';
  startedAt: string;
  expiresAt: string | null; // null para Free vitalício
  autoRenew: boolean;
  paymentMethod?: 'PIX' | 'CREDIT_CARD';
}

/**
 * Perfil do usuário com dados de segurança para autenticação local e 2FA.
 */
export interface UserProfile {
  username: string;
  salt: string;              // Salt gerado aleatoriamente para derivação da chave mestra
  kdfAlgorithm?: KdfAlgorithm; // Algoritmo de derivação de chave ('argon2id' ou 'pbkdf2' legado)
  passwordHash: string;      // Hash SHA-256 da senha mestra + salt para verificação rápida de login
  pinHash?: string;          // Hash do PIN local de 6 dígitos para re-entrada rápida
  totpSecret?: string;       // Mantido temporariamente para compatibilidade legada
  encryptedTotpSecret?: EncryptedData; // Segredo TOTP criptografado com a Master Key
  totpEnabled: boolean;      // Indica se o 2FA está configurado e ativado
  subscription?: SubscriptionInfo; // Informações do Plano (Free, Pro, Ultra)
  createdAt: string;
}

/**
 * Sessão de login local ativa no dispositivo móvel.
 */
export interface ActiveSession {
  id: string;
  deviceName: string;
  lastActive: string;
  ipPlaceholder?: string;
}

/**
 * Registros de eventos de segurança (Audit Logs) para visualização do usuário.
 */
export interface AuditLog {
  id: string;
  timestamp: string;
  action: 
    | 'LOGIN_SUCCESS' 
    | 'LOGIN_FAILED' 
    | '2FA_VERIFIED' 
    | 'PIN_LOCKED' 
    | 'CREDENTIAL_CREATED' 
    | 'CREDENTIAL_UPDATED' 
    | 'CREDENTIAL_DELETED' 
    | 'PASSWORD_COPIED' 
    | 'BACKUP_EXPORTED' 
    | 'VAULT_IMPORTED'
    | 'DEK_ROTATED'
    | 'SUBSCRIPTION_UPGRADED'
    | 'SUBSCRIPTION_CANCELLED'
    | 'SCREENSHOT_BLOCKED' 
    | 'AUTO_LOCK' 
    | 'LOGOUT'
    | 'ROOT_DETECTED'
    | 'SESSION_INVALIDATED'
    | 'VAULT_HEALTH_CHECK'
    | 'BREACH_DETECTED'
    | 'VPN_CONNECTED'
    | 'VPN_DISCONNECTED'
    | 'VPN_KILLSWITCH_TRIGGERED'
    | 'VPN_IP_VERIFICATION_FAILED';
  details: string;
}

/**
 * Representação de Servidor WireGuard para o Módulo de VPN Real.
 */
export interface VpnServer {
  id: string;
  name: string;
  country: string;
  city: string;
  flag: string;
  endpoint: string; // IP ou hostname real do servidor WireGuard
  port: number;     // Porta WireGuard (padrão: 51820)
  serverPublicKey: string; // Chave pública Curve25519 (Base64) do servidor
  dns: string[];
  allowedIps: string[];
  clientAddress: string; // IP atribuído ao cliente na interface tun (ex: 10.14.0.2/32)
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE';
  isCustom?: boolean;
  ping?: number;
  load?: number;
}
