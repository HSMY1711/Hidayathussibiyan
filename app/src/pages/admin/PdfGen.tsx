import { useEffect, useState } from 'react';
import { api, ZONES, GENDERS, type Zone, type Gender } from '@/lib/api';
import { PageHeader } from './ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Users, ClipboardPen } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useOutletContext } from 'react-router';

export default function PdfGen() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [jGender, setJGender] = useState<Gender | ''>('');
  const [jZone, setJZone] = useState<Zone | '' | 'all'>('all');
  const [busy, setBusy] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/api/admin/teams').then((d) => setTeams(d.teams)).catch(() => {}); }, []);

  const generate = async (kind: string, body: any) => {
    setBusy(kind);
    try {
      const d = await api.post('/api/admin/pdfs/generate', { kind, ...body });
      toast.success('PDF generated and saved. Manage visibility under Published Documents.');
      navigate('/admin/documents');
      void d;
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(''); }
  };

  return (
    <div>
      <PageHeader
        title="PDF Generation"
        desc="Generate A4 PDFs — saved automatically to the system. Publish them under Published Documents to make them visible on the public page."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="stat-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
              <CardTitle className="font-display text-base">Team / Group PDF</CardTitle>
            </div>
            <CardDescription>All members of one team — Name, Chest No., Gender. Auto-paginated A4.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={locked || !teamId || !!busy} onClick={() => generate('team', { team_id: Number(teamId) })}>
              <FileText className="mr-2 h-4 w-4" /> {busy === 'team' ? 'Generating…' : 'Generate Team PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
              <CardTitle className="font-display text-base">Participant Competition PDF</CardTitle>
            </div>
            <CardDescription>Participant Name, Chest No., and all their competitions in one row. Separate PDFs for Boys and Girls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={locked || !gender || !!busy} onClick={() => generate('participants', { gender })}>
              <FileText className="mr-2 h-4 w-4" /> {busy === 'participants' ? 'Generating…' : 'Generate Participants PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClipboardPen className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
              <CardTitle className="font-display text-base">Judge Marking Sheets</CardTitle>
            </div>
            <CardDescription>Four program sections per A4 sheet to reduce printing cost. Each section lists entrants with Mark / Total Mark columns for all three judges.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={jGender} onValueChange={(v) => setJGender(v as Gender)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Zone</Label>
                <Select value={jZone} onValueChange={(v) => setJZone(v as Zone | 'all')}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="All zones" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={locked || !!busy} onClick={() => generate('judges', { gender: jGender, zone: jZone === 'all' ? '' : jZone })}>
              <FileText className="mr-2 h-4 w-4" /> {busy === 'judges' ? 'Generating…' : 'Generate Judge Sheets'}
            </Button>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Judge marks entered on paper still need to be recorded once in the Judge Marks section — the printed sheet cannot transmit handwriting. Entering them there updates scores automatically.
      </p>
    </div>
  );
}
