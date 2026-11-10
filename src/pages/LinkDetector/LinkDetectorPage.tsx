import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonToast } from '@ionic/react';
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
  Server,
  X,
  Lock,
  Activity,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { OrbitRing, OrbitTone } from '../../components/brand';

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
  entropyBits?: number;
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

function calcShannonEntropy(str: string): number {
  if (!str) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(2));
}

function analyzeUrlSync(rawUrl: string): AnalysisResult {
  const url = rawUrl.trim();
  const warnings: string[] = [];
  const checks: AnalysisCheck[] = [];
  let penalty = 0;

  const lower = url.toLowerCase();
  const hasHttps = lower.startsWith('https://');
  const hostname = extractHostname(url);
  const entropyBits = calcShannonEntropy(hostname);

  // 1. Criptografia HTTPS (SSL / TLS)
  if (!hasHttps) {
    penalty += 30;
    warnings.push('Conexão Insegura: O link utiliza protocolo HTTP sem criptografia TLS.');
    checks.push({
      name: 'Protocolo SSL / TLS (HTTPS)',
      passed: false,
      severity: 'WARN',
      detail: 'Tráfego em texto claro vulnerável a interceptação (MITM)',
    });
  } else {
    checks.push({
      name: 'Protocolo SSL / TLS (HTTPS)',
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

  // 6. Falsificação de Marca (Brand Impersonation), Punycode & Homograph
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
        : `Ataque Homográfico / Punycode ("${foundHomoglyph}"): Tentativa de imitar visualmente uma marca conhecida trocando letras por números ou Punycode.`
    );
    checks.push({
      name: 'Punycode / Homograph & Brand Spoofing',
      passed: false,
      severity: 'CRITICAL',
      detail: impersonatedBrand
        ? `Imitação não autorizada da marca "${impersonatedBrand}"`
        : `Padrão homográfico enganoso "${foundHomoglyph}"`,
    });
  } else {
    checks.push({
      name: 'Punycode / Homograph & Brand Spoofing',
      passed: true,
      severity: 'OK',
      detail: 'Nenhuma falsificação homográfica ou de marca detectada',
    });
  }

  // 7. Redirecionadores, Encurtadores e Entropia Sintática da URL
  const isShortened = SHORTENERS.some((s) => hostname === s || hostname.endsWith('.' + s));
  const dotCount = (hostname.match(/\./g) || []).length;
  const hyphenCount = (hostname.match(/-/g) || []).length;

  if (isShortened) {
    penalty += 35;
    warnings.push('Link Encurtado: O destino real está oculto atrás de um redirecionador.');
    checks.push({
      name: 'Redirecionamento & Entropia da URL',
      passed: false,
      severity: 'WARN',
      detail: `Encurtador de URL (${hostname}) mascara o destino final · Entropia ${entropyBits} bits`,
    });
  } else if (dotCount > 3 || hyphenCount >= 3 || entropyBits > 4.25) {
    penalty += 30;
    warnings.push('Estrutura de Domínio Anômala: Excesso de subdomínios, hífens ou entropia elevada (padrão comum em kits de phishing DGA).');
    checks.push({
      name: 'Redirecionamento & Entropia da URL',
      passed: false,
      severity: 'WARN',
      detail: `${dotCount} subdomínios / ${hyphenCount} hífens · Entropia ${entropyBits} bits`,
    });
  } else {
    checks.push({
      name: 'Redirecionamento & Entropia da URL',
      passed: true,
      severity: 'OK',
      detail: `Estrutura direta sem redirecionadores · Entropia ${entropyBits} bits`,
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
    entropyBits,
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
      .filter((ans: { type?: number; data?: unknown }) => ans.type === 1 && ans.data)
      .map((ans: { data?: unknown }) => String(ans.data));
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

  const verdictTone: OrbitTone = !result
    ? 'accent'
    : result.verdict === 'SAFE'
      ? 'success'
      : result.verdict === 'SUSPICIOUS'
        ? 'warning'
        : 'danger';

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content" fullscreen>
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Inspeção Heurística"
            title="Detector de Links & Phishing"
            subtitle="Motor Zero-Trust com reputação de TLD, detecção de ataques homográficos (Punycode), entropia de URL, redirecionadores e resolução DNS-over-HTTPS."
            actions={
              <span className="rz-badge rz-badge-blue">
                <span className="rz-dot info is-live" />
                Motor Zero-Trust v2
              </span>
            }
          />

          {/* ==================== BARRA DE INSPEÇÃO DE URL ==================== */}
          <section className="rz-panel rz-meridian-bg" style={{ marginBottom: 24 }}>
            <label htmlFor="url-inspector-input" className="rz-label">
              ENDEREÇO WEB (URL) PARA AUDITORIA HEURÍSTICA
            </label>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'stretch',
                marginTop: 6,
              }}
            >
              <div className="rz-input-group" style={{ flex: 1, minWidth: 240 }}>
                <Globe size={18} />
                <input
                  id="url-inspector-input"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Ex: https://futemax.kred/ ou https://itau-acesso-seguro.xyz"
                  className="rz-input is-mono"
                />
                {urlInput && (
                  <button
                    type="button"
                    className="rz-icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setUrlInput('')}
                    aria-label="Limpar endereço"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePaste}
                className="rz-btn rz-btn-secondary"
                title="Colar da área de transferência"
              >
                <Clipboard size={16} />
                <span>Colar</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={analyzing}
                data-loading={analyzing ? 'true' : undefined}
                className="rz-btn rz-btn-primary"
              >
                <Search size={16} />
                <span>{analyzing ? 'Analisando...' : 'Inspecionar Link'}</span>
              </button>
            </div>

            {/* Exemplos rápidos para teste */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid var(--rz-border-subtle)',
              }}
            >
              <span className="rz-help" style={{ fontWeight: 700 }}>
                Testar amostras:
              </span>
              <div className="rz-scroll-x" style={{ flex: 1 }}>
                <button
                  type="button"
                  className="rz-chip"
                  onClick={() => {
                    const u = 'https://futemax.kred/';
                    setUrlInput(u);
                    handleAnalyze(u);
                  }}
                >
                  <span className="rz-dot danger" />
                  <span>Streaming Ilegal (futemax.kred)</span>
                </button>

                <button
                  type="button"
                  className="rz-chip"
                  onClick={() => {
                    const u = 'https://itau-recadastro-urgente.sbs/login';
                    setUrlInput(u);
                    handleAnalyze(u);
                  }}
                >
                  <span className="rz-dot danger" />
                  <span>Phishing Bancário (itau-recadastro.sbs)</span>
                </button>

                <button
                  type="button"
                  className="rz-chip"
                  onClick={() => {
                    const u = 'https://bit.ly/oferta-secreta-2026';
                    setUrlInput(u);
                    handleAnalyze(u);
                  }}
                >
                  <span className="rz-dot warning" />
                  <span>Encurtador Mascarado (bit.ly)</span>
                </button>

                <button
                  type="button"
                  className="rz-chip"
                  onClick={() => {
                    const u = 'https://www.gov.br/pt-br';
                    setUrlInput(u);
                    handleAnalyze(u);
                  }}
                >
                  <span className="rz-dot success" />
                  <span>Portal Oficial (gov.br)</span>
                </button>
              </div>
            </div>
          </section>

          {/* ==================== RESULTADO DA INSPEÇÃO COM ORBITRING ==================== */}
          {result && (
            <section
              className="rz-panel"
              style={{
                marginBottom: 24,
                borderColor:
                  result.verdict === 'SAFE'
                    ? 'var(--rz-success-line)'
                    : result.verdict === 'SUSPICIOUS'
                      ? 'var(--rz-warning-line)'
                      : 'var(--rz-danger-line)',
              }}
            >
              {/* Cabeçalho do Veredito + OrbitRing */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 20,
                  paddingBottom: 20,
                  borderBottom: '1px solid var(--rz-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 260 }}>
                  <OrbitRing
                    size={112}
                    stroke={6}
                    spinning={analyzing}
                    value={result.score}
                    tone={verdictTone}
                    globe
                    label={`Índice de Confiança: ${result.score} de 100`}
                  >
                    <span
                      className="rz-num"
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        lineHeight: 1,
                        color:
                          result.verdict === 'SAFE'
                            ? 'var(--rz-success)'
                            : result.verdict === 'SUSPICIOUS'
                              ? 'var(--rz-warning)'
                              : 'var(--rz-danger)',
                      }}
                    >
                      {result.score}
                    </span>
                    <span
                      className="rz-font-mono"
                      style={{ fontSize: '0.68rem', color: 'var(--rz-text-muted)' }}
                    >
                      /100
                    </span>
                  </OrbitRing>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span
                        className={`rz-badge ${
                          result.verdict === 'SAFE'
                            ? 'rz-badge-success'
                            : result.verdict === 'SUSPICIOUS'
                              ? 'rz-badge-warning'
                              : 'rz-badge-danger'
                        }`}
                      >
                        {result.verdict === 'SAFE' ? (
                          <ShieldCheck size={12} />
                        ) : result.verdict === 'SUSPICIOUS' ? (
                          <AlertTriangle size={12} />
                        ) : (
                          <ShieldAlert size={12} />
                        )}
                        <span>
                          {result.verdict === 'SAFE'
                            ? 'Veredito: Seguro'
                            : result.verdict === 'SUSPICIOUS'
                              ? 'Veredito: Suspeito'
                              : 'Veredito: Perigoso'}
                        </span>
                      </span>
                      <span className="rz-badge rz-badge-neutral rz-font-mono">
                        Índice de Confiança: {result.score}/100
                      </span>
                    </div>

                    <h2
                      style={{
                        margin: 0,
                        fontFamily: 'var(--rz-font-display)',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--rz-text-primary)',
                      }}
                    >
                      {result.verdict === 'SAFE'
                        ? 'Domínio Verificado e Seguro'
                        : result.verdict === 'SUSPICIOUS'
                          ? 'Link Suspeito — Cautela Recomendada'
                          : 'Alto Risco Detectado — Acesso Não Recomendado'}
                    </h2>

                    <code
                      style={{
                        display: 'block',
                        marginTop: 6,
                        fontSize: 'var(--rz-text-sm)',
                        color: 'var(--rz-ice)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {result.url}
                    </code>
                  </div>
                </div>
              </div>

              {/* Faixa de Telemetria da URL */}
              <div className="rz-metrics" style={{ marginTop: 18 }}>
                <div className="rz-metric">
                  <span className="rz-stat-label">
                    <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Hostname Extraído
                  </span>
                  <div
                    className="rz-stat-value-sm rz-font-mono rz-truncate"
                    title={result.hostname}
                  >
                    {result.hostname}
                  </div>
                  <span className="rz-help">Alvo primário de resolução</span>
                </div>

                <div className="rz-metric">
                  <span className="rz-stat-label">
                    <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Camada SSL / TLS
                  </span>
                  <div
                    className="rz-stat-value-sm"
                    style={{
                      color: result.url.toLowerCase().startsWith('https://')
                        ? 'var(--rz-success)'
                        : 'var(--rz-warning)',
                    }}
                  >
                    {result.url.toLowerCase().startsWith('https://')
                      ? 'HTTPS Criptografado'
                      : 'HTTP Sem Cifragem'}
                  </div>
                  <span className="rz-help">Inspeção de protocolo</span>
                </div>

                <div className="rz-metric">
                  <span className="rz-stat-label">
                    <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Entropia de Shannon
                  </span>
                  <div className="rz-stat-value-sm rz-font-mono">
                    {result.entropyBits ?? calcShannonEntropy(result.hostname)} bits/char
                  </div>
                  <span className="rz-help">Comprimento: {result.url.length} caracteres</span>
                </div>

                <div className="rz-metric">
                  <span className="rz-stat-label">
                    <Server size={12} style={{ display: 'inline', marginRight: 4 }} />
                    DNS-over-HTTPS (DoH)
                  </span>
                  <div
                    className="rz-stat-value-sm rz-font-mono"
                    style={{
                      color:
                        result.dnsStatus === 'NXDOMAIN'
                          ? 'var(--rz-danger)'
                          : result.dnsStatus === 'RESOLVED'
                            ? 'var(--rz-success)'
                            : 'var(--rz-text-secondary)',
                    }}
                  >
                    {result.dnsStatus === 'RESOLVED'
                      ? result.resolvedIps?.[0] || 'Resolvido'
                      : result.dnsStatus === 'NXDOMAIN'
                        ? 'NXDOMAIN'
                        : 'Verificação Local'}
                  </div>
                  <span className="rz-help">Consulta Google DoH</span>
                </div>
              </div>

              {/* Alertas Encontrados */}
              {result.warnings.length > 0 && (
                <div
                  style={{
                    marginTop: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    className="rz-label"
                    style={{ color: 'var(--rz-danger)', marginBottom: 2 }}
                  >
                    AMEAÇAS E ANOMALIAS IDENTIFICADAS ({result.warnings.length})
                  </div>
                  {result.warnings.map((warn, i) => (
                    <div key={i} className="rz-alert rz-alert-danger">
                      <AlertTriangle size={18} />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Decomposição Heurística Estruturada */}
              <div style={{ marginTop: 20 }}>
                <div className="rz-section-head">
                  <h3 className="rz-section-title">
                    <span>Vetores de Inspeção Técnica</span>
                    <span className="rz-count">{result.checks.length} CAMADAS</span>
                  </h3>
                </div>

                <div className="rz-list">
                  {result.checks.map((chk, idx) => {
                    const iconClass = chk.passed
                      ? 'success'
                      : chk.severity === 'CRITICAL'
                        ? 'danger'
                        : 'warning';
                    return (
                      <div key={idx} className="rz-row">
                        <div className={`rz-icon-tile ${iconClass}`}>
                          {chk.passed ? <CheckCircle2 /> : <XCircle />}
                        </div>

                        <div className="rz-row-main">
                          <div className="rz-row-title">{chk.name}</div>
                          <div className="rz-row-meta" style={{ whiteSpace: 'normal' }}>
                            {chk.detail}
                          </div>
                        </div>

                        <div className="rz-row-trailing">
                          <span
                            className={`rz-badge ${
                              chk.passed
                                ? 'rz-badge-success'
                                : chk.severity === 'CRITICAL'
                                  ? 'rz-badge-danger'
                                  : 'rz-badge-warning'
                            }`}
                          >
                            {chk.passed
                              ? 'Aprovado'
                              : chk.severity === 'CRITICAL'
                                ? 'Crítico'
                                : 'Alerta'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ==================== HISTÓRICO DE LINKS VERIFICADOS ==================== */}
          {history.length > 0 && (
            <section className="rz-section" style={{ marginBottom: 0 }}>
              <div className="rz-section-head">
                <h2 className="rz-section-title">
                  <Clock size={16} />
                  <span>Histórico de Inspeções Recentes</span>
                  <span className="rz-count">{history.length}</span>
                </h2>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="rz-btn rz-btn-secondary rz-btn-sm"
                >
                  <Trash2 size={14} />
                  <span>Limpar</span>
                </button>
              </div>

              <div className="rz-list">
                {history.map((item, idx) => {
                  const iconTone =
                    item.verdict === 'SAFE'
                      ? 'success'
                      : item.verdict === 'SUSPICIOUS'
                        ? 'warning'
                        : 'danger';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setUrlInput(item.url);
                        handleAnalyze(item.url);
                      }}
                      className="rz-row is-interactive"
                    >
                      <div className={`rz-icon-tile ${iconTone}`}>
                        {item.verdict === 'SAFE' ? (
                          <CheckCircle2 />
                        ) : item.verdict === 'SUSPICIOUS' ? (
                          <AlertTriangle />
                        ) : (
                          <XCircle />
                        )}
                      </div>

                      <div className="rz-row-main">
                        <div className="rz-row-title rz-font-mono">{item.url}</div>
                        <div className="rz-row-meta">
                          Host: <span className="rz-font-mono">{item.hostname}</span>
                        </div>
                      </div>

                      <div className="rz-row-trailing">
                        <span
                          className={`rz-badge rz-font-mono ${
                            item.verdict === 'SAFE'
                              ? 'rz-badge-success'
                              : item.verdict === 'SUSPICIOUS'
                                ? 'rz-badge-warning'
                                : 'rz-badge-danger'
                          }`}
                        >
                          {item.score} pts
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2200}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
