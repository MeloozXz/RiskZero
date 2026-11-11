import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IonPage, IonContent, IonToast, IonToggle } from '@ionic/react';
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Monitor,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  ExternalLink,
  Info,
  Server,
  FileCode,
  Lock,
  Radar,
  Wifi,
  Clock,
  MapPin,
  Network,
  Puzzle,
} from 'lucide-react';
import {
  VpnService,
  VpnStats,
  BrowserExtensionService,
  BrowserExtensionState,
} from '../../services/vpn';
import {
  runProtectionCheck,
  clearBaseline,
  ProtectionReport,
  CheckResult,
  CheckStatus,
  Verdict,
} from '../../services/protectionCheck';
import { ClipboardService } from '../../services/clipboard';
import { PageHeader } from '../../components/ui/PageHeader';
import { OrbitRing, OrbitTone } from '../../components/brand/OrbitRing';
import './VpnPage.css';

type VpnMode = 'browser-ext' | 'wireguard-pc';

const VERDICT_UI: Record<Verdict, { label: string; tone: OrbitTone; badge: string; pill: string; dot: string }> = {
  protected: { label: 'Navegador Protegido', tone: 'success', badge: 'rz-badge-success', pill: 'is-connected', dot: 'success is-live' },
  leaking: { label: 'IP Mascarado, Com Vazamentos', tone: 'warning', badge: 'rz-badge-warning', pill: 'is-error', dot: 'warning' },
  unprotected: { label: 'IP Real Exposto', tone: 'danger', badge: 'rz-badge-danger', pill: 'is-error', dot: 'danger' },
  unknown: { label: 'Não Verificado', tone: 'muted', badge: 'rz-badge-blue', pill: '', dot: 'info' },
};

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  ok: <CheckCircle2 size={16} />,
  warn: <AlertTriangle size={16} />,
  fail: <XCircle size={16} />,
  info: <Info size={16} />,
  skipped: <MinusCircle size={16} />,
  running: <RefreshCw size={16} className="rz-spin" />,
  error: <MinusCircle size={16} />,
};

export const VpnPage: React.FC = () => {
  const [activeMode, setActiveMode] = useState<VpnMode>('browser-ext');
  const [vpnStats, setVpnStats] = useState<VpnStats>(() => VpnService.getStats());
  const [toastMessage, setToastMessage] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [configPreview, setConfigPreview] = useState<string>('');
  const [showConfPreview, setShowConfPreview] = useState<boolean>(false);

  // Estado LIDO da extensão (a página não controla a extensão)
  const [extState, setExtState] = useState<BrowserExtensionState>(() =>
    BrowserExtensionService.getState()
  );

  // Checkup de proteção
  const [report, setReport] = useState<ProtectionReport | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const geoRef = useRef<CheckResult | undefined>(undefined);
  const checkSeq = useRef(0);

  // Estados de expansão dos tutoriais
  const [showBrowserTutorial, setShowBrowserTutorial] = useState<boolean>(false);
  const [showWindowsTutorial, setShowWindowsTutorial] = useState<boolean>(false);

  useEffect(() => {
    const unsubVpn = VpnService.subscribe((stats) => {
      setVpnStats(stats);
    });
    const unsubExt = BrowserExtensionService.subscribe((state) => {
      setExtState(state);
    });
    return () => {
      unsubVpn();
      unsubExt();
    };
  }, []);

  const runCheck = useCallback(
    async (includeGeolocation: boolean) => {
      const seq = ++checkSeq.current;
      setIsChecking(true);
      try {
        const res = await runProtectionCheck({
          extensionConnected: extState.isInstalled ? extState.isConnected : undefined,
          includeGeolocation,
          previousGeolocation: geoRef.current,
        });
        if (includeGeolocation) geoRef.current = res.checks.geolocation;
        if (seq === checkSeq.current) setReport(res);
      } finally {
        if (seq === checkSeq.current) setIsChecking(false);
      }
    },
    [extState.isInstalled, extState.isConnected]
  );

  // Roda ao abrir e quando a extensão avisa mudança de estado
  useEffect(() => {
    const t = setTimeout(() => runCheck(false), 400);
    return () => clearTimeout(t);
  }, [runCheck]);

  useEffect(() => {
    let active = true;
    VpnService.getWireguardConfig()
      .then(({ configString }) => {
        if (active) setConfigPreview(configString);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [vpnStats.selectedServer.id]);

  const handleVerify = () => {
    if (activeMode === 'browser-ext') BrowserExtensionService.ping();
    runCheck(true);
  };

  const handleResetBaseline = () => {
    clearBaseline();
    setToastMessage('IP real esquecido. Verifique novamente com a VPN desligada para salvá-lo.');
    runCheck(false);
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await ClipboardService.copySecure(text, label);
      }
      setCopiedField(label);
      setToastMessage(`${label} copiado para a área de transferência.`);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      setToastMessage('Falha ao copiar texto.');
    }
  };

  const handleDownloadExtension = () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const link = document.createElement('a');
    link.href = `${cleanBase}seguranapp-extension.zip`;
    link.download = 'seguranapp-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Download da extensão iniciado (.zip). Siga os 3 passos abaixo.');
    setShowBrowserTutorial(true);
  };

  const handleDownloadConf = async () => {
    try {
      await VpnService.downloadCurrentConfigFile();
      setToastMessage(`Perfil WireGuard (${vpnStats.selectedServer.name}) baixado.`);
      setShowWindowsTutorial(true);
    } catch {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const link = document.createElement('a');
      link.href = `${cleanBase}seguranapp-vpn.conf`;
      link.download = 'seguranapp-vpn.conf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToastMessage('Perfil WireGuard (.conf) baixado.');
      setShowWindowsTutorial(true);
    }
  };

  const verdict: Verdict = report?.verdict ?? 'unknown';
  const verdictUi = VERDICT_UI[verdict];
  const currentIp = report?.ipInfo?.ip ?? (isChecking ? 'Consultando...' : '—');

  const extStatusLabel = !extState.isInstalled
    ? 'Extensão não detectada'
    : extState.isConnected
      ? `Extensão ligada · ${extState.selectedServer?.name || 'servidor desconhecido'}`
      : 'Extensão instalada, desligada';

  /** Reator central compartilhado pelas duas abas */
  const renderReactor = (context: 'ext' | 'wg') => (
    <div className="vpn-reactor-stage">
      <OrbitRing
        size={168}
        stroke={7}
        spinning={isChecking}
        value={isChecking ? undefined : report ? 100 : 0}
        tone={isChecking ? 'accent' : verdictUi.tone}
        globe
        label={verdictUi.label}
      >
        <button
          type="button"
          onClick={handleVerify}
          disabled={isChecking}
          className={`vpn-power-btn ${verdict === 'protected' ? 'is-connected' : ''} ${isChecking ? 'is-connecting' : ''}`}
          aria-label="Verificar proteção"
        >
          {isChecking ? (
            <RefreshCw size={28} strokeWidth={2} className="rz-spin" />
          ) : verdict === 'protected' ? (
            <ShieldCheck size={30} strokeWidth={2} />
          ) : verdict === 'unknown' ? (
            <Radar size={30} strokeWidth={2} />
          ) : (
            <ShieldAlert size={30} strokeWidth={2} />
          )}
          <span className="vpn-power-label">{isChecking ? 'Verificando' : 'Verificar'}</span>
        </button>
      </OrbitRing>

      <div className="vpn-ip-readout">
        <span className="vpn-ip-eyebrow">IP público visto pelos sites</span>
        <div className="vpn-ip-value-row">
          <span className="vpn-ip-value">{currentIp}</span>
          {report?.ipInfo?.ip && (
            <button
              type="button"
              className="rz-icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => handleCopyText(report.ipInfo!.ip, 'Endereço IP')}
              aria-label="Copiar endereço IP"
            >
              {copiedField === 'Endereço IP' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
        </div>
        <span className="vpn-ip-meta">
          {report?.checks.ip.detail ||
            (context === 'ext'
              ? 'Ligue a extensão pelo ícone na barra do navegador e verifique.'
              : 'Ative o túnel no app WireGuard e verifique.')}
        </span>
      </div>
    </div>
  );

  /** Grade de resultados do checkup */
  const renderResults = () => {
    const items: { key: string; icon: React.ReactNode; label: string; res?: CheckResult }[] = [
      { key: 'ip', icon: <Wifi size={12} />, label: 'IP Público', res: report?.checks.ip },
      { key: 'webrtc', icon: <Network size={12} />, label: 'WebRTC', res: report?.checks.webrtc },
      { key: 'dns', icon: <Server size={12} />, label: 'DNS', res: report?.checks.dns },
      { key: 'locale', icon: <Clock size={12} />, label: 'Fuso / Idioma', res: report?.checks.locale },
      { key: 'geo', icon: <MapPin size={12} />, label: 'Geolocalização', res: report?.checks.geolocation },
    ];
    return (
      <section className="rz-panel vpn-check-panel" aria-label="Resultados da verificação">
        <div className="vpn-check-head">
          <span className="rz-stat-label">Checkup de Proteção</span>
          <span className="rz-help rz-font-mono">
            {report ? `Testado às ${new Date(report.testedAt).toLocaleTimeString('pt-BR')}` : 'Aguardando...'}
          </span>
        </div>
        <div className="vpn-check-grid">
          {items.map(({ key, icon, label, res }) => {
            const status: CheckStatus = isChecking && !res ? 'running' : res?.status ?? 'skipped';
            return (
              <div key={key} className={`vpn-check-card is-${status}`}>
                <div className="vpn-check-card-top">
                  <span className="rz-stat-label">
                    {icon} {label}
                  </span>
                  <span className="vpn-check-icon">{STATUS_ICON[status]}</span>
                </div>
                <div className="vpn-check-title">{res?.title ?? (isChecking ? 'Verificando...' : 'Não executado')}</div>
                <div className="vpn-check-detail">{res?.detail ?? ''}</div>
              </div>
            );
          })}
        </div>
        <div className="vpn-check-foot">
          <span className="rz-help">
            {report?.baseline
              ? `Seu IP real salvo neste dispositivo: ${report.baseline.ip}`
              : 'IP real ainda não salvo: verifique uma vez com a VPN desligada para comparar.'}
          </span>
          {report?.baseline && (
            <button type="button" className="rz-btn rz-btn-ghost rz-btn-sm" onClick={handleResetBaseline}>
              Esquecer IP real
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content" fullscreen>
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Rede Criptografada"
            title="Túnel VPN & Proteção de Rede"
            subtitle="Ligue a proteção pela extensão ou pelo app WireGuard instalado. Aqui você verifica se ela está realmente funcionando."
            actions={
              <>
                <span className={`rz-badge ${isChecking ? 'rz-badge-blue' : verdictUi.badge}`}>
                  <span className={`rz-dot ${isChecking ? 'info' : verdictUi.dot}`} />
                  {isChecking ? 'Verificando...' : verdictUi.label}
                </span>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isChecking}
                  className="rz-btn rz-btn-secondary rz-btn-sm"
                >
                  <RefreshCw size={14} className={isChecking ? 'rz-spin' : ''} />
                  <span>{isChecking ? 'Verificando...' : 'Verificar Proteção'}</span>
                </button>
              </>
            }
          />

          {/* ==================== SELETOR DE MODO (EXTENSÃO VS WIREGUARD PC) ==================== */}
          <div className="vpn-mode-selector-wrap">
            <div className="vpn-mode-selector" role="tablist" aria-label="Modo de Operação VPN">
              <button
                type="button"
                role="tab"
                aria-selected={activeMode === 'browser-ext'}
                onClick={() => setActiveMode('browser-ext')}
                className={`vpn-mode-tab ${activeMode === 'browser-ext' ? 'is-active' : ''}`}
              >
                <div className="vpn-mode-tab-icon">
                  <Globe size={18} />
                </div>
                <div className="vpn-mode-tab-text">
                  <span className="vpn-mode-tab-title">1. Extensão de Navegador (Chrome / Edge)</span>
                  <span className="vpn-mode-tab-sub">
                    Protege suas abas web sem instalar executável no PC
                  </span>
                </div>
                {extState.isInstalled && (
                  <span className="rz-badge rz-badge-success" style={{ marginLeft: 'auto' }}>
                    Instalada
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeMode === 'wireguard-pc'}
                onClick={() => setActiveMode('wireguard-pc')}
                className={`vpn-mode-tab ${activeMode === 'wireguard-pc' ? 'is-active' : ''}`}
              >
                <div className="vpn-mode-tab-icon violet">
                  <Monitor size={18} />
                </div>
                <div className="vpn-mode-tab-text">
                  <span className="vpn-mode-tab-title">2. WireGuard Oficial (Computador Inteiro)</span>
                  <span className="vpn-mode-tab-sub">
                    Perfil .conf de nível de kernel para Windows, Mac e Linux
                  </span>
                </div>
                <span className="rz-badge rz-badge-violet" style={{ marginLeft: 'auto' }}>
                  Sistema PC
                </span>
              </button>
            </div>
          </div>

          {/* ==================== MODO 1: EXTENSÃO DE NAVEGADOR ==================== */}
          {activeMode === 'browser-ext' && (
            <div className="vpn-layout">
              {/* Coluna Esquerda: Verificação de Proteção */}
              <div className="vpn-col">
                <section
                  className={`vpn-reactor-panel rz-meridian-bg ${verdict === 'protected' ? 'is-connected' : isChecking ? 'is-connecting' : ''}`}
                  aria-label="Verificação de proteção do navegador"
                >
                  <div className="vpn-reactor-top">
                    <div className={`vpn-status-pill ${isChecking ? 'is-connecting' : verdictUi.pill}`}>
                      <span className={`rz-dot ${isChecking ? 'info' : verdictUi.dot}`} />
                      <span>{isChecking ? 'Verificando...' : verdictUi.label}</span>
                    </div>
                    <span className="vpn-uptime" title="Estado lido da extensão">
                      {!extState.isInstalled ? 'SEM EXTENSÃO' : extState.isConnected ? 'EXT: LIGADA' : 'EXT: DESLIGADA'}
                    </span>
                  </div>

                  {renderReactor('ext')}

                  {/* Ação Principal */}
                  <div className="vpn-thumb-bar">
                    {!extState.isInstalled ? (
                      <button
                        type="button"
                        onClick={handleDownloadExtension}
                        className="rz-btn rz-btn-lg rz-btn-block rz-btn-primary"
                      >
                        <Download size={16} />
                        <span>Baixar Extensão SeguranApp (.zip)</span>
                      </button>
                    ) : (
                      <>
                        <p className="vpn-ext-hint">
                          <Puzzle size={14} />
                          <span>
                            Ligue/desligue e troque o servidor pelo <strong>ícone da extensão</strong> na barra do navegador.
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={handleVerify}
                          disabled={isChecking}
                          className="rz-btn rz-btn-lg rz-btn-block rz-btn-secondary"
                        >
                          <RefreshCw size={16} className={isChecking ? 'rz-spin' : ''} />
                          <span>{isChecking ? 'Verificando...' : 'Verificar novamente'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </section>

                {renderResults()}
              </div>

              {/* Coluna Direita: Gerenciamento da Extensão & Tutorial */}
              <div className="vpn-col">
                <section className="rz-panel">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className="rz-icon-tile">
                        <Globe />
                      </div>
                      <div>
                        <h2 className="rz-card-title">Como Funciona a Extensão</h2>
                        <p className="rz-text-muted">
                          Roteia e camufla as requisições das abas do Chrome e Edge.
                        </p>
                      </div>
                    </div>
                    <span className="rz-badge rz-badge-blue">100% no Browser</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--rz-text-sm)', color: 'var(--rz-text-secondary)' }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--rz-success)', flexShrink: 0 }} />
                      <span>
                        <strong style={{ color: 'var(--rz-text-primary)' }}>Sem permissões de administrador:</strong> roda direto no navegador.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--rz-text-sm)', color: 'var(--rz-text-secondary)' }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--rz-success)', flexShrink: 0 }} />
                      <span>
                        <strong style={{ color: 'var(--rz-text-primary)' }}>Isolamento por abas:</strong> protege seu tráfego sem afetar outros programas.
                      </span>
                    </div>
                  </div>

                  {/* Estado da extensão (somente leitura) */}
                  <div
                    className="rz-stat-box"
                    style={{
                      marginBottom: 16,
                      borderColor: extState.isInstalled
                        ? 'var(--rz-success-line)'
                        : 'var(--rz-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className={`rz-badge ${extState.isInstalled ? 'rz-badge-success' : 'rz-badge-warning'}`}>
                        <span className={`rz-dot ${extState.isInstalled ? 'success is-live' : 'warning'}`} />
                        {extState.isInstalled ? 'EXTENSÃO RECONHECIDA NO SITE' : 'EXTENSÃO AINDA NÃO ATIVADA'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          BrowserExtensionService.ping();
                          setToastMessage('Verificando extensão...');
                        }}
                        className="rz-btn rz-btn-ghost rz-btn-sm"
                        style={{ height: 26, padding: '0 8px' }}
                      >
                        <RefreshCw size={12} />
                        <span>Sincronizar</span>
                      </button>
                    </div>

                    {extState.isInstalled && (
                      <div className="rz-setting-row" style={{ paddingBottom: 0 }}>
                        <span className="rz-label" style={{ marginBottom: 0 }}>
                          Estado na extensão:
                        </span>
                        <span className="rz-font-mono" style={{ fontSize: 'var(--rz-text-sm)', color: 'var(--rz-text-primary)' }}>
                          {extStatusLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botões de Ação */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={handleDownloadExtension}
                      className="rz-btn rz-btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Download size={16} />
                      <span>Baixar Extensão (.zip)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBrowserTutorial(!showBrowserTutorial)}
                      className="rz-btn rz-btn-secondary"
                    >
                      <span>{showBrowserTutorial ? 'Ocultar Tutorial' : 'Como Ativar no Navegador'}</span>
                      {showBrowserTutorial ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {/* Tutorial Colapsável */}
                  {showBrowserTutorial && (
                    <div className="vpn-steps">
                      <div className="vpn-step">
                        <span className="vpn-step-num">1</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Extraia o arquivo .zip</p>
                          <p style={{ margin: 0 }}>
                            Descompacte o arquivo <code>seguranapp-extension.zip</code> em qualquer pasta do seu computador.
                          </p>
                        </div>
                      </div>
                      <div className="vpn-step">
                        <span className="vpn-step-num">2</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Abra as extensões do navegador</p>
                          <p style={{ margin: '0 0 6px' }}>
                            Acesse <code>chrome://extensions</code> no Chrome ou <code>edge://extensions</code> no Edge e marque a chave <strong>Modo do Desenvolvedor</strong> no canto superior.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopyText('chrome://extensions', 'Endereço')}
                            className="rz-btn rz-btn-secondary rz-btn-sm"
                          >
                            <Copy size={13} />
                            <span>Copiar chrome://extensions</span>
                          </button>
                        </div>
                      </div>
                      <div className="vpn-step">
                        <span className="vpn-step-num">3</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Carregue a pasta descompactada</p>
                          <p style={{ margin: 0 }}>
                            Clique no botão <strong>Carregar sem compactação</strong> (Load Unpacked) e selecione a pasta extraída. Pronto!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* ==================== MODO 2: WIREGUARD PC (SISTEMA COMPLETO) ==================== */}
          {activeMode === 'wireguard-pc' && (
            <div className="vpn-layout">
              {/* Coluna Esquerda: Reator e Seleção do Perfil .conf */}
              <div className="vpn-col">
                <section
                  className={`vpn-reactor-panel rz-meridian-bg ${verdict === 'protected' ? 'is-connected' : isChecking ? 'is-connecting' : ''}`}
                  aria-label="Verificação de proteção do computador"
                >
                  <div className="vpn-reactor-top">
                    <div className={`vpn-status-pill ${isChecking ? 'is-connecting' : verdictUi.pill}`}>
                      <span className={`rz-dot ${isChecking ? 'info' : verdictUi.dot}`} />
                      <span>{isChecking ? 'Verificando...' : verdictUi.label.replace('Navegador', 'Computador')}</span>
                    </div>

                    <span className="vpn-uptime" title="Perfil .conf selecionado">
                      {vpnStats.selectedServer.name}
                    </span>
                  </div>

                  {renderReactor('wg')}

                  {/* Ação: Baixar Perfil */}
                  <div className="vpn-thumb-bar">
                    <button
                      type="button"
                      onClick={handleDownloadConf}
                      className="rz-btn rz-btn-lg rz-btn-block rz-btn-premium"
                    >
                      <Download size={18} />
                      <span>Baixar Perfil .conf ({vpnStats.selectedServer.city || vpnStats.selectedServer.name})</span>
                    </button>
                  </div>
                </section>

                {renderResults()}

                {/* Chave Pública do Cliente e Kill Switch */}
                <section className="rz-panel">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className="rz-icon-tile violet">
                        <Lock />
                      </div>
                      <div>
                        <h2 className="rz-card-title">Par de Chaves &amp; Kill-Switch</h2>
                        <p className="rz-text-muted">
                          Criptografia assimétrica Curve25519 e proteção contra queda de pacote.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rz-setting-row" style={{ paddingTop: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--rz-text-primary)', fontSize: 'var(--rz-text-md)' }}>
                        Kill-Switch Determinístico
                      </div>
                      <div className="rz-help">
                        Bloqueia qualquer vazamento de tráfego se a conexão cair.
                      </div>
                    </div>
                    <IonToggle
                      checked={vpnStats.killSwitchEnabled}
                      onIonChange={() => VpnService.toggleKillSwitch()}
                      aria-label="Ativar Kill-Switch"
                    />
                  </div>

                  {vpnStats.clientPublicKey && (
                    <div style={{ paddingTop: 12 }}>
                      <span className="rz-stat-label">Sua Chave Pública do Cliente (Curve25519)</span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          background: 'var(--rz-bg-deep)',
                          border: '1px solid var(--rz-border)',
                          borderRadius: 'var(--rz-radius-sm)',
                          padding: '8px 12px',
                        }}
                      >
                        <code
                          className="rz-truncate"
                          style={{ fontSize: 'var(--rz-text-xs)', color: 'var(--rz-text-secondary)' }}
                        >
                          {vpnStats.clientPublicKey}
                        </code>
                        <button
                          type="button"
                          className="rz-icon-btn"
                          style={{ width: 28, height: 28 }}
                          onClick={() => handleCopyText(vpnStats.clientPublicKey || '', 'Chave pública')}
                          aria-label="Copiar chave pública"
                        >
                          {copiedField === 'Chave pública' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Coluna Direita: Como Instalar no PC */}
              <div className="vpn-col">
                {/* Painel: Cliente Oficial WireGuard */}
                <section className="rz-panel">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className="rz-icon-tile violet">
                        <Monitor />
                      </div>
                      <div>
                        <h2 className="rz-card-title">Como Ativar no Computador</h2>
                        <p className="rz-text-muted">
                          Passo simples com o aplicativo oficial do WireGuard.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rz-grid-2" style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={handleDownloadConf}
                      className="rz-btn rz-btn-primary"
                    >
                      <Download size={16} />
                      <span>1. Baixar .conf</span>
                    </button>

                    <a
                      href="https://download.wireguard.com/windows-client/wireguard-installer.exe"
                      target="_blank"
                      rel="noreferrer"
                      className="rz-btn rz-btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink size={16} />
                      <span>2. WireGuard Oficial (.exe)</span>
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowConfPreview(!showConfPreview)}
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      style={{ flex: 1 }}
                    >
                      <FileCode size={14} />
                      <span>{showConfPreview ? 'Ocultar Arquivo .conf' : 'Inspecionar Perfil .conf'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWindowsTutorial(!showWindowsTutorial)}
                      className="rz-btn rz-btn-ghost rz-btn-sm"
                      style={{ flex: 1 }}
                    >
                      <span>{showWindowsTutorial ? 'Ocultar Tutorial' : 'Passo a Passo de Instalação'}</span>
                      {showWindowsTutorial ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {showConfPreview && configPreview && (
                    <div style={{ marginBottom: 14 }}>
                      <pre className="vpn-conf-box">{configPreview}</pre>
                      <button
                        type="button"
                        onClick={() => handleCopyText(configPreview, 'Configuração WireGuard')}
                        className="rz-btn rz-btn-secondary rz-btn-sm rz-btn-block"
                      >
                        <Copy size={14} />
                        <span>Copiar Texto .conf</span>
                      </button>
                    </div>
                  )}

                  {showWindowsTutorial && (
                    <div className="vpn-steps">
                      <div className="vpn-step">
                        <span className="vpn-step-num">1</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Instale o WireGuard no PC</p>
                          <p style={{ margin: 0 }}>
                            Baixe e execute o instalador oficial <code>wireguard-installer.exe</code>.
                          </p>
                        </div>
                      </div>
                      <div className="vpn-step">
                        <span className="vpn-step-num">2</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Importe o arquivo .conf</p>
                          <p style={{ margin: 0 }}>
                            Abra o WireGuard, clique em <strong>Adicionar Túnel</strong> ou aperte <kbd className="rz-kbd">Ctrl + O</kbd> e escolha o arquivo baixado.
                          </p>
                        </div>
                      </div>
                      <div className="vpn-step">
                        <span className="vpn-step-num">3</span>
                        <div className="vpn-step-body">
                          <p className="vpn-step-title">Clique em Ativar</p>
                          <p style={{ margin: 0 }}>
                            O status ficará verde e todo o tráfego de todos os programas estará 100% criptografado!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* ==================== AVISO DE ESCLARECIMENTO FINAL ==================== */}
          <div className="rz-alert rz-alert-info" style={{ marginTop: 24 }}>
            <Info size={18} />
            <div>
              <strong>Qual escolher?</strong> Use a <strong>Extensão</strong> se quiser apenas navegar de forma anônima e rápida nas abas do Chrome ou Edge sem precisar instalar programas. Use o <strong>WireGuard PC</strong> se quiser proteger o computador inteiro (jogos, terminal, discord, torrent e outros aplicativos do sistema).
            </div>
          </div>
        </div>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={3000}
          onDidDismiss={() => setToastMessage('')}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
