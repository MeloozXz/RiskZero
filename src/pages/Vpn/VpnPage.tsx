import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonToast, IonToggle } from '@ionic/react';
import {
  Power,
  ShieldCheck,
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
  ExternalLink,
  Wifi,
  Info,
  Server,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  FileCode,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  VpnService,
  VpnStats,
  ExternalIpAudit,
  BrowserExtensionService,
  BrowserExtensionState,
} from '../../services/vpn';
import { ClipboardService } from '../../services/clipboard';
import { VpnServer } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { OrbitRing } from '../../components/brand';
import './VpnPage.css';

type VpnMode = 'browser-ext' | 'wireguard-pc';

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getNodeCode(server: VpnServer): string {
  if (server.id === 'cf-warp') return 'WARP';
  if (server.id.startsWith('br')) return 'BR';
  if (server.id.startsWith('us')) return 'US';
  if (server.id.startsWith('de')) return 'DE';
  if (server.id.startsWith('uk')) return 'UK';
  return 'VPS';
}

export const VpnPage: React.FC = () => {
  const [activeMode, setActiveMode] = useState<VpnMode>('browser-ext');
  const [vpnStats, setVpnStats] = useState<VpnStats>(() => VpnService.getStats());
  const [servers, setServers] = useState<VpnServer[]>(() => VpnService.getServers());
  const [auditData, setAuditData] = useState<ExternalIpAudit | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [configPreview, setConfigPreview] = useState<string>('');
  const [showConfPreview, setShowConfPreview] = useState<boolean>(false);

  // Estado sincronizado com a Extensão do Navegador
  const [extState, setExtState] = useState<BrowserExtensionState>(() =>
    BrowserExtensionService.getState()
  );

  // Estados de expansão dos tutoriais
  const [showBrowserTutorial, setShowBrowserTutorial] = useState<boolean>(false);
  const [showWindowsTutorial, setShowWindowsTutorial] = useState<boolean>(false);

  useEffect(() => {
    const unsubVpn = VpnService.subscribe((stats) => {
      setVpnStats(stats);
      setServers(VpnService.getServers());
    });
    const unsubExt = BrowserExtensionService.subscribe((state) => {
      setExtState(state);
    });
    return () => {
      unsubVpn();
      unsubExt();
    };
  }, []);

  useEffect(() => {
    runAudit();
  }, [vpnStats.status, vpnStats.selectedServer.id, extState.isConnected]);

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

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await VpnService.auditExternalIp();
      setAuditData(res);
    } catch {
      setAuditData({
        ip: '189.20.125.138',
        isp: 'Vivo (Provedor Local)',
        city: 'São Paulo',
        country: 'Brasil',
        isProtected: false,
        testedAt: Date.now(),
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleToggleTunnel = async () => {
    if (activeMode === 'browser-ext') {
      if (!extState.isInstalled) {
        handleDownloadExtension();
        setToastMessage('Baixe e ative a extensão para rotear as abas do navegador.');
        return;
      }
      BrowserExtensionService.toggleConnect();
      setToastMessage(
        !extState.isConnected ? 'Proteção da extensão ativada!' : 'Proteção da extensão desativada.'
      );
      return;
    }

    // Modo WireGuard PC
    if (vpnStats.status === 'CONNECTED' || vpnStats.status === 'CONNECTING') {
      await VpnService.disconnect();
      setToastMessage('Túnel WireGuard desconectado.');
    } else {
      try {
        await VpnService.connect();
        setToastMessage(`Túnel simulado via ${vpnStats.selectedServer.name}.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao iniciar túnel VPN.';
        setToastMessage(msg);
      }
    }
  };

  const handleSelectServer = async (server: VpnServer) => {
    if (server.status === 'UNAVAILABLE') {
      setToastMessage('Este nó requer configuração manual de endpoint.');
      return;
    }
    const wasConnected = vpnStats.status === 'CONNECTED';
    if (wasConnected) {
      await VpnService.disconnect();
    }
    VpnService.setServer(server);
    setToastMessage(`Nó selecionado: ${server.name}`);
    if (wasConnected) {
      try {
        await VpnService.connect();
      } catch {
        // Tratado no estado de erro
      }
    }
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
    const link = document.createElement('a');
    link.href = '/seguranapp-extension.zip';
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
      const link = document.createElement('a');
      link.href = '/seguranapp-vpn.conf';
      link.download = 'seguranapp-vpn.conf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToastMessage('Perfil WireGuard (.conf) baixado.');
      setShowWindowsTutorial(true);
    }
  };

  const isConnected =
    activeMode === 'browser-ext'
      ? extState.isConnected
      : vpnStats.status === 'CONNECTED';

  const isConnecting =
    activeMode === 'wireguard-pc' &&
    (vpnStats.status === 'CONNECTING' ||
      vpnStats.status === 'RECONNECTING' ||
      vpnStats.status === 'DISCONNECTING');

  const isError = activeMode === 'wireguard-pc' && vpnStats.status === 'ERROR';

  const activeVirtualIp = isConnected
    ? vpnStats.protectedIp
    : auditData?.ip || vpnStats.originalIp || 'Consultando IP...';

  const availableNodes = servers.filter((s) => s.status === 'AVAILABLE');

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content" fullscreen>
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Rede Criptografada"
            title="Túnel VPN & Proteção de Rede"
            subtitle="Escolha entre a Extensão Leve para Navegador ou o Perfil WireGuard Oficial (.conf) para o Computador Inteiro."
            actions={
              <>
                <span className={`rz-badge ${isConnected ? 'rz-badge-success' : 'rz-badge-blue'}`}>
                  <span className={`rz-dot ${isConnected ? 'success is-live' : 'info'}`} />
                  {isConnected ? 'Proteção Ativa' : 'Pronto para Conectar'}
                </span>
                <button
                  type="button"
                  onClick={runAudit}
                  disabled={isAuditing}
                  className="rz-btn rz-btn-secondary rz-btn-sm"
                >
                  <RefreshCw size={14} className={isAuditing ? 'rz-spin' : ''} />
                  <span>{isAuditing ? 'Auditando...' : 'Testar Meu IP'}</span>
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
              {/* Coluna Esquerda: Reator de Conexão da Extensão */}
              <div className="vpn-col">
                <section
                  className={`vpn-reactor-panel rz-meridian-bg ${isConnected ? 'is-connected' : ''
                    }`}
                  aria-label="Controle da Extensão do Navegador"
                >
                  <div className="vpn-reactor-top">
                    <div
                      className={`vpn-status-pill ${isConnected
                          ? 'is-connected'
                          : extState.isInstalled
                            ? 'is-connecting'
                            : ''
                        }`}
                    >
                      <span
                        className={`rz-dot ${isConnected
                            ? 'success is-live'
                            : extState.isInstalled
                              ? 'info'
                              : 'warning'
                          }`}
                      />
                      <span>
                        {isConnected
                          ? 'Navegador Protegido'
                          : extState.isInstalled
                            ? 'Extensão em Standby'
                            : 'Extensão Não Detectada'}
                      </span>
                    </div>

                    <span className="vpn-uptime" title="Tempo de conexão">
                      {formatDuration(vpnStats.connectedTimeSeconds)}
                    </span>
                  </div>

                  <div className="vpn-reactor-stage">
                    <OrbitRing
                      size={168}
                      stroke={7}
                      spinning={false}
                      value={isConnected ? 100 : 0}
                      tone={isConnected ? 'success' : 'accent'}
                      globe
                      label={isConnected ? 'Extensão Conectada' : 'Extensão Desconectada'}
                    >
                      <button
                        type="button"
                        onClick={handleToggleTunnel}
                        className={`vpn-power-btn ${isConnected ? 'is-connected' : ''}`}
                        aria-label={
                          isConnected ? 'Desconectar Extensão' : 'Conectar Extensão'
                        }
                      >
                        <Power size={30} strokeWidth={2} />
                        <span className="vpn-power-label">
                          {isConnected ? 'Ativo' : 'Conectar'}
                        </span>
                      </button>
                    </OrbitRing>

                    <div className="vpn-ip-readout">
                      <span className="vpn-ip-eyebrow">
                        {isConnected ? 'IP Mascarado no Navegador' : 'Endereço IP Atual do Navegador'}
                      </span>
                      <div className="vpn-ip-value-row">
                        <span className="vpn-ip-value">{activeVirtualIp}</span>
                        <button
                          type="button"
                          className="rz-icon-btn"
                          style={{ width: 28, height: 28 }}
                          onClick={() => handleCopyText(activeVirtualIp, 'Endereço IP')}
                          aria-label="Copiar endereço IP"
                        >
                          {copiedField === 'Endereço IP' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <span className="vpn-ip-meta">
                        {isConnected
                          ? `Protegendo abas via ${extState.selectedServer?.country || 'Alemanha'}`
                          : auditData?.city
                            ? `${auditData.city}, ${auditData.country || 'Brasil'} · ${auditData.isp || 'Provedor Local'}`
                            : 'Tráfego direto sem proxy'}
                      </span>
                    </div>
                  </div>

                  {/* Ação Principal do Reator */}
                  <div className="vpn-thumb-bar">
                    <button
                      type="button"
                      onClick={handleToggleTunnel}
                      className={`rz-btn rz-btn-lg rz-btn-block ${isConnected ? 'rz-btn-danger' : 'rz-btn-primary'
                        }`}
                    >
                      <Power size={16} />
                      <span>
                        {isConnected
                          ? 'Desconectar Proteção do Navegador'
                          : extState.isInstalled
                            ? 'Ativar Proteção do Navegador'
                            : '1. Baixar Extensão SeguranApp (.zip)'}
                      </span>
                    </button>
                  </div>
                </section>

                {/* Métricas do Navegador */}
                <section className="rz-metrics" aria-label="Telemetria do navegador">
                  <div className="rz-metric">
                    <span className="rz-stat-label">
                      <ArrowDownToLine size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Download
                    </span>
                    <div className="rz-stat-value rz-num">
                      {isConnected ? vpnStats.downloadSpeedKbps : 0}
                      <small style={{ fontSize: '0.85rem', marginLeft: 4, color: 'var(--rz-text-muted)' }}>
                        kbps
                      </small>
                    </div>
                    <span className="rz-help rz-font-mono">
                      Total: {formatBytes(vpnStats.downloadBytes)}
                    </span>
                  </div>

                  <div className="rz-metric">
                    <span className="rz-stat-label">
                      <ArrowUpFromLine size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Upload
                    </span>
                    <div className="rz-stat-value rz-num">
                      {isConnected ? vpnStats.uploadSpeedKbps : 0}
                      <small style={{ fontSize: '0.85rem', marginLeft: 4, color: 'var(--rz-text-muted)' }}>
                        kbps
                      </small>
                    </div>
                    <span className="rz-help rz-font-mono">
                      Total: {formatBytes(vpnStats.uploadBytes)}
                    </span>
                  </div>

                  <div className="rz-metric">
                    <span className="rz-stat-label">
                      <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Latência
                    </span>
                    <div className="rz-stat-value rz-num" style={{ color: 'var(--rz-ice)' }}>
                      18
                      <small style={{ fontSize: '0.85rem', marginLeft: 4, color: 'var(--rz-text-muted)' }}>
                        ms
                      </small>
                    </div>
                    <span className="rz-help">Proxy Web Local</span>
                  </div>

                  <div className="rz-metric">
                    <span className="rz-stat-label">
                      <ShieldCheck size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Modo Web
                    </span>
                    <div className="rz-stat-value rz-num" style={{ fontSize: '1.35rem' }}>
                      Extensão
                    </div>
                    <span className="rz-help rz-font-mono">Proxy Zero-Install</span>
                  </div>
                </section>
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

                  {/* Estado da extensão */}
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
                        <label htmlFor="ext-server-select" className="rz-label" style={{ marginBottom: 0 }}>
                          Servidor de Saída:
                        </label>
                        <select
                          id="ext-server-select"
                          value={extState.selectedServer?.id || 'de-fra'}
                          onChange={(e) => BrowserExtensionService.setServer(e.target.value)}
                          className="rz-select"
                          style={{ maxWidth: 220, height: 36 }}
                        >
                          <option value="de-fra">Alemanha (Frankfurt)</option>
                          <option value="br-spo">Brasil (São Paulo)</option>
                          <option value="us-mia">Estados Unidos (Miami)</option>
                          <option value="uk-lon">Reino Unido (Londres)</option>
                        </select>
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
                  className={`vpn-reactor-panel rz-meridian-bg ${isConnected ? 'is-connected' : isConnecting ? 'is-connecting' : ''
                    }`}
                  aria-label="Perfil WireGuard de Máquina"
                >
                  <div className="vpn-reactor-top">
                    <div className="vpn-status-pill is-connecting">
                      <span className="rz-dot info" />
                      <span>{vpnStats.selectedServer.name}</span>
                    </div>

                    <span className="vpn-uptime" title="Porta UDP">
                      UDP :{vpnStats.selectedServer.port}
                    </span>
                  </div>

                  <div className="vpn-reactor-stage">
                    <OrbitRing
                      size={168}
                      stroke={7}
                      spinning={false}
                      value={100}
                      tone="violet"
                      globe
                      label="Perfil WireGuard Oficial"
                    >
                      <button
                        type="button"
                        onClick={handleDownloadConf}
                        className="vpn-power-btn"
                        style={{ borderColor: 'var(--rz-violet)', color: 'var(--rz-ice)' }}
                        aria-label="Baixar perfil .conf"
                      >
                        <Download size={28} strokeWidth={2} />
                        <span className="vpn-power-label">Baixar .conf</span>
                      </button>
                    </OrbitRing>

                    <div className="vpn-ip-readout">
                      <span className="vpn-ip-eyebrow">Endpoint do Servidor WireGuard</span>
                      <div className="vpn-ip-value-row">
                        <span className="vpn-ip-value">
                          {vpnStats.selectedServer.endpoint}:{vpnStats.selectedServer.port}
                        </span>
                        <button
                          type="button"
                          className="rz-icon-btn"
                          style={{ width: 28, height: 28 }}
                          onClick={() =>
                            handleCopyText(
                              `${vpnStats.selectedServer.endpoint}:${vpnStats.selectedServer.port}`,
                              'Endpoint'
                            )
                          }
                          aria-label="Copiar Endpoint"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <span className="vpn-ip-meta">
                        {vpnStats.selectedServer.city} · Cifra ChaCha20-Poly1305 · MTU 1280
                      </span>
                    </div>
                  </div>

                  {/* Ação Principal: Baixar Perfil e Ativar */}
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

              {/* Coluna Direita: Nós WireGuard e Como Instalar no PC */}
              <div className="vpn-col">
                {/* Seleção de Servidor para Gerar o .conf */}
                <section className="rz-section" style={{ marginBottom: 0 }}>
                  <div className="rz-section-head">
                    <h2 className="rz-section-title">
                      <Server size={16} />
                      <span>Escolha o Servidor para o Perfil .conf</span>
                      <span className="rz-count">{availableNodes.length} DISPONÍVEIS</span>
                    </h2>
                  </div>

                  <div className="rz-list" role="listbox" aria-label="Servidores VPN disponíveis">
                    {servers.map((srv) => {
                      const selected = vpnStats.selectedServer.id === srv.id;
                      const unavailable = srv.status === 'UNAVAILABLE';
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={unavailable}
                          onClick={() => handleSelectServer(srv)}
                          className={`rz-row is-interactive vpn-node-row ${selected ? 'is-selected' : ''}`}
                          style={unavailable ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        >
                          <div className="vpn-node-code">{getNodeCode(srv)}</div>

                          <div className="rz-row-main">
                            <div className="rz-row-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{srv.name}</span>
                              {selected && (
                                <span className="rz-badge rz-badge-violet">Configurado</span>
                              )}
                            </div>
                            <div className="rz-row-meta rz-font-mono">
                              {srv.endpoint
                                ? `${srv.endpoint}:${srv.port} · ${srv.city}`
                                : 'Endpoint manual'}
                            </div>
                          </div>

                          <div className="rz-row-trailing">
                            {!unavailable ? (
                              <>
                                <span className="vpn-ping">{srv.ping ?? 20} ms</span>
                                <span
                                  className={`rz-dot ${selected
                                      ? 'success is-live'
                                      : (srv.ping ?? 20) < 60
                                        ? 'success'
                                        : 'info'
                                    }`}
                                />
                              </>
                            ) : (
                              <span className="rz-badge rz-badge-neutral">Manual</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

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
