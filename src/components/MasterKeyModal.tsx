import React, { useState, useEffect } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
  IonToast,
  IonButtons
} from '@ionic/react';
import {
  lockClosedOutline,
  fingerPrintOutline,
  shieldCheckmarkOutline,
  warningOutline,
  closeOutline,
  checkmarkCircleOutline,
  keyOutline
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { BiometricsService } from '../services/biometrics';
import { SessionService } from '../services/session';
import { StorageService } from '../services/storage';
import { deriveKey, generateSalt } from '../crypto/webcrypto';

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
      // Exige autenticação biométrica nativa para gravar/recriptografar com a nova chave.
      // Sem fallback para senhas simples nesta ação crítica.
      const enrolled = isBiometricsEnrolled(activeEmail);
      if (!enrolled) {
        triggerToast('⚠️ Apenas dispositivos com biometria previamente cadastrada podem redefinir a Chave Mestra por esta rota segura.', 'warning');
        setIsProcessing(false);
        return;
      }

      triggerToast('Disparando validação biométrica nativa de hardware...', 'medium');
      const bioResult = await BiometricsService.authenticate(activeEmail);

      if (!bioResult.success) {
        setBioVerified(false);
        triggerToast(`❌ Operação abortada: ${bioResult.error || 'A biometria falhou.'}`, 'danger');
        setIsProcessing(false);
        return;
      }

      setBioVerified(true);

      // Deriva nova CryptoKey AES-256 em memória RAM
      const newSalt = generateSalt();
      const newCryptoKey = await deriveKey(newMasterKey, newSalt);

      // Atualiza a chave mestra em memória volátil
      SessionService.setMasterKey(newCryptoKey);

      // Recadastra a biometria vinculada à nova chave mestra
      await BiometricsService.registerBiometrics(activeEmail, newMasterKey);

      // Log de Auditoria
      await StorageService.addAuditLog(
        activeEmail,
        'CREDENTIAL_UPDATED',
        'Chave Mestra recriptografada com sucesso via autorização biométrica nativa.'
      );

      triggerToast('✓ Chave Mestra redefinida e cofre re-criptografado com sucesso!', 'success');

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Erro na redefinição da chave mestra:', err);
      triggerToast(err.message || 'Falha ao redefinir Chave Mestra.', 'danger');
      setIsProcessing(false);
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      style={{
        '--background': '#070a13',
        '--border-radius': '24px'
      }}
    >
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <IonTitle style={{ color: '#ffffff', fontWeight: 800 }}>
            Redefinir Chave Mestra
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: '#94a3b8' }}>
              <IonIcon icon={closeOutline} style={{ fontSize: '24px' }} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#070a13' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
          
          {/* Banner de Advertência Zero-Knowledge */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <IonIcon icon={warningOutline} style={{ color: '#ef4444', fontSize: '24px', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ color: '#f8fafc', fontSize: '0.85rem', lineHeight: '1.5' }}>
              <strong style={{ color: '#ef4444', display: 'block', marginBottom: '2px' }}>
                Exigência Criptográfica Estrita
              </strong>
              Esta ação re-criptografa seu cofre local com uma nova Chave Mestra. Para evitar sequestro de conta, <strong>SÓ SERÁ CONCLUÍDA</strong> após leitura biométrica válida do seu hardware.
            </div>
          </div>

          {/* Form de Nova Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                NOVA CHAVE MESTRA
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(0, 242, 254, 0.2)',
                borderRadius: '12px',
                padding: '0 12px'
              }}>
                <IonIcon icon={keyOutline} style={{ color: '#00f2fe', fontSize: '18px', marginRight: '8px' }} />
                <IonInput
                  type="password"
                  placeholder="Mínimo 12 caracteres fortes"
                  value={newMasterKey}
                  onIonInput={(e) => setNewMasterKey(e.detail.value ?? '')}
                  style={{ color: '#ffffff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                CONFIRME A NOVA CHAVE MESTRA
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(0, 242, 254, 0.2)',
                borderRadius: '12px',
                padding: '0 12px'
              }}>
                <IonIcon icon={lockClosedOutline} style={{ color: '#00f2fe', fontSize: '18px', marginRight: '8px' }} />
                <IonInput
                  type="password"
                  placeholder="Repita a nova Chave Mestra"
                  value={confirmMasterKey}
                  onIonInput={(e) => setConfirmMasterKey(e.detail.value ?? '')}
                  style={{ color: '#ffffff' }}
                />
              </div>
            </div>

            {/* Requisitos de Força de Senha */}
            {newMasterKey.length > 0 && (
              <div style={{
                background: 'rgba(2, 6, 23, 0.5)',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ color: strength.isValid ? '#10b981' : '#f59e0b', fontWeight: 700, fontSize: '0.8rem' }}>
                  {strength.isValid ? '✓ Senha Mestra Forte!' : 'Requisitos da Senha:'}
                </span>
                {strength.feedback.map((fb, idx) => (
                  <span key={idx} style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    • {fb}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status de Verificação Biométrica */}
          <div style={{
            background: bioVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
            border: bioVerified ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <IonIcon
              icon={bioVerified ? checkmarkCircleOutline : fingerPrintOutline}
              style={{ color: bioVerified ? '#10b981' : '#8b5cf6', fontSize: '26px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                {bioVerified ? 'Biometria Validada no Hardware' : 'Autorização Biométrica Requerida'}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {bioVerified ? 'Leitura do leitor aprovada com sucesso.' : 'O prompt nativo será exibido ao clicar no botão.'}
              </span>
            </div>
          </div>

          {/* Botão de Gravação Criptográfica Biométrica */}
          <IonButton
            expand="block"
            onClick={handleRotateMasterKey}
            disabled={isProcessing || !newMasterKey || newMasterKey !== confirmMasterKey || !strength.isValid}
            style={{
              '--background': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              '--border-radius': '14px',
              height: '50px',
              fontWeight: 800,
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
              marginTop: '10px'
            }}
          >
            {isProcessing ? (
              <IonSpinner name="crescent" style={{ color: '#ffffff' }} />
            ) : (
              <>
                <IonIcon icon={fingerPrintOutline} slot="start" />
                Validar Biometria & Alterar Chave
              </>
            )}
          </IonButton>

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
