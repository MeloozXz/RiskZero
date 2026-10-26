import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultService } from './vault';
import { SessionService } from './session';
import { StorageService } from './storage';
import { deriveKey, generateSalt } from '../crypto/webcrypto';

// Mocks do Firebase para os testes rodarem offline
let mockStore: Record<string, any> = {};

vi.mock('./firebase', () => {
  return {
    auth: {
      currentUser: { uid: 'mock-uid-123' }
    },
    db: {}
  };
});

let userPasswords: Record<string, string> = {};

vi.mock('firebase/auth', () => {
  return {
    signInWithEmailAndPassword: async (_auth: any, email: string, password: string) => {
      const emailKey = (email || '').toLowerCase().trim();
      const expected = userPasswords[emailKey];
      if (expected && password !== expected) {
        const err = new Error('auth/wrong-password');
        (err as any).code = 'auth/wrong-password';
        throw err;
      }
      return { user: { uid: 'mock-uid-123' } };
    },
    createUserWithEmailAndPassword: async (_auth: any, email: string, password: string) => {
      const emailKey = (email || '').toLowerCase().trim();
      userPasswords[emailKey] = password;
      return { user: { uid: 'mock-uid-123' } };
    },
    signOut: async () => {}
  };
});

vi.mock('firebase/firestore', () => {
  return {
    doc: (db: any, col: string, id: string) => `${col}/${id}`,
    getDoc: async (docRef: string) => ({
      exists: () => !!mockStore[docRef],
      data: () => mockStore[docRef]
    }),
    setDoc: async (docRef: string, data: any) => {
      mockStore[docRef] = data;
    },
    updateDoc: async (docRef: string, data: any) => {
      mockStore[docRef] = { ...mockStore[docRef], ...data };
    }
  };
});

// Mock do Preferences do Capacitor (StorageService depende dele)
vi.mock('@capacitor/preferences', () => {
  let store: Record<string, string> = {};
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store[key] || null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        store[key] = value;
      },
      remove: async ({ key }: { key: string }) => {
        delete store[key];
      },
      clear: async () => {
        store = {};
      },
    },
  };
});

describe('VaultService Criptográfico - Suíte de Testes (Zero-Knowledge)', () => {
  const masterPassword = 'MasterPassword@987654321';

  beforeEach(async () => {
    // Limpa estado anterior do banco simulado
    mockStore = {};
    userPasswords = {};
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    SessionService.clearSession();

    // Inicializa perfil do usuário para o teste
    await SessionService.registerUser('testuser@tcc.com', masterPassword);
  });

  it('deve armazenar credenciais criptografadas de forma que o plaintext nunca toque o disco', async () => {
    const id = await VaultService.create({
      title: 'Minha Conta de Teste',
      username: 'usuario_teste',
      password: 'SenhaUltraSecreta@2026',
      url: 'https://exemplo-seguro.com',
      notes: 'Nota secreta do cofre',
    });

    expect(id).toBeDefined();

    // Busca o dado bruto no banco (StorageService)
    const rawVault = await StorageService.getEncryptedVault('testuser@tcc.com');
    expect(rawVault).toBeDefined();
    expect(rawVault).not.toContain('Minha Conta de Teste'); // Título também está cifrado Zero-Knowledge
    expect(rawVault).not.toContain('https://exemplo-seguro.com'); // URL também está cifrada
    expect(rawVault).not.toContain('usuario_teste');
    expect(rawVault).not.toContain('SenhaUltraSecreta@2026');
    expect(rawVault).not.toContain('Nota secreta do cofre');

    // Descriptografa em RAM via VaultService
    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Minha Conta de Teste');
    expect(all[0].username).toBe('usuario_teste');
    expect(all[0].url).toBe('https://exemplo-seguro.com');
    expect(all[0]._plaintextPassword).toBe('SenhaUltraSecreta@2026');
  });

  it('deve re-criptografar o cofre de forma segura durante a rotação da chave mestra', async () => {
    await VaultService.create({
      title: 'Email Pessoal',
      username: 'usuario@email.com',
      password: 'SenhaAntiga@123',
      url: 'https://mail.com',
    });

    const oldKey = SessionService.getMasterKey();
    const newSalt = generateSalt(16);
    const newKey = await deriveKey('NovaSenhaMestraForte@999', newSalt);

    // Re-encripta o cofre
    await VaultService.reencryptVault(oldKey, newKey);

    // Define a nova chave mestra na RAM
    SessionService.setMasterKey(newKey);

    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Email Pessoal');
    expect(all[0].username).toBe('usuario@email.com');
    expect(all[0]._plaintextPassword).toBe('SenhaAntiga@123');
  });


  it('deve manter histórico de até 5 versões criptografadas de senhas antigas', async () => {
    const id = await VaultService.create({
      title: 'Banco Cripto',
      username: 'client_crypto',
      password: 'senha_original_123',
      url: 'https://banco.com',
    });

    // Atualiza a senha 3 vezes
    await VaultService.update(id, { password: 'senha_segunda_456' });
    await VaultService.update(id, { password: 'senha_terceira_789' });
    await VaultService.update(id, { password: 'senha_quarta_abc' });

    const all = await VaultService.getAll();
    const item = all[0];

    expect(item._plaintextPassword).toBe('senha_quarta_abc');
    expect(item.history).toBeDefined();
    expect(item.history!.length).toBe(3);

    // Revela a senha original de uma entrada do histórico
    const firstHist = item.history![2]; // A mais antiga é a última do array
    const originalPass = await VaultService.revealHistoryPassword(id, firstHist.id);
    expect(originalPass).toBe('senha_original_123');

    // Revela a segunda senha
    const secondHist = item.history![1];
    const secondPass = await VaultService.revealHistoryPassword(id, secondHist.id);
    expect(secondPass).toBe('senha_segunda_456');
  });

  it('deve realizar análise matemática local de saúde das senhas sem enviar dados à rede', async () => {
    // Cadastra uma senha fraca
    await VaultService.create({
      title: 'Fraca',
      username: 'user1',
      password: '123',
      url: 'https://site1.com',
    });

    // Cadastra uma senha forte, mas reutilizada
    await VaultService.create({
      title: 'Forte Reutilizada 1',
      username: 'user2',
      password: 'SenhaSuperForte@2026!',
      url: 'https://site2.com',
    });

    await VaultService.create({
      title: 'Forte Reutilizada 2',
      username: 'user3',
      password: 'SenhaSuperForte@2026!',
      url: 'https://site3.com',
    });

    const analysis = await VaultService.analyzePasswordHealth();
    expect(analysis.total).toBe(3);
    expect(analysis.weak).toBe(1); // '123' é fraca
    expect(analysis.reused).toBe(2); // 'SenhaSuperForte@2026!' é duplicada
  });

  it('deve exportar backup contendo apenas ciphertext (Zero-Knowledge)', async () => {
    await VaultService.create({
      title: 'Backup Test',
      username: 'backup_user',
      password: 'PasswordBackup123!',
      url: 'https://backup.com',
    });

    const backupBlob = await VaultService.exportEncryptedBlob();
    expect(backupBlob).toBeDefined();
    
    // O backup é uma string JSON
    const parsed = JSON.parse(backupBlob);
    expect(parsed.version).toBe('2.0');
    expect(parsed.salt).toBeDefined();
    expect(parsed.vault).toBeDefined();

    // Garante que o backup não tem texto claro exposto
    const rawString = JSON.stringify(parsed.vault);
    expect(rawString).not.toContain('backup_user');
    expect(rawString).not.toContain('PasswordBackup123!');
  });

  it('deve importar backup criptografado decifrando-o com a senha correta e re-encriptando-o com a chave do usuário ativo', async () => {
    // 1. Cadastra credencial
    await VaultService.create({
      title: 'Site de Compra',
      username: 'comprador1',
      password: 'SenhaSecretaCompras@99',
      url: 'https://loja.com',
    });

    // 2. Exporta o backup
    const backupJson = await VaultService.exportEncryptedBlob();

    // 3. Simula reset do app (limpa tudo) e cria um novo perfil de usuário com senha diferente
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    SessionService.clearSession();

    const novaSenhaMestra = 'NovaSenhaMestraSuperForte@2026';
    await SessionService.registerUser('newuser@tcc.com', novaSenhaMestra);

    // 4. Tenta importar com senha errada (deve falhar)
    await expect(
      VaultService.importEncryptedBlob(backupJson, 'SenhaMestraIncorreta@123', true)
    ).rejects.toThrow();

    // 5. Importa com a senha correta (a que foi usada no backup anterior)
    const res = await VaultService.importEncryptedBlob(backupJson, masterPassword, true);
    expect(res.success).toBe(true);
    expect(res.importedCount).toBe(1);

    // 6. Verifica se o item importado foi re-criptografado e pode ser lido com a NOVA senha mestra ativa
    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Site de Compra');
    expect(all[0].username).toBe('comprador1');
    expect(all[0]._plaintextPassword).toBe('SenhaSecretaCompras@99');
  }, 30000);

  it('deve realizar a migração transparente de um usuário legado PBKDF2 para Argon2id no login', async () => {
    // 1. Simula usuário legado com PBKDF2 no Firestore (kdfAlgorithm: 'pbkdf2')
    SessionService.clearSession();
    const legacyEmail = 'legacy_user@tcc.com';
    const legacyPass = 'LegacyMasterKey@2025';
    const legacySalt = generateSalt(16);
    const legacyKey = await deriveKey(legacyPass, legacySalt, 'pbkdf2');

    // Inicializa a sessão temporariamente com a chave legada para popular o cofre
    SessionService.setMasterKey(legacyKey, legacyEmail);

    // Popula o Firestore com o perfil legado
    mockStore['users/mock-uid-123'] = {
      email: legacyEmail,
      salt: legacySalt,
      kdfAlgorithm: 'pbkdf2',
      totpEnabled: false,
      encryptedVault: '',
      auditLogs: [],
      createdAt: new Date().toISOString()
    };

    // Cria uma credencial usando a chave legada
    await VaultService.create({
      title: 'Credencial Legada',
      username: 'usuario_antigo',
      password: 'SenhaUltraAntiga@99',
      url: 'https://sistema-antigo.com'
    });

    // Limpa a sessão para simular logout
    SessionService.clearSession();

    // 2. Realiza o login (deve disparar a migração transparente)
    const loginRes = await SessionService.authenticateMaster(legacyEmail, legacyPass);
    expect(loginRes.success).toBe(true);

    // 3. Verifica se o perfil no Firestore foi atualizado para Argon2id
    const updatedProfile = mockStore['users/mock-uid-123'];
    expect(updatedProfile.kdfAlgorithm).toBe('argon2id');
    expect(updatedProfile.salt).not.toBe(legacySalt); // Um novo salt deve ter sido gerado

    // 4. Verifica se o cofre foi re-encriptado e continua acessível normalmente com a nova chave Argon2id
    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Credencial Legada');
    expect(all[0].username).toBe('usuario_antigo');
    expect(all[0]._plaintextPassword).toBe('SenhaUltraAntiga@99');
  }, 30000);

  it('deve armazenar categorias e gerar códigos TOTP/2FA de 6 dígitos em tempo real', async () => {
    // Segredo Base32 de teste (RFC 6238)
    const testTotpSecret = 'JBSWY3DPEHPK3PXP';
    const id = await VaultService.create({
      title: 'GitHub Enterprise',
      username: 'octocat',
      password: 'GitHubSuperSecret@2026',
      url: 'https://github.com',
      category: 'LOGIN',
      totpSecret: testTotpSecret,
    });

    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].category).toBe('LOGIN');
    expect(all[0]._plaintextTotpSecret).toBe(testTotpSecret);

    // Gera o código 2FA ao vivo
    const totpResult = await VaultService.getTotpCode(id);
    expect(totpResult).toBeDefined();
    expect(totpResult?.code.length).toBe(6);
    expect(totpResult?.remainingSeconds).toBeGreaterThanOrEqual(1);
    expect(totpResult?.remainingSeconds).toBeLessThanOrEqual(30);
  });

  it('deve importar dados em formato Bitwarden e Chrome CSV e exportar em CSV com sucesso', async () => {
    const { ImporterService } = await import('./importer');

    // CSV simulado do Bitwarden
    const bitwardenCSV = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
,0,1,Discord,Notas do discord,,,https://discord.com,discord_user,DiscordPass@2026,JBSWY3DPEHPK3PXP
,0,1,AWS Console,Conta cloud,,,https://aws.amazon.com,aws_admin,AWSSuperPass@99,`;

    const parsed = ImporterService.parseCSVToItems(bitwardenCSV);
    expect(parsed.format).toBe('BITWARDEN');
    expect(parsed.items.length).toBe(2);

    const importRes = await ImporterService.importItemsToVault(parsed.items);
    expect(importRes.importedCount).toBe(2);

    const all = await VaultService.getAll();
    expect(all.some((i) => i.title === 'Discord' && i.username === 'discord_user')).toBe(true);
    expect(all.some((i) => i.title === 'AWS Console' && i.username === 'aws_admin')).toBe(true);

    // A-5: Exige reautenticação com senha mestra para exportar CSV
    await expect(ImporterService.exportVaultToCSV()).rejects.toThrow('Reautenticação obrigatória');
    await expect(ImporterService.exportVaultToCSV('senha_errada_123')).rejects.toThrow();

    // Exporta como CSV com a senha mestra correta
    const exportedCSV = await ImporterService.exportVaultToCSV(masterPassword);
    expect(exportedCSV).toContain('Discord');
    expect(exportedCSV).toContain('discord_user');
    expect(exportedCSV).toContain('AWS Console');
  });
});
