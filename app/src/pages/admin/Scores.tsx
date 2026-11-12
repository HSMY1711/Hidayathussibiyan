import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, LoadingRows } from './ui';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Search } from 'lucide-react';

export default function Scores() {
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/api/admin/scores').then(setD).catch(() => {}); }, []);

  const rows = (d?.participants ?? []).filter((p: any) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.chest_no.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Scores"
        desc="Every score is calculated from recorded results and judge marks. Nothing here is typed in by hand — edit results or judge marks and this page updates."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {(d?.teams ?? []).map((t: any, i: number) => (
          <Card key={t.id} className="stat-card">
            <CardContent className="px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{t.name}</span>
                {i === 0 && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: 'hsl(var(--gold))' }}><Trophy className="h-3.5 w-3.5" /> 1st</span>}
                {i === 1 && <span className="shrink-0 text-xs text-muted-foreground">2nd</span>}
              </div>
              <div className="font-display mt-1 text-3xl font-semibold tabular-nums">{t.score}</div>
            </CardContent>
          </Card>
        ))}
        {!d && <><div className="h-24 animate-pulse rounded-sm bg-muted" /><div className="h-24 animate-pulse rounded-sm bg-muted" /></>}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or Chest No…" className="h-11 pl-9" aria-label="Search scores" />
      </div>

      <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chest No.</TableHead><TableHead>Name</TableHead><TableHead>Team</TableHead>
              <TableHead>Zone</TableHead><TableHead>Gender</TableHead><TableHead className="text-right">Total Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!d ? <LoadingRows cols={6} rows={10} /> : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm italic text-muted-foreground">No participants yet.</TableCell></TableRow>
            ) : rows.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-[13px]">{p.chest_no}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.team_label}</TableCell>
                <TableCell>{p.zone}</TableCell>
                <TableCell>{p.gender}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{p.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 md:hidden">
        {!d ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-sm bg-muted" />)
          : rows.map((p: any) => (
            <Card key={p.id} className="stat-card">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.team_label} · {p.zone} · {p.gender}</div>
                </div>
                <span className="shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs">{p.chest_no}</span>
                <span className="shrink-0 text-lg font-semibold tabular-nums">{p.score}</span>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
