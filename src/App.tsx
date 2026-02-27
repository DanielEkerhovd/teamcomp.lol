import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
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
import FirstTimeSetupModal from './components/onboarding/FirstTimeSetupModal';
import UsernameSetupModal from './components/onboarding/UsernameSetupModal';
import { AuthProvider } from './contexts/AuthContext';
import UserMenu from './components/auth/UserMenu';
import { FriendsNavItem } from './components/notifications';
import { NotificationBell } from './components/notifications';
import { useTierLimits } from './stores/useAuthStore';

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
  const { maxTeams } = useTierLimits();
  const myTeamLabel = maxTeams <= 1 ? 'My Team' : 'My Teams';

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
    { to: '/tools', label: 'Tools', icon: ToolsIcon },
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

        <NavDivider label="Utilities" collapsed={collapsed} />

        {/* Utilities section */}
        <div className="space-y-1">
          {utilNavItems.map(renderNavItem)}
          {/* Friends nav item (only for authenticated users) */}
          <FriendsNavItem collapsed={collapsed} />
        </div>
      </nav>

      {/* Notification bell + User section */}
      <div className="px-3 pb-3 space-y-2">
        <NotificationBell collapsed={collapsed} />
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
        <div className="px-8 py-6">{children}</div>
      </main>

      {/* Modals */}
      <FirstTimeSetupModal />
      <UsernameSetupModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
                  <Route path="/live-draft" element={<LiveDraftListPage />} />
                  <Route path="/live-draft/join/:token" element={<JoinLiveDraftPage />} />
                  <Route path="/live-draft/lobby/:sessionId" element={<LiveDraftPage />} />
                  <Route path="/live-draft/:sessionId/game" element={<LiveDraftPage />} />
                  <Route path="/live-draft/:sessionId" element={<LiveDraftPage />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
