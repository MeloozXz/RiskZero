/**
 * Checkup de Proteção (somente leitura).
 *
 * A página NÃO liga/desliga a VPN — isso é feito pela extensão ou pelo app
 * WireGuard instalado. Aqui apenas verificamos, de forma real, se o tráfego
 * deste navegador está mascarado e se há vazamentos.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'info' | 'skipped' | 'running' | 'error';

export interface CheckResult {
  status: CheckStatus;
  title: string;
  detail: string;
}

export interface IpInfo {
  ip: string;
  countryCode?: string;
  country?: string;
  city?: string;
  isp?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

export interface RealIpBaseline {
  ip: string;
  countryCode?: string;
  isp?: string;
  savedAt: number;
}

export type Verdict = 'protected' | 'leaking' | 'unprotected' | 'unknown';

export interface ProtectionReport {
  verdict: Verdict;
  ipInfo: IpInfo | null;
  baseline: RealIpBaseline | null;
  masked: boolean;
  checks: {
    ip: CheckResult;
    webrtc: CheckResult;
    locale: CheckResult;
    geolocation: CheckResult;
    dns: CheckResult;
  };
  testedAt: number;
}

const BASELINE_KEY = 'riskzero.realIpBaseline';

const VPN_ISP_PATTERN =
  /cloudflare|warp|digitalocean|amazon|aws|google cloud|google llc|microsoft|azure|ovh|hetzner|linode|akamai|vultr|m247|datacamp|leaseweb|choopa|mullvad|proton|nord|express ?vpn|surfshark|private internet|contabo|oracle|hostinger|tor exit|packethub|cdn77/i;

export function looksLikeVpnIsp(isp?: string): boolean {
  return !!isp && VPN_ISP_PATTERN.test(isp);
}

// ---------------------------------------------------------------------------
// Baseline do IP real (salvo localmente, nunca enviado a servidores)
// ---------------------------------------------------------------------------

export function getBaseline(): RealIpBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as RealIpBaseline) : null;
  } catch {
    return null;
  }
}

export function saveBaseline(info: IpInfo): RealIpBaseline {
  const baseline: RealIpBaseline = {
    ip: info.ip,
    countryCode: info.countryCode,
    isp: info.isp,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
  } catch {
    /* armazenamento indisponível */
  }
  return baseline;
}

export function clearBaseline(): void {
  try {
    localStorage.removeItem(BASELINE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// 1. IP público real
// ---------------------------------------------------------------------------

async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function checkPublicIp(): Promise<IpInfo> {
  try {
    const d = await fetchJson('https://ipwho.is/');
    if (d && d.success !== false && d.ip) {
      return {
        ip: d.ip,
        countryCode: d.country_code,
        country: d.country,
        city: d.city,
        isp: d.connection?.isp || d.connection?.org,
        timezone: d.timezone?.id,
        latitude: typeof d.latitude === 'number' ? d.latitude : undefined,
        longitude: typeof d.longitude === 'number' ? d.longitude : undefined,
      };
    }
  } catch {
    /* tenta o próximo */
  }

  try {
    const d = await fetchJson('https://ipapi.co/json/');
    if (d && d.ip) {
      return {
        ip: d.ip,
        countryCode: d.country_code,
        country: d.country_name,
        city: d.city,
        isp: d.org,
        timezone: d.timezone,
        latitude: typeof d.latitude === 'number' ? d.latitude : undefined,
        longitude: typeof d.longitude === 'number' ? d.longitude : undefined,
      };
    }
  } catch {
    /* tenta o próximo */
  }

  const d = await fetchJson('https://api.ipify.org?format=json');
  if (!d?.ip) throw new Error('Não foi possível obter o IP público.');
  return { ip: d.ip };
}

// ---------------------------------------------------------------------------
// 2. Vazamento WebRTC
// ---------------------------------------------------------------------------

export async function gatherWebRtcIps(timeoutMs = 4000): Promise<{ publicIps: string[]; localIps: string[] }> {
  const publicIps = new Set<string>();
  const localIps = new Set<string>();

  if (typeof RTCPeerConnection === 'undefined') {
    return { publicIps: [], localIps: [] };
  }

  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.createDataChannel('rz');

  const done = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        clearTimeout(timer);
        resolve();
        return;
      }
      const parts = e.candidate.candidate.split(' ');
      const addr = parts[4];
      const type = parts[7];
      if (!addr || addr.endsWith('.local')) return; // mDNS ofuscado = sem vazamento
      if (type === 'srflx') publicIps.add(addr);
      else if (type === 'host') localIps.add(addr);
    };
  });

  try {
    await pc.setLocalDescription(await pc.createOffer());
    await done;
  } finally {
    pc.close();
  }

  return { publicIps: [...publicIps], localIps: [...localIps] };
}

async function runWebRtcCheck(ipInfo: IpInfo | null, baseline: RealIpBaseline | null, masked: boolean): Promise<CheckResult> {
  try {
    const { publicIps, localIps } = await gatherWebRtcIps();
    if (publicIps.length === 0 && localIps.length === 0) {
      return { status: 'ok', title: 'Sem vazamento WebRTC', detail: 'Nenhum IP exposto via WebRTC.' };
    }
    const exposedReal = publicIps.filter(
      (ip) => (baseline && ip === baseline.ip) || (masked && ipInfo && ip !== ipInfo.ip)
    );
    if (exposedReal.length > 0) {
      return {
        status: 'fail',
        title: 'Vazamento WebRTC',
        detail: `WebRTC expõe ${exposedReal.join(', ')}, diferente do IP mascarado.`,
      };
    }
    if (localIps.length > 0) {
      return {
        status: 'warn',
        title: 'IP local exposto',
        detail: `WebRTC revela IP da rede interna: ${localIps.join(', ')}.`,
      };
    }
    return { status: 'ok', title: 'Sem vazamento WebRTC', detail: `WebRTC mostra o mesmo IP público (${publicIps.join(', ')}).` };
  } catch {
    return { status: 'error', title: 'WebRTC indisponível', detail: 'Não foi possível testar o WebRTC.' };
  }
}

// ---------------------------------------------------------------------------
// 3. Fuso horário / idioma vs. país do IP
// ---------------------------------------------------------------------------

function runLocaleCheck(ipInfo: IpInfo | null): CheckResult {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language || '';
  if (!ipInfo?.timezone) {
    return { status: 'info', title: 'Fuso / Idioma', detail: `Navegador: ${browserTz} · ${lang}. Fuso do IP indisponível.` };
  }
  const offsetOf = (tz: string) => {
    try {
      const now = new Date();
      const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      return Math.round((local.getTime() - utc.getTime()) / 60000);
    } catch {
      return null;
    }
  };
  const sameOffset = offsetOf(browserTz) === offsetOf(ipInfo.timezone);
  if (browserTz === ipInfo.timezone || sameOffset) {
    return { status: 'ok', title: 'Fuso consistente', detail: `Navegador (${browserTz}) bate com o IP (${ipInfo.timezone}).` };
  }
  return {
    status: 'warn',
    title: 'Fuso denuncia VPN',
    detail: `Navegador em ${browserTz} (${lang}), mas o IP está em ${ipInfo.timezone}. Sites podem detectar o uso de VPN.`,
  };
}

// ---------------------------------------------------------------------------
// 4. Geolocalização do navegador (pede permissão — só sob clique)
// ---------------------------------------------------------------------------

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function checkGeolocation(ipInfo: IpInfo | null): Promise<CheckResult> {
  if (!('geolocation' in navigator)) {
    return { status: 'skipped', title: 'Geolocalização', detail: 'Navegador sem suporte a geolocalização.' };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 })
    );
    if (ipInfo?.latitude === undefined || ipInfo?.longitude === undefined) {
      return { status: 'info', title: 'Geolocalização', detail: 'Posição obtida, mas sem coordenadas do IP para comparar.' };
    }
    const km = Math.round(distanceKm(pos.coords.latitude, pos.coords.longitude, ipInfo.latitude, ipInfo.longitude));
    if (km > 500) {
      return {
        status: 'warn',
        title: 'Geolocalização revela você',
        detail: `O navegador informa uma posição a ~${km} km do local do IP. Sites com permissão veem sua localização real.`,
      };
    }
    return { status: 'ok', title: 'Geolocalização consistente', detail: `Posição do navegador a ~${km} km do local do IP.` };
  } catch {
    return { status: 'skipped', title: 'Geolocalização', detail: 'Permissão negada ou indisponível (sites também não a verão).' };
  }
}

// ---------------------------------------------------------------------------
// 5. Vazamento de DNS (bash.ws)
// ---------------------------------------------------------------------------

interface BashWsEntry {
  ip: string;
  country?: string;
  country_name?: string;
  asn?: string;
  type: 'ip' | 'dns' | 'conclusion';
}

export async function checkDnsLeak(ipInfo: IpInfo | null, baseline: RealIpBaseline | null, masked: boolean): Promise<CheckResult> {
  try {
    const idRes = await fetch('https://bash.ws/id', { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    const id = (await idRes.text()).trim();
    if (!id) throw new Error('sem id');

    // Dispara resoluções DNS para subdomínios únicos (a resposta não importa)
    await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        fetch(`https://${i + 1}.${id}.bash.ws`, { mode: 'no-cors', signal: AbortSignal.timeout(3000) })
      )
    );

    const entries = (await fetchJson(`https://bash.ws/dnsleak/test/${id}?json`, 8000)) as BashWsEntry[];
    const dns = entries.filter((e) => e.type === 'dns');
    if (dns.length === 0) {
      return { status: 'info', title: 'DNS', detail: 'Nenhum servidor DNS identificado no teste.' };
    }
    const summary = dns
      .slice(0, 3)
      .map((e) => `${e.ip}${e.asn ? ` (${e.asn})` : ''}`)
      .join(', ');

    const realCountry = baseline?.countryCode?.toUpperCase();
    const currentCountry = ipInfo?.countryCode?.toUpperCase();
    const leaksToRealCountry =
      masked && !!realCountry && realCountry !== currentCountry && dns.some((e) => e.country?.toUpperCase() === realCountry);

    if (leaksToRealCountry) {
      return {
        status: 'fail',
        title: 'Vazamento de DNS',
        detail: `Consultas DNS saem pelo seu país real (${realCountry}): ${summary}.`,
      };
    }
    return { status: 'ok', title: 'DNS sem vazamento', detail: `Servidores DNS: ${summary}.` };
  } catch {
    return { status: 'error', title: 'DNS indisponível', detail: 'Serviço de teste de DNS (bash.ws) não respondeu.' };
  }
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

export interface RunOptions {
  /** Estado lido da extensão (true/false) ou undefined se não houver extensão/leitura. */
  extensionConnected?: boolean;
  /** Pede geolocalização (somente quando o usuário clica). */
  includeGeolocation?: boolean;
  /** Resultado de geolocalização anterior, para manter na tela em execuções automáticas. */
  previousGeolocation?: CheckResult;
}

const pending = (title: string): CheckResult => ({ status: 'skipped', title, detail: 'Não executado.' });

export async function runProtectionCheck(opts: RunOptions = {}): Promise<ProtectionReport> {
  let ipInfo: IpInfo | null = null;
  let ipCheck: CheckResult;

  try {
    ipInfo = await checkPublicIp();
  } catch {
    ipInfo = null;
  }

  let baseline = getBaseline();

  // Salva o IP real somente quando temos certeza razoável de estar sem proteção
  if (ipInfo && !baseline && opts.extensionConnected === false && !looksLikeVpnIsp(ipInfo.isp)) {
    baseline = saveBaseline(ipInfo);
  }

  let masked = false;
  if (ipInfo) {
    masked = baseline ? ipInfo.ip !== baseline.ip : !!opts.extensionConnected || looksLikeVpnIsp(ipInfo.isp);
    const where = [ipInfo.city, ipInfo.country].filter(Boolean).join(', ');
    const desc = `${where}${ipInfo.isp ? ` · ${ipInfo.isp}` : ''}`;
    ipCheck = masked
      ? { status: 'ok', title: 'IP mascarado', detail: desc || 'IP diferente do seu IP real.' }
      : { status: 'fail', title: 'IP real exposto', detail: desc || 'Sites veem seu IP real.' };
  } else {
    ipCheck = { status: 'error', title: 'IP indisponível', detail: 'Não foi possível consultar o IP público.' };
  }

  const [webrtc, dns, geolocation] = await Promise.all([
    runWebRtcCheck(ipInfo, baseline, masked),
    checkDnsLeak(ipInfo, baseline, masked),
    opts.includeGeolocation
      ? checkGeolocation(ipInfo)
      : Promise.resolve(opts.previousGeolocation ?? { ...pending('Geolocalização'), detail: 'Clique em Verificar para testar (pede permissão).' }),
  ]);

  const locale = runLocaleCheck(ipInfo);
  const leaking = webrtc.status === 'fail' || dns.status === 'fail';

  let verdict: Verdict;
  if (!ipInfo) verdict = 'unknown';
  else if (!masked) verdict = 'unprotected';
  else if (leaking) verdict = 'leaking';
  else verdict = 'protected';

  return {
    verdict,
    ipInfo,
    baseline,
    masked,
    checks: { ip: ipCheck, webrtc, locale, geolocation, dns },
    testedAt: Date.now(),
  };
}

