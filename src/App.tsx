import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import EnemyTeamPage from './pages/EnemyTeamPage';
import MyTeamPage from './pages/MyTeamPage';
import ChampionPoolPage from './pages/ChampionPoolPage';
import DraftListPage from './pages/DraftListPage';
import DraftDetailPage from './pages/DraftDetailPage';
import ToolsPage from './pages/ToolsPage';
import SharedDraftPage from './pages/SharedDraftPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import LiveDraftLobbyPage from './pages/LiveDraftLobbyPage';
import LiveDraftListPage from './pages/LiveDraftListPage';
import JoinLiveDraftPage from './pages/JoinLiveDraftPage';
import LiveDraftPage from './pages/LiveDraftPage';
import AdminPage from './pages/AdminPage';
import SplashArtsPage from './pages/SplashArtsPage';
import UpgradePage from './pages/UpgradePage';
import FirstTimeSetupModal from './components/onboarding/FirstTimeSetupModal';
import UsernameSetupModal from './components/onboarding/UsernameSetupModal';
import TeamOnboardingModal from './components/onboarding/TeamOnboardingModal';
import BanOverlay from './components/auth/BanOverlay';
import { AuthProvider } from './contexts/AuthContext';
import UserMenu from './components/auth/UserMenu';
import { useAuthStore } from './stores/useAuthStore';
import { useMyTeamStore } from './stores/useMyTeamStore';
import { usePageTracker } from './hooks/usePageTracker';

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center gap-3">
      <span className="text-7xl font-bold text-gray-600">404</span>
      <p className="text-xl text-gray-400">Looks like you wandered into the fog of war.</p>
      <p className="text-sm text-gray-500">This page doesn't exist.</p>
      <button
        onClick={() => navigate('/')}
        className="mt-2 px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition-colors"
      >
        Return to Base
      </button>
    </div>
  );
}

// Icons as components
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const DraftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const EnemyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const TeamIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ChampionIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ToolsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);

const LiveDraftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    {/* Sidebar panel icon */}
    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M9 3v18" />
    {/* Arrow indicator */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d={collapsed ? "M14 12l3-3m0 0l-3-3m3 3H12" : "M17 12l-3-3m0 0l3-3m-3 3h5"}
      className="transition-all duration-300"
    />
  </svg>
);

function NavDivider({ label, collapsed }: { label?: string; collapsed: boolean }) {
  return (
    <div className="py-2">
      <div className="flex items-center">
        <div className="flex-1 h-px bg-lol-border" />
        {label && (
          <>
            <span className={`text-[10px] uppercase tracking-wider text-gray-500 font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 mx-0' : 'max-w-[100px] opacity-100 mx-2'}`}>
              {label}
            </span>
            <div className={`h-px bg-lol-border transition-all duration-300 ${collapsed ? 'flex-0 w-0' : 'flex-1'}`} />
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const { profile } = useAuthStore();
  const teams = useMyTeamStore((s) => s.teams);
  const memberships = useMyTeamStore((s) => s.memberships);
  const totalTeams = teams.length + memberships.length;
  const myTeamLabel = totalTeams > 1 ? 'My Teams' : 'My Team';

  const mainNavItems = [
    { to: '/', label: 'Home', icon: HomeIcon },
  ];

  const draftNavItems = [
    { to: '/draft', label: 'Drafts', icon: DraftIcon },
    { to: '/enemy-teams', label: 'Enemy Teams', icon: EnemyIcon },
    { to: '/my-teams', label: myTeamLabel, icon: TeamIcon },
    { to: '/champion-pool', label: 'Pools', icon: ChampionIcon },
  ];

  const utilNavItems = [
    { to: '/live-draft', label: 'Live Draft', icon: LiveDraftIcon },
    { to: '/tools', label: 'Other Tools', icon: ToolsIcon },
  ];

  const renderNavItem = (item: { to: string; label: string; icon: React.ComponentType }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `flex items-center py-3 px-3 rounded-xl font-medium transition-all duration-300 group relative
        ${isActive
          ? 'bg-gradient-to-r from-lol-gold/20 to-transparent text-lol-gold'
          : 'text-gray-400 hover:text-white hover:bg-lol-surface'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator */}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-lol-gold rounded-r-full" />
          )}
          <span className="shrink-0"><item.icon /></span>
          <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            {item.label}
          </span>
          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              {item.label}
            </div>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-lol-dark border-r border-lol-border
        flex flex-col z-50 transition-all duration-300 ease-in-out
        ${collapsed ? 'w-20' : 'w-[240px]'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center border-b border-lol-border shrink-0 px-3">
        <NavLink to="/" className="flex items-center group overflow-hidden">
          <div>
            <img src="/images/logo.png" alt="Teamcomp logo" className="size-10" />
          </div>
          <span className={`text-lg font-bold text-white group-hover:text-lol-gold whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            teamcomp.<span className='text-lol-gold'>lol</span>
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide bg-lol-gold/20 text-lol-gold px-1.5 py-0.5 rounded-full align-middle">beta</span>
          </span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-hidden">
        {/* Main section */}
        <div className="space-y-1">
          {mainNavItems.map(renderNavItem)}
        </div>

        <NavDivider label="Planning" collapsed={collapsed} />

        {/* Draft section */}
        <div className="space-y-1">
          {draftNavItems.map(renderNavItem)}
        </div>

        <NavDivider label="Tools" collapsed={collapsed} />

        {/* Utilities section */}
        <div className="space-y-1">
          {utilNavItems.map(renderNavItem)}
        </div>

        {/* Admin section (developer only) */}
        {profile?.tier === 'developer' && (
          <>
            <NavDivider label="Admin" collapsed={collapsed} />
            <div className="space-y-1">
              {renderNavItem({ to: '/admin', label: 'Admin Panel', icon: AdminIcon })}
            </div>
          </>
        )}
      </nav>

      {/* Notification bell + User section */}
      <div className="px-3 pb-3 space-y-2">
        <a
          href="https://discord.gg/zKVUjtPSb6"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center py-3 px-3 rounded-xl font-medium text-gray-400 hover:text-[#5865F2] hover:bg-lol-surface transition-all duration-300 group relative"
        >
          <span className="shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </span>
          <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            Discord
          </span>
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Discord
            </div>
          )}
        </a>
        <UserMenu collapsed={collapsed} />
      </div>

      {/* Bottom section */}
      <div className="border-t border-lol-border p-3 space-y-1">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center w-full py-3 px-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-lol-surface transition-all duration-300"
        >
          <span className="shrink-0"><CollapseIcon collapsed={collapsed} /></span>
          <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'}`}>
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-lol-gray">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main
        className={`transition-all duration-300 ease-in-out min-h-screen ${
          collapsed ? 'ml-20' : 'ml-[240px]'
        }`}
      >
        <div className="px-8 py-6 max-w-450 mx-auto">{children}</div>
      </main>

      {/* Modals */}
      <FirstTimeSetupModal />
      <UsernameSetupModal />
      <TeamOnboardingModal />
      <BanOverlay />
    </div>
  );
}

/**
 * Handles redirect back to the original page after OAuth sign-in.
 * OAuth flows land on `/` (the app root), so this picks up the stored
 * return URL and navigates there once the user is authenticated.
 */
function PageTracker() {
  usePageTracker();
  return null;
}

function AuthRedirectHandler() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (user && !hasRedirected.current) {
      try {
        const returnUrl = localStorage.getItem('teamcomp-lol-auth-return-url');
        if (returnUrl) {
          localStorage.removeItem('teamcomp-lol-auth-return-url');
          hasRedirected.current = true;
          navigate(returnUrl, { replace: true });
        }
      } catch { /* ignore */ }
    }
  }, [user, navigate]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthRedirectHandler />
        <PageTracker />
        <Routes>
          {/* Public routes (no sidebar) */}
          <Route path="/share/:token" element={<SharedDraftPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* App routes (with sidebar layout) */}
          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/draft" element={<DraftListPage />} />
                  <Route path="/draft/:draftId" element={<DraftDetailPage />} />
                  <Route path="/enemy-teams" element={<EnemyTeamPage />} />
                  <Route path="/my-teams" element={<MyTeamPage />} />
                  <Route path="/champion-pool" element={<ChampionPoolPage />} />
                  <Route path="/tools" element={<ToolsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/upgrade" element={<UpgradePage />} />
                  <Route path="/splasharts" element={<SplashArtsPage />} />
                  <Route path="/live-draft" element={<LiveDraftListPage />} />
                  <Route path="/live-draft/join/:token" element={<JoinLiveDraftPage />} />
                  <Route path="/live-draft/lobby/:sessionId" element={<LiveDraftPage />} />
                  <Route path="/live-draft/:sessionId/game" element={<LiveDraftPage />} />
                  <Route path="/live-draft/:sessionId" element={<LiveDraftPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
