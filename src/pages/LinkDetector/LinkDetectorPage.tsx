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
  IonInput,
  IonBadge,
  IonToast,
} from '@ionic/react';
import {
  globeOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  warningOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  clipboardOutline,
  trashOutline,
  timeOutline,
  searchOutline,
} from 'ionicons/icons';

interface AnalysisResult {
  url: string;
  safe: boolean;
  score: number;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  warnings: string[];
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
  timestamp: number;
}

const SUSPICIOUS_PATTERNS = [
  'paypal-secure', 'itau-login', 'bradesco-acesso', 'banco-seguro', 'bb-autoatendimento',
  'santander-login', 'caixa-fgts', 'nubank-recadastro', 'pagbank-acesso', 'mercado-pago-premio',
  'conta-bloqueada', 'atualizar-dados', 'verify-account', 'confirm-identity', 'recadastro-obrigatorio',
  'netflix-payment', 'amazon-prize', 'whatsapp-gold', 'instagram-verified',
  'gov-br-cpf', 'receita-federal-pgto', 'correios-taxa-pendente', 'sorteio-pix', 'pix-premiado',
];

const SUSPICIOUS_TLDS = ['.xyz', '.click', '.tk', '.pw', '.cc', '.loan', '.work', '.top', '.buzz', '.gq', '.ml', '.cf', '.ga'];

const SHORTENERS = ['bit.ly', 'tinyurl.com', 'is.gd', 'cutt.ly', 't.co', 'shorte.st', 'ow.ly'];

function analyzeUrl(rawUrl: string): AnalysisResult {
  const url = rawUrl.trim();
  const warnings: string[] = [];
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  const lower = url.toLowerCase().replace(/^https?:\/\//, '');
  const hasHttps = url.startsWith('https://');

  // 1. Verificação de HTTPS / Criptografia SSL
  if (!hasHttps) {
    warnings.push('Conexão Insegura: O link não utiliza criptografia HTTPS (tráfego em texto claro).');
    checks.push({ name: 'Criptografia HTTPS', passed: false, detail: 'Protocolo HTTP sem cifragem SSL/TLS' });
  } else {
    checks.push({ name: 'Criptografia HTTPS', passed: true, detail: 'Conexão criptografada por TLS' });
  }

  // 2. Verificação de Obfuscação por @ (Basic Auth Trick)
  if (lower.includes('@')) {
    warnings.push('Alerta de Dissimulação: O link utiliza o caractere "@" para ocultar o domínio de destino real.');
    checks.push({ name: 'Validação de Destino', passed: false, detail: 'Uso de artifício "@" para disfarçar destino' });
  } else {
    checks.push({ name: 'Validação de Destino', passed: true, detail: 'Sem artifícios de disfarce de usuário' });
  }

  // 3. Verificação de IP Direto
  const hasDirectIp = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(lower);
  if (hasDirectIp) {
    warnings.push('Perigo Crítico: O endereço aponta para um endereço de IP numérico direto em vez de domínio oficial.');
    checks.push({ name: 'Resolução de Domínio', passed: false, detail: 'Endereço de IP bruto (típico de botnets/phishing)' });
  } else {
    checks.push({ name: 'Resolução de Domínio', passed: true, detail: 'Nome de domínio totalmente qualificado (FQDN)' });
  }

  // 4. Verificação de Encurtador de URL
  const isShortened = SHORTENERS.some((s) => lower.startsWith(s) || lower.includes('/' + s));
  if (isShortened) {
    warnings.push('Atenção: Link encurtado. O endereço original de destino está mascarado.');
    checks.push({ name: 'Transparência de Rota', passed: false, detail: 'Serviço de redirecionamento/encurtamento detectado' });
  } else {
    checks.push({ name: 'Transparência de Rota', passed: true, detail: 'Destino direto e transparente' });
  }

  // 5. Verificação de Excesso de Subdomínios
  const domainPart = lower.split('/')[0].split('?')[0];
  const dotCount = (domainPart.match(/\./g) || []).length;
  if (dotCount > 3) {
    warnings.push('Alerta Heurístico: Excesso de níveis de subdomínios, técnica comum para imitar sites legítimos.');
    checks.push({ name: 'Estrutura de Domínio', passed: false, detail: `${dotCount} subdomínios concatenados` });
  } else {
    checks.push({ name: 'Estrutura de Domínio', passed: true, detail: 'Hierarquia de subdomínios normal' });
  }

  // 6. Verificação de TLD Suspeito
  let foundTld: string | null = null;
  for (const t of SUSPICIOUS_TLDS) {
    if (domainPart.endsWith(t) || domainPart.includes(t + ':')) {
      foundTld = t;
      break;
    }
  }
  if (foundTld) {
    warnings.push(`Extensão Vulnerável: O TLD "${foundTld}" é estatisticamente associado a campanhas de spam e golpes.`);
    checks.push({ name: 'Reputação do TLD', passed: false, detail: `Extensão ${foundTld} de alta incidência de fraude` });
  } else {
    checks.push({ name: 'Reputação do TLD', passed: true, detail: 'Extensão de domínio padrão / comercial comum' });
  }

  // 7. Padrões de Phishing de Engenharia Social / Bancos
  let foundPattern: string | null = null;
  for (const p of SUSPICIOUS_PATTERNS) {
    if (lower.includes(p)) {
      foundPattern = p;
      break;
    }
  }
  if (foundPattern) {
    warnings.push(`Engenharia Social Detectada: Identificado padrão comum de fraude bancária ou financeira ("${foundPattern}").`);
    checks.push({ name: 'Assinatura Anti-Phishing', passed: false, detail: `Gatilho malicioso identificado: "${foundPattern}"` });
  } else {
    checks.push({ name: 'Assinatura Anti-Phishing', passed: true, detail: 'Nenhuma assinatura conhecida de golpe encontrada' });
  }

  // 8. Tela de Login em Domínio Não Autenticado
  if (lower.includes('login') || lower.includes('signin') || lower.includes('entrar')) {
    const trusted = ['google.com', 'microsoft.com', 'apple.com', 'gov.br', 'github.com'];
    const isTrusted = trusted.some((d) => domainPart.endsWith(d));
    if (!isTrusted) {
      warnings.push('Perigo de Captura de Credenciais: Formulário de autenticação em domínio não verificado.');
      checks.push({ name: 'Verificação de Autenticidade', passed: false, detail: 'Página de login fora dos provedores confiáveis' });
    }
  }

  // Cálculo de Score
  const score = Math.max(0, 100 - warnings.length * 25);
  let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' = 'SAFE';
  if (score < 50) verdict = 'DANGEROUS';
  else if (score < 80) verdict = 'SUSPICIOUS';

  return {
    url,
    safe: warnings.length === 0,
    score,
    verdict,
    warnings,
    checks,
    timestamp: Date.now(),
  };
}

const STORAGE_HISTORY_KEY = 'riskzero_link_detector_history';

export const LinkDetectorPage: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'warning' | 'danger'>('success');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) {
        setHistory(JSON.parse(raw));
      }
    } catch {
      setHistory([]);
    }
  }, []);

  const saveToHistory = (item: AnalysisResult) => {
    const updated = [item, ...history.filter((h) => h.url !== item.url)].slice(0, 8);
    setHistory(updated);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
  };

  const handleAnalyze = (targetUrl?: string) => {
    const toTest = (targetUrl || urlInput).trim();
    if (!toTest) {
      setToastMsg('Por favor, digite ou cole uma URL para analisar.');
      setToastColor('warning');
      return;
    }

    const formatted = toTest.startsWith('http://') || toTest.startsWith('https://')
      ? toTest
      : `https://${toTest}`;

    const analysis = analyzeUrl(formatted);
    setResult(analysis);
    saveToHistory(analysis);

    if (analysis.verdict === 'SAFE') {
      setToastMsg('Link analisado: Nenhuma ameaça detectada.');
      setToastColor('success');
    } else if (analysis.verdict === 'SUSPICIOUS') {
      setToastMsg('Atenção: O link apresenta características suspeitas!');
      setToastColor('warning');
    } else {
      setToastMsg('Perigo: Link potencialmente fraudulento identificado!');
      setToastColor('danger');
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
          handleAnalyze(text.trim());
        }
      } else {
        setToastMsg('Use Ctrl+V para colar o link no campo.');
        setToastColor('warning');
      }
    } catch {
      setToastMsg('Permissão de leitura da área de transferência indisponível.');
      setToastColor('warning');
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_HISTORY_KEY);
    setToastMsg('Histórico de análises limpo.');
    setToastColor('success');
  };

  return (
    <IonPage style={{ background: '#070a13' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <IonTitle style={{ color: '#60a5fa', fontWeight: 800, fontSize: '1.15rem' }}>
              Detector de Links
            </IonTitle>
            <IonBadge color="primary" style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
              Anti-phishing
            </IonBadge>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding" style={{ '--background': '#070a13' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

          {/* Banner de Apresentação */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            border: '1px solid rgba(96, 165, 250, 0.25)',
            borderRadius: '20px',
            padding: '22px',
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
                flexShrink: 0,
              }}>
                <IonIcon icon={globeOutline} style={{ fontSize: '26px' }} />
              </div>
              <div>
                <h2 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px' }}>
                  Verifique um link antes de abrir
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                  Verifique links suspeitos recebidos no WhatsApp, SMS, Telegram ou e-mail antes de clicar. A análise considera padrões de phishing, domínios de alto risco, encurtadores e uso de HTTPS.
                </p>
              </div>
            </div>
          </div>

          {/* CARD DE ENTRADA DO LINK */}
          <IonCard style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            margin: 0,
            backdropFilter: 'blur(16px)',
          }}>
            <IonCardHeader style={{ padding: '20px 20px 10px' }}>
              <IonCardTitle style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={searchOutline} style={{ color: '#60a5fa' }} />
                Endereço a verificar
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 20px 20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid rgba(96, 165, 250, 0.25)',
                borderRadius: '14px',
                padding: '4px 12px',
                marginBottom: '14px',
              }}>
                <IonIcon icon={globeOutline} style={{ color: '#38bdf8', fontSize: '20px', marginRight: '10px' }} />
                <IonInput
                  type="url"
                  placeholder="https://exemplo.com.br/verificar"
                  value={urlInput}
                  onIonInput={(e) => setUrlInput(e.detail.value ?? '')}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
                  style={{ color: '#ffffff', fontSize: '0.95rem' }}
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    aria-label="Limpar campo"
                  >
                    <IonIcon icon={closeCircleOutline} style={{ fontSize: '18px', color: '#94a3b8' }} />
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                <IonButton
                  expand="block"
                  onClick={() => handleAnalyze()}
                  disabled={!urlInput.trim()}
                  style={{
                    '--background': 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                    '--border-radius': '12px',
                    fontWeight: 800,
                    margin: 0,
                    height: '46px',
                    color: '#070a13',
                  }}
                >
                  <IonIcon icon={shieldCheckmarkOutline} slot="start" />
                  Verificar link
                </IonButton>

                <IonButton
                  fill="outline"
                  onClick={handlePaste}
                  style={{
                    '--border-color': 'rgba(96, 165, 250, 0.4)',
                    '--border-radius': '12px',
                    '--color': '#38bdf8',
                    fontWeight: 700,
                    margin: 0,
                    height: '46px',
                  }}
                >
                  <IonIcon icon={clipboardOutline} slot="icon-only" />
                </IonButton>
              </div>

              {/* Exemplos Rápidos de Teste */}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>Exemplos:</span>
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('https://google.com/search?q=riskzero');
                    handleAnalyze('https://google.com/search?q=riskzero');
                  }}
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    color: '#34d399',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Link seguro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('http://itau-login.conta-bloqueada.click/verify');
                    handleAnalyze('http://itau-login.conta-bloqueada.click/verify');
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Phishing bancário
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('https://bit.ly/premio-pix-urgente');
                    handleAnalyze('https://bit.ly/premio-pix-urgente');
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Encurtador suspeito
                </button>
              </div>
            </IonCardContent>
          </IonCard>

          {/* CARD DE RESULTADO DA ANÁLISE */}
          {result && (
            <div style={{
              background: result.verdict === 'SAFE'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : result.verdict === 'SUSPICIOUS'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: result.verdict === 'SAFE'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : result.verdict === 'SUSPICIOUS'
                ? '1px solid rgba(245, 158, 11, 0.35)'
                : '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '24px',
              backdropFilter: 'blur(16px)',
              boxShadow: result.verdict === 'SAFE'
                ? '0 10px 30px rgba(16, 185, 129, 0.1)'
                : '0 10px 30px rgba(239, 68, 68, 0.15)',
            }}>
              {/* Header do Resultado */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: result.verdict === 'SAFE'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : result.verdict === 'SUSPICIOUS'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: result.verdict === 'SAFE' ? '#10b981' : result.verdict === 'SUSPICIOUS' ? '#f59e0b' : '#ef4444',
                  }}>
                    <IonIcon
                      icon={result.verdict === 'SAFE' ? checkmarkCircleOutline : result.verdict === 'SUSPICIOUS' ? warningOutline : alertCircleOutline}
                      style={{ fontSize: '32px' }}
                    />
                  </div>
                  <div>
                    <span style={{
                      display: 'block',
                      color: result.verdict === 'SAFE' ? '#10b981' : result.verdict === 'SUSPICIOUS' ? '#fbbf24' : '#ef4444',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                    }}>
                      {result.verdict === 'SAFE'
                        ? 'Link Aprovado como Seguro'
                        : result.verdict === 'SUSPICIOUS'
                        ? 'Atenção: Características Suspeitas'
                        : 'Alerta Crítico: Risco Elevado de Golpe!'}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      {result.url}
                    </span>
                  </div>
                </div>

                {/* Score Circular Badge */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: '16px',
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <span style={{
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    color: result.verdict === 'SAFE' ? '#10b981' : result.verdict === 'SUSPICIOUS' ? '#fbbf24' : '#ef4444',
                    lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                    SCORE / 100
                  </span>
                </div>
              </div>

              {/* Lista de Alertas / Riscos Encontrados */}
              {result.warnings.length > 0 && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '14px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <span style={{ color: '#fca5a5', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IonIcon icon={warningOutline} />
                    Vulnerabilidades e Anomalias Detectadas:
                  </span>
                  {result.warnings.map((warn, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                      <span style={{ color: '#f87171', fontSize: '0.85rem', lineHeight: 1.4 }}>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Matriz de Checagens Heurísticas */}
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>
                  Detalhamento das Camadas de Defesa RiskZero:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {result.checks.map((chk, i) => (
                    <div key={i} style={{
                      background: 'rgba(2, 6, 23, 0.5)',
                      border: `1px solid ${chk.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.25)'}`,
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <IonIcon
                        icon={chk.passed ? checkmarkCircleOutline : closeCircleOutline}
                        style={{ color: chk.passed ? '#10b981' : '#ef4444', fontSize: '20px', flexShrink: 0 }}
                      />
                      <div>
                        <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700, display: 'block' }}>
                          {chk.name}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          {chk.detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* HISTÓRICO LOCAL DE ANÁLISES */}
          {history.length > 0 && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={timeOutline} style={{ color: '#38bdf8', fontSize: '18px' }} />
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 800 }}>
                    Histórico de Links Verificados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <IonIcon icon={trashOutline} />
                  Limpar
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setUrlInput(item.url);
                      setResult(item);
                    }}
                    style={{
                      background: 'rgba(2, 6, 23, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', marginRight: '10px' }}>
                      <IonIcon
                        icon={item.verdict === 'SAFE' ? checkmarkCircleOutline : alertCircleOutline}
                        style={{
                          color: item.verdict === 'SAFE' ? '#10b981' : item.verdict === 'SUSPICIOUS' ? '#fbbf24' : '#ef4444',
                          fontSize: '18px',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.url}
                      </span>
                    </div>
                    <IonBadge
                      color={item.verdict === 'SAFE' ? 'success' : item.verdict === 'SUSPICIOUS' ? 'warning' : 'danger'}
                      style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', flexShrink: 0 }}
                    >
                      {item.score} pts
                    </IonBadge>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <IonToast
          isOpen={!!toastMsg}
          onDidDismiss={() => setToastMsg('')}
          message={toastMsg}
          color={toastColor}
          duration={2500}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
