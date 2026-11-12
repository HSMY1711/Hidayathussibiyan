import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, StatusBadge, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

export default function Results() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [programs, setPrograms] = useState<any[] | null>(null);
  const [results, setResults] = useState<Record<number, any>>({});
  const [progId, setProgId] = useState('');
  const [form, setForm] = useState({ first: '', second: '', third: '' });
  const [publish, setPublish] = useState(false);

  const load = () => api.get('/api/admin/results').then((d) => {
    setPrograms(d.programs);
    setResults(Object.fromEntries(d.results.map((r: any) => [r.program_id, r])));
  });
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const prog = programs?.find((p) => String(p.id) === progId);
  const existing = prog ? results[prog.id] : null;

  useEffect(() => {
    if (existing) {
      setForm({ first: existing.first_chest ?? '', second: existing.second_chest ?? '', third: existing.third_chest ?? '' });
      setPublish(!!existing.published);
    } else {
      setForm({ first: '', second: '', third: '' });
      setPublish(false);
    }
  }, [progId]);

  const chestInfo = (chest: string) => {
    if (!chest.trim()) return null;
    return null; // validation happens server-side; info shown after save
  };
  void chestInfo;

  const save = async () => {
    if (!prog) return;
    try {
      await api.put(`/api/admin/results/${prog.id}`, {
        first_chest: form.first.trim() || null,
        second_chest: form.second.trim() || null,
        third_chest: form.third.trim() || null,
        published: publish,
      });
      toast.success('Result saved. Scores, scoreboard, and rankings updated automatically.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const rankRows = programs?.map((p) => {
    const r = results[p.id];
    return { p, r };
  });

  return (
    <div>
      <PageHeader
        title="Results"
        desc="Enter Chest Numbers for 1st, 2nd, and 3rd place. The system identifies each participant automatically — names are never re-typed. Position marks are added to participant and team totals at once."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display mb-3 text-lg font-semibold">Record / Edit a Result</h2>
          <div className="rounded-sm border border-border bg-card p-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select value={progId} onValueChange={setProgId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select a program" /></SelectTrigger>
                  <SelectContent>
                    {(programs ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} — {p.gender}, {p.zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {prog && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([['first', '1st place'], ['second', '2nd place'], ['third', '3rd place']] as const).map(([k, label]) => (
                      <div key={k} className="space-y-1.5">
                        <Label htmlFor={`chest-${k}`}>{label}</Label>
                        <Input
                          id={`chest-${k}`}
                          value={form[k]}
                          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                          placeholder="e.g. JR-102"
                          className="h-11 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marks on save — 1st, 2nd, 3rd place receive the configured position marks and flow into participant totals, team totals, the live scoreboard, and rankings. Changing a result recalculates everything affected.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="pub"
                      type="checkbox"
                      checked={publish}
                      onChange={(e) => setPublish(e.target.checked)}
                      className="h-4 w-4 accent-[#0c3b3e]"
                    />
                    <Label htmlFor="pub" className="font-normal">Publish result to the public page</Label>
                  </div>
                  <Button onClick={save} disabled={locked} className="w-full sm:w-auto">Save result</Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display mb-3 text-lg font-semibold">All Programs</h2>
          <div className="hidden rounded-sm border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead><TableHead>Result</TableHead><TableHead>Public</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rankRows ? <LoadingRows cols={3} rows={6} /> : rankRows.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-10 text-center text-sm italic text-muted-foreground">No programs configured yet.</TableCell></TableRow>
                ) : rankRows.map(({ p, r }) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.gender} · {p.zone}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r ? (
                        <>1st {r.first_chest ?? '—'}<br />2nd {r.second_chest ?? '—'}<br />3rd {r.third_chest ?? '—'}</>
                      ) : <span className="italic text-muted-foreground">Not entered</span>}
                    </TableCell>
                    <TableCell><StatusBadge on={!!r?.published} onLabel="Published" offLabel="Hidden" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {!rankRows ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-sm bg-muted" />)
              : rankRows.map(({ p, r }) => (
                <Card key={p.id} className="stat-card">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {r ? `1st ${r.first_chest ?? '—'} · 2nd ${r.second_chest ?? '—'} · 3rd ${r.third_chest ?? '—'}` : 'Result not entered'}
                        </div>
                      </div>
                      <StatusBadge on={!!r?.published} onLabel="Public" offLabel="Hidden" />
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
