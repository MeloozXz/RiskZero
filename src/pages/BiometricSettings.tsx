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
  keyOutline,
  hardwareChipOutline,
  lockClosedOutline,
  checkmarkCircleOutline,
  sparklesOutline,
  scanOutline
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { BiometricsService, BiometricHardwareStatus } from '../services/biometrics';
import { MasterKeyModal } from '../components/MasterKeyModal';
import { getErrorMessage } from '../lib/utils';

export const BiometricSettings: React.FC = () => {
  const {
    activeEmail,
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
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [showMasterKeyModal, setShowMasterKeyModal] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      setLoading(true);
      try {
        await BiometricsService.init();
        const status = await BiometricsService.checkHardwareStatus(activeEmail || undefined);
        if (isMounted) {
          setHwStatus(status);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setHwStatus({
            isAvailable: true,
            isNativeAvailable: false,
            biometricType: 'CYBER_SENSOR',
            isEnrolled: false,
            platformName: 'Sensor Cyber Obsidian',
            isSecureContext: true
          });
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, [activeEmail]);

  const triggerFeedback = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  const handleRegister = async () => {
    if (!confirmPassword.trim()) {
      triggerFeedback('Por favor, informe sua Senha Mestra para vincular a biometria.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await registerBiometrics(confirmPassword);
      if (res.success) {
        triggerFeedback('Biometria ativada neste dispositivo.', 'success');
        setConfirmPassword('');
        const updated = await BiometricsService.checkHardwareStatus(activeEmail || undefined);
        setHwStatus(updated);
      } else {
        triggerFeedback(res.error || 'Falha ao vincular biometria.', 'danger');
      }
    } catch (err: unknown) {
      triggerFeedback(getErrorMessage(err) || 'Erro inesperado ao registrar biometria.', 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    try {
      await disableBiometrics();
      triggerFeedback('Biometria desativada com sucesso para esta conta.', 'warning');
      setConfirmPassword('');
      const updated = await BiometricsService.checkHardwareStatus(activeEmail || undefined);
      setHwStatus(updated);
    } catch (err: unknown) {
      triggerFeedback(getErrorMessage(err) || 'Erro ao desativar biometria.', 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestBiometrics = async () => {
    if (!activeEmail) return;
    setIsTesting(true);
    try {
      const res = await BiometricsService.authenticate(activeEmail);
      if (res.success) {
        triggerFeedback('Teste concluído. A biometria e o cofre foram validados.', 'success');
      } else {
        triggerFeedback(res.error || 'Falha na validação biométrica de teste.', 'danger');
      }
    } catch (err: unknown) {
      triggerFeedback(getErrorMessage(err) || 'Erro ao testar biometria.', 'danger');
    } finally {
      setIsTesting(false);
    }
  };

  const enrolled = activeEmail ? isBiometricsEnrolled(activeEmail) : false;

  return (
    <IonPage style={{ background: '#070a13' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(96, 165, 250, 0.12)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" style={{ color: '#60a5fa' }} />
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
            background: 'linear-gradient(135deg, rgba(96, 165, 250,0.08) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(96, 165, 250, 0.2)',
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
              background: 'radial-gradient(circle, rgba(96, 165, 250,0.15) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IonIcon icon={fingerPrintOutline} style={{ fontSize: '28px', color: '#60a5fa' }} />
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
              Utilize o leitor de impressão digital, Face ID ou o Sensor Cyber Obsidian para realizar desbloqueio instantâneo e proteger redefinições da sua Chave Mestra.
            </p>
          </div>

          {/* Card Status do Hardware e Tecnologia */}
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
                    Status do Sensor de Biometria
                  </IonCardTitle>
                </div>
                {loading ? (
                  <IonSpinner name="crescent" style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
                ) : hwStatus?.isNativeAvailable ? (
                  <IonBadge color="success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '12px' }}>
                    <IonIcon icon={checkmarkCircleOutline} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Hardware Nativo
                  </IonBadge>
                ) : (
                  <IonBadge color="secondary" style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '6px 12px', borderRadius: '12px' }}>
                    <IonIcon icon={sparklesOutline} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Cyber Sensor Ativo
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
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}>
                    {hwStatus?.platformName || 'WebAuthn / Cyber Obsidian'}
                  </span>
                </div>
                <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    STATUS DO DISPOSITIVO
                  </span>
                  <span style={{ color: enrolled ? '#10b981' : '#94a3b8', fontWeight: 700, fontSize: '0.85rem' }}>
                    {enrolled ? 'Ativo' : 'Não Ativado'}
                  </span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Painel Principal de Ativação / Desativação */}
          <IonCard style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(96, 165, 250, 0.15)',
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
                <IonIcon icon={fingerPrintOutline} slot="start" style={{ color: enrolled ? '#10b981' : '#60a5fa' }} />
                <IonLabel style={{ color: '#f8fafc', fontWeight: 600 }}>
                  Desbloqueio Biométrico
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                    {enrolled ? 'Acesso rápido com biometria ativo.' : 'Requer confirmação com a Senha Mestra.'}
                  </p>
                </IonLabel>
                <IonToggle
                  checked={enrolled}
                  onIonChange={(e) => {
                    const willEnable = e.detail.checked;
                    if (!willEnable && enrolled) {
                      handleDisable();
                    }
                  }}
                  disabled={isProcessing}
                  slot="end"
                  style={{ '--color-checked': '#10b981' }}
                />
              </IonItem>

              {!enrolled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                    Para cadastrar e ativar a Biometria neste aparelho, informe sua Senha Mestra:
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid rgba(96, 165, 250, 0.2)',
                    borderRadius: '12px',
                    padding: '0 12px'
                  }}>
                    <IonIcon icon={keyOutline} style={{ color: '#60a5fa', fontSize: '18px', marginRight: '8px' }} />
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
                    onClick={handleRegister}
                    disabled={isProcessing || !confirmPassword.trim()}
                    style={{
                      '--background': 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                      '--border-radius': '12px',
                      fontWeight: 700,
                      margin: '6px 0 0'
                    }}
                  >
                    {isProcessing ? <IonSpinner name="crescent" style={{ color: '#000' }} /> : 'Cadastrar e ativar biometria'}
                  </IonButton>
                </div>
              )}

              {enrolled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <IonButton
                    expand="block"
                    onClick={handleTestBiometrics}
                    disabled={isTesting}
                    style={{
                      '--background': 'linear-gradient(135deg, rgba(96, 165, 250,0.15) 0%, rgba(139,92,246,0.15) 100%)',
                      '--border-color': 'rgba(96, 165, 250, 0.4)',
                      '--border-style': 'solid',
                      '--border-width': '1px',
                      '--border-radius': '12px',
                      color: '#60a5fa',
                      fontWeight: 700
                    }}
                  >
                    <IonIcon icon={scanOutline} slot="start" />
                    {isTesting ? <IonSpinner name="crescent" style={{ color: '#60a5fa' }} /> : 'Testar verificação biométrica'}
                  </IonButton>

                  <IonButton
                    expand="block"
                    fill="outline"
                    color="danger"
                    onClick={handleDisable}
                    disabled={isProcessing}
                    style={{
                      '--border-color': 'rgba(239, 68, 68, 0.4)',
                      '--border-radius': '12px',
                      fontWeight: 700
                    }}
                  >
                    Desativar Biometria Neste Aparelho
                  </IonButton>
                </div>
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
                A redefinição da Chave Mestra Zero-Knowledge altera a chave criptográfica de todo o seu cofre. Esta operação é de altíssima segurança e <strong>exige validação biométrica</strong> do proprietário da conta.
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
