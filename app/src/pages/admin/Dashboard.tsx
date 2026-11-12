import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { PageHeader, LoadingRows } from './ui';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get('/api/admin/dashboard').then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-destructive">{err}</p>;

  const cards = d ? [
    { label: 'Total Participants', value: d.counts.participants, to: '/admin/participants' },
    { label: 'Programs Configured', value: d.counts.programs, to: '/admin/programs' },
    { label: 'Programs Announced', value: d.counts.announced, to: '/admin/publishing' },
    { label: 'Results Recorded', value: d.counts.results, to: '/admin/results' },
    { label: 'Results Published', value: d.counts.publishedResults, to: '/admin/results' },
    { label: 'PDFs Published', value: `${d.counts.publishedPdfs} / ${d.counts.pdfs}`, to: '/admin/documents' },
  ] : [];

  return (
    <div>
      <PageHeader title="Dashboard" desc="Live overview of the Jashne Rabeeh management system." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {d ? cards.map((c) => (
          <Link key={c.to} to={c.to} className="block">
            <Card className="stat-card h-full transition-colors hover:bg-muted/60">
              <CardContent className="px-4 py-4">
                <div className="text-2xl font-semibold tabular-nums md:text-3xl">{c.value}</div>
                <div className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">{c.label}</div>
              </CardContent>
            </Card>
          </Link>
        )) : Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="stat-card h-full"><CardContent className="px-4 py-4">
            <div className="h-12 animate-pulse rounded bg-muted" />
          </CardContent></Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display mb-3 text-lg font-semibold">Teams</h2>
          {!d ? (
            <table className="w-full"><tbody><LoadingRows cols={3} rows={2} /></tbody></table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div>
          <h2 className="font-display mb-3 text-lg font-semibold">Zone & Gender Counts</h2>
          {!d ? (
            <table className="w-full"><tbody><LoadingRows cols={2} rows={6} /></tbody></table>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Zone</TableHead><TableHead className="text-right">Participants</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {d.zoneCounts.map((z: any) => (
                    <TableRow key={z.zone}>
                      <TableCell>{z.zone}</TableCell>
                      <TableCell className="text-right tabular-nums">{z.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Gender</TableHead><TableHead className="text-right">Participants</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(d.genderCounts).map(([g, c]: any) => (
                    <TableRow key={g}>
                      <TableCell>{g}</TableCell>
                      <TableCell className="text-right tabular-nums">{c}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
