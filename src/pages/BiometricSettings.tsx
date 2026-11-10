import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonToast,
  IonSpinner,
} from '@ionic/react';
import {
  Fingerprint,
  ShieldCheck,
  KeyRound,
  Cpu,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ScanFace,
  Trash2,
} from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { BiometricsService, BiometricHardwareStatus } from '../services/biometrics';
import { MasterKeyModal } from '../components/MasterKeyModal';
import { getErrorMessage } from '../lib/utils';

export const BiometricSettings: React.FC = () => {
  const {
    activeEmail,
    isBiometricsEnrolled,
    registerBiometrics,
    disableBiometrics,
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
            isAvailable: false,
            isNativeAvailable: false,
            biometricType: 'NONE',
            isEnrolled: false,
            platformName: 'Nenhum sensor biométrico físico detectado',
            isSecureContext: true,
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
    if (!hwStatus?.isNativeAvailable) {
      triggerFeedback(
        'Nenhum leitor biométrico físico foi detectado neste dispositivo.',
        'danger'
      );
      return;
    }

    if (!confirmPassword.trim()) {
      triggerFeedback('Informe sua Senha Mestra para autorizar o vínculo no hardware.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await registerBiometrics(confirmPassword);
      if (res.success) {
        triggerFeedback('Biometria de hardware vinculada com sucesso.', 'success');
        setConfirmPassword('');
        const updated = await BiometricsService.checkHardwareStatus(activeEmail || undefined);
        setHwStatus(updated);
      } else {
        triggerFeedback(res.error || 'Falha ao vincular biometria no hardware.', 'danger');
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
      triggerFeedback('Credencial biométrica removida deste dispositivo.', 'warning');
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
        triggerFeedback('Leitura biométrica de hardware autenticada com sucesso.', 'success');
      } else {
        triggerFeedback(res.error || 'A leitura biométrica falhou ou foi cancelada.', 'danger');
      }
    } catch (err: unknown) {
      triggerFeedback(getErrorMessage(err) || 'Erro ao testar sensor biométrico.', 'danger');
    } finally {
      setIsTesting(false);
    }
  };

  const enrolled = activeEmail ? isBiometricsEnrolled(activeEmail) : false;
  const hasHardware = Boolean(hwStatus?.isNativeAvailable);

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content">
        <div className="rz-container-narrow">
          {/* Page Header */}
          <div className="rz-page-header">
            <div>
              <h1 className="rz-page-title">Biometria &amp; Chave Mestra</h1>
              <p className="rz-page-subtitle">
                Autenticação física via WebAuthn (Windows Hello, Touch ID ou Leitor Digital Android) e rotação de chaves.
              </p>
            </div>
            <span className={`rz-badge ${hasHardware ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
              {loading ? 'Verificando...' : hasHardware ? 'Sensor Físico Detectado' : 'Sem Leitor Biométrico'}
            </span>
          </div>

          {/* Hardware Diagnostics Card */}
          <section className="rz-card" style={{ marginBottom: '20px' }}>
            <div className="rz-card-header">
              <div className="rz-card-title-group">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <h2 className="rz-card-title">Diagnóstico de Hardware Biométrico</h2>
              </div>
            </div>

            <div className="rz-grid-2" style={{ marginTop: '12px' }}>
              <div className="rz-stat-box">
                <span className="rz-stat-label">Módulo de Plataforma</span>
                <span className="rz-stat-value-sm">
                  {loading ? 'Consultando SO...' : hwStatus?.platformName || 'Não detectado'}
                </span>
              </div>
              <div className="rz-stat-box">
                <span className="rz-stat-label">Status da Credencial FIDO2</span>
                <span
                  className="rz-stat-value-sm"
                  style={{ color: enrolled ? '#10b981' : '#a1a1aa' }}
                >
                  {enrolled ? 'Ativa e vinculada ao hardware' : 'Não configurada'}
                </span>
              </div>
            </div>

            {!loading && !hasHardware && (
              <div className="rz-alert rz-alert-warning" style={{ marginTop: '16px' }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <strong>Leitor biométrico físico não disponível neste aparelho/navegador.</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                    Por política de segurança estrita, cliques de mouse ou sensores emulados são bloqueados. Para usar biometria, acesse a partir de um dispositivo com leitor de impressão digital, Face ID, Touch ID ou Windows Hello configurado.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Enrollment / Management Card */}
          <section className="rz-card" style={{ marginBottom: '20px' }}>
            <div className="rz-card-header">
              <div className="rz-card-title-group">
                <Fingerprint className="w-4 h-4 text-zinc-400" />
                <h2 className="rz-card-title">Vínculo de Impressão Digital / Biometria</h2>
              </div>
              {enrolled && (
                <span className="rz-badge rz-badge-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado
                </span>
              )}
            </div>

            <p className="rz-text-muted" style={{ marginBottom: '16px' }}>
              Quando ativada, a chave do cofre é encapsulada pelo chip de segurança do dispositivo (TPM / Secure Enclave / Android Keystore) e exige leitura biométrica real do sistema operacional.
            </p>

            {!enrolled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="rz-label" htmlFor="bio-master-pwd">
                    Confirme sua Senha Mestra para registrar no sensor físico
                  </label>
                  <div className="rz-input-group">
                    <KeyRound className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input
                      id="bio-master-pwd"
                      type="password"
                      className="rz-input"
                      placeholder="Digite sua Senha Mestra atual"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={!hasHardware || isProcessing}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={!hasHardware || isProcessing || !confirmPassword.trim()}
                  className="rz-btn rz-btn-primary"
                >
                  {isProcessing ? (
                    <>
                      <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                      <span>Aguardando leitura física do sensor...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Vincular Biometria de Hardware</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleTestBiometrics}
                  disabled={isTesting}
                  className="rz-btn rz-btn-secondary"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>{isTesting ? 'Aguardando sensor...' : 'Testar Leitor Físico'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={isProcessing}
                  className="rz-btn rz-btn-danger"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remover Biometria deste Dispositivo</span>
                </button>
              </div>
            )}
          </section>

          {/* Master Key Rotation Card */}
          <section className="rz-card">
            <div className="rz-card-header">
              <div className="rz-card-title-group">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                <h2 className="rz-card-title">Rotação da Senha Mestra (Envelope Encryption)</h2>
              </div>
            </div>

            <p className="rz-text-muted" style={{ marginBottom: '16px' }}>
              Altera a Chave de Cifragem de Chave (KEK) e re-encapsula a DEK de 256 bits sem necessidade de re-cifrar individualmente todos os itens do cofre.
            </p>

            <button
              type="button"
              onClick={() => setShowMasterKeyModal(true)}
              className="rz-btn rz-btn-secondary"
            >
              <Lock className="w-4 h-4" />
              <span>Alterar Senha Mestra</span>
            </button>
          </section>
        </div>

        <MasterKeyModal
          isOpen={showMasterKeyModal}
          onClose={() => setShowMasterKeyModal(false)}
        />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default BiometricSettings;
