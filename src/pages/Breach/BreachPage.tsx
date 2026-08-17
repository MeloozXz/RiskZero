import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonBackButton,
  IonButtons
} from '@ionic/react';
import {
  warningOutline,
  searchOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  lockClosedOutline,
  refreshOutline,
  keyOutline,
  arrowForwardOutline
} from 'ionicons/icons';
import { DataBreachService, EmailBreachResult, PasswordBreachResult } from '../../services/breach';
import { SessionService } from '../../services/session';
import './BreachPage.css';

export const BreachPage: React.FC = () => {
  const history = useHistory();
  const currentEmail = SessionService.getActiveUserEmail() || '';

  const [inputEmail, setInputEmail] = useState<string>(currentEmail);
  const [testPassword, setTestPassword] = useState<string>('');
  
  const [loadingEmail, setLoadingEmail] = useState<boolean>(false);
  const [loadingPwd, setLoadingPwd] = useState<boolean>(false);

  const [emailResult, setEmailResult] = useState<EmailBreachResult | null>(null);
  const [pwdResult, setPwdResult] = useState<PasswordBreachResult | null>(null);

  const handleCheckEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputEmail.trim()) return;

    setLoadingEmail(true);
    try {
      const res = await DataBreachService.checkEmailBreach(inputEmail);
      setEmailResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleCheckPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testPassword) return;

    setLoadingPwd(true);
    try {
      const res = await DataBreachService.checkPasswordBreach(testPassword);
      setPwdResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPwd(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" text="" style={{ color: '#00f2fe' }} />
          </IonButtons>
          <IonTitle style={{ color: '#f8fafc', fontWeight: 800 }}>
            Auditoria de Vazamentos
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#070a13' }}>
        <div className="max-w-2xl mx-auto py-2">
          
          {/* Header Banner */}
          <div className="glass-card p-6 mb-6 rounded-2xl border border-cyan-500/20 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <IonIcon icon={warningOutline} className="text-3xl text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-100">Detector de Credenciais Comprometidas</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Verifique se o seu e-mail ou senhas foram expostos em vazamentos públicos de grandes serviços da internet.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: VERIFICAÇÃO DE E-MAIL */}
          <IonCard className="glass-card mb-6">
            <IonCardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <IonIcon icon={searchOutline} className="text-cyan-400 text-lg" />
                <h2 className="text-base font-bold text-slate-100">1. Consultar Endereço de E-mail</h2>
              </div>

              <form onSubmit={handleCheckEmail} className="space-y-3">
                <IonItem className="glass-input" lines="none">
                  <IonInput
                    type="email"
                    placeholder="Digite seu e-mail (Ex: usuario@exemplo.com)"
                    value={inputEmail}
                    onIonInput={(e) => setInputEmail(e.detail.value!)}
                    required
                  />
                </IonItem>

                <IonButton
                  type="submit"
                  expand="block"
                  className="cyber-btn"
                  disabled={loadingEmail || !inputEmail.trim()}
                  style={{
                    '--background': 'linear-gradient(135deg, #00f2fe 0%, #6366f1 100%)',
                    '--color': '#070a13',
                    height: '48px'
                  }}
                >
                  {loadingEmail ? (
                    <div className="flex items-center gap-2">
                      <IonSpinner name="crescent" color="dark" />
                      <span>Auditando bases de vazamento...</span>
                    </div>
                  ) : (
                    'Verificar Segurança do E-mail'
                  )}
                </IonButton>
              </form>

              {/* Resultado da busca de E-mail */}
              {emailResult && (
                <div className="mt-5 pt-4 border-t border-white/10 animate-fade-in">
                  {emailResult.isBreached ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-red-400 font-bold">
                          <IonIcon icon={warningOutline} className="text-xl" />
                          <span>E-mail encontrado em {emailResult.totalBreaches} vazamentos!</span>
                        </div>
                        <IonBadge color="danger" className="cyber-badge">
                          Risco {emailResult.riskScore}%
                        </IonBadge>
                      </div>

                      <p className="text-xs text-slate-300 mb-4">
                        Recomendamos trocar a senha das contas listadas abaixo imediatamente no seu cofre.
                      </p>

                      <div className="space-y-3">
                        {emailResult.breaches.map((b) => (
                          <div key={b.id} className="bg-slate-900/80 p-3 rounded-lg border border-red-500/20">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-slate-100">{b.name}</h4>
                              <span className="text-[10px] text-slate-400">{b.breachDate}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{b.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {b.dataClasses.map((item, idx) => (
                                <span key={idx} className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                      <IonIcon icon={checkmarkCircleOutline} className="text-3xl text-emerald-400 shrink-0" />
                      <div>
                        <h3 className="font-extrabold text-slate-100 text-sm">Nenhum vazamento encontrado!</h3>
                        <p className="text-xs text-slate-400">
                          Seu e-mail <strong>{emailResult.email}</strong> não foi detectado nas bases de dados expostas catalogadas.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* SEÇÃO 2: TESTE DE SENHA K-ANONYMITY */}
          <IonCard className="glass-card mb-6">
            <IonCardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <IonIcon icon={keyOutline} className="text-indigo-400 text-lg" />
                <h2 className="text-base font-bold text-slate-100">2. Teste de Senha Anonimizado (k-Anonymity)</h2>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Sua senha <strong>nunca é enviada completa</strong>. Apenas os 5 primeiros caracteres do hash SHA-1 são consultados na API do HaveIBeenPwned.
              </p>

              <form onSubmit={handleCheckPassword} className="space-y-3">
                <IonItem className="glass-input" lines="none">
                  <IonInput
                    type="password"
                    placeholder="Digite uma senha para testar se é conhecida por hackers"
                    value={testPassword}
                    onIonInput={(e) => setTestPassword(e.detail.value!)}
                    required
                  />
                </IonItem>

                <IonButton
                  type="submit"
                  expand="block"
                  className="cyber-btn"
                  disabled={loadingPwd || !testPassword}
                  style={{
                    '--background': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    '--color': '#ffffff',
                    height: '48px'
                  }}
                >
                  {loadingPwd ? (
                    <div className="flex items-center gap-2">
                      <IonSpinner name="crescent" color="light" />
                      <span>Consultando HIBP SHA-1...</span>
                    </div>
                  ) : (
                    'Auditar Senha (Zero-Knowledge)'
                  )}
                </IonButton>
              </form>

              {/* Resultado da busca de Senha */}
              {pwdResult && (
                <div className="mt-4 pt-3 border-t border-white/10 animate-fade-in">
                  {pwdResult.breached ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                      <IonIcon icon={alertCircleOutline} className="text-3xl text-amber-400 shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-amber-400 text-sm">Atenção: Senha Comprometida!</h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Esta senha já apareceu <strong>{pwdResult.count.toLocaleString()} vezes</strong> em vazamentos de dados públicos. <strong>Não a utilize!</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                      <IonIcon icon={checkmarkCircleOutline} className="text-3xl text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-emerald-400 text-sm">Senha Segura e Exclusiva</h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Nenhum registro desta senha foi encontrado na base global do HaveIBeenPwned.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Atalho para o Cofre */}
          <IonButton
            expand="block"
            fill="outline"
            className="cyber-btn"
            onClick={() => history.push('/vault')}
            style={{
              '--border-color': 'rgba(0, 242, 254, 0.4)',
              '--color': '#00f2fe',
              height: '48px'
            }}
          >
            <IonIcon slot="start" icon={lockClosedOutline} />
            Ir para Meu Cofre Atualizar Senhas
            <IonIcon slot="end" icon={arrowForwardOutline} />
          </IonButton>

        </div>
      </IonContent>
    </IonPage>
  );
};
