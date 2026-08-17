import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonToggle,
  IonInput,
  IonToast,
  IonSpinner,
  IonBackButton,
  IonButtons,
  IonBadge
} from '@ionic/react';
import {
  fingerPrintOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  keyOutline,
  timeOutline,
  hardwareChipOutline,
  lockClosedOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  warningOutline
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { BiometricsService, BiometricHardwareStatus } from '../services/biometrics';
import { MasterKeyModal } from '../components/MasterKeyModal';

export const BiometricSettings: React.FC = () => {
  const {
    activeEmail,
    isBiometricsSupported,
    isBiometricsEnrolled,
    registerBiometrics,
    disableBiometrics
  } = useSecurity();

  const [hwStatus, setHwStatus] = useState<BiometricHardwareStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastColor, setToastColor] = useState<string>('dark');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showMasterKeyModal, setShowMasterKeyModal] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      setLoading(true);
      const status = await BiometricsService.checkHardwareStatus();
      if (isMounted) {
        setHwStatus(status);
        setLoading(false);
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const triggerFeedback = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  const handleToggle = async (enable: boolean) => {
    if (!activeEmail) return;

    if (!enable) {
      // Desativar biometria
      await disableBiometrics();
      triggerFeedback('Biometria desativada com sucesso neste dispositivo.', 'warning');
      setConfirmPassword('');
      return;
    }

    if (!confirmPassword.trim()) {
      triggerFeedback('Por favor, informe sua Senha Mestra para confirmar a ativação biométrica.', 'danger');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await registerBiometrics(confirmPassword);
      if (res.success) {
        triggerFeedback('✓ Biometria nativa ativada com sucesso!', 'success');
        setConfirmPassword('');
      } else {
        triggerFeedback(res.error || 'Falha ao vincular biometria.', 'danger');
      }
    } catch (err: any) {
      triggerFeedback(err.message || 'Erro inesperado ao registrar biometria.', 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const enrolled = activeEmail ? isBiometricsEnrolled(activeEmail) : false;

  return (
    <IonPage style={{ background: '#070a13' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(0, 242, 254, 0.12)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" style={{ color: '#00f2fe' }} />
          </IonButtons>
          <IonTitle style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.1rem' }}>
            Biometria & Chave Mestra
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#070a13' }}>
        <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Banner Cyber Obsidian */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,242,254,0.08) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(0, 242, 254, 0.2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '20px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(0,242,254,0.15) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IonIcon icon={fingerPrintOutline} style={{ fontSize: '28px', color: '#00f2fe' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.25rem', fontWeight: 800 }}>
                  Autenticação Biométrica
                </h2>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  Arquitetura Zero-Knowledge & Hardware Seguro
                </span>
              </div>
            </div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Utilize o leitor de impressão digital ou Face ID do seu dispositivo para realizar desbloqueio rápido e proteger redefinições da sua Chave Mestra.
            </p>
          </div>

          {/* Card Status do Hardware Nativo */}
          <IonCard style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            margin: 0
          }}>
            <IonCardHeader style={{ padding: '16px 20px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IonIcon icon={hardwareChipOutline} style={{ color: '#8b5cf6', fontSize: '20px' }} />
                  <IonCardTitle style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>
                    Status do Sensor Nativo
                  </IonCardTitle>
                </div>
                {loading ? (
                  <IonSpinner name="crescent" style={{ width: '20px', height: '20px', color: '#00f2fe' }} />
                ) : hwStatus?.isAvailable ? (
                  <IonBadge color="success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '12px' }}>
                    <IonIcon icon={checkmarkCircleOutline} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Disponível
                  </IonBadge>
                ) : (
                  <IonBadge color="danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '12px' }}>
                    <IonIcon icon={closeCircleOutline} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Indisponível
                  </IonBadge>
                )}
              </div>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 20px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    TECNOLOGIA
                  </span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
                    {hwStatus?.biometricType === 'FACE_ID' ? 'Face ID / Facial' : hwStatus?.biometricType === 'FINGERPRINT' ? 'Impressão Digital' : 'WebAuthn Nativo'}
                  </span>
                </div>
                <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ARRASTADO NO DISPOSITIVO
                  </span>
                  <span style={{ color: enrolled ? '#10b981' : '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>
                    {enrolled ? 'Ativo & Configurado' : 'Não Ativado'}
                  </span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Card de Aviso Amarelo/Âmbar se incompatível */}
          {!loading && !hwStatus?.isAvailable && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              backdropFilter: 'blur(16px)'
            }}>
              <IonIcon icon={warningOutline} style={{ fontSize: '28px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ margin: '0 0 6px', color: '#fbbf24', fontSize: '1rem', fontWeight: 800 }}>
                  Recurso Biométrico Incompatível ou Indisponível
                </h3>
                <p style={{ margin: 0, color: '#fef3c7', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Este dispositivo não possui sensores de biometria (impressão digital ou Face ID) compatíveis/ativos no momento. O recurso de autenticação biométrica nativa não poderá ser ativado neste aparelho.
                </p>
              </div>
            </div>
          )}

          {/* Painel Principal de Ativação / Desativação */}
          <IonCard style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(0, 242, 254, 0.15)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            margin: 0
          }}>
            <IonCardHeader>
              <IonCardTitle style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>
                Configuração de Acesso
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <IonItem lines="none" style={{
                '--background': 'rgba(2, 6, 23, 0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '4px 8px'
              }}>
                <IonIcon icon={fingerPrintOutline} slot="start" style={{ color: enrolled ? '#10b981' : '#00f2fe' }} />
                <IonLabel style={{ color: '#f8fafc', fontWeight: 600 }}>
                  Desbloqueio Biométrico
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                    {enrolled ? 'Acesso rápido ativado com biometria.' : !hwStatus?.isAvailable ? 'Incompatível neste aparelho.' : 'Requer confirmação com a Senha Mestra.'}
                  </p>
                </IonLabel>
                <IonToggle
                  checked={enrolled}
                  onIonChange={(e) => handleToggle(e.detail.checked)}
                  disabled={isProcessing || !hwStatus?.isAvailable}
                  slot="end"
                  style={{ '--color-checked': '#10b981' }}
                />
              </IonItem>

              {!enrolled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                    Para cadastrar/ativar sua Biometria (Impressão Digital ou Rosto), informe sua Senha Mestra:
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid rgba(0, 242, 254, 0.2)',
                    borderRadius: '12px',
                    padding: '0 12px'
                  }}>
                    <IonIcon icon={keyOutline} style={{ color: '#00f2fe', fontSize: '18px', marginRight: '8px' }} />
                    <IonInput
                      type="password"
                      placeholder="Digite sua Senha Mestra"
                      value={confirmPassword}
                      onIonInput={(e) => setConfirmPassword(e.detail.value ?? '')}
                      style={{ color: '#ffffff', '--placeholder-color': '#64748b' }}
                    />
                  </div>
                  <IonButton
                    expand="block"
                    onClick={() => handleToggle(true)}
                    disabled={isProcessing || !confirmPassword.trim()}
                    style={{
                      '--background': 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                      '--border-radius': '12px',
                      fontWeight: 700,
                      margin: '6px 0 0'
                    }}
                  >
                    {isProcessing ? <IonSpinner name="crescent" style={{ color: '#000' }} /> : '⚡ Cadastrar e Vincular Biometria Nativa'}
                  </IonButton>
                </div>
              )}

              {enrolled && (
                <IonButton
                  expand="block"
                  fill="outline"
                  color="danger"
                  onClick={() => handleToggle(false)}
                  style={{
                    '--border-color': 'rgba(239, 68, 68, 0.4)',
                    '--border-radius': '12px',
                    fontWeight: 700
                  }}
                >
                  Desativar Biometria Neste Aparelho
                </IonButton>
              )}
            </IonCardContent>
          </IonCard>

          {/* Ação Crítica: Redefinição de Chave Mestra Protegida por Biometria */}
          <IonCard style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(15,23,42,0.8) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            margin: 0
          }}>
            <IonCardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IonIcon icon={shieldCheckmarkOutline} style={{ color: '#ef4444', fontSize: '22px' }} />
                <IonCardTitle style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>
                  Redefinição Crítica da Chave Mestra
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                A redefinição da Chave Mestra Zero-Knowledge altera a chave criptográfica de todo o seu cofre. Esta operação é de altíssima segurança e <strong>EXIGE autorização biométrica nativa direta</strong> do proprietário do aparelho.
              </p>

              <IonButton
                expand="block"
                onClick={() => setShowMasterKeyModal(true)}
                style={{
                  '--background': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  '--border-radius': '12px',
                  fontWeight: 800,
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                  margin: '4px 0 0'
                }}
              >
                <IonIcon icon={lockClosedOutline} slot="start" />
                Redefinir Chave Mestra com Biometria
              </IonButton>
            </IonCardContent>
          </IonCard>

        </div>

        {/* Modal de Redefinição Crítica */}
        <MasterKeyModal
          isOpen={showMasterKeyModal}
          onClose={() => setShowMasterKeyModal(false)}
        />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3500}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default BiometricSettings;
