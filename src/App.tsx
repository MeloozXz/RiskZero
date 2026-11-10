import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Redirect, Route, useLocation, useHistory } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  Lock,
  LayoutDashboard,
  Wifi,
  ShieldAlert,
  Globe,
  Activity,
  Smartphone,
  BookOpen,
  Fingerprint,
  Settings,
  CreditCard,
  LogOut,
  Plus,
  Radar,
  UserRound,
  X,
  ChevronRight,
} from 'lucide-react';

import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { VaultProvider, useVault } from './contexts/VaultContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { UpgradeModal } from './components/Subscription/UpgradeModal';
import AuthPage from './pages/Auth/AuthPage';
import { LockOverlay } from './components/Auth/LockOverlay';
import { RzMark, Mascot, OrbitLoader, OrbitRing } from './components/brand';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Design system "Orbital" */
import './theme/variables.css';
import './theme/components.css';
import './theme/shell.css';

setupIonicReact({ mode: 'md' });

const Home = lazy(() => import('./pages/Home'));
const VaultListPage = lazy(() => import('./pages/Vault/VaultListPage').then((m) => ({ default: m.VaultListPage })));
const VaultFormPage = lazy(() => import('./pages/Vault/VaultFormPage').then((m) => ({ default: m.VaultFormPage })));
const VaultDetailPage = lazy(() => import('./pages/Vault/VaultDetailPage').then((m) => ({ default: m.VaultDetailPage })));
const HardeningPage = lazy(() => import('./pages/Hardening/HardeningPage').then((m) => ({ default: m.HardeningPage })));
const AnalysisPage = lazy(() => import('./pages/Analysis/AnalysisPage').then((m) => ({ default: m.AnalysisPage })));
const EducationPage = lazy(() => import('./pages/Education/EducationPage').then((m) => ({ default: m.EducationPage })));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BiometricSettings = lazy(() => import('./pages/BiometricSettings').then((m) => ({ default: m.BiometricSettings })));
const VpnPage = lazy(() => import('./pages/Vpn/VpnPage').then((m) => ({ default: m.VpnPage })));
const BreachPage = lazy(() => import('./pages/Breach/BreachPage').then((m) => ({ default: m.BreachPage })));
const LinkDetectorPage = lazy(() => import('./pages/LinkDetector/LinkDetectorPage').then((m) => ({ default: m.LinkDetectorPage })));
const PlansPage = lazy(() => import('./pages/Plans/PlansPage').then((m) => ({ default: m.PlansPage })));

const LoadingFallback: React.FC = () => <OrbitLoader label="Carregando módulo" fullscreen />;

/* --------------------------------------------------------------------------
   Mapa de navegação — fonte única para sidebar, trilho e folhas mobile
   -------------------------------------------------------------------------- */
interface NavItemConfig {
  path: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const PRIMARY_NAV: NavItemConfig[] = [
  { path: '/vault', label: 'Cofre', hint: 'Suas credenciais criptografadas', icon: Lock },
  { path: '/home', label: 'Painel', hint: 'Visão geral da sua segurança', icon: LayoutDashboard },
];

const DEFENSE_NAV: NavItemConfig[] = [
  { path: '/vpn', label: 'Túnel VPN', hint: 'Simulação de túnel WireGuard', icon: Wifi },
  { path: '/breach', label: 'Vazamentos', hint: 'Auditoria k-Anonymity de senhas', icon: ShieldAlert },
  { path: '/link-detector', label: 'Detector de Links', hint: 'Analise URLs antes de abrir', icon: Globe },
  { path: '/analysis', label: 'Saúde das Senhas', hint: 'Fracas, repetidas e antigas', icon: Activity },
  { path: '/hardening', label: 'Proteção do Aparelho', hint: 'Checklist de blindagem', icon: Smartphone },
];

const ACCOUNT_NAV: NavItemConfig[] = [
  { path: '/biometric-settings', label: 'Biometria & Chave', hint: 'Desbloqueio e chave mestra', icon: Fingerprint },
  { path: '/settings', label: 'Configurações', hint: 'Preferências, backup e dados', icon: Settings },
  { path: '/plans', label: 'Planos & Licença', hint: 'Gratuito, Pro e Ultra', icon: CreditCard },
  { path: '/education', label: 'Educação & LGPD', hint: 'Guia de boas práticas', icon: BookOpen },
];

const FOCUS_ROUTES = ['/vault/add', '/vault/edit'];

type SheetKind = 'defense' | 'account' | null;

const EnterpriseShell: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const { activeEmail, lockApp, logout } = useSecurity();
  const { items } = useVault();
  const { isUltra, isPro } = useSubscription();
  const [sheet, setSheet] = useState<SheetKind>(null);

  const currentPath = location.pathname;
  const userInitial = activeEmail ? activeEmail.charAt(0).toUpperCase() : 'U';
  const planName = isUltra ? 'Ultra' : isPro ? 'Pro' : 'Gratuito';
  const isPremium = isUltra || isPro;
  const inFocusFlow = FOCUS_ROUTES.some((r) => currentPath.startsWith(r));
  const inDetail = currentPath.startsWith('/vault/detail');

  // Fecha a folha ao trocar de rota e com Esc
  useEffect(() => setSheet(null), [currentPath]);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const isRouteActive = (path: string) =>
    path === '/vault' ? currentPath === '/vault' || currentPath.startsWith('/vault/') : currentPath === path;
  const groupActive = (group: NavItemConfig[]) => group.some((i) => isRouteActive(i.path));

  const go = (path: string) => history.push(path);

  const renderNavItem = (item: NavItemConfig, badge?: number) => {
    const Icon = item.icon;
    const active = isRouteActive(item.path);
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => go(item.path)}
        className={`rz-nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        data-tooltip={item.label}
      >
        <Icon className="rz-nav-item-icon" />
        <span className="rz-nav-item-label">{item.label}</span>
        {badge !== undefined && badge > 0 && <span className="rz-nav-count">{badge}</span>}
      </button>
    );
  };

  const sheetItems = sheet === 'defense' ? DEFENSE_NAV : ACCOUNT_NAV;

  return (
    <div className={`rz-shell ${inFocusFlow ? 'is-focus' : ''}`}>
      {/* ---------------- Sidebar (desktop) / trilho (tablet) ---------------- */}
      <aside className="rz-sidebar" aria-label="Navegação principal">
        <div className="rz-sidebar-top">
          <button type="button" className="rz-brand" onClick={() => go('/home')} aria-label="RiskZero — Painel">
            <RzMark size={34} />
            <span className="rz-brand-text">
              <span className="rz-brand-name">Risk Zero</span>
              <span className="rz-brand-sub">Zero-Knowledge Vault</span>
            </span>
          </button>

          <button
            type="button"
            className="rz-btn rz-btn-primary rz-sidebar-cta"
            onClick={() => go('/vault/add')}
            data-tooltip="Nova credencial"
          >
            <Plus />
            <span className="rz-nav-item-label">Nova credencial</span>
          </button>

          <nav className="rz-nav-group" aria-label="Principal">
            {PRIMARY_NAV.map((item) => renderNavItem(item, item.path === '/vault' ? items.length : undefined))}
          </nav>

          <nav className="rz-nav-group" aria-label="Defesa">
            <span className="rz-nav-group-label">Defesa</span>
            {DEFENSE_NAV.map((item) => renderNavItem(item))}
          </nav>

          <nav className="rz-nav-group" aria-label="Conta">
            <span className="rz-nav-group-label">Conta</span>
            {ACCOUNT_NAV.map((item) => renderNavItem(item))}
          </nav>
        </div>

        <div className="rz-sidebar-footer">
          <div className="rz-secure-line" data-tooltip="Cofre criptografado · AES-256-GCM">
            <span className="rz-dot success is-live" />
            <span className="rz-nav-item-label">Cofre criptografado · AES-256</span>
          </div>
          <div className="rz-user-row">
            <div className={`rz-user-avatar ${isPremium ? 'is-premium' : ''}`} aria-hidden>
              {userInitial}
            </div>
            <div className="rz-user-details">
              <span className="rz-user-email" title={activeEmail || undefined}>
                {activeEmail || 'Sessão ativa'}
              </span>
              <span className={`rz-user-plan ${isPremium ? 'is-premium' : ''}`}>Plano {planName}</span>
            </div>
            <div className="rz-user-actions">
              <button type="button" onClick={lockApp} className="rz-icon-btn" aria-label="Bloquear cofre" data-tooltip="Bloquear">
                <Lock />
              </button>
              <button type="button" onClick={logout} className="rz-icon-btn is-danger" aria-label="Encerrar sessão" data-tooltip="Sair">
                <LogOut />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- Barra superior (celular) ---------------- */}
      {!inFocusFlow && !inDetail && (
        <header className="rz-mobile-top">
          <button type="button" className="rz-brand" onClick={() => go('/home')} aria-label="RiskZero — Painel">
            <RzMark size={28} />
            <span className="rz-brand-name">Risk Zero</span>
          </button>
          <div className="rz-mobile-top-actions">
            <span className="rz-secure-chip">
              <span className="rz-dot success is-live" />
              Protegido
            </span>
            <button type="button" className="rz-icon-btn" onClick={lockApp} aria-label="Bloquear cofre">
              <Lock />
            </button>
          </div>
        </header>
      )}

      {/* ---------------- Área de conteúdo ---------------- */}
      <main className="rz-main-viewport">
        <IonRouterOutlet className="rz-outlet">
          <Suspense fallback={<LoadingFallback />}>
            <Route exact path="/home" component={Home} />
            <Route exact path="/vault" component={VaultListPage} />
            <Route exact path="/vpn" component={VpnPage} />
            <Route exact path="/breach" component={BreachPage} />
            <Route exact path="/link-detector" component={LinkDetectorPage} />
            <Route exact path="/hardening" component={HardeningPage} />
            <Route exact path="/analysis" component={AnalysisPage} />
            <Route exact path="/education" component={EducationPage} />
            <Route exact path="/settings" component={SettingsPage} />
            <Route exact path="/biometric-settings" component={BiometricSettings} />
            <Route exact path="/plans" component={PlansPage} />
            <Route exact path="/vault/add" component={VaultFormPage} />
            <Route exact path="/vault/edit/:id" component={VaultFormPage} />
            <Route exact path="/vault/detail/:id" component={VaultDetailPage} />
            <Route exact path="/">
              <Redirect to="/vault" />
            </Route>
          </Suspense>
        </IonRouterOutlet>
      </main>

      {/* ---------------- Barra inferior (celular) ---------------- */}
      {!inFocusFlow && (
        <nav className="rz-bottombar" aria-label="Navegação mobile">
          <button
            type="button"
            onClick={() => go('/vault')}
            className={`rz-tab ${isRouteActive('/vault') && !sheet ? 'active' : ''}`}
            aria-current={isRouteActive('/vault') ? 'page' : undefined}
          >
            <Lock />
            <span>Cofre</span>
          </button>
          <button
            type="button"
            onClick={() => go('/home')}
            className={`rz-tab ${isRouteActive('/home') && !sheet ? 'active' : ''}`}
            aria-current={isRouteActive('/home') ? 'page' : undefined}
          >
            <LayoutDashboard />
            <span>Painel</span>
          </button>

          <div className="rz-tab-fab-slot">
            <button type="button" className="rz-tab-fab" onClick={() => go('/vault/add')} aria-label="Nova credencial">
              <Plus />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSheet(sheet === 'defense' ? null : 'defense')}
            className={`rz-tab ${sheet === 'defense' || (!sheet && groupActive(DEFENSE_NAV)) ? 'active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={sheet === 'defense'}
          >
            <Radar />
            <span>Defesa</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet(sheet === 'account' ? null : 'account')}
            className={`rz-tab ${sheet === 'account' || (!sheet && groupActive(ACCOUNT_NAV)) ? 'active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={sheet === 'account'}
          >
            <UserRound />
            <span>Conta</span>
          </button>
        </nav>
      )}

      {/* ---------------- Folha de navegação (celular) ---------------- */}
      {sheet && (
        <div className="rz-sheet-layer" onClick={() => setSheet(null)}>
          <div
            className="rz-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === 'defense' ? 'Ferramentas de defesa' : 'Conta'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rz-sheet-grip" aria-hidden />
            <div className="rz-sheet-head">
              <div>
                <p className="rz-eyebrow" style={{ marginBottom: 2 }}>
                  {sheet === 'defense' ? 'Defesa & monitoramento' : 'Sua conta'}
                </p>
                <h2 className="rz-sheet-title">{sheet === 'defense' ? 'Ferramentas' : 'Conta'}</h2>
              </div>
              <button type="button" className="rz-icon-btn is-bordered" onClick={() => setSheet(null)} aria-label="Fechar">
                <X />
              </button>
            </div>

            {sheet === 'account' && (
              <div className="rz-sheet-user">
                <div className={`rz-user-avatar ${isPremium ? 'is-premium' : ''}`} aria-hidden>
                  {userInitial}
                </div>
                <div className="rz-user-details">
                  <span className="rz-user-email">{activeEmail || 'Sessão ativa'}</span>
                  <span className={`rz-user-plan ${isPremium ? 'is-premium' : ''}`}>Plano {planName}</span>
                </div>
              </div>
            )}

            <div className="rz-sheet-list">
              {sheetItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`rz-sheet-item ${active ? 'active' : ''}`}
                    onClick={() => go(item.path)}
                  >
                    <span className={`rz-icon-tile ${active ? '' : 'neutral'}`}>
                      <Icon />
                    </span>
                    <span className="rz-sheet-item-text">
                      <span className="rz-sheet-item-label">{item.label}</span>
                      <span className="rz-sheet-item-hint">{item.hint}</span>
                    </span>
                    <ChevronRight className="rz-sheet-item-chevron" />
                  </button>
                );
              })}
            </div>

            {sheet === 'account' && (
              <div className="rz-sheet-actions">
                <button type="button" className="rz-btn rz-btn-secondary" onClick={lockApp}>
                  <Lock />
                  Bloquear cofre
                </button>
                <button type="button" className="rz-btn rz-btn-danger" onClick={logout}>
                  <LogOut />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Tela de inicialização: mascote discreto + órbita ativa. */
const BootScreen: React.FC = () => (
  <div className="rz-boot" role="status" aria-label="Iniciando RiskZero">
    <div className="rz-boot-stage">
      <OrbitRing size={168} stroke={3} spinning globe={false} />
      <Mascot height={120} className="rz-boot-mascot" />
    </div>
    <span className="rz-boot-label">Iniciando cofre seguro</span>
  </div>
);

const AppContent: React.FC = () => {
  const { isLoggedIn, isLocked, isInitializing } = useSecurity();

  return (
    <IonApp>
      {isInitializing ? (
        <BootScreen />
      ) : (
        <VaultProvider>
          <IonReactRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            {!isLoggedIn ? (
              <AuthPage />
            ) : (
              <>
                <EnterpriseShell />
                <UpgradeModal />
              </>
            )}
            {isLocked && <LockOverlay />}
          </IonReactRouter>
        </VaultProvider>
      )}
    </IonApp>
  );
};

const App: React.FC = () => (
  <SecurityProvider>
    <SubscriptionProvider>
      <AppContent />
    </SubscriptionProvider>
  </SecurityProvider>
);

export default App;
