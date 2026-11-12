import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  LayoutDashboard, Users, UserRound, Trophy, Megaphone, Award, Star, ClipboardPen,
  FileText, FolderOpen, Settings as SettingsIcon, Lock, LockOpen, Menu, LogOut, Home,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/teams', label: 'Teams', icon: Users },
  { to: '/admin/participants', label: 'Participants', icon: UserRound },
  { to: '/admin/programs', label: 'Competitions / Programs', icon: Trophy },
  { to: '/admin/publishing', label: 'Announcements / Publishing', icon: Megaphone },
  { to: '/admin/results', label: 'Results', icon: Award },
  { to: '/admin/scores', label: 'Scores', icon: Star },
  { to: '/admin/judge-marks', label: 'Judge Marks', icon: ClipboardPen },
  { to: '/admin/pdf-generation', label: 'PDF Generation', icon: FileText },
  { to: '/admin/documents', label: 'Published Documents', icon: FolderOpen },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

function NavItems({ onNavigate, locked }: { onNavigate?: () => void; locked: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end as boolean | undefined}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-[44px] items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
            }`
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="leading-snug">{item.label}</span>
        </NavLink>
      ))}
      {locked && (
        <div className="mt-4 flex items-center gap-2 rounded-sm border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/80">
          <Lock className="h-3.5 w-3.5" /> System is locked
        </div>
      )}
    </nav>
  );
}

export default function AdminLayout() {
  const [user, setUser] = useState<any>(null);
  const [locked, setLocked] = useState(false);
  const [booted, setBooted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me')
      .then((d) => { setUser(d.user); setLocked(d.locked); setBooted(true); })
      .catch(() => navigate('/admin/login', { replace: true }));
  }, [navigate]);

  const logout = async () => {
    await api.post('/api/auth/logout');
    navigate('/admin/login');
  };

  const toggleLock = async () => {
    try {
      const d = await api.post('/api/admin/lock', { locked: !locked });
      setLocked(d.locked);
      toast.success(d.locked ? 'Jashne Rabeeh management locked.' : 'Jashne Rabeeh management unlocked.');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!booted) return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div className="border-b border-sidebar-border px-5 py-5">
          <div className="section-label">Hidayathussibiyan Madarasa</div>
          <div className="font-display mt-1 text-lg font-semibold">Jashne Rabeeh</div>
          <div className="mt-1 text-xs text-sidebar-foreground/70">Administration</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavItems locked={locked} />
        </div>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/70">
          Signed in as <span className="font-medium text-sidebar-foreground">{user?.username}</span>
          <span className="ml-1 opacity-60">({user?.role})</span>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <div className="border-b border-sidebar-border px-5 py-5">
                <div className="section-label">Hidayathussibiyan Madarasa</div>
                <div className="font-display mt-1 text-lg font-semibold">Jashne Rabeeh</div>
              </div>
              <div className="px-3 py-4">
                <NavItems locked={locked} onNavigate={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="font-display min-w-0 flex-1 truncate text-base font-semibold">Jashne Rabeeh — Admin</div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden h-14 items-center justify-end gap-2 border-b bg-card px-6 lg:flex">
          <Button variant="outline" size="sm" onClick={toggleLock} className="gap-1.5">
            {locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {locked ? 'Unlock System' : 'Lock System'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-1.5">
            <Home className="h-4 w-4" /> Public Page
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </header>

        {/* Mobile utility row */}
        <div className="flex items-center justify-end gap-2 border-b bg-card px-3 py-2 lg:hidden">
          <span className="mr-auto text-xs text-muted-foreground">{user?.username} ({user?.role})</span>
          <Button variant="outline" size="sm" onClick={toggleLock} className="h-11 gap-1.5">
            {locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-11 gap-1.5">
            <Home className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="h-11 gap-1.5">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet context={{ locked, user }} />
        </main>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
