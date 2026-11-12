import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

export default function JudgeMarks() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [programs, setPrograms] = useState<any[]>([]);
  const [scheme, setScheme] = useState<any>({ components: [] });
  const [progId, setProgId] = useState('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const loadBase = () => api.get('/api/admin/judge-marks').then((d) => {
    setPrograms(d.programs);
    setScheme(d.scheme);
  });
  useEffect(() => { loadBase().catch((e) => toast.error(e.message)); }, []);

  useEffect(() => {
    if (!progId) return;
    setLoading(true);
    api.get(`/api/admin/judge-marks?program_id=${progId}`)
      .then((d) => { setParticipants(d.participants); setMarks(d.marks); setScheme(d.scheme); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [progId]);

  const prog = programs.find((p) => String(p.id) === progId);

  const setComponent = (judge: number, pid: number, idx: number, value: string) => {
    const key = `${judge}:${pid}`;
    const cur = marks[key]?.components ?? scheme.components.map(() => 0);
    const next = [...cur];
    while (next.length < scheme.components.length) next.push(0);
    next[idx] = value === '' ? 0 : Math.max(0, Number(value) || 0);
    const total = next.reduce((a, b) => a + b, 0);
    setMarks((m) => ({ ...m, [key]: { components: next, total } }));
  };

  const saveMark = async (judge: number, pid: number) => {
    const key = `${judge}:${pid}`;
    const entry = marks[key];
    if (!entry) return;
    try {
      await api.put('/api/admin/judge-marks', {
        program_id: Number(progId), judge_no: judge, participant_id: pid, components: entry.components,
      });
      toast.success(`Judge ${judge} marks saved — calculated mark flows into the participant's score.`);
    } catch (e: any) { toast.error(e.message); }
  };

  const markEntry = (judge: number, pid: number) => marks[`${judge}:${pid}`];
  const judgeTotal = (judge: number, pid: number) => markEntry(judge, pid)?.total ?? 0;
  const calculated = (pid: number) => judgeTotal(1, pid) + judgeTotal(2, pid) + judgeTotal(3, pid);

  return (
    <div>
      <PageHeader
        title="Judge Marks"
        desc="Three judges per program. Enter each mark's components — totals are calculated automatically — and the calculated mark (J1 + J2 + J3) flows directly into participant and team scores. Use PDF Generation to print physical marking sheets."
      />

      <div className="mb-6 max-w-md space-y-1.5">
        <Label>Program</Label>
        <Select value={progId} onValueChange={setProgId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select a program" /></SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name} — {p.gender}, {p.zone}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {progId && (
        <div className="mb-4 rounded-sm border border-border bg-card px-4 py-3 text-sm">
          <span className="font-medium">{prog?.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            Marking scheme: {scheme.components.map((c: any) => `${c.label} (max ${c.max})`).join(' + ')} per judge
          </span>
        </div>
      )}

      {progId && (
        loading ? (
          <div className="overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full"><tbody><LoadingRows cols={4 + scheme.components.length * 3} rows={4} /></tbody></table>
          </div>
        ) : participants.length === 0 ? (
          <p className="rounded-sm border border-border bg-card px-4 py-8 text-center text-sm italic text-muted-foreground">
            No entrants in this program yet. Add entrants from Competitions / Programs first.
          </p>
        ) : (
          <div className="space-y-8">
            {[1, 2, 3].map((judge) => (
              <div key={judge} className="overflow-x-auto rounded-sm border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5">
                  <span className="section-label">Judge {judge}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Chest No.</TableHead>
                      {scheme.components.map((c: any, i: number) => (
                        <TableHead key={i} className="text-center">{c.label} <span className="text-muted-foreground">/ {c.max}</span></TableHead>
                      ))}
                      <TableHead className="text-center">Total Mark</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((p) => {
                      const entry = markEntry(judge, p.id);
                      const comps = entry?.components ?? [];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-[13px]">{p.chest_no}</TableCell>
                          {scheme.components.map((c: any, i: number) => (
                            <TableCell key={i} className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={c.max}
                                value={comps[i] ?? ''}
                                onChange={(e) => setComponent(judge, p.id, i, e.target.value)}
                                className="mx-auto h-9 w-16 text-center"
                                aria-label={`${c.label} mark for ${p.name}, judge ${judge}`}
                                disabled={locked}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold tabular-nums">{judgeTotal(judge, p.id)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="h-9" onClick={() => saveMark(judge, p.id)} disabled={locked || !entry}>Save</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}

            <div className="overflow-x-auto rounded-sm border border-border bg-card">
              <div className="border-b border-border px-4 py-2.5">
                <span className="section-label">Calculated Mark — Judge 1 + Judge 2 + Judge 3</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Chest No.</TableHead>
                    <TableHead className="text-center">J1</TableHead>
                    <TableHead className="text-center">J2</TableHead>
                    <TableHead className="text-center">J3</TableHead>
                    <TableHead className="text-right">Calculated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-[13px]">{p.chest_no}</TableCell>
                      <TableCell className="text-center tabular-nums">{judgeTotal(1, p.id)}</TableCell>
                      <TableCell className="text-center tabular-nums">{judgeTotal(2, p.id)}</TableCell>
                      <TableCell className="text-center tabular-nums">{judgeTotal(3, p.id)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{calculated(p.id)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}
      {!progId && (
        <p className="rounded-sm border border-border bg-card px-4 py-8 text-center text-sm italic text-muted-foreground">
          Select a program to enter judge marks digitally — no manual copying from paper sheets.
        </p>
      )}
    </div>
  );
}
