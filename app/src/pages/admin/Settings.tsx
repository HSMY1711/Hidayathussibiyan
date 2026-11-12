import { useEffect, useRef, useState } from 'react';
import { api, ZONES } from '@/lib/api';
import { PageHeader, ConfirmDialog } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';
import { Star, PenLine, ImagePlus, Trash2, KeyRound, UserPlus } from 'lucide-react';

const STAR_ZONES = [...ZONES, 'Overall'];
const PEN_ZONES = [...ZONES, 'Overall'];

function StarSection({ kind, title, desc, zones }: { kind: 'star' | 'pen'; title: string; desc: string; zones: string[] }) {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [sel, setSel] = useState<Record<string, any>>({});
  const [chest, setChest] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/api/admin/stars').then((d) => setSel(d[kind])).catch(() => {});
  }, [kind]);

  const save = async (zone: string) => {
    try {
      const d = await api.put('/api/admin/stars', { kind, zone, chest_no: (chest[zone] ?? '').trim() });
      toast.success(d.name ? `${zone}: ${d.name} selected.` : `${zone} selection cleared.`);
      const all = await api.get('/api/admin/stars');
      setSel(all[kind]);
      setChest((c) => ({ ...c, [zone]: '' }));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {kind === 'star' ? <Star className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} /> : <PenLine className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />}
          <CardTitle className="font-display text-base">{title}</CardTitle>
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {zones.map((z) => (
          <div key={z} className="flex flex-col gap-2 rounded-sm border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center">
            <span className={`w-32 shrink-0 text-sm ${z === 'Overall' ? 'font-semibold' : 'text-muted-foreground'}`}>{z === 'Overall' ? `Overall ${kind === 'star' ? 'Star' : 'Pen'}` : z}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {sel[z]?.name ? <>{sel[z].name} <span className="ml-1 font-mono text-xs text-muted-foreground">{sel[z].chest_no}</span></> : <span className="italic text-muted-foreground">Not selected</span>}
            </span>
            <div className="flex gap-2">
              <Input
                value={chest[z] ?? ''}
                onChange={(e) => setChest((c) => ({ ...c, [z]: e.target.value }))}
                placeholder="Chest No."
                className="h-10 w-28 font-mono"
                aria-label={`Chest number for ${z}`}
                disabled={locked}
              />
              <Button size="sm" className="h-10" onClick={() => save(z)} disabled={locked || !(chest[z] ?? '').trim()}>Set</Button>
              <Button size="sm" variant="outline" className="h-10" onClick={() => api.put('/api/admin/stars', { kind, zone: z, chest_no: '' }).then(async () => { setSel((await api.get('/api/admin/stars'))[kind]); toast.success('Cleared.'); }).catch((e) => toast.error(e.message))} disabled={locked || !sel[z]}>Clear</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { locked, user } = useOutletContext<{ locked: boolean; user: any }>();
  const isOwner = user?.role === 'owner';

  const [s, setS] = useState<any>(null);
  const [eventName, setEventName] = useState('');
  const [pm, setPm] = useState({ first: 10, second: 8, third: 5 });
  const [scheme, setScheme] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' });
  const [pwChange, setPwChange] = useState({ current: '', password: '' });
  const [deletingUser, setDeletingUser] = useState<any>(null);

  const load = () => {
    api.get('/api/admin/settings').then((d) => {
      setS(d); setEventName(d.event_name); setPm(d.position_marks); setScheme(d.marking_scheme.components);
    });
    if (isOwner) api.get('/api/admin/users').then((d) => setUsers(d.users)).catch(() => {});
  };
  useEffect(load, [isOwner]);

  const saveSettings = async () => {
    try {
      await api.put('/api/admin/settings', { event_name: eventName, position_marks: pm, marking_scheme: { components: scheme } });
      toast.success('Settings saved. Score calculations use the new values.');
    } catch (e: any) { toast.error(e.message); }
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.post('/api/admin/settings/logo', fd);
      toast.success('Logo updated — it appears on the public page.');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeLogo = async () => {
    try {
      await api.del('/api/admin/settings/logo');
      toast.success('Logo removed.');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const addUser = async () => {
    try {
      await api.post('/api/admin/users', newUser);
      toast.success(`Account “${newUser.username}” created.`);
      setNewUser({ username: '', password: '', role: 'admin' });
      api.get('/api/admin/users').then((d) => setUsers(d.users));
    } catch (e: any) { toast.error(e.message); }
  };

  const changePassword = async () => {
    try {
      await api.put('/api/auth/password', pwChange);
      toast.success('Password changed.');
      setPwChange({ current: '', password: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Jashne Rabeeh Settings" desc="Identity, scoring configuration, honours selections, and account management." />

      <div className="space-y-6">
        {/* Identity */}
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Name & Logo</CardTitle>
            <CardDescription>Shown at the top of the public Jashne Rabeeh page. Fully editable — nothing is hard-coded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evname">Jashne Rabeeh name</Label>
              <Input id="evname" value={eventName} onChange={(e) => setEventName(e.target.value)} className="h-11 max-w-md" disabled={locked} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
              <Button variant="outline" className="h-11 gap-1.5" onClick={() => fileRef.current?.click()} disabled={locked}>
                <ImagePlus className="h-4 w-4" /> Upload logo
              </Button>
              {s?.logo_set && (
                <Button variant="outline" className="h-11 gap-1.5 text-destructive" onClick={removeLogo} disabled={locked}>
                  <Trash2 className="h-4 w-4" /> Remove logo
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{s?.logo_set ? 'A custom logo is set.' : 'No logo uploaded — a placeholder emblem is shown.'}</span>
            </div>
            <Button onClick={saveSettings} disabled={locked} className="w-full sm:w-auto">Save settings</Button>
          </CardContent>
        </Card>

        {/* Position marks */}
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Position Marks</CardTitle>
            <CardDescription>Marks awarded for 1st / 2nd / 3rd place. Changes apply to all score calculations immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([['first', '1st place'], ['second', '2nd place'], ['third', '3rd place']] as const).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`pm-${k}`}>{label}</Label>
                  <Input id={`pm-${k}`} type="number" min={0} value={pm[k]} onChange={(e) => setPm({ ...pm, [k]: Number(e.target.value) || 0 })} className="h-11" disabled={locked} />
                </div>
              ))}
            </div>
            <Button onClick={saveSettings} disabled={locked} className="mt-4 w-full sm:w-auto">Save settings</Button>
          </CardContent>
        </Card>

        {/* Marking scheme */}
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Judge Marking Structure</CardTitle>
            <CardDescription>The components of each judge's mark. Example: Content (max 8) + Presentation (max 2) = Total Mark 10.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheme.map((c, i) => (
              <div key={i} className="flex max-w-md items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Component {i + 1}</Label>
                  <Input value={c.label} onChange={(e) => setScheme(scheme.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="h-11" disabled={locked} />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label>Max</Label>
                  <Input type="number" min={0} value={c.max} onChange={(e) => setScheme(scheme.map((x, j) => j === i ? { ...x, max: Number(e.target.value) || 0 } : x))} className="h-11" disabled={locked} />
                </div>
                <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => setScheme(scheme.filter((_, j) => j !== i))} disabled={locked || scheme.length <= 1} aria-label="Remove component">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" onClick={() => setScheme([...scheme, { label: '', max: 10 }])} disabled={locked || scheme.length >= 6}>Add component</Button>
              <Button onClick={saveSettings} disabled={locked}>Save settings</Button>
            </div>
          </CardContent>
        </Card>

        {/* Honours */}
        <StarSection kind="star" title="Star of the Fest — Boys" desc="Select participants by Chest No. for each zone and the overall title. Admin decision — no automatic formula." zones={STAR_ZONES} />
        <StarSection kind="pen" title="Pen of the Fest — Girls" desc="Select participants by Chest No. for each zone and the overall title. Admin decision — no automatic formula." zones={PEN_ZONES} />

        {/* Accounts */}
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
              <CardTitle className="font-display text-base">Your Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <Input type="password" placeholder="Current password" value={pwChange.current} onChange={(e) => setPwChange({ ...pwChange, current: e.target.value })} className="h-11" autoComplete="current-password" />
              <Input type="password" placeholder="New password (min 6)" value={pwChange.password} onChange={(e) => setPwChange({ ...pwChange, password: e.target.value })} className="h-11" autoComplete="new-password" />
            </div>
            <Button className="mt-3 w-full sm:w-auto" onClick={changePassword} disabled={locked || !pwChange.current || pwChange.password.length < 6}>Change password</Button>
          </CardContent>
        </Card>

        {isOwner && (
          <Card className="stat-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
                <CardTitle className="font-display text-base">Admin Accounts</CardTitle>
              </div>
              <CardDescription>Owner-only. Admins can operate the system but can never remove the Owner account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-sm border border-border bg-background px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.username}</span>
                    <span className="shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 text-xs capitalize">{u.role}</span>
                    {u.role !== 'owner' && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeletingUser(u)} disabled={locked} aria-label={`Remove ${u.username}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
                <Input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="h-11" />
                <Input type="password" placeholder="Password (min 6)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="h-11" autoComplete="new-password" />
                <Button className="h-11" onClick={addUser} disabled={locked || !newUser.username || newUser.password.length < 6}>Add admin</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={() => setDeletingUser(null)}
        title="Remove admin account?"
        description={`This permanently removes “${deletingUser?.username}”. They will be signed out and lose all access.`}
        onConfirm={async () => {
          try {
            await api.del(`/api/admin/users/${deletingUser.id}`);
            toast.success('Account removed.');
            api.get('/api/admin/users').then((d) => setUsers(d.users));
          } catch (e: any) { toast.error(e.message); }
        }}
      />
    </div>
  );
}
