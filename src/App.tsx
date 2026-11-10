import React, { Suspense, lazy } from 'react';
import { Redirect, Route, useLocation, useHistory } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact,
  IonSpinner,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  Shield,
  Lock,
  LayoutDashboard,
  Wifi,
  AlertTriangle,
  Globe,
  Activity,
  Smartphone,
  BookOpen,
  Fingerprint,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react';

import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { VaultProvider, useVault } from './contexts/VaultContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { UpgradeModal } from './components/Subscription/UpgradeModal';
import AuthPage from './pages/Auth/AuthPage';
import { LockOverlay } from './components/Auth/LockOverlay';

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

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

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

const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#09090b',
      gap: '10px',
    }}
  >
    <IonSpinner name="crescent" style={{ color: '#3b82f6', width: '24px', height: '24px' }} />
    <span style={{ color: '#71717a', fontSize: '0.78rem', fontWeight: 500 }}>Carregando módulo...</span>
  </div>
);

interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const EnterpriseShell: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const { activeEmail, lockApp, logout } = useSecurity();
  const { items } = useVault();
  const { isUltra, isPro } = useSubscription();

  const currentPath = location.pathname;
  const userInitial = activeEmail ? activeEmail.charAt(0).toUpperCase() : 'U';
  const planName = isUltra ? 'Plano Ultra' : isPro ? 'Plano Pro' : 'Plano Gratuito';

  const primaryNav: NavItemConfig[] = [
    { path: '/vault', label: 'Cofre de Senhas', icon: Lock, badge: items.length > 0 ? items.length : undefined },
    { path: '/home', label: 'Painel Geral', icon: LayoutDashboard },
  ];

  const securityNav: NavItemConfig[] = [
    { path: '/vpn', label: 'Túnel VPN WireGuard', icon: Wifi },
    { path: '/breach', label: 'Auditoria de Vazamentos', icon: AlertTriangle },
    { path: '/link-detector', label: 'Detector de Links', icon: Globe },
    { path: '/analysis', label: 'Saúde das Senhas', icon: Activity },
  ];

  const systemNav: NavItemConfig[] = [
    { path: '/hardening', label: 'Proteção do Aparelho', icon: Smartphone },
    { path: '/biometric-settings', label: 'Biometria & Chave', icon: Fingerprint },
    { path: '/education', label: 'Educação & LGPD', icon: BookOpen },
    { path: '/settings', label: 'Configurações', icon: Settings },
    { path: '/plans', label: 'Planos & Licença', icon: CreditCard },
  ];

  const isRouteActive = (path: string) => {
    if (path === '/vault') {
      return currentPath === '/vault' || currentPath.startsWith('/vault/');
    }
    return currentPath === path;
  };

  return (
    <div className="rz-shell">
      {/* Desktop Sidebar */}
      <aside className="rz-sidebar" aria-label="Navegação Principal">
        <div className="rz-sidebar-top">
          <div className="rz-brand-row">
            <div className="rz-brand-identity">
              <div className="rz-brand-logo">
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="rz-brand-name">RiskZero</span>
                <span className="rz-brand-sub">Enterprise Security</span>
              </div>
            </div>
            <span className="rz-badge rz-badge-neutral" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
              v1.0
            </span>
          </div>

          <div className="rz-nav-group">
            <span className="rz-nav-group-label">Principal</span>
            <div className="rz-nav-list">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => history.push(item.path)}
                    className={`rz-nav-item ${active ? 'active' : ''}`}
                  >
                    <span className="rz-nav-item-left">
                      <Icon className="rz-nav-item-icon" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="rz-badge rz-badge-neutral" style={{ padding: '1px 6px', fontSize: '0.68rem' }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rz-nav-group">
            <span className="rz-nav-group-label">Defesa &amp; Monitoramento</span>
            <div className="rz-nav-list">
              {securityNav.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => history.push(item.path)}
                    className={`rz-nav-item ${active ? 'active' : ''}`}
                  >
                    <span className="rz-nav-item-left">
                      <Icon className="rz-nav-item-icon" />
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rz-nav-group">
            <span className="rz-nav-group-label">Governança &amp; Sistema</span>
            <div className="rz-nav-list">
              {systemNav.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => history.push(item.path)}
                    className={`rz-nav-item ${active ? 'active' : ''}`}
                  >
                    <span className="rz-nav-item-left">
                      <Icon className="rz-nav-item-icon" />
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rz-sidebar-footer">
          <div className="rz-user-Row">
            <div className="rz-user-avatar">{userInitial}</div>
            <div className="rz-user-details">
              <span className="rz-user-email">{activeEmail || 'Sessão Ativa'}</span>
              <span className="rz-user-plan">{planName} · AES-256</span>
            </div>
          </div>

          <div className="rz-sidebar-actions">
            <button type="button" onClick={lockApp} className="rz-sidebar-btn" title="Bloquear Cofre">
              <Lock className="w-3.5 h-3.5" />
              <span>Bloquear</span>
            </button>
            <button type="button" onClick={logout} className="rz-sidebar-btn danger" title="Encerrar Sessão">
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="rz-main-viewport">
        <IonRouterOutlet style={{ overflow: 'hidden', background: '#09090b' }}>
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
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="rz-mobile-nav" aria-label="Navegação Mobile">
        <button
          type="button"
          onClick={() => history.push('/vault')}
          className={`rz-mobile-nav-btn ${isRouteActive('/vault') ? 'active' : ''}`}
        >
          <Lock className="w-4 h-4" />
          <span>Cofre</span>
        </button>
        <button
          type="button"
          onClick={() => history.push('/home')}
          className={`rz-mobile-nav-btn ${isRouteActive('/home') ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Painel</span>
        </button>
        <button
          type="button"
          onClick={() => history.push('/vpn')}
          className={`rz-mobile-nav-btn ${isRouteActive('/vpn') ? 'active' : ''}`}
        >
          <Wifi className="w-4 h-4" />
          <span>VPN</span>
        </button>
        <button
          type="button"
          onClick={() => history.push('/link-detector')}
          className={`rz-mobile-nav-btn ${isRouteActive('/link-detector') ? 'active' : ''}`}
        >
          <Globe className="w-4 h-4" />
          <span>Links</span>
        </button>
        <button
          type="button"
          onClick={() => history.push('/settings')}
          className={`rz-mobile-nav-btn ${isRouteActive('/settings') ? 'active' : ''}`}
        >
          <Settings className="w-4 h-4" />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isLoggedIn, isLocked, isInitializing } = useSecurity();

  return (
    <IonApp style={{ background: '#09090b' }}>
      {isInitializing ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#09090b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <IonSpinner name="crescent" style={{ color: '#3b82f6', width: '32px', height: '32px' }} />
        </div>
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
