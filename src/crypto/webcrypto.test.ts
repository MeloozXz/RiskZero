import { describe, it, expect } from 'vitest';
import { 
  generateSalt, 
  deriveKey, 
  deriveKeyArgon2id,
  deriveKeyPBKDF2,
  encryptData, 
  decryptData, 
  hashSHA256, 
  derivePinHash,
  derivePinHashArgon2id,
  derivePinHashPBKDF2
} from './webcrypto';

describe('Web Crypto & Argon2id Suite', () => {
  const password = 'Password@123456';

  it('deve gerar salts Base64 de comprimento válido', () => {
    const salt = generateSalt(16);
    expect(salt).toBeDefined();
    expect(salt.length).toBeGreaterThanOrEqual(20);
  });

  it('deve gerar hashes SHA-256 idênticos para a mesma entrada', async () => {
    const text = 'test_hash';
    const hash1 = await hashSHA256(text);
    const hash2 = await hashSHA256(text);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(text);
  });

  it('deve derivar chaves consistentes com Argon2id (RFC 9106)', async () => {
    const salt = generateSalt(16);
    const key1 = await deriveKeyArgon2id(password, salt);
    const key2 = await deriveKeyArgon2id(password, salt);
    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1.type).toBe('secret');
    expect(key1.algorithm.name).toBe('AES-GCM');

    // Chave padrão deriveKey deve ser Argon2id
    const keyDefault = await deriveKey(password, salt);
    expect(keyDefault).toBeDefined();
    expect(keyDefault.algorithm.name).toBe('AES-GCM');
  });

  it('deve derivar chaves com PBKDF2 no modo fallback de compatibilidade', async () => {
    const salt = generateSalt(16);
    const pbkdf2Key = await deriveKeyPBKDF2(password, salt);
    const explicitFallback = await deriveKey(password, salt, 'pbkdf2');
    expect(pbkdf2Key).toBeDefined();
    expect(explicitFallback).toBeDefined();
    expect(pbkdf2Key.algorithm.name).toBe('AES-GCM');
  });

  it('deve criptografar e decriptografar dados com chave derivada por Argon2id', async () => {
    const secretMessage = 'Esta é uma credencial ultra secreta para o cofre com Argon2id.';
    const salt = generateSalt(16);
    const key = await deriveKey(password, salt, 'argon2id');

    const encrypted = await encryptData(secretMessage, key);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(secretMessage);

    const decrypted = await decryptData(encrypted, key);
    expect(decrypted).toBe(secretMessage);
  });

  it('deve falhar ao decriptografar com chave incorreta em Argon2id', async () => {
    const secretMessage = 'Mensagem de teste';
    const salt = generateSalt(16);
    const correctKey = await deriveKey(password, salt, 'argon2id');
    const wrongKey = await deriveKey('WrongPassword@12', salt, 'argon2id');

    const encrypted = await encryptData(secretMessage, correctKey);
    await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
  }, 15000);

  it('deve derivar hash de PIN seguro com Argon2id e suportar fallback PBKDF2', async () => {
    const pin = '123456';
    const salt = generateSalt(16);
    
    // Argon2id
    const pinHashArgon1 = await derivePinHashArgon2id(pin, salt);
    const pinHashArgon2 = await derivePinHash(pin, salt, 'argon2id');
    expect(pinHashArgon1).toBe(pinHashArgon2);
    expect(pinHashArgon1).not.toBe(pin);

    // PBKDF2 fallback
    const pinHashPBKDF2_1 = await derivePinHashPBKDF2(pin, salt);
    const pinHashPBKDF2_2 = await derivePinHash(pin, salt, 'pbkdf2');
    expect(pinHashPBKDF2_1).toBe(pinHashPBKDF2_2);
    expect(pinHashPBKDF2_1).not.toBe(pinHashArgon1);
  });
});


