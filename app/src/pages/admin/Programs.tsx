import { useEffect, useState } from 'react';
import { api, ZONES, GENDERS } from '@/lib/api';
import { PageHeader, ConfirmDialog, StatusBadge, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

export default function Programs() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [rows, setRows] = useState<any[] | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', gender: '', zone: '' });
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entrantProg, setEntrantProg] = useState<any>(null);
  const [entrantId, setEntrantId] = useState('');

  const load = () => Promise.all([
    api.get('/api/admin/programs'),
    api.get('/api/admin/participants'),
  ]).then(([p, pa]) => { setRows(p.programs); setParticipants(pa.participants); });

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', gender: '', zone: '' }); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, gender: p.gender, zone: p.zone });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/api/admin/programs/${editing.id}`, form);
      else await api.post('/api/admin/programs', form);
      toast.success(editing ? 'Program updated.' : 'Program added as Draft / Not Announced.');
      setDialogOpen(false);
      await load();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleAnnounce = async (p: any) => {
    try {
      await api.post(`/api/admin/programs/${p.id}/announce`, { announced: !p.announced });
      toast.success(p.announced ? 'Program unpublished (now Draft).' : 'Program announced publicly.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/api/admin/programs/${deleting.id}`);
      toast.success('Program removed.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const [entMap, setEntMap] = useState<Record<number, number[]>>({});
  useEffect(() => {
    if (!rows) return;
    Promise.all(rows.map((r) => api.get(`/api/admin/judge-marks?program_id=${r.id}`).then((d) => [r.id, d.participants.map((x: any) => x.id)] as const)))
      .then((pairs) => setEntMap(Object.fromEntries(pairs as any)))
      .catch(() => {});
  }, [rows]);

  const addEntrant = async () => {
    if (!entrantProg || !entrantId) return;
    try {
      await api.post('/api/admin/participations', { participant_id: Number(entrantId), program_id: entrantProg.id });
      toast.success('Participant entered into program.');
      setEntrantId('');
      await load();
      const d = await api.get(`/api/admin/judge-marks?program_id=${entrantProg.id}`);
      setEntMap((m) => ({ ...m, [entrantProg.id]: d.participants.map((x: any) => x.id) }));
    } catch (e: any) { toast.error(e.message); }
  };

  const removeEntrant = async (pid: number, participantId: number) => {
    try {
      await api.del('/api/admin/participations', { participant_id: participantId, program_id: pid });
      toast.success('Entrant removed.');
      await load();
      const d = await api.get(`/api/admin/judge-marks?program_id=${pid}`);
      setEntMap((m) => ({ ...m, [pid]: d.participants.map((x: any) => x.id) }));
    } catch (e: any) { toast.error(e.message); }
  };

  const candidatesFor = (prog: any) => participants.filter(
    (p) => p.gender === prog.gender && !(entMap[prog.id] ?? []).includes(p.id),
  );

  const renderRow = (p: any, mobile = false) => {
    const ids = entMap[p.id] ?? [];
    if (mobile) {
      return (
        <Card key={p.id} className="stat-card">
          <CardContent className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{p.gender} · {p.zone} · {ids.length} entrants</div>
              </div>
              <StatusBadge on={!!p.announced} onLabel="Announced" offLabel="Draft" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-10" onClick={() => setEntrantProg(p)} disabled={locked}>Entrants</Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => toggleAnnounce(p)} disabled={locked}>{p.announced ? 'Unpublish' : 'Announce'}</Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => openEdit(p)} disabled={locked}>Edit</Button>
              <Button variant="outline" size="sm" className="h-10 text-destructive" onClick={() => setDeleting(p)} disabled={locked}>Delete</Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <TableRow key={p.id}>
        <TableCell className="font-medium">{p.name}</TableCell>
        <TableCell>{p.gender}</TableCell>
        <TableCell>{p.zone}</TableCell>
        <TableCell className="tabular-nums">{ids.length}</TableCell>
        <TableCell><StatusBadge on={!!p.announced} onLabel="Announced" offLabel="Draft / Not Announced" /></TableCell>
        <TableCell className="text-right">
          <div className="inline-flex flex-wrap justify-end gap-1">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setEntrantProg(p)} disabled={locked}>Entrants</Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => toggleAnnounce(p)} disabled={locked}>{p.announced ? 'Unpublish' : 'Announce'}</Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(p)} disabled={locked} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeleting(p)} disabled={locked} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div>
      <PageHeader
        title="Competitions / Programs"
        desc="Programs are created as Drafts and become public only when explicitly announced. Program names are entered by you — nothing is pre-filled."
      />

      <div className="mb-4 flex justify-end">
        <Button onClick={openAdd} disabled={locked} className="h-11 gap-1.5"><Plus className="h-4 w-4" /> Add Program</Button>
      </div>

      <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Entrants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? <LoadingRows cols={6} rows={6} /> : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm italic text-muted-foreground">No programs yet. Add the first one — it stays private until announced.</TableCell></TableRow>
            ) : rows.map((p) => renderRow(p))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 md:hidden">
        {!rows ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-sm bg-muted" />)
          : rows.length === 0 ? <p className="py-10 text-center text-sm italic text-muted-foreground">No programs yet.</p>
          : rows.map((p) => renderRow(p, true))}
      </div>

      {/* Add / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit Program' : 'Add Program'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prname">Program name</Label>
              <Input id="prname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} required>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Zone / Category</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })} required>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save changes' : 'Add as Draft'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entrants management */}
      <Dialog open={!!entrantProg} onOpenChange={() => setEntrantProg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Entrants — {entrantProg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={entrantId} onValueChange={setEntrantId}>
                <SelectTrigger className="h-11 flex-1"><SelectValue placeholder={`Select a ${entrantProg?.gender?.toLowerCase() ?? ''} participant…`} /></SelectTrigger>
                <SelectContent>
                  {entrantProg && candidatesFor(entrantProg).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.chest_no}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addEntrant} disabled={locked || !entrantId} className="h-11 gap-1.5"><UserPlus className="h-4 w-4" /> Enter</Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {entrantProg && (entMap[entrantProg.id] ?? []).length === 0 && (
                <p className="text-sm italic text-muted-foreground">No entrants yet. Enter participants so results and judge marks can be recorded for this program.</p>
              )}
              {entrantProg && participants.filter((x) => (entMap[entrantProg.id] ?? []).includes(x.id)).map((x) => (
                <div key={x.id} className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{x.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{x.chest_no}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeEntrant(entrantProg.id, x.id)} disabled={locked} aria-label={`Remove ${x.name}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Remove program?"
        description={`This permanently removes “${deleting?.name}”, its entrants, judge marks, and any recorded result.`}
        onConfirm={doDelete}
      />
    </div>
  );
}
