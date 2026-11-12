import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from './ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Teams() {
  const [teams, setTeams] = useState<any[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/api/admin/teams').then((d) => {
    setTeams(d.teams);
    setNames(Object.fromEntries(d.teams.map((t: any) => [t.id, t.name ?? ''])));
  });
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (id: number) => {
    setBusy(true);
    try {
      await api.put(`/api/admin/teams/${id}`, { name: names[id] });
      toast.success('Team name saved.');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Teams / Groups"
        desc="There are exactly two teams. Enter or edit their names — the names appear everywhere, including the live scoreboard, rankings, participant records, and PDFs."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t, i) => (
          <Card key={t.id} className="stat-card">
            <CardContent className="space-y-4 px-4 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`team-${t.id}`} className="section-label">Team {i + 1}</Label>
                <span className="text-xs text-muted-foreground">{t.count} members</span>
              </div>
              <Input
                id={`team-${t.id}`}
                value={names[t.id] ?? ''}
                onChange={(e) => setNames((n) => ({ ...n, [t.id]: e.target.value }))}
                placeholder={t.label}
                className="h-11"
              />
              <Button onClick={() => save(t.id)} disabled={busy} className="w-full sm:w-auto">Save</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Team names are never hard-coded: wherever a team is shown, the saved name (or “Team 1 / Team 2” until named) is used automatically.
      </p>
    </div>
  );
}
