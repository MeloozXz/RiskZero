import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const { mockVpnPlugin } = vi.hoisted(() => {
  return {
    mockVpnPlugin: {
      startVpn: vi.fn(),
      stopVpn: vi.fn(),
      getVpnStatus: vi.fn(),
      getTunnelStatistics: vi.fn(),
      getOrCreateClientKeys: vi.fn(),
      setKillSwitch: vi.fn(),
      openVpnSettings: vi.fn(),
      addListener: vi.fn(),
    },
  };
});

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core');
  return {
    ...actual,
    registerPlugin: (name: string) => {
      if (name === 'WireguardVpn') {
        return mockVpnPlugin;
      }
      return actual.registerPlugin(name);
    },
  };
});

import { VpnService, DEFAULT_SERVERS } from './vpn';
import { VpnServer } from '../types';

describe('VpnService - Implementação WireGuard Real', () => {
  const validTestServer: VpnServer = {
    id: 'test-vps',
    name: 'Test VPS WireGuard',
    country: 'Brasil',
    city: 'São Paulo',
    flag: '🇧🇷',
    endpoint: '203.0.113.50',
    port: 51820,
    serverPublicKey: 'c2VndXJhbmFwcF9zZXJ2ZXJfcHVibGljX2tleV94eXo=',
    dns: ['1.1.1.1', '1.0.0.1'],
    allowedIps: ['0.0.0.0/0'],
    clientAddress: '10.14.0.2/32',
    status: 'AVAILABLE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockVpnPlugin.getOrCreateClientKeys.mockResolvedValue({
      publicKey: 'Y2xpZW50X3B1YmxpY19rZXlfY3VydmUyNTUxOQ==',
      hasPrivateKey: true,
    });
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ ip: '177.18.25.99' }),
    } as any);
  });

  afterEach(async () => {
    await VpnService.disconnect();
    vi.restoreAllMocks();
  });

  it('deve possuir estado inicial desconectado e protocolo exclusivo WireGuard', () => {
    const stats = VpnService.getStats();
    expect(stats.status).toBe('DISCONNECTED');
    expect(stats.protocol).toBe('WireGuard');
    expect(stats.selectedServer).toBeDefined();
    expect(stats.killSwitchEnabled).toBe(true);
  });

  it('deve recusar conexão se o servidor estiver como UNAVAILABLE (sem infraestrutura)', async () => {
    // Servidor sem infraestrutura provisionada
    const unconfiguredServer = DEFAULT_SERVERS.find((s) => s.status === 'UNAVAILABLE') || DEFAULT_SERVERS[4];
    VpnService.setServer(unconfiguredServer);

    await expect(VpnService.connect()).rejects.toThrow(/não está configurado/);
    expect(VpnService.getStats().status).toBe('ERROR');
    expect(mockVpnPlugin.startVpn).not.toHaveBeenCalled();
  });

  it('deve conectar com sucesso a um servidor WireGuard configurado', async () => {
    VpnService.setServer(validTestServer);
    VpnService.setOriginalIp('177.18.25.99');

    mockVpnPlugin.startVpn.mockResolvedValue({
      success: true,
      isConnected: true,
      message: 'Túnel WireGuard estabelecido com sucesso.',
    });

    // Simula mock de fetch do IP público pós-conexão (mudou para o IP da VPN)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ ip: '203.0.113.50' }),
    } as any);

    const statusChanges: string[] = [];
    const unsubscribe = VpnService.subscribe((stats) => {
      statusChanges.push(stats.status);
    });

    await VpnService.connect();

    expect(mockVpnPlugin.startVpn).toHaveBeenCalled();
    const callArg = mockVpnPlugin.startVpn.mock.calls[0][0];
    expect(callArg.configString).toContain('[Interface]');
    expect(callArg.configString).toContain('[Peer]');
    expect(callArg.configString).toContain('203.0.113.50:51820');
    expect(callArg.configString).toContain('c2VndXJhbmFwcF9zZXJ2ZXJfcHVibGljX2tleV94eXo=');

    expect(statusChanges).toContain('CONNECTING');
    expect(VpnService.getStats().status).toBe('CONNECTED');
    expect(VpnService.getStats().protectedIp).toBe('203.0.113.50');

    unsubscribe();
  });

  it('deve detectar vazamento de IP e desconectar caso o IP não seja mascarado após a conexão', async () => {
    VpnService.setServer(validTestServer);

    mockVpnPlugin.startVpn.mockResolvedValue({
      success: true,
      isConnected: true,
    });
    mockVpnPlugin.stopVpn.mockResolvedValue({
      success: true,
      isConnected: false,
    });

    // Força o IP original e o IP pós-conexão a serem IDÊNTICOS (vazamento)
    const leakingIp = '177.18.25.99';
    VpnService.setOriginalIp(leakingIp);

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ ip: leakingIp }),
    } as any);

    await VpnService.connect();

    // Deve ter detectado erro de vazamento
    expect(VpnService.getStats().status).toBe('ERROR');
    expect(VpnService.getStats().errorMessage).toContain('Vazamento Detectado');
    expect(mockVpnPlugin.stopVpn).toHaveBeenCalled();
  });

  it('deve desconectar chamando stopVpn e zerar métricas reais', async () => {
    VpnService.setServer(validTestServer);
    mockVpnPlugin.startVpn.mockResolvedValue({ success: true, isConnected: true });
    mockVpnPlugin.stopVpn.mockResolvedValue({ success: true, isConnected: false });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ ip: '203.0.113.50' }),
    } as any);

    await VpnService.connect();
    expect(VpnService.getStats().status).toBe('CONNECTED');

    await VpnService.disconnect();

    expect(mockVpnPlugin.stopVpn).toHaveBeenCalled();
    const finalStats = VpnService.getStats();
    expect(finalStats.status).toBe('DISCONNECTED');
    expect(finalStats.downloadSpeedKbps).toBe(0);
    expect(finalStats.uploadSpeedKbps).toBe(0);
  });

  it('deve cadastrar, listar e excluir servidores customizados', () => {
    const custom: VpnServer = {
      id: 'my-custom-vps',
      name: 'VPS Minha Empresa',
      country: 'Personalizado',
      city: '198.51.100.1',
      flag: '🛡️',
      endpoint: '198.51.100.1',
      port: 51820,
      serverPublicKey: 'c2VydmVyX3B1YmtleV9jdXN0b20=',
      dns: ['1.1.1.1'],
      allowedIps: ['0.0.0.0/0'],
      clientAddress: '10.14.0.2/32',
      status: 'AVAILABLE',
      isCustom: true,
    };

    VpnService.saveCustomServer(custom);
    const servers = VpnService.getServers();
    expect(servers.some((s) => s.id === 'my-custom-vps')).toBe(true);

    VpnService.deleteCustomServer('my-custom-vps');
    const serversAfter = VpnService.getServers();
    expect(serversAfter.some((s) => s.id === 'my-custom-vps')).toBe(false);
  });

  it('deve alternar o Kill Switch e notificar o plugin nativo', async () => {
    mockVpnPlugin.setKillSwitch.mockResolvedValue({ enabled: false });

    await VpnService.toggleKillSwitch();
    expect(VpnService.getStats().killSwitchEnabled).toBe(false);
    expect(mockVpnPlugin.setKillSwitch).toHaveBeenCalledWith({ enabled: false });

    mockVpnPlugin.setKillSwitch.mockResolvedValue({ enabled: true });
    await VpnService.toggleKillSwitch();
    expect(VpnService.getStats().killSwitchEnabled).toBe(true);
  });

  it('deve consultar o status real da conexão via getNativeStatus', async () => {
    mockVpnPlugin.getVpnStatus.mockResolvedValue({ isConnected: true, state: 'CONNECTED' });

    const isConnected = await VpnService.getNativeStatus();

    expect(mockVpnPlugin.getVpnStatus).toHaveBeenCalled();
    expect(isConnected).toBe(true);
  });
});
