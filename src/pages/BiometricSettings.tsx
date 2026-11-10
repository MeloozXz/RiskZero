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
import { PageHeader } from '../components/ui/PageHeader';
import { OrbitRing } from '../components/brand';
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
  const readinessScore = loading ? 50 : enrolled ? 100 : hasHardware ? 60 : 15;
  const orbitTone = loading
    ? 'accent'
    : enrolled
      ? 'success'
      : hasHardware
        ? 'accent'
        : 'warning';

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content">
        <div className="rz-container-narrow">
          <PageHeader
            eyebrow="Autenticação Hardware"
            title="Biometria & Chave Mestra"
            subtitle="Autenticação física via WebAuthn (Windows Hello, Touch ID ou Leitor Digital Android) e rotação de chaves."
            actions={
              <span className={`rz-badge ${hasHardware ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                <span className={`rz-dot ${hasHardware ? 'success is-live' : ''}`} />
                {loading ? 'Verificando...' : hasHardware ? 'Sensor Físico Detectado' : 'Sem Leitor Biométrico'}
              </span>
            }
          />

          {/* Hardware Diagnostics Panel with OrbitRing */}
          <section className="rz-section">
            <div className="rz-section-head">
              <h2 className="rz-section-title">
                <Cpu size={16} />
                Diagnóstico de Hardware Biométrico
              </h2>
            </div>

            <div className="rz-panel rz-meridian-bg">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '24px',
                  paddingBottom: '18px',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--rz-border-subtle)',
                }}
              >
                <OrbitRing
                  value={readinessScore}
                  size={104}
                  stroke={6}
                  tone={orbitTone}
                  spinning={loading || isProcessing || isTesting}
                  label="Status de Prontidão FIDO2"
                >
                  <Fingerprint
                    size={28}
                    style={{
                      color: enrolled
                        ? 'var(--rz-success)'
                        : hasHardware
                          ? 'var(--rz-ice)'
                          : 'var(--rz-warning)',
                    }}
                  />
                  <span
                    className="rz-num"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--rz-text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    {loading ? 'SCAN' : enrolled ? 'ATIVO' : hasHardware ? 'PRONTO' : 'OFF'}
                  </span>
                </OrbitRing>

                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 className="rz-card-title" style={{ fontSize: '1.1rem' }}>
                      {enrolled
                        ? 'Enclave FIDO2 Vinculado e Operacional'
                        : hasHardware
                          ? 'Sensor Físico Pronto para Vínculo'
                          : 'Modo Exclusivo por Senha Mestra'}
                    </h3>
                    <span className={`rz-badge ${enrolled ? 'rz-badge-success' : hasHardware ? 'rz-badge-info' : 'rz-badge-warning'}`}>
                      {enrolled ? 'FIDO2 Ativo' : hasHardware ? 'Disponível' : 'Indisponível'}
                    </span>
                  </div>
                  <p className="rz-text-muted">
                    {enrolled
                      ? 'Sua Chave Mestra está encapsulada pelo chip seguro do dispositivo e exige validação biométrica real do sistema operacional.'
                      : 'Verificação direta do autenticador de plataforma (TPM 2.0, Apple Secure Enclave ou Android Keystore).'}
                  </p>
                </div>
              </div>

              <div>
                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title">Módulo de Plataforma</div>
                    <div className="rz-row-meta">Sensor ou subsistema criptográfico identificado</div>
                  </div>
                  <span className="rz-stat-value-sm" style={{ textAlign: 'right' }}>
                    {loading ? 'Consultando SO...' : hwStatus?.platformName || 'Não detectado'}
                  </span>
                </div>

                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title">Status da Credencial FIDO2</div>
                    <div className="rz-row-meta">Assinatura criptográfica vinculada ao cofre local</div>
                  </div>
                  <span
                    className="rz-stat-value-sm"
                    style={{
                      color: enrolled ? 'var(--rz-success)' : 'var(--rz-text-secondary)',
                      textAlign: 'right',
                    }}
                  >
                    {enrolled ? 'Ativa e vinculada ao hardware' : 'Não configurada'}
                  </span>
                </div>

                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title">Contexto Seguro (WebCrypto / HTTPS)</div>
                    <div className="rz-row-meta">Isolamento de origem exigido pelo padrão WebAuthn</div>
                  </div>
                  <span className={`rz-badge ${hwStatus?.isSecureContext !== false ? 'rz-badge-success' : 'rz-badge-danger'}`}>
                    {hwStatus?.isSecureContext !== false ? 'Verificado' : 'Inseguro'}
                  </span>
                </div>
              </div>

              {!loading && !hasHardware && (
                <div className="rz-alert rz-alert-warning" style={{ marginTop: '16px' }}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Leitor biométrico físico não disponível neste aparelho/navegador.</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--rz-text-xs)', opacity: 0.92 }}>
                      Por política de segurança estrita, cliques de mouse ou sensores emulados são bloqueados. Para usar biometria, acesse a partir de um dispositivo com leitor de impressão digital, Face ID, Touch ID ou Windows Hello configurado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Enrollment / Management Panel */}
          <section className="rz-section">
            <div className="rz-section-head">
              <h2 className="rz-section-title">
                <Fingerprint size={16} />
                Vínculo de Impressão Digital / Biometria
              </h2>
              {enrolled && (
                <span className="rz-badge rz-badge-success">
                  <CheckCircle2 size={12} /> Vinculado
                </span>
              )}
            </div>

            <div className={`rz-panel ${enrolled ? 'rz-panel-accent' : ''}`}>
              <p className="rz-text-muted" style={{ marginBottom: '18px' }}>
                Quando ativada, a chave do cofre é encapsulada pelo chip de segurança do dispositivo (TPM / Secure Enclave / Android Keystore) e exige leitura biométrica real do sistema operacional.
              </p>

              {!enrolled ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="rz-field" style={{ marginBottom: 0 }}>
                    <label className="rz-label" htmlFor="bio-master-pwd">
                      Confirme sua Senha Mestra para registrar no sensor físico
                    </label>
                    <div className="rz-input-group">
                      <KeyRound size={17} />
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
                    className="rz-btn rz-btn-primary rz-btn-block"
                  >
                    {isProcessing ? (
                      <>
                        <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                        <span>Aguardando leitura física do sensor...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint size={16} />
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
                    <ScanFace size={16} />
                    <span>{isTesting ? 'Aguardando sensor...' : 'Testar Leitor Físico'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisable}
                    disabled={isProcessing}
                    className="rz-btn rz-btn-danger"
                  >
                    <Trash2 size={16} />
                    <span>Remover Biometria deste Dispositivo</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Master Key Rotation Panel */}
          <section className="rz-section">
            <div className="rz-section-head">
              <h2 className="rz-section-title">
                <ShieldCheck size={16} />
                Rotação da Senha Mestra (Envelope Encryption)
              </h2>
            </div>

            <div className="rz-panel">
              <div className="rz-setting-row" style={{ paddingTop: 0, borderBottom: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rz-row-title" style={{ marginBottom: '4px' }}>
                    Re-encapsulamento Criptográfico (KEK / DEK 256-bit)
                  </div>
                  <p className="rz-text-muted">
                    Altera a Chave de Cifragem de Chave (KEK) e re-encapsula a DEK de 256 bits com validação biométrica de hardware.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMasterKeyModal(true)}
                  className="rz-btn rz-btn-secondary"
                >
                  <Lock size={16} />
                  <span>Alterar Senha Mestra</span>
                </button>
              </div>
            </div>
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
