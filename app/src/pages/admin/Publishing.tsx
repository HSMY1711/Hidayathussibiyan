import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, StatusBadge, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

export default function Publishing() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => api.get('/api/admin/programs').then((d) => setRows(d.programs));
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const total = rows?.length ?? 0;
  const announced = rows?.filter((r) => r.announced).length ?? 0;

  const toggle = async (p: any) => {
    try {
      await api.post(`/api/admin/programs/${p.id}/announce`, { announced: !p.announced });
      toast.success(p.announced ? `“${p.name}” is now Draft / Not Announced.` : `“${p.name}” announced publicly.`);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const renderRow = (p: any, mobile = false) => mobile ? (
    <Card key={p.id} className="stat-card">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{p.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{p.gender} · {p.zone}</div>
        </div>
        <StatusBadge on={!!p.announced} onLabel="Announced" offLabel="Draft" />
        <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={() => toggle(p)} disabled={locked}>
          {p.announced ? 'Retract' : 'Release'}
        </Button>
      </CardContent>
    </Card>
  ) : (
    <TableRow key={p.id}>
      <TableCell className="font-medium">{p.name}</TableCell>
      <TableCell>{p.gender}</TableCell>
      <TableCell>{p.zone}</TableCell>
      <TableCell><StatusBadge on={!!p.announced} onLabel="Announced / Published" offLabel="Draft / Not Announced" /></TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" className="h-9" onClick={() => toggle(p)} disabled={locked}>
          {p.announced ? 'Retract' : 'Release to public'}
        </Button>
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title="Announcements / Publishing"
        desc="A program becomes public only when it is explicitly released here. Draft programs are never visible on the public page."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:max-w-md">
        <Card className="stat-card"><CardContent className="px-4 py-4">
          <div className="text-3xl font-semibold tabular-nums">{announced}</div>
          <div className="mt-1 text-xs text-muted-foreground">Program Announced</div>
        </CardContent></Card>
        <Card className="stat-card"><CardContent className="px-4 py-4">
          <div className="text-3xl font-semibold tabular-nums">{total - announced}</div>
          <div className="mt-1 text-xs text-muted-foreground">Program Remaining to Announce</div>
        </CardContent></Card>
      </div>

      <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead><TableHead>Gender</TableHead><TableHead>Zone</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Publishing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? <LoadingRows cols={5} rows={6} /> : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm italic text-muted-foreground">No programs configured yet.</TableCell></TableRow>
            ) : rows.map((p) => renderRow(p))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 md:hidden">
        {!rows ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-sm bg-muted" />)
          : rows.length === 0 ? <p className="py-10 text-center text-sm italic text-muted-foreground">No programs configured yet.</p>
          : rows.map((p) => renderRow(p, true))}
      </div>
    </div>
  );
}
