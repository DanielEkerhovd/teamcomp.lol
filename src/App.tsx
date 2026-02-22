import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './pages/HomePage';
import EnemyTeamPage from './pages/EnemyTeamPage';
import MyTeamPage from './pages/MyTeamPage';
import ChampionPoolPage from './pages/ChampionPoolPage';
import DraftPage from './pages/DraftPage';
import ToolsPage from './pages/ToolsPage';
import FirstTimeSetupModal from './components/onboarding/FirstTimeSetupModal';
import SettingsModal from './components/settings/SettingsModal';

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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function Sidebar({ collapsed, setCollapsed, onSettingsClick }: { collapsed: boolean; setCollapsed: (v: boolean) => void; onSettingsClick: () => void }) {
  const navItems = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/draft', label: 'Draft', icon: DraftIcon },
    { to: '/enemy-teams', label: 'Enemy Teams', icon: EnemyIcon },
    { to: '/my-teams', label: 'My Teams', icon: TeamIcon },
    { to: '/champion-pool', label: 'Pools', icon: ChampionIcon },
    { to: '/tools', label: 'Tools', icon: ToolsIcon },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-lol-dark border-r border-lol-border
        flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden
        ${collapsed ? 'w-[72px]' : 'w-[240px]'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center border-b border-lol-border shrink-0 px-4">
        <NavLink to="/" className="flex items-center gap-3 group overflow-hidden">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-lol-gold-light to-lol-gold flex items-center justify-center text-lol-dark font-bold text-lg shadow-lg shadow-lol-gold/20">
            TC
          </div>
          <span className={`text-lg font-bold text-white group-hover:text-lol-gold transition-all duration-300 whitespace-nowrap ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            Teamcomp.lol
          </span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200 group relative
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
                <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>{item.label}</span>
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-lol-surface/50 border border-lol-border group relative">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-linear-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-semibold text-sm">
            ?
          </div>
          <div className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            <div className="text-sm font-medium text-white truncate">Guest User</div>
            <div className="text-xs text-gray-500">Not signed in</div>
          </div>
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Guest User
            </div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="border-t border-lol-border p-3 space-y-1">
        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-lol-surface transition-all duration-200 group relative"
        >
          <span className="shrink-0"><SettingsIcon /></span>
          <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Settings</span>
          {collapsed && (
            <div className="absolute left-full ml-3 px-3 py-2 bg-lol-card border border-lol-border rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
              Settings
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-lol-surface transition-all duration-200"
        >
          <span className="shrink-0"><CollapseIcon collapsed={collapsed} /></span>
          <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-lol-gray">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <main
        className={`transition-all duration-300 ease-in-out min-h-screen ${
          collapsed ? 'ml-[72px]' : 'ml-[240px]'
        }`}
      >
        <div className="px-8 py-6">{children}</div>
      </main>

      {/* Modals */}
      <FirstTimeSetupModal />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/draft" element={<DraftPage />} />
          <Route path="/enemy-teams" element={<EnemyTeamPage />} />
          <Route path="/my-teams" element={<MyTeamPage />} />
          <Route path="/champion-pool" element={<ChampionPoolPage />} />
          <Route path="/tools" element={<ToolsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
