'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from './ThemeProvider';

const navItems = [
  { href: '/',           label: 'Search',    icon: '🔍', section: 'main' },
  { href: '/channels',   label: 'Channels',  icon: '📺', section: 'main' },
  { href: '/videos',     label: 'Videos',    icon: '🎬', section: 'main' },
  { href: '/bookmarks',  label: 'Bookmarks', icon: '🔖', section: 'library' },
  { href: '/analytics',  label: 'Analytics', icon: '📊', section: 'library' },
  { href: '/history',    label: 'History',   icon: '🕐', section: 'library' },
  { href: '/settings',   label: 'Settings',  icon: '⚙️',  section: 'system' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();

  const sections = [
    { key: 'main', label: 'Navigation' },
    { key: 'library', label: 'Library' },
    { key: 'system', label: 'System' },
  ];

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() ?? '?';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎯</div>
        <span className="sidebar-logo-text">CaptionHunt</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.key}>
            <div className="sidebar-section-label">{section.label}</div>
            {navItems
              .filter((item) => item.section === section.key)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
          </div>
        ))}
      </nav>

      {/* Footer: user + theme toggle */}
      <div className="sidebar-footer">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="sidebar-link"
          style={{ marginBottom: '0.5rem' }}
          aria-label="Toggle theme"
        >
          <span className="sidebar-link-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* User info */}
        {session?.user && (
          <div
            className="user-info"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            title="Sign out"
          >
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{session.user.name ?? 'User'}</div>
              <div className="user-email">{session.user.email}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
