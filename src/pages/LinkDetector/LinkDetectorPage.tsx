import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonToast,
} from '@ionic/react';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clipboard,
  Trash2,
  Clock,
  Search,
  Server
} from 'lucide-react';

interface AnalysisCheck {
  name: string;
  passed: boolean;
  severity: 'OK' | 'WARN' | 'CRITICAL';
  detail: string;
}

interface AnalysisResult {
  url: string;
  hostname: string;
  safe: boolean;
  score: number;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  warnings: string[];
  checks: AnalysisCheck[];
  dnsStatus?: 'RESOLVED' | 'NXDOMAIN' | 'UNVERIFIED';
  resolvedIps?: string[];
  timestamp: number;
}

const STANDARD_TRUSTED_TLDS = [
  '.com.br', '.org.br', '.gov.br', '.edu.br', '.mil.br', '.jus.br', '.b.br', '.net.br',
  '.com', '.org', '.net', '.gov', '.edu', '.io', '.dev', '.app'
];

const HIGH_RISK_TLDS = [
  '.kred', '.xyz', '.click', '.tk', '.pw', '.cc', '.loan', '.work', '.top', '.buzz',
  '.gq', '.ml', '.cf', '.ga', '.icu', '.vip', '.sbs', '.cfd', '.live', '.fit',
  '.rest', '.cyou', '.stream', '.download', '.win', '.bid', '.racing', '.date',
  '.faith', '.review', '.trade', '.party', '.gdn', '.men', '.mom', '.lol', '.fun',
  '.uno', '.lat', '.ink', '.monster', '.hair', '.beauty', '.quest', '.bond',
  '.shop', '.online', '.site', '.cam', '.bar', '.okinawa', '.su', '.ru', '.cn'
];

const PIRACY_WAREZ_KEYWORDS = [
  'futemax', 'multicanais', 'redecanais', 'pirata', 'torrent', 'thepiratebay',
  '1337x', 'fitgirl', 'crackeado', 'crack', 'keygen', 'ativador', 'kmspico',
  'baixargratis', 'baixar-gratis', 'modapk', 'apkmod', 'apk-mod', 'happymod',
  'pobreflix', 'vizer', 'topflix', 'braflix', 'megaflix', 'cinevision',
  'assistir-filme', 'futebol-ao-vivo', 'jogos-ao-vivo', 'tv-online', 'fute-max',
  'canais-ao-vivo', 'filmes-hd', 'series-gratis'
];

const FINANCIAL_SCAM_KEYWORDS = [
  'tigrinho', 'fortune-tiger', 'horarios-pagantes', 'bug-do-tigre', 'robopix',
  'urubu-do-pix', 'gerador-pix', 'pix-premiado', 'sorteio-pix', 'bet-bonus',
  'ganhar-dinheiro', 'renda-extra', 'resgate-fgts', 'valores-a-receber',
  'indenizacao', 'desenrola-brasil', 'limpa-nome', 'conta-bloqueada',
  'atualizar-dados', 'verify-account', 'confirm-identity', 'recadastro-obrigatorio',
  'correios-taxa', 'taxa-alfandega', 'receita-regularizar', 'premio-exclusivo',
  'clone-cartao', 'notas-falsas'
];

const PROTECTED_BRANDS: { keyword: string; officialDomains: string[] }[] = [
  { keyword: 'itau', officialDomains: ['itau.com.br', 'itau.com'] },
  { keyword: 'bradesco', officialDomains: ['bradesco.com.br', 'banco.bradesco'] },
  { keyword: 'nubank', officialDomains: ['nubank.com.br', 'nu.com.br'] },
  { keyword: 'santander', officialDomains: ['santander.com.br', 'santander.com'] },
  { keyword: 'bancodobrasil', officialDomains: ['bb.com.br'] },
  { keyword: 'caixa', officialDomains: ['caixa.gov.br', 'caixa.com.br'] },
  { keyword: 'mercadolivre', officialDomains: ['mercadolivre.com.br', 'mercadolibre.com'] },
  { keyword: 'mercadopago', officialDomains: ['mercadopago.com.br', 'mercadopago.com'] },
  { keyword: 'paypal', officialDomains: ['paypal.com', 'paypal.com.br'] },
  { keyword: 'netflix', officialDomains: ['netflix.com', 'netflix.com.br'] },
  { keyword: 'amazon', officialDomains: ['amazon.com', 'amazon.com.br'] },
  { keyword: 'google', officialDomains: ['google.com', 'google.com.br'] },
  { keyword: 'microsoft', officialDomains: ['microsoft.com', 'live.com', 'office.com'] },
  { keyword: 'apple', officialDomains: ['apple.com', 'icloud.com'] },
  { keyword: 'instagram', officialDomains: ['instagram.com'] },
  { keyword: 'whatsapp', officialDomains: ['whatsapp.com', 'whatsapp.net'] },
  { keyword: 'facebook', officialDomains: ['facebook.com', 'fb.com'] },
  { keyword: 'correios', officialDomains: ['correios.com.br'] },
  { keyword: 'picpay', officialDomains: ['picpay.com', 'picpay.com.br'] },
  { keyword: 'govbr', officialDomains: ['gov.br'] },
];

const HOMOGLYPH_PATTERNS = [
  'g00gle', 'paypa1', '1tau', 'nub4nk', 'faceb00k', 'm1crosoft', 'netfl1x',
  'amaz0n', 'inst4gram', 'wh4tsapp', 'br4desco', 's4ntander', 'c4ixa', 'xn--'
];

const SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'is.gd', 'cutt.ly', 't.co', 'shorte.st',
  'ow.ly', 'rb.gy', 'tiny.cc', 'abre.ai', 'encurtador.com.br'
];

function extractHostname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return rawUrl.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split(':')[0];
  }
}

function analyzeUrlSync(rawUrl: string): AnalysisResult {
  const url = rawUrl.trim();
  const warnings: string[] = [];
  const checks: AnalysisCheck[] = [];
  let penalty = 0;

  const lower = url.toLowerCase();
  const hasHttps = lower.startsWith('https://');
  const hostname = extractHostname(url);

  // 1. Criptografia HTTPS
  if (!hasHttps) {
    penalty += 30;
    warnings.push('Conexão Insegura: O link utiliza protocolo HTTP sem criptografia TLS.');
    checks.push({
      name: 'Protocolo TLS / HTTPS',
      passed: false,
      severity: 'WARN',
      detail: 'Tráfego em texto claro vulnerável a interceptação (MITM)',
    });
  } else {
    checks.push({
      name: 'Protocolo TLS / HTTPS',
      passed: true,
      severity: 'OK',
      detail: 'Transporte criptografado via HTTPS (Nota: HTTPS não garante idoneidade do site)',
    });
  }

  // 2. Obfuscação com @ ou IP Direto
  const hasDirectIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const hasAtTrick = lower.replace(/^https?:\/\//, '').includes('@');
  if (hasDirectIp || hasAtTrick) {
    penalty += 55;
    warnings.push(
      hasDirectIp
        ? 'Perigo Crítico: O link aponta para um endereço IP numérico bruto em vez de domínio registrado.'
        : 'Alerta de Dissimulação: Uso do caractere "@" na URL para mascarar o domínio verdadeiro.'
    );
    checks.push({
      name: 'Integridade do Hostname',
      passed: false,
      severity: 'CRITICAL',
      detail: hasDirectIp ? 'Host por IP direto (típico de servidores C2/Phishing)' : 'Ofuscação de credenciais na URL (@)',
    });
  } else {
    checks.push({
      name: 'Integridade do Hostname',
      passed: true,
      severity: 'OK',
      detail: `Domínio estruturado: ${hostname}`,
    });
  }

  // 3. Reputação da Extensão de Domínio (TLD Zero-Trust)
  const matchedHighRiskTld = HIGH_RISK_TLDS.find((tld) => hostname.endsWith(tld));
  const matchedStandardTld = STANDARD_TRUSTED_TLDS.find((tld) => hostname.endsWith(tld));

  if (matchedHighRiskTld) {
    penalty += 50;
    warnings.push(
      `Domínio de Alto Risco (${matchedHighRiskTld}): Extensão amplamente utilizada por sites de pirataria, phishing descartável e distribuição de adware/malware.`
    );
    checks.push({
      name: 'Reputação do TLD (Zero-Trust)',
      passed: false,
      severity: 'CRITICAL',
      detail: `TLD "${matchedHighRiskTld}" classificado em lista negra de abuso cibernético`,
    });
  } else if (!matchedStandardTld) {
    const ext = '.' + (hostname.split('.').pop() || '');
    penalty += 30;
    warnings.push(
      `Extensão Não Convencional (${ext}): O domínio não utiliza uma extensão comercial ou institucional padrão (.com, .com.br, .org, .gov.br).`
    );
    checks.push({
      name: 'Reputação do TLD (Zero-Trust)',
      passed: false,
      severity: 'WARN',
      detail: `Extensão atípica (${ext}) fora do conjunto corporativo padrão`,
    });
  } else {
    checks.push({
      name: 'Reputação do TLD (Zero-Trust)',
      passed: true,
      severity: 'OK',
      detail: `Extensão de domínio reconhecida (${matchedStandardTld})`,
    });
  }

  // 4. Detecção de Pirataria, Streaming Ilegal, Warez e APK Mod
  const foundPiracy = PIRACY_WAREZ_KEYWORDS.find((kw) => lower.includes(kw));
  if (foundPiracy) {
    penalty += 55;
    warnings.push(
      `Site de Pirataria / Streaming Ilegal Detectado ("${foundPiracy}"): Portais não oficiais de transmissão ou downloads modificados apresentam altíssima incidência de scripts maliciosos, pop-ups de engenharia social e roubo de sessão.`
    );
    checks.push({
      name: 'Filtro de Pirataria / Adware / Warez',
      passed: false,
      severity: 'CRITICAL',
      detail: `Assinatura de portal ilegal/warez detectada: "${foundPiracy}"`,
    });
  } else {
    checks.push({
      name: 'Filtro de Pirataria / Adware / Warez',
      passed: true,
      severity: 'OK',
      detail: 'Nenhum indicador de portal de pirataria ou warez',
    });
  }

  // 5. Detecção de Golpes Financeiros, PIX e Apostas Fraudulentas
  const foundScam = FINANCIAL_SCAM_KEYWORDS.find((kw) => lower.includes(kw));
  if (foundScam) {
    penalty += 60;
    warnings.push(
      `Assinatura de Golpe / Fraude Financeira ("${foundScam}"): Termo fortemente associado a páginas de captura de dados bancários ou esquemas fraudulentos.`
    );
    checks.push({
      name: 'Heurística Anti-Fraude Financeira',
      passed: false,
      severity: 'CRITICAL',
      detail: `Padrão de engenharia social financeira: "${foundScam}"`,
    });
  } else {
    checks.push({
      name: 'Heurística Anti-Fraude Financeira',
      passed: true,
      severity: 'OK',
      detail: 'Sem gatilhos lexicais de golpes financeiros/PIX',
    });
  }

  // 6. Falsificação de Marca (Brand Impersonation) & Typosquatting
  const foundHomoglyph = HOMOGLYPH_PATTERNS.find((h) => hostname.includes(h));
  let impersonatedBrand: string | null = null;
  const cleanHostNoHyphens = hostname.replace(/-/g, '');

  for (const brand of PROTECTED_BRANDS) {
    if (hostname.includes(brand.keyword) || cleanHostNoHyphens.includes(brand.keyword)) {
      const isOfficial = brand.officialDomains.some(
        (off) => hostname === off || hostname.endsWith('.' + off)
      );
      if (!isOfficial) {
        impersonatedBrand = brand.keyword;
        break;
      }
    }
  }

  if (foundHomoglyph || impersonatedBrand) {
    penalty += 65;
    warnings.push(
      impersonatedBrand
        ? `Falsificação de Marca (Brand Spoofing): O domínio menciona a marca "${impersonatedBrand}", mas NÃO pertence ao domínio oficial da instituição.`
        : `Ataque Homográfico / Typosquatting ("${foundHomoglyph}"): Tentativa de imitar visualmente uma marca conhecida trocando letras por números ou Punycode.`
    );
    checks.push({
      name: 'Proteção contra Typosquatting & Spoofing',
      passed: false,
      severity: 'CRITICAL',
      detail: impersonatedBrand
        ? `Imitação não autorizada da marca "${impersonatedBrand}"`
        : `Padrão homográfico enganoso "${foundHomoglyph}"`,
    });
  } else {
    checks.push({
      name: 'Proteção contra Typosquatting & Spoofing',
      passed: true,
      severity: 'OK',
      detail: 'Nenhuma falsificação de marca conhecida detectada',
    });
  }

  // 7. Encurtadores e Excesso de Subdomínios / Hífens
  const isShortened = SHORTENERS.some((s) => hostname === s || hostname.endsWith('.' + s));
  const dotCount = (hostname.match(/\./g) || []).length;
  const hyphenCount = (hostname.match(/-/g) || []).length;

  if (isShortened) {
    penalty += 35;
    warnings.push('Link Encurtado: O destino real está oculto atrás de um redirecionador.');
    checks.push({
      name: 'Transparência de Redirecionamento',
      passed: false,
      severity: 'WARN',
      detail: `Encurtador de URL (${hostname}) mascara o destino final`,
    });
  } else if (dotCount > 3 || hyphenCount >= 3) {
    penalty += 30;
    warnings.push('Estrutura de Domínio Anômala: Excesso de subdomínios ou hífens, padrão comum em kits de phishing.');
    checks.push({
      name: 'Estrutura Sintática do Domínio',
      passed: false,
      severity: 'WARN',
      detail: `${dotCount} subdomínios / ${hyphenCount} hífens detectados`,
    });
  } else {
    checks.push({
      name: 'Estrutura Sintática do Domínio',
      passed: true,
      severity: 'OK',
      detail: 'Estrutura de domínio limpa e direta',
    });
  }

  const score = Math.max(0, 100 - penalty);
  let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' = 'SAFE';
  if (score < 50) verdict = 'DANGEROUS';
  else if (score < 80) verdict = 'SUSPICIOUS';

  return {
    url,
    hostname,
    safe: score >= 80 && warnings.length === 0,
    score,
    verdict,
    warnings,
    checks,
    dnsStatus: 'UNVERIFIED',
    timestamp: Date.now(),
  };
}

async function verifyDnsOverHttps(hostname: string): Promise<{ status: 'RESOLVED' | 'NXDOMAIN' | 'UNVERIFIED'; ips: string[] }> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
    if (!resp.ok) return { status: 'UNVERIFIED', ips: [] };
    const data = await resp.json();
    if (data.Status === 3) {
      return { status: 'NXDOMAIN', ips: [] };
    }
    const ips: string[] = (data.Answer || [])
      .filter((ans: any) => ans.type === 1 && ans.data)
      .map((ans: any) => String(ans.data));
    return { status: ips.length > 0 ? 'RESOLVED' : 'UNVERIFIED', ips };
  } catch {
    return { status: 'UNVERIFIED', ips: [] };
  }
}

const STORAGE_HISTORY_KEY = 'riskzero_link_detector_history_v2';

export const LinkDetectorPage: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

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
    setHistory((prev) => {
      const updated = [item, ...prev.filter((h) => h.url !== item.url)].slice(0, 8);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignora erro de quota
      }
      return updated;
    });
  };

  const handleAnalyze = async (targetUrl?: string) => {
    const toTest = (targetUrl ?? urlInput).trim();
    if (!toTest) {
      setToastMsg('Digite ou cole uma URL para inspecionar.');
      setShowToast(true);
      return;
    }

    setAnalyzing(true);
    const formatted =
      toTest.startsWith('http://') || toTest.startsWith('https://')
        ? toTest
        : `https://${toTest}`;

    const baseAnalysis = analyzeUrlSync(formatted);

    // Consulta complementar DNS-over-HTTPS
    const dns = await verifyDnsOverHttps(baseAnalysis.hostname);
    baseAnalysis.dnsStatus = dns.status;
    baseAnalysis.resolvedIps = dns.ips;

    if (dns.status === 'NXDOMAIN') {
      baseAnalysis.warnings.push(
        'Domínio Inexistente (NXDOMAIN): O servidor DNS global informou que este domínio não existe ou foi derrubado por fraude.'
      );
      baseAnalysis.checks.push({
        name: 'Resolução DNS-over-HTTPS (Google DoH)',
        passed: false,
        severity: 'CRITICAL',
        detail: 'NXDOMAIN — Domínio inexistente ou desativado',
      });
      baseAnalysis.score = Math.min(baseAnalysis.score, 25);
      baseAnalysis.verdict = 'DANGEROUS';
      baseAnalysis.safe = false;
    } else if (dns.status === 'RESOLVED') {
      baseAnalysis.checks.push({
        name: 'Resolução DNS-over-HTTPS (Google DoH)',
        passed: true,
        severity: 'OK',
        detail: `Resolvido (${dns.ips.slice(0, 2).join(', ')})`,
      });
    }

    setAnalyzing(false);
    setResult(baseAnalysis);
    saveToHistory(baseAnalysis);
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
        setToastMsg('Use Ctrl+V para colar o endereço.');
        setShowToast(true);
      }
    } catch {
      setToastMsg('Permissão da área de transferência indisponível.');
      setShowToast(true);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_HISTORY_KEY);
    setToastMsg('Histórico de inspeções limpo.');
    setShowToast(true);
  };

  return (
    <IonPage style={{ background: '#09090b' }}>
      <IonContent fullscreen style={{ '--background': '#09090b' }}>
        <div className="rz-page-container" style={{ maxWidth: 880 }}>
          <header className="rz-page-header">
            <div>
              <h1 className="rz-page-title">Inspeção de Links &amp; Anti-Phishing</h1>
              <p className="rz-page-subtitle">
                Motor heurístico Zero-Trust com reputação de TLD, detecção de pirataria/warez, typosquatting e consulta DNS-over-HTTPS.
              </p>
            </div>
            <span className="rz-badge rz-badge-blue">Motor Zero-Trust v2</span>
          </header>

          {/* Barra de Inspeção */}
          <section className="rz-card" style={{ marginBottom: 18 }}>
            <label htmlFor="url-inspector-input" className="rz-label">
              ENDEREÇO WEB (URL) PARA AUDITORIA
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Globe
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#71717a',
                  }}
                />
                <input
                  id="url-inspector-input"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Ex: https://futemax.kred/ ou https://itau-acesso-seguro.xyz"
                  className="rz-input"
                  style={{ paddingLeft: 36 }}
                />
              </div>

              <button
                type="button"
                onClick={handlePaste}
                className="rz-btn rz-btn-secondary"
                title="Colar da área de transferência"
              >
                <Clipboard size={15} />
                <span>Colar</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={analyzing}
                className="rz-btn rz-btn-primary"
              >
                <Search size={15} />
                <span>{analyzing ? 'Analisando...' : 'Inspecionar Link'}</span>
              </button>
            </div>

            {/* Exemplos rápidos para teste */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #27272a' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Testar exemplos:</span>
              <button
                type="button"
                className="rz-badge rz-badge-danger"
                style={{ cursor: 'pointer', border: '1px solid rgba(239,68,68,0.35)' }}
                onClick={() => {
                  const u = 'https://futemax.kred/';
                  setUrlInput(u);
                  handleAnalyze(u);
                }}
              >
                Streaming Ilegal (futemax.kred)
              </button>
              <button
                type="button"
                className="rz-badge rz-badge-danger"
                style={{ cursor: 'pointer', border: '1px solid rgba(239,68,68,0.35)' }}
                onClick={() => {
                  const u = 'https://itau-recadastro-urgente.sbs/login';
                  setUrlInput(u);
                  handleAnalyze(u);
                }}
              >
                Phishing Bancário (itau-recadastro.sbs)
              </button>
              <button
                type="button"
                className="rz-badge rz-badge-warning"
                style={{ cursor: 'pointer', border: '1px solid rgba(245,158,11,0.35)' }}
                onClick={() => {
                  const u = 'https://bit.ly/oferta-secreta-2026';
                  setUrlInput(u);
                  handleAnalyze(u);
                }}
              >
                Encurtador Mascarado (bit.ly)
              </button>
              <button
                type="button"
                className="rz-badge rz-badge-success"
                style={{ cursor: 'pointer', border: '1px solid rgba(16,185,129,0.35)' }}
                onClick={() => {
                  const u = 'https://www.gov.br/pt-br';
                  setUrlInput(u);
                  handleAnalyze(u);
                }}
              >
                Portal Oficial (gov.br)
              </button>
            </div>
          </section>

          {/* Resultado da Inspeção */}
          {result && (
            <section
              className="rz-card"
              style={{
                marginBottom: 18,
                borderColor:
                  result.verdict === 'SAFE'
                    ? 'rgba(16, 185, 129, 0.4)'
                    : result.verdict === 'SUSPICIOUS'
                      ? 'rgba(245, 158, 11, 0.4)'
                      : 'rgba(239, 68, 68, 0.45)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingBottom: 16, borderBottom: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        result.verdict === 'SAFE'
                          ? 'rgba(16, 185, 129, 0.14)'
                          : result.verdict === 'SUSPICIOUS'
                            ? 'rgba(245, 158, 11, 0.14)'
                            : 'rgba(239, 68, 68, 0.14)',
                      color:
                        result.verdict === 'SAFE'
                          ? '#10b981'
                          : result.verdict === 'SUSPICIOUS'
                            ? '#f59e0b'
                            : '#ef4444',
                    }}
                  >
                    {result.verdict === 'SAFE' ? (
                      <ShieldCheck size={24} />
                    ) : result.verdict === 'SUSPICIOUS' ? (
                      <AlertTriangle size={24} />
                    ) : (
                      <ShieldAlert size={24} />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fafafa' }}>
                        {result.verdict === 'SAFE'
                          ? 'Domínio Verificado e Seguro'
                          : result.verdict === 'SUSPICIOUS'
                            ? 'Link Suspeito — Cautela Recomendada'
                            : 'Alto Risco Detectado — Acesso Não Recomendado'}
                      </h2>
                    </div>
                    <code style={{ display: 'block', marginTop: 4, fontSize: '0.8rem', color: '#a1a1aa', wordBreak: 'break-all' }}>
                      {result.url}
                    </code>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--rz-font-mono)',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      color:
                        result.verdict === 'SAFE'
                          ? '#10b981'
                          : result.verdict === 'SUSPICIOUS'
                            ? '#f59e0b'
                            : '#ef4444',
                    }}
                  >
                    {result.score}/100
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Índice de Confiança
                  </span>
                </div>
              </div>

              {/* Alertas Encontrados */}
              {result.warnings.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="rz-label" style={{ color: '#f87171' }}>
                    AMEAÇAS E ANOMALIAS IDENTIFICADAS ({result.warnings.length})
                  </div>
                  {result.warnings.map((warn, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#fca5a5',
                        fontSize: '0.82rem',
                        lineHeight: 1.45,
                      }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#ef4444' }} />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Checklist Técnico */}
              <div style={{ marginTop: 18 }}>
                <div className="rz-label" style={{ marginBottom: 8 }}>
                  VETORES DE INSPEÇÃO TÉCNICA
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
                  {result.checks.map((chk, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: '#09090b',
                        border: '1px solid #27272a',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      {chk.passed ? (
                        <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <XCircle
                          size={15}
                          style={{
                            color: chk.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fafafa' }}>{chk.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: 2 }}>{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Histórico de Links Verificados */}
          {history.length > 0 && (
            <section className="rz-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600, color: '#fafafa' }}>
                  <Clock size={15} className="text-zinc-400" />
                  <span>Histórico de Inspeções Recentes</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="rz-btn rz-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <Trash2 size={13} />
                  <span>Limpar</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setUrlInput(item.url);
                      handleAnalyze(item.url);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#09090b',
                      border: '1px solid #27272a',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {item.verdict === 'SAFE' ? (
                        <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                      ) : item.verdict === 'SUSPICIOUS' ? (
                        <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      ) : (
                        <XCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.82rem', color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.url}
                      </span>
                    </div>

                    <span
                      className={`rz-badge ${item.verdict === 'SAFE'
                          ? 'rz-badge-success'
                          : item.verdict === 'SUSPICIOUS'
                            ? 'rz-badge-warning'
                            : 'rz-badge-danger'
                        }`}
                    >
                      {item.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2200}
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
