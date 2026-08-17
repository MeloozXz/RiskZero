import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonToggle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonList
} from '@ionic/react';
import {
  wifiOutline,
  shieldCheckmarkOutline,
  globeOutline,
  lockClosedOutline,
  arrowDownOutline,
  arrowUpOutline,
  flashOutline,
  checkmarkCircleOutline,
  warningOutline,
  serverOutline,
  optionsOutline
} from 'ionicons/icons';
import { VpnService, VpnStats, VpnServerNode, SERVERS, VpnProtocol } from '../../services/vpn';
import './VpnPage.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(kbps: number): string {
  if (kbps > 1024) {
    return (kbps / 1024).toFixed(1) + ' MB/s';
  }
  return kbps + ' KB/s';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const VpnPage: React.FC = () => {
  const [stats, setStats] = useState<VpnStats>(VpnService.getStats());
  const [showServerModal, setShowServerModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = VpnService.subscribe((updated) => {
      setStats(updated);
    });
    return () => unsubscribe();
  }, []);

  const isConnected = stats.status === 'CONNECTED';
  const isConnecting = stats.status === 'CONNECTING';

  const handleToggleVpn = async () => {
    if (isConnected) {
      await VpnService.disconnect();
    } else {
      await VpnService.connect();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <IonTitle style={{ color: '#00f2fe', fontWeight: 800 }}>
            Túnel VPN Criptografado
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#070a13' }}>
        <div className="max-w-xl mx-auto py-2">

          {/* BOTÃO PRINCIPAL DE CONEXÃO RADAR 60FPS */}
          <div className="flex flex-col items-center justify-center my-6 relative">
            
            {/* Ondas de Pulso Radar se Conectado */}
            {isConnected && (
              <div className="absolute w-64 h-64 rounded-full border-2 border-cyan-400/40 animate-ping pointer-events-none" />
            )}
            
            <button
              onClick={handleToggleVpn}
              disabled={isConnecting}
              className={`w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl relative z-10 border-4 ${
                isConnected
                  ? 'bg-gradient-to-br from-cyan-400 to-indigo-600 border-cyan-300 shadow-cyan-500/50 scale-105'
                  : 'bg-slate-900/90 border-slate-700/60 hover:border-slate-500 shadow-black/80'
              }`}
              style={{
                boxShadow: isConnected
                  ? '0 0 60px rgba(0, 242, 254, 0.45), inset 0 0 20px rgba(255, 255, 255, 0.3)'
                  : '0 10px 30px rgba(0, 0, 0, 0.6)'
              }}
            >
              <IonIcon
                icon={isConnected ? shieldCheckmarkOutline : wifiOutline}
                className={`text-5xl transition-transform duration-300 ${
                  isConnected ? 'text-slate-950 scale-110' : 'text-slate-400'
                }`}
              />
              <span className={`text-xs font-black tracking-widest uppercase mt-2 ${
                isConnected ? 'text-slate-950' : 'text-slate-300'
              }`}>
                {isConnecting ? 'CONECTANDO...' : isConnected ? 'PROTEGIDO' : 'TOQUE p/ ATIVAR'}
              </span>
            </button>

            {/* Status Text Badge */}
            <div className="mt-5 text-center">
              {isConnected ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-extrabold animate-fade-in">
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>CONEXÃO SEGURA • IP MASCARADO: {stats.protectedIp}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold">
                  <IonIcon icon={warningOutline} />
                  <span>VPN DESATIVADA • IP REAL EXPOSTO ({stats.originalIp})</span>
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DE ESTATÍSTICAS EM TEMPO REAL */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            
            {/* Velocidade Download */}
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <IonIcon icon={arrowDownOutline} className="text-xl" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Download</span>
                <span className="text-sm font-extrabold text-slate-100">
                  {isConnected ? formatSpeed(stats.downloadSpeedKbps) : '0 KB/s'}
                </span>
                <span className="text-[10px] text-slate-500 block">{formatBytes(stats.downloadBytes)}</span>
              </div>
            </div>

            {/* Velocidade Upload */}
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <IonIcon icon={arrowUpOutline} className="text-xl" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Upload</span>
                <span className="text-sm font-extrabold text-slate-100">
                  {isConnected ? formatSpeed(stats.uploadSpeedKbps) : '0 KB/s'}
                </span>
                <span className="text-[10px] text-slate-500 block">{formatBytes(stats.uploadBytes)}</span>
              </div>
            </div>
          </div>

          {/* DURAÇÃO E SELETOR DE SERVIDOR */}
          <IonCard className="glass-card mb-6">
            <IonCardContent className="p-4 space-y-3">
              
              {/* Servidor Selecionado */}
              <div
                onClick={() => setShowServerModal(true)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/10 cursor-pointer hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{stats.selectedServer.flag}</span>
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Servidor Ativo</span>
                    <span className="text-sm font-bold text-slate-100">
                      {stats.selectedServer.country} ({stats.selectedServer.city})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IonBadge color="success" className="cyber-badge">
                    {stats.selectedServer.ping} ms
                  </IonBadge>
                  <IonIcon icon={serverOutline} className="text-cyan-400" />
                </div>
              </div>

              {/* Duração da Conexão */}
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1 px-1">
                <span>Tempo de Conexão:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {formatTime(stats.connectedTimeSeconds)}
                </span>
              </div>
            </IonCardContent>
          </IonCard>

          {/* CONFIGURAÇÕES AVANÇADAS DA VPN */}
          <IonCard className="glass-card mb-6">
            <IonCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <IonIcon icon={optionsOutline} className="text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-sm">Ajustes do Túnel de Segurança</h3>
              </div>

              {/* Protocolo */}
              <IonItem lines="none" className="glass-input" style={{ '--background': 'rgba(255,255,255,0.02)' }}>
                <IonLabel className="text-xs font-semibold text-slate-300">Protocolo de Criptografia</IonLabel>
                <IonSelect
                  value={stats.protocol}
                  onIonChange={(e) => VpnService.setProtocol(e.detail.value as VpnProtocol)}
                  interface="popover"
                  style={{ color: '#00f2fe', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  <IonSelectOption value="WireGuard (Recomendado)">WireGuard (Veloz)</IonSelectOption>
                  <IonSelectOption value="OpenVPN UDP">OpenVPN UDP</IonSelectOption>
                  <IonSelectOption value="IPsec / IKEv2">IPsec / IKEv2</IonSelectOption>
                </IonSelect>
              </IonItem>

              {/* Kill Switch Toggle */}
              <IonItem lines="none" className="glass-input" style={{ '--background': 'rgba(255,255,255,0.02)' }}>
                <IonLabel className="ion-text-wrap text-xs text-slate-300 font-semibold">
                  Kill Switch (Bloquear tráfego se a VPN cair)
                </IonLabel>
                <IonToggle
                  checked={stats.killSwitchEnabled}
                  onIonChange={() => VpnService.toggleKillSwitch()}
                  style={{ '--color-checked': '#00f2fe' }}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

        </div>

        {/* MODAL DE SELEÇÃO DE SERVIDORES */}
        <IonModal isOpen={showServerModal} onDidDismiss={() => setShowServerModal(false)}>
          <IonHeader>
            <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <IonTitle style={{ color: '#00f2fe', fontWeight: 800, fontSize: '1rem' }}>
                Selecionar Servidor Global
              </IonTitle>
              <IonButton slot="end" fill="clear" color="medium" onClick={() => setShowServerModal(false)}>
                Fechar
              </IonButton>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding" style={{ '--background': '#070a13' }}>
            <IonList lines="none" style={{ background: 'transparent' }}>
              {SERVERS.map((server) => (
                <div
                  key={server.id}
                  onClick={() => {
                    VpnService.setServer(server);
                    setShowServerModal(false);
                  }}
                  className={`glass-card p-4 mb-3 rounded-xl cursor-pointer border flex items-center justify-between transition-all ${
                    stats.selectedServer.id === server.id
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/5 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{server.flag}</span>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{server.country}</h4>
                      <p className="text-xs text-slate-400">{server.city} • IP: {server.virtualIp}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <IonBadge color={server.ping < 50 ? 'success' : 'warning'} className="cyber-badge">
                      {server.ping} ms
                    </IonBadge>
                    <span className="text-[10px] text-slate-500 block mt-1">Carga: {server.load}%</span>
                  </div>
                </div>
              ))}
            </IonList>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};
