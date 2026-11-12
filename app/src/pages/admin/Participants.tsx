import { useEffect, useMemo, useState } from 'react';
import { api, ZONES, GENDERS, type Zone, type Gender } from '@/lib/api';
import { PageHeader, ConfirmDialog, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

const EMPTY = { name: '', team_id: '', zone: '' as Zone | '', gender: '' as Gender | '' };

export default function Participants() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [rows, setRows] = useState<any[] | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [filters, setFilters] = useState({ q: '', team: '', zone: '', gender: '' });
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<any>(null); // participant being edited
  const [deleting, setDeleting] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    return Promise.all([
      api.get(`/api/admin/participants${qs ? '?' + qs : ''}`),
      api.get('/api/admin/teams'),
    ]).then(([p, t]) => { setRows(p.participants); setTeams(t.teams); });
  };
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [filters]);

  const counts = useMemo(() => {
    if (!rows) return null;
    return {
      shown: rows.length,
      boys: rows.filter((r) => r.gender === 'Boys').length,
      girls: rows.filter((r) => r.gender === 'Girls').length,
    };
  }, [rows]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, team_id: String(p.team_id), zone: p.zone, gender: p.gender });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const d = await api.put(`/api/admin/participants/${editing.id}`, { ...form, team_id: Number(form.team_id) });
        toast.success(`Saved. ${d.chest_no !== editing.chest_no ? `New Chest No. ${d.chest_no} (zone change).` : ''}`);
      } else {
        const d = await api.post('/api/admin/participants', { ...form, team_id: Number(form.team_id) });
        toast.success(`Participant added with Chest No. ${d.chest_no}`);
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) { toast.error(err.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/api/admin/participants/${deleting.id}`);
      toast.success('Participant removed.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader
        title="Participants"
        desc="Hierarchy: Team → Zone → Gender → Participant. Chest numbers are generated automatically (Ground 100+, Zero 200+, High 300+, General 400+, continuous within each zone)."
      />

      {counts && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { l: 'Shown', v: counts.shown },
            { l: 'Boys', v: counts.boys },
            { l: 'Girls', v: counts.girls },
          ].map((c) => (
            <Card key={c.l} className="stat-card"><CardContent className="px-4 py-3">
              <div className="text-xl font-semibold tabular-nums">{c.v}</div>
              <div className="text-xs text-muted-foreground">{c.l}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search name…"
            className="h-11 pl-9"
            aria-label="Search participants"
          />
        </div>
        <Select value={filters.team} onValueChange={(v) => setFilters((f) => ({ ...f, team: v === 'all' ? '' : v }))}>
          <SelectTrigger className="h-11 sm:w-44"><SelectValue placeholder="All teams" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.zone} onValueChange={(v) => setFilters((f) => ({ ...f, zone: v === 'all' ? '' : v }))}>
          <SelectTrigger className="h-11 sm:w-44"><SelectValue placeholder="All zones" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.gender} onValueChange={(v) => setFilters((f) => ({ ...f, gender: v === 'all' ? '' : v }))}>
          <SelectTrigger className="h-11 sm:w-40"><SelectValue placeholder="All genders" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openAdd} disabled={locked} className="h-11 gap-1.5 sm:ml-auto">
          <Plus className="h-4 w-4" /> Add Participant
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chest No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? <LoadingRows cols={6} rows={8} /> : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm italic text-muted-foreground">No participants match.</TableCell></TableRow>
            ) : rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-[13px]">{p.chest_no}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.team_label}</TableCell>
                <TableCell>{p.zone}</TableCell>
                <TableCell>{p.gender}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(p)} disabled={locked} aria-label={`Edit ${p.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeleting(p)} disabled={locked} aria-label={`Delete ${p.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {!rows ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-sm bg-muted" />)
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-muted-foreground">No participants match.</p>
        ) : rows.map((p) => (
          <Card key={p.id} className="stat-card">
            <CardContent className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.team_label} · {p.zone} · {p.gender}</div>
                </div>
                <span className="shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs">{p.chest_no}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="h-10 flex-1" onClick={() => openEdit(p)} disabled={locked}>Edit</Button>
                <Button variant="outline" size="sm" className="h-10 flex-1 text-destructive" onClick={() => setDeleting(p)} disabled={locked}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'Edit Participant' : 'Add Participant'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Name</Label>
              <Input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })} required>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })} required>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} required>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <p className="rounded-sm border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Current Chest No. <span className="font-mono">{editing.chest_no}</span>.
                Changing the zone reassigns the Chest No. automatically to keep numbering rules consistent.
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save changes' : 'Add participant'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Remove participant?"
        description={`This permanently removes ${deleting?.name} (${deleting?.chest_no}) and their entries, judge marks, and result references. Team and zone counts update automatically.`}
        onConfirm={doDelete}
      />
    </div>
  );
}
