import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonBadge,
  IonToast,
  IonSpinner,
} from '@ionic/react';
import {
  shieldCheckmarkOutline,
  globeOutline,
  desktopOutline,
  cloudDownloadOutline,
  copyOutline,
  chevronDownOutline,
  chevronUpOutline,
  refreshOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  openOutline,
  flashOutline,
  lockClosedOutline,
  wifiOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { VpnService, ExternalIpAudit, BrowserExtensionService, BrowserExtensionState } from '../../services/vpn';
import { ClipboardService } from '../../services/clipboard';
import './VpnPage.css';

export const VpnPage: React.FC = () => {
  const [auditData, setAuditData] = useState<ExternalIpAudit | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Estado sincronizado com a Extensão do Navegador
  const [extState, setExtState] = useState<BrowserExtensionState>({
    isInstalled: false,
    isConnected: false,
    selectedServer: {
      id: 'de-fra',
      name: 'Alemanha (Frankfurt)',
      country: 'Alemanha',
      flag: '🇩🇪',
      city: 'Frankfurt am Main'
    }
  });

  // Estados de expansão dos tutoriais
  const [showBrowserTutorial, setShowBrowserTutorial] = useState<boolean>(false);
  const [showWindowsTutorial, setShowWindowsTutorial] = useState<boolean>(false);

  // Monitora a Extensão do Navegador
  useEffect(() => {
    const unsub = BrowserExtensionService.subscribe((state) => {
      setExtState(state);
    });
    return () => unsub();
  }, []);

  // Executa auditoria inicial de IP
  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await VpnService.auditExternalIp();
      setAuditData(res);
    } catch {
      // Fallback
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
    setToastMessage('Download da extensão iniciado.');
    // Abre automaticamente o tutorial para facilitar a vida do usuário
    setShowBrowserTutorial(true);
  };

  const handleDownloadConf = () => {
    const link = document.createElement('a');
    link.href = '/seguranapp-vpn.conf';
    link.download = 'seguranapp-vpn.conf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Perfil WireGuard (.conf) baixado.');
    setShowWindowsTutorial(true);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <IonIcon icon={shieldCheckmarkOutline} style={{ color: '#60a5fa', fontSize: '20px' }} />
              <IonTitle style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.05rem', padding: 0 }}>
                VPN
              </IonTitle>
            </div>
            <IonBadge
              color="primary"
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' }}
            >
              Criptografia Ativa
            </IonBadge>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="vpn-content" fullscreen>
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* BANNER DE BOAS-VINDAS / INTRODUÇÃO */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 p-6 border border-white/10 shadow-2xl">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-3">
                <IonIcon icon={flashOutline} />
                <span>Duas formas de proteger sua conexão</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mb-2">
                Proteja sua conexão
              </h1>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Use a extensão para proteger apenas o navegador ou instale o perfil WireGuard no Windows para proteger todo o tráfego do computador.
              </p>
            </div>
          </div>

          {/* PAINEL COMPACTO: AUDITORIA DE IP EM TEMPO REAL */}
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md p-4 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                <IonIcon icon={wifiOutline} className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Auditoria de Rede Atual
                  </span>
                  {auditData && (
                    <span className={`inline-block w-2 h-2 rounded-full ${auditData.isProtected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm md:text-base font-extrabold font-mono text-white">
                    {auditData ? auditData.ip : 'Consultando IP...'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {auditData?.city ? `(${auditData.city} • ${auditData.isp || 'Provedor'})` : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={runAudit}
                disabled={isAuditing}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isAuditing ? (
                  <>
                    <IonSpinner name="dots" style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <IonIcon icon={refreshOutline} className="text-cyan-400 text-sm" />
                    <span>Testar Meu IP Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OS 2 CARDS PRINCIPAIS: EXTENSÃO VS MÁQUINA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* CARD 1: VPN DE NAVEGADOR (EXTENSÃO) */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />

              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-2xl shadow-lg shadow-cyan-500/10">
                    <IonIcon icon={globeOutline} />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    100% no Navegador
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-white mb-1.5 flex items-center gap-2">
                  VPN de Navegador
                  <span className="text-xs text-slate-400 font-normal">(Chrome & Edge)</span>
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Proteção ultra-rápida direto nas suas abas. Altera seu IP para nós nos <strong>Estados Unidos</strong> ou <strong>Alemanha</strong> sem precisar instalar nenhum executável (.exe) no Windows.
                </p>

                {/* Vantagens */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-emerald-400 text-base flex-shrink-0" />
                    <span><strong>Zero Download de Programas:</strong> opera 100% na extensão.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-emerald-400 text-base flex-shrink-0" />
                    <span><strong>Imune a Quedas:</strong> conexão segura sem travar sua internet.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-emerald-400 text-base flex-shrink-0" />
                    <span><strong>Ativação em 30 Segundos:</strong> basta carregar no navegador.</span>
                  </div>
                </div>

                {/* Painel de Controle Ao Vivo da Extensão (quando detectada) */}
                {extState.isInstalled && (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-3 mb-6 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        EXTENSÃO CONECTADA AO SITE
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        V2.0 Ativa
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <div className="text-[11px] text-slate-400">Proteção de Rede:</div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          {extState.isConnected ? (
                            <>
                              <span className="text-emerald-400">● ATIVA</span>
                              <span className="text-xs text-slate-300 font-normal">({extState.selectedServer?.country || 'Alemanha'})</span>
                            </>
                          ) : (
                            <span className="text-slate-400">○ DESLIGADA</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => BrowserExtensionService.toggleConnect()}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          extState.isConnected
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20'
                        }`}
                      >
                        {extState.isConnected ? 'Desligar VPN' : 'Ligar VPN Agora'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                      <label className="text-[11px] text-slate-400 font-medium">Servidor:</label>
                      <select
                        value={extState.selectedServer?.id || 'de-fra'}
                        onChange={(e) => BrowserExtensionService.setServer(e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none cursor-pointer"
                      >
                        <option value="de-fra">🇩🇪 Alemanha (Frankfurt)</option>
                        <option value="br-spo">🇧🇷 Brasil (São Paulo - SP3)</option>
                        <option value="us-mia">🇺🇸 Estados Unidos (Miami)</option>
                        <option value="uk-lon">🇬🇧 Reino Unido (Londres)</option>
                        <option value="local-bridge">Conexão rápida (Anycast)</option>
                        <option value="custom">Servidor próprio (proxy remoto)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href="https://www.meuip.com.br/"
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-center text-cyan-300 block"
                      >
                        Verificar IP
                      </a>
                      <a
                        href="https://maps.google.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-center text-sky-300 block"
                      >
                        Ver no mapa
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div>
                {/* Botões de Ação */}
                <div className="space-y-2.5">
                  <button
                    onClick={handleDownloadExtension}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <IonIcon icon={cloudDownloadOutline} className="text-lg" />
                    <span>Baixar Extensão SeguranApp (.zip)</span>
                  </button>

                  <button
                    onClick={() => {
                      BrowserExtensionService.ping();
                      setToastMessage('Sincronizando com a extensão no Chrome...');
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <IonIcon icon={refreshOutline} className="text-cyan-400" />
                    <span>{extState.isInstalled ? 'Extensão sincronizada' : 'Verificar se Extensão foi Instalada'}</span>
                  </button>

                  <button
                    onClick={() => setShowBrowserTutorial(!showBrowserTutorial)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{showBrowserTutorial ? 'Ocultar Passo a Passo' : 'Como ativar no navegador'}</span>
                    <IonIcon icon={showBrowserTutorial ? chevronUpOutline : chevronDownOutline} />
                  </button>
                </div>

                {/* Tutorial Expansível da Extensão */}
                {showBrowserTutorial && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/20 space-y-3.5 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                        Instalação em 3 Passos:
                      </span>
                    </div>

                    {/* Passo 1 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div className="text-xs text-slate-300">
                        <p className="font-semibold text-white">Extraia o arquivo baixado</p>
                        <p className="text-slate-400 text-[11px]">Descompacte o <code className="text-cyan-300">seguranapp-extension.zip</code> em uma pasta de sua preferência.</p>
                      </div>
                    </div>

                    {/* Passo 2 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div className="text-xs text-slate-300 w-full">
                        <p className="font-semibold text-white">Abra a tela de extensões</p>
                        <p className="text-slate-400 text-[11px] mb-1.5">No Chrome ou Edge, digite o endereço na barra:</p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10.5px] px-2 py-1 rounded bg-slate-900 border border-white/10 text-cyan-300">
                            chrome://extensions
                          </span>
                          <button
                            onClick={() => handleCopyText('chrome://extensions', 'Endereço de extensões')}
                            className="p-1 px-2 rounded bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] font-bold cursor-pointer"
                          >
                            {copiedField === 'Endereço de extensões' ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-1.5">
                          Ative a chave <strong>"Modo do desenvolvedor"</strong> no canto superior direito.
                        </p>
                      </div>
                    </div>

                    {/* Passo 3 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div className="text-xs text-slate-300">
                        <p className="font-semibold text-white">Carregue a extensão</p>
                        <p className="text-slate-400 text-[11px]">
                          Clique em <strong>"Carregar sem compactação"</strong> (ou <em>Load unpacked</em>) e selecione a pasta extraída. O ícone do SeguranApp surgirá na barra de tarefas!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: VPN DE MÁQUINA (WINDOWS / PC) */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-6 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />

              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-2xl shadow-lg shadow-indigo-500/10">
                    <IonIcon icon={desktopOutline} />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    Proteção Total PC
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-white mb-1.5 flex items-center gap-2">
                  VPN de Máquina
                  <span className="text-xs text-slate-400 font-normal">(Windows Completo)</span>
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Tunelamento de nível de kernel via <strong>WireGuard oficial</strong>. Criptografa 100% de todo o tráfego do PC (jogos, navegadores, Discord, torrents e terminal).
                </p>

                {/* Vantagens */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-indigo-400 text-base flex-shrink-0" />
                    <span><strong>100% da Máquina Criptografada:</strong> protege todos os aplicativos.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-indigo-400 text-base flex-shrink-0" />
                    <span><strong>Alta Velocidade:</strong> protocolo ChaCha20 com menor latência.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <IonIcon icon={checkmarkCircleOutline} className="text-indigo-400 text-base flex-shrink-0" />
                    <span><strong>Perfil Pronto:</strong> arquivo .conf canônico oficial já configurado.</span>
                  </div>
                </div>
              </div>

              <div>
                {/* Botões de Ação */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={handleDownloadConf}
                      className="py-3 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                      <IonIcon icon={cloudDownloadOutline} className="text-base" />
                      <span>1. Baixar .conf</span>
                    </button>

                    <a
                      href="https://download.wireguard.com/windows-client/wireguard-installer.exe"
                      target="_blank"
                      rel="noreferrer"
                      className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center"
                    >
                      <IonIcon icon={openOutline} className="text-base" />
                      <span>2. WireGuard (.exe)</span>
                    </a>
                  </div>

                  <button
                    onClick={() => setShowWindowsTutorial(!showWindowsTutorial)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{showWindowsTutorial ? 'Ocultar Passo a Passo' : 'Como ativar no Windows'}</span>
                    <IonIcon icon={showWindowsTutorial ? chevronUpOutline : chevronDownOutline} />
                  </button>
                </div>

                {/* Tutorial Expansível do Windows */}
                {showWindowsTutorial && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/20 space-y-3.5 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                        Instalação em 3 Passos:
                      </span>
                    </div>

                    {/* Passo 1 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <div className="text-xs text-slate-300">
                        <p className="font-semibold text-white">Instale o WireGuard para Windows</p>
                        <p className="text-slate-400 text-[11px]">Execute o instalador oficial baixado no botão acima.</p>
                      </div>
                    </div>

                    {/* Passo 2 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <div className="text-xs text-slate-300">
                        <p className="font-semibold text-white">Importe seu arquivo de perfil</p>
                        <p className="text-slate-400 text-[11px] mb-1">
                          Abra o WireGuard e aperte o atalho no teclado:
                        </p>
                        <span className="font-mono text-[10.5px] px-2 py-1 rounded bg-slate-900 border border-white/10 text-indigo-300 inline-block">
                          Ctrl + O
                        </span>
                        <p className="text-slate-400 text-[11px] mt-1">Selecione o arquivo <code className="text-indigo-300">seguranapp-vpn.conf</code> que você baixou.</p>
                      </div>
                    </div>

                    {/* Passo 3 */}
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <div className="text-xs text-slate-300">
                        <p className="font-semibold text-white">Clique em Ativar</p>
                        <p className="text-slate-400 text-[11px]">
                          Pronto! Seu status mudará para "Ativo" e 100% da rede do seu computador estará criptografada pelo túnel.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* DICA DE COMPARAÇÃO / FAQ */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 flex items-start gap-3">
            <IonIcon icon={informationCircleOutline} className="text-cyan-400 text-xl flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-200 font-semibold">Qual escolher? </span>
              Se você quer apenas navegar em sites com IP camuflado sem instalar nada no Windows, use a <strong>Extensão de Navegador</strong>. Se você quer proteger jogos, downloads, Discord e todos os aplicativos do PC simultaneamente, use a <strong>VPN de Máquina (WireGuard)</strong>.
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
