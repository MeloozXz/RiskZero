import { describe, it, expect, beforeEach } from 'vitest';
import { BiometricsService, registerBiometricPromptHandler } from './biometrics';

describe('BiometricsService - Suíte de Testes Criptográficos e Biometria', () => {
  const testEmail = 'aluno@cyberobsidian.com';
  const testMasterPassword = 'SenhaSuperSegura!2026@Obsidian';

  beforeEach(async () => {
    registerBiometricPromptHandler(async () => true);
    await BiometricsService.disableBiometrics(testEmail);
    localStorage.clear();
  });

  it('M-5: deve rejeitar promptCyberSensor se nenhum handler visual estiver montado', async () => {
    registerBiometricPromptHandler(null);
    const approved = await BiometricsService.promptCyberSensor(testEmail, 'AUTH', 'CYBER_SENSOR');
    expect(approved).toBe(false);
  });

  it('deve consultar o status de hardware e ambiente sem disparar exceções', async () => {
    const status = await BiometricsService.checkHardwareStatus(testEmail);
    expect(status).toBeDefined();
    expect(status.isAvailable).toBe(true);
    expect(typeof status.platformName).toBe('string');
    expect(typeof status.isNativeAvailable).toBe('boolean');
    expect(status.isEnrolled).toBe(false);
  });

  it('deve cadastrar a biometria vinculando a senha mestra de forma cifrada (Zero-Knowledge)', async () => {
    const regResult = await BiometricsService.registerBiometrics(testEmail, testMasterPassword);
    expect(regResult.success).toBe(true);

    const isEnrolled = BiometricsService.isEnrolled(testEmail);
    expect(isEnrolled).toBe(true);

    const enrolledList = BiometricsService.getEnrolledEmails();
    expect(enrolledList).toContain(testEmail);
  });

  it('deve autenticar com sucesso e decifrar a senha mestra idêntica em memória', async () => {
    await BiometricsService.registerBiometrics(testEmail, testMasterPassword);

    const authResult = await BiometricsService.authenticate(testEmail);
    expect(authResult.success).toBe(true);
    expect(authResult.masterPassword).toBe(testMasterPassword);
  });

  it('deve desativar e limpar os dados biométricos do usuário', async () => {
    await BiometricsService.registerBiometrics(testEmail, testMasterPassword);
    expect(BiometricsService.isEnrolled(testEmail)).toBe(true);

    await BiometricsService.disableBiometrics(testEmail);
    expect(BiometricsService.isEnrolled(testEmail)).toBe(false);

    const authResult = await BiometricsService.authenticate(testEmail);
    expect(authResult.success).toBe(false);
    expect(authResult.errorCode).toBe('NOT_ENROLLED');
  });
});
