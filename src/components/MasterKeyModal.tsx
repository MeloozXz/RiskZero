import React, { useState, useEffect } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonSpinner,
  IonToast,
  IonButtons
} from '@ionic/react';
import {
  Lock,
  Fingerprint,
  AlertTriangle,
  X,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { BiometricsService } from '../services/biometrics';
import { SessionService } from '../services/session';
import { StorageService } from '../services/storage';
import { deriveKey, generateSalt } from '../crypto/webcrypto';
import { getErrorMessage } from '../lib/utils';

import { VaultService } from '../services/vault';

interface MasterKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MasterKeyModal: React.FC<MasterKeyModalProps> = ({ isOpen, onClose }) => {
  const { activeEmail, isBiometricsEnrolled } = useSecurity();

  const [newMasterKey, setNewMasterKey] = useState<string>('');
  const [confirmMasterKey, setConfirmMasterKey] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [bioVerified, setBioVerified] = useState<boolean>(false);

  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastColor, setToastColor] = useState<string>('dark');

  // Limpa estados ao fechar modal
  useEffect(() => {
    if (!isOpen) {
      setNewMasterKey('');
      setConfirmMasterKey('');
      setIsProcessing(false);
      setBioVerified(false);
    }
  }, [isOpen]);

  const triggerToast = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  // Validação em tempo real de força de senha
  const strength = SessionService.validatePasswordStrength(newMasterKey);

  /**
   * Executa o fluxo rigoroso de redefinição Zero-Knowledge com Validação Biométrica Obrigatória.
   */
  const handleRotateMasterKey = async () => {
    if (!activeEmail) {
      triggerToast('Sessão ativa não encontrada.', 'danger');
      return;
    }

    if (!newMasterKey.trim() || newMasterKey !== confirmMasterKey) {
      triggerToast('As senhas mestras não coincidem.', 'danger');
      return;
    }

    if (!strength.isValid) {
      triggerToast(`Senha incompatível: ${strength.feedback[0]}`, 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      // REGRA DE SEGURANÇA ESTRITA (Zero-Knowledge):
      // Exige autenticação biométrica nativa para autorizar re-criptografia.
      const enrolled = isBiometricsEnrolled(activeEmail);
      if (!enrolled) {
        triggerToast('Apenas dispositivos com biometria previamente cadastrada podem redefinir a Chave Mestra por esta rota segura.', 'warning');
        setIsProcessing(false);
        return;
      }

      triggerToast('Disparando validação biométrica nativa de hardware...', 'medium');
      const bioResult = await BiometricsService.authenticate(activeEmail);

      if (!bioResult.success) {
        setBioVerified(false);
        triggerToast(`Operação cancelada: ${bioResult.error || 'A biometria falhou.'}`, 'danger');
        setIsProcessing(false);
        return;
      }

      setBioVerified(true);

      const oldMasterKey = SessionService.getMasterKey();

      // 1. Gera novo salt seguro e deriva a nova CryptoKey AES-256
      const newSalt = generateSalt();
      const newCryptoKey = await deriveKey(newMasterKey, newSalt);

      // 2. Re-criptografa atomicamente todos os itens do cofre
      await VaultService.reencryptVault(oldMasterKey, newCryptoKey);

      // 3. Atualiza salt no Firestore e senha no Firebase Auth
      await SessionService.updateMasterPassword(newMasterKey, newSalt);

      // 4. Atualiza a chave mestra em memória volátil
      SessionService.setMasterKey(newCryptoKey);

      // 5. Recadastra a biometria vinculada à nova chave mestra
      await BiometricsService.registerBiometrics(activeEmail, newMasterKey);

      // 6. Log de Auditoria
      await StorageService.addAuditLog(
        activeEmail,
        'CREDENTIAL_UPDATED',
        'Chave Mestra redefinida e cofre 100% re-criptografado com novo salt criptográfico.'
      );

      triggerToast('Chave mestra redefinida. O cofre foi recriptografado com sucesso.', 'success');

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error('Erro na redefinição da chave mestra:', err);
      triggerToast(getErrorMessage(err) || 'Falha ao redefinir Chave Mestra.', 'danger');
      setIsProcessing(false);
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      style={{
        '--background': 'var(--rz-bg-elevated)',
        '--border-radius': 'var(--rz-radius-lg)'
      }}
    >
      <IonHeader className="ion-no-border">
        <IonToolbar
          style={{
            '--background': 'var(--rz-bg-elevated)',
            borderBottom: '1px solid var(--rz-border)'
          }}
        >
          <IonTitle>Redefinir Chave Mestra</IonTitle>
          <IonButtons slot="end">
            <button
              type="button"
              onClick={onClose}
              className="rz-icon-btn"
              aria-label="Fechar modal"
            >
              <X />
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--rz-bg-elevated)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0 12px' }}>
          {/* Banner de Advertência Zero-Knowledge */}
          <div className="rz-alert rz-alert-danger" role="alert">
            <AlertTriangle />
            <div>
              <strong style={{ color: 'var(--rz-text-primary)', display: 'block', marginBottom: '2px' }}>
                Exigência Criptográfica Estrita
              </strong>
              <span>
                Esta ação re-criptografa seu cofre local com uma nova Chave Mestra. Para evitar sequestro de conta,{' '}
                <strong>SÓ SERÁ CONCLUÍDA</strong> após leitura biométrica válida do seu hardware.
              </span>
            </div>
          </div>

          {/* Form de Nova Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="rz-field" style={{ marginBottom: 0 }}>
              <label className="rz-label">Nova Chave Mestra</label>
              <div className="rz-input-group">
                <KeyRound />
                <IonInput
                  type="password"
                  placeholder="Mínimo 12 caracteres fortes"
                  value={newMasterKey}
                  onIonInput={(e) => setNewMasterKey(e.detail.value ?? '')}
                  style={{ color: 'var(--rz-text-primary)' }}
                />
              </div>
            </div>

            <div className="rz-field" style={{ marginBottom: 0 }}>
              <label className="rz-label">Confirme a Nova Chave Mestra</label>
              <div className="rz-input-group">
                <Lock />
                <IonInput
                  type="password"
                  placeholder="Repita a nova Chave Mestra"
                  value={confirmMasterKey}
                  onIonInput={(e) => setConfirmMasterKey(e.detail.value ?? '')}
                  style={{ color: 'var(--rz-text-primary)' }}
                />
              </div>
            </div>

            {/* Requisitos de Força de Senha */}
            {newMasterKey.length > 0 && (
              <div
                className="rz-panel"
                style={{
                  background: 'var(--rz-bg-deep)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <span
                  style={{
                    color: strength.isValid ? 'var(--rz-success)' : 'var(--rz-warning)',
                    fontWeight: 700,
                    fontSize: 'var(--rz-text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  {strength.isValid ? 'Senha mestra forte' : 'Requisitos da Senha:'}
                </span>
                {strength.feedback.map((fb, idx) => (
                  <span key={idx} style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-xs)' }}>
                    • {fb}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status de Verificação Biométrica */}
          <div
            className="rz-panel"
            style={{
              background: bioVerified ? 'var(--rz-success-soft)' : 'var(--rz-bg-surface)',
              borderColor: bioVerified ? 'var(--rz-success-line)' : 'var(--rz-border)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div className={`rz-icon-tile ${bioVerified ? 'success' : 'violet'}`}>
              {bioVerified ? <CheckCircle2 /> : <Fingerprint />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ color: 'var(--rz-text-primary)', fontWeight: 700, fontSize: 'var(--rz-text-sm)' }}>
                {bioVerified ? 'Biometria Validada no Hardware' : 'Autorização Biométrica Requerida'}
              </span>
              <span style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-xs)' }}>
                {bioVerified
                  ? 'Leitura do leitor aprovada com sucesso.'
                  : 'O prompt nativo será exibido ao clicar no botão.'}
              </span>
            </div>
          </div>

          {/* Botão de Gravação Criptográfica Biométrica */}
          <button
            type="button"
            onClick={handleRotateMasterKey}
            disabled={isProcessing || !newMasterKey || newMasterKey !== confirmMasterKey || !strength.isValid}
            className="rz-btn rz-btn-danger rz-btn-lg rz-btn-block"
            style={{ marginTop: '4px' }}
          >
            {isProcessing ? (
              <IonSpinner name="crescent" style={{ width: '18px', height: '18px' }} />
            ) : (
              <>
                <Fingerprint />
                <span>Validar Biometria &amp; Alterar Chave</span>
              </>
            )}
          </button>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3500}
          position="bottom"
        />
      </IonContent>
    </IonModal>
  );
};
