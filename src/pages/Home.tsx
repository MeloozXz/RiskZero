import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonContent, 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonCard, 
  IonCardContent, 
  IonButton, 
  IonIcon, 
  IonText,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonNote,
  IonBadge
} from '@ionic/react';
import { 
  lockClosedOutline, 
  shieldCheckmarkOutline, 
  keyOutline, 
  logOutOutline, 
  shieldOutline, 
  documentTextOutline, 
  fingerPrintOutline, 
  timeOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline,
  trendingUpOutline,
  eyeOffOutline,
  schoolOutline,
  settingsOutline,
  wifiOutline,
  warningOutline
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { generateTOTP } from '../crypto/totp';
import { decryptData } from '../crypto/webcrypto';
import { AuditLog } from '../types';
import './Home.css';

const Home: React.FC = () => {
  const history = useHistory();
  const { 
    logout, 
    lockApp, 
    hasPIN, 
    registerPIN, 
    totpEnabled, 
    totpSecret, 
    setupNew2FA, 
    enable2FA, 
    disable2FA,
    activeEmail
  } = useSecurity();

  // Estados locais para configuração
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  
  const [show2FASetup, setShow2FASetup] = useState<boolean>(false);
  const [totpTokenInput, setTotpTokenInput] = useState<string>('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [currentLocalSecret, setCurrentLocalSecret] = useState<string | null>(null);
  const [liveTOTP, setLiveTOTP] = useState<string>('');
  const [totpCountdown, setTotpCountdown] = useState<number>(30);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Atualiza logs de auditoria
  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadLogs();
    const handleFocus = () => loadLogs();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Monitora e calcula o TOTP gerado localmente em tempo real se o segredo estiver ativo ou sendo configurado
  useEffect(() => {
    let timer: any = null;
    const updateTOTP = async () => {
      const email = SessionService.getActiveUserEmail();
      let activeSecret = currentLocalSecret;
      if (!activeSecret && totpEnabled && email) {
        const profile = await StorageService.getUserProfile(email);
        if (profile) {
          if (profile.encryptedTotpSecret) {
            try {
              const masterKey = SessionService.getMasterKey();
              activeSecret = await decryptData(profile.encryptedTotpSecret, masterKey);
            } catch (err) {
              console.error('Falha ao decifrar segredo 2FA na Home:', err);
            }
          } else if (profile.totpSecret) {
            activeSecret = profile.totpSecret; // Suporte legado
          }
        }
      }

      if (activeSecret) {
        const code = await generateTOTP(activeSecret);
        setLiveTOTP(code);
        
        // Calcula segundos restantes para a mudança do token (passo de 30s)
        const secs = 30 - (Math.floor(Date.now() / 1000) % 30);
        setTotpCountdown(secs);
      } else {
        setLiveTOTP('');
      }
    };

    updateTOTP();
    timer = setInterval(updateTOTP, 1000); // Atualiza de segundo em segundo para o contador de 30s

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentLocalSecret, totpEnabled]);

  // Handler para salvar PIN
  const handleSavePIN = async () => {
    setPinError(null);
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      setPinError('O PIN deve conter exatamente 6 números.');
      return;
    }
    try {
      await registerPIN(pinInput);
      setPinInput('');
      loadLogs();
      alert('PIN local cadastrado com sucesso! Use-o para desbloquear o app.');
    } catch (e: any) {
      setPinError(e.message || 'Erro ao registrar PIN.');
    }
  };

  // Handler para iniciar configuração de 2FA
  const handleStart2FA = () => {
    setMfaError(null);
    const secret = setupNew2FA();
    setCurrentLocalSecret(secret);
    setShow2FASetup(true);
  };

  // Handler para validar e salvar 2FA
  const handleConfirm2FA = async () => {
    setMfaError(null);
    const res = await enable2FA(totpTokenInput);
    if (res.success) {
      setTotpTokenInput('');
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      loadLogs();
      alert('Autenticação em Dois Fatores (2FA) ATIVADA com sucesso!');
    } else {
      setMfaError(res.error || 'Código 2FA incorreto.');
    }
  };

  // Handler para desativar 2FA
  const handleDisable2FA = async () => {
    if (window.confirm('Tem certeza que deseja desativar o 2FA? Isso reduzirá a segurança da conta.')) {
      await disable2FA();
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      loadLogs();
    }
  };

  return (
    <IonPage>
      <IonContent className="home-content ion-padding">
        <div className="home-header">
          <h1>Central de Segurança</h1>
          <p>Monitore e otimize a proteção das suas credenciais e do seu dispositivo</p>
        </div>

        {/* Módulos de Atalhos Rápidos */}
        <div className="quick-links-grid">
          <div onClick={() => history.push('/biometric-settings')} className="quick-link-card biometrics">
            <IonIcon icon={fingerPrintOutline} style={{ color: '#10b981' }} />
            <span className="quick-link-title">Biometria & Hardware</span>
            <span className="quick-link-desc">Configurar leitor de digital e biometria nativa</span>
          </div>

          <div onClick={() => history.push('/education')} className="quick-link-card education">
            <IonIcon icon={schoolOutline} style={{ color: '#8b5cf6' }} />
            <span className="quick-link-title">Módulo Educativo</span>
            <span className="quick-link-desc">Dicas, 13 guias de segurança e Detector de Phishing</span>
          </div>

          <div onClick={() => history.push('/vpn')} className="quick-link-card hardening">
            <IonIcon icon={wifiOutline} style={{ color: '#3b82f6' }} />
            <span className="quick-link-title">VPN Nativa</span>
            <span className="quick-link-desc">Túnel de rede criptografado de dados</span>
          </div>

          <div onClick={() => history.push('/breach')} className="quick-link-card analysis">
            <IonIcon icon={warningOutline} style={{ color: '#f59e0b' }} />
            <span className="quick-link-title">Vazamento de Dados</span>
            <span className="quick-link-desc">Consulte se suas contas foram expostas</span>
          </div>

          <div onClick={() => history.push('/analysis')} className="quick-link-card analysis">
            <IonIcon icon={trendingUpOutline} style={{ color: '#fbbf24' }} />
            <span className="quick-link-title">Saúde das Senhas</span>
            <span className="quick-link-desc">Descubra se suas senhas estão seguras</span>
          </div>

          <div onClick={() => history.push('/hardening')} className="quick-link-card hardening">
            <IonIcon icon={eyeOffOutline} style={{ color: '#06b6d4' }} />
            <span className="quick-link-title">Proteção do Aparelho</span>
            <span className="quick-link-desc">Evite capturas de tela indesejadas</span>
          </div>
        </div>

        {/* CARD 1: ESTADO DA CRIPTOGRAFIA LOCAL */}
        <IonCard className="premium-card bg-glow-blue">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={shieldCheckmarkOutline} className="icon-blue" />
              <h3>Sua Privacidade em Primeiro Lugar</h3>
            </div>
            <p className="card-description">
              Todas as suas senhas são cifradas no seu aparelho. Nem nós nem terceiros temos acesso a elas.
            </p>
            <div className="security-badges">
              <IonBadge color="success" className="sec-badge">
                <IonIcon icon={checkmarkCircleOutline} /> Criptografia Avançada
              </IonBadge>
              <IonBadge color="success" className="sec-badge">
                <IonIcon icon={checkmarkCircleOutline} /> Proteção Reforçada
              </IonBadge>
              <IonBadge color={hasPIN ? 'success' : 'warning'} className="sec-badge">
                <IonIcon icon={hasPIN ? checkmarkCircleOutline : closeCircleOutline} /> PIN Rápido
              </IonBadge>
              <IonBadge color={totpEnabled ? 'success' : 'warning'} className="sec-badge">
                <IonIcon icon={totpEnabled ? checkmarkCircleOutline : closeCircleOutline} /> Proteção 2FA
              </IonBadge>
            </div>

            <IonButton expand="block" onClick={lockApp} className="btn-action-primary">
              <IonIcon slot="start" icon={lockClosedOutline} />
              Bloquear Aplicativo Agora
            </IonButton>

            <IonButton expand="block" fill="outline" onClick={logout} className="btn-action-danger" style={{ marginTop: '10px' }}>
              <IonIcon slot="start" icon={logOutOutline} />
              Sair da Conta
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* CARD 2: CONFIGURAÇÃO DE PIN LOCAL (HOT RE-ENTRY) */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={fingerPrintOutline} className="icon-purple" />
              <h3>Acesso Rápido com PIN</h3>
            </div>
            <p className="card-description">
              Cadastre um código de 6 dígitos para desbloquear o app rapidamente, sem precisar digitar a Senha Mestra inteira.
            </p>

            {hasPIN ? (
              <div className="pin-active-indicator">
                <IonIcon icon={checkmarkCircleOutline} color="success" />
                <IonText color="success"><p>Código PIN ativado neste aparelho.</p></IonText>
              </div>
            ) : (
              <div className="pin-inactive-indicator">
                <IonIcon icon={closeCircleOutline} color="warning" />
                <p>Você ainda não ativou o código PIN de acesso rápido.</p>
              </div>
            )}

            <div className="inline-action-form">
              <IonItem className="premium-input-item" lines="none">
                <IonInput 
                  type="password"
                  inputmode="numeric"
                  maxlength={6}
                  placeholder="Escolha um PIN de 6 dígitos" 
                  value={pinInput}
                  onIonInput={e => setPinInput(e.detail.value!)}
                />
              </IonItem>
              <IonButton color="secondary" onClick={handleSavePIN}>
                Ativar PIN
              </IonButton>
            </div>
            {pinError && <IonText color="danger"><p className="input-error-msg">{pinError}</p></IonText>}
          </IonCardContent>
        </IonCard>

        {/* CARD 3: AUTENTICAÇÃO EM DOIS FATORES (2FA - TOTP) */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={keyOutline} className="icon-emerald" />
              <h3>Verificação em Duas Etapas (2FA)</h3>
            </div>
            <p className="card-description">
              Adicione uma camada extra de segurança sincronizando seu cofre com aplicativos autenticadores nativos (Google Authenticator, Authy, Microsoft Authenticator).
            </p>

            {totpEnabled ? (
              <div className="totp-status-container">
                <div className="totp-status-active">
                  <IonIcon icon={checkmarkCircleOutline} style={{ color: '#10b981', fontSize: '24px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <IonText style={{ color: '#10b981', fontWeight: 800, fontSize: '1rem' }}>
                      Autenticação 2FA Ativada & Protegida
                    </IonText>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      Seus códigos de acesso temporários são gerados exclusivamente dentro do seu aplicativo autenticador.
                    </span>
                  </div>
                </div>

                <IonButton fill="outline" color="danger" expand="block" onClick={handleDisable2FA} className="btn-action-danger">
                  Desativar Proteção 2FA
                </IonButton>
              </div>
            ) : (
              <div>
                {!show2FASetup ? (
                  <IonButton expand="block" color="success" onClick={handleStart2FA} className="btn-action-success">
                    Ativar Proteção 2FA
                  </IonButton>
                ) : (
                  <div className="totp-setup-flow animate-fade-in">
                    <p className="totp-setup-title">
                      1. Escaneie o QR Code abaixo no seu aplicativo autenticador (Google Authenticator, Authy) ou copie a chave secreta:
                    </p>

                    {/* QR Code de alta resolução */}
                    {currentLocalSecret && (
                      <div className="totp-qr-container">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                            `otpauth://totp/SeguranApp:${encodeURIComponent(activeEmail || 'usuario')}?secret=${currentLocalSecret}&issuer=SeguranApp`
                          )}`} 
                          alt="QR Code para Autenticador 2FA" 
                          className="totp-qr-image"
                        />
                      </div>
                    )}

                    <div className="totp-secret-box">
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        CHAVE SECRETA BASE32
                      </span>
                      <code>{currentLocalSecret}</code>
                    </div>

                    <p className="totp-setup-title" style={{ marginTop: '16px' }}>
                      2. Insira o código de 6 dígitos gerado no seu aplicativo para confirmar a ativação:
                    </p>
                    <div className="inline-action-form">
                      <IonItem className="premium-input-item" lines="none">
                        <IonInput 
                          type="text"
                          inputmode="numeric"
                          maxlength={6}
                          placeholder="000000" 
                          value={totpTokenInput}
                          onIonInput={e => setTotpTokenInput((e.detail.value || '').trim())}
                        />
                      </IonItem>
                      <IonButton color="success" onClick={handleConfirm2FA} disabled={!totpTokenInput.trim()}>
                        Confirmar
                      </IonButton>
                    </div>
                    {mfaError && <IonText color="danger"><p className="input-error-msg">{mfaError}</p></IonText>}

                    <IonButton fill="clear" color="medium" expand="block" onClick={() => setShow2FASetup(false)} style={{ marginTop: '10px' }}>
                      Cancelar
                    </IonButton>
                  </div>
                )}
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* CARD 4: LOG DE AUDITORIA DE SEGURANÇA LOCAL */}
        <IonCard className="premium-card">
          <IonCardContent className="premium-card-content">
            <div className="card-header-icon">
              <IonIcon icon={documentTextOutline} className="icon-amber" />
              <h3>Histórico de Segurança</h3>
            </div>
            <p className="card-description">
              Acompanhe as atividades e alterações de segurança realizadas neste aparelho.
            </p>

            <div className="audit-logs-list-wrapper">
              {auditLogs.length === 0 ? (
                <p className="no-logs-text">Nenhuma atividade registrada até o momento.</p>
              ) : (
                <IonList className="audit-logs-list" lines="none">
                  {auditLogs.map((log) => (
                    <IonItem key={log.id} className="audit-log-item">
                      <div className="log-dot" />
                      <IonLabel>
                        <h4>{log.details}</h4>
                        <p>{new Date(log.timestamp).toLocaleTimeString()} - {log.action}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </div>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default Home;
