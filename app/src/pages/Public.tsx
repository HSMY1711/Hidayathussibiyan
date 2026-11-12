import { useEffect, useMemo, useState } from 'react';
import { api, ZONES, GENDERS, type Gender, type Zone } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Medal, FileText, Search, Trophy, Sparkles, PenLine } from 'lucide-react';

const STAR_ZONES = ZONES as readonly string[];
const PEN_ZONES = ['Ground Zone', 'Zero Zone', 'High Zone', 'General'];

function Section({ id, label, title, children }: { id: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto mt-14 w-full max-w-3xl scroll-mt-6">
      <div className="section-label">{label}</div>
      <h2 className="font-display mt-1 text-xl font-semibold md:text-2xl">{title}</h2>
      <div className="gold-rule my-4" />
      {children}
    </section>
  );
}

function PlaceRow({ place, entry }: { place: string; entry: any }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <span className="w-14 shrink-0 text-sm font-semibold" style={{ color: 'hsl(var(--gold))' }}>{place}</span>
      {entry ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[15px]">{entry.name}</span>
          <span className="shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs">{entry.chest_no}</span>
          {entry.team_name ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{entry.team_name}</span> : null}
        </>
      ) : (
        <span className="text-sm italic text-muted-foreground">—</span>
      )}
    </div>
  );
}

export default function Public() {
  const [ov, setOv] = useState<any>(null);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [stars, setStars] = useState<any>({ star: {}, pen: {} });

  const [gender, setGender] = useState<Gender | ''>('');
  const [zone, setZone] = useState<Zone | ''>('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [program, setProgram] = useState<any>(null);
  const [result, setResult] = useState<{ loaded: boolean; data: any }>({ loaded: false, data: null });

  const [chest, setChest] = useState('');
  const [scoreOut, setScoreOut] = useState<any>(null);
  const [scoreErr, setScoreErr] = useState('');

  const load = async () => {
    try {
      const [o, p] = await Promise.all([api.get('/api/public/overview'), api.get('/api/public/pdfs')]);
      setOv(o); setPdfs(p.pdfs);
    } catch { /* public page stays usable */ }
  };
  useEffect(() => {
    load();
    api.get('/api/public/stars').then(setStars).catch(() => {});
    const t = setInterval(() => { load(); api.get('/api/public/stars').then(setStars).catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (gender && zone) {
      api.get(`/api/public/programs?gender=${encodeURIComponent(gender)}&zone=${encodeURIComponent(zone)}`)
        .then((d) => setPrograms(d.programs))
        .catch(() => setPrograms([]));
      setProgram(null);
      setResult({ loaded: false, data: null });
    } else {
      setPrograms([]);
    }
  }, [gender, zone]);

  useEffect(() => {
    if (!program) return;
    setResult({ loaded: false, data: null });
    api.get(`/api/public/results/${program.id}`)
      .then((d) => setResult({ loaded: true, data: d.result }))
      .catch(() => setResult({ loaded: true, data: null }));
  }, [program]);

  const lookupScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setScoreErr(''); setScoreOut(null);
    const c = chest.trim();
    if (!c) return;
    try {
      const d = await api.get(`/api/public/score/${encodeURIComponent(c)}`);
      setScoreOut(d);
    } catch (err: any) {
      setScoreErr(err.message || 'Not found');
    }
  };

  const stats = ov?.stats;
  const ranked = useMemo(() => ov?.teams ?? [], [ov]);
  const chippable = (v: string, cur: string, set: (v: any) => void) => (
    <button
      type="button"
      onClick={() => set(v)}
      className={`min-h-[44px] rounded-sm border px-3 py-2 text-sm transition-colors ${
        cur === v
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:bg-muted'
      }`}
    >
      {v}
    </button>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <div className="section-label">Hidayathussibiyan Madarasa</div>
            <div className="font-display text-base font-semibold">Annual Fest Management</div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-20">
        {/* Logo + name */}
        <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center text-center">
          {ov?.logo_url ? (
            <img src={ov.logo_url} alt="Jashne Rabeeh logo" className="h-28 w-28 rounded-full border border-border object-cover md:h-32 md:w-32" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full border md:h-32 md:w-32" style={{ borderColor: 'hsl(43 59% 44% / 0.5)' }}>
              <Sparkles className="h-10 w-10" style={{ color: 'hsl(var(--gold))' }} />
            </div>
          )}
          <h1 className="font-display mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{ov?.event_name || 'Jashne Rabeeh'}</h1>
          <div className="gold-rule mt-5 w-48" />
        </div>

        {/* Details / Participants documents */}
        <Section id="documents" label="Details" title="Participants & Documents">
          {pdfs.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No documents have been published yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-sm border border-border bg-card">
              {pdfs.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">Updated {String(p.updated_at).replace('T', ' ').slice(0, 16)}</div>
                  </div>
                  <a
                    href={`/api/public/pdfs/${p.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] content-center rounded-sm border border-border px-3 text-sm font-medium hover:bg-muted"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Public statistics */}
        <Section id="stats" label="Statistics" title="At a Glance">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Participants No.', value: stats?.participants ?? '—' },
              { label: 'Total Programs', value: stats?.totalPrograms ?? '—' },
              { label: 'Program Announced', value: stats?.announced ?? '—' },
              { label: 'Program Remaining to Announce', value: stats?.remaining ?? '—' },
            ].map((s) => (
              <Card key={s.label} className="stat-card">
                <CardContent className="px-4 py-4">
                  <div className="text-3xl font-semibold tabular-nums md:text-4xl">{s.value}</div>
                  <div className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* Team live scoreboard */}
        <Section id="scoreboard" label="Live" title="Team Scoreboard">
          <div className="grid gap-3 sm:grid-cols-2">
            {ranked.map((t: any) => (
              <Card key={t.id} className="stat-card relative overflow-hidden">
                <CardContent className="px-4 py-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{t.name}</span>
                    {t.rank === 1 && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: 'hsl(var(--gold))' }}>
                        <Trophy className="h-3.5 w-3.5" /> 1st
                      </span>
                    )}
                    {t.rank === 2 && <span className="shrink-0 text-xs font-medium text-muted-foreground">2nd</span>}
                  </div>
                  <div className="font-display mt-2 text-4xl font-semibold tabular-nums">{t.score}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* Program selection + results */}
        <Section id="results" label="Results" title="Program Results">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">1. Gender</div>
              <div className="flex flex-wrap gap-2">{GENDERS.map((g) => chippable(g, gender, setGender))}</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">2. Zone</div>
              <div className="flex flex-wrap gap-2">{ZONES.map((z) => chippable(z, zone, setZone))}</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">3. Program</div>
              {gender && zone ? (
                programs.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">No programs announced for this selection yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">{programs.map((p) => chippable(p.name, program?.id === p.id ? p.name : '', () => setProgram(p)))}</div>
                )
              ) : (
                <p className="text-sm italic text-muted-foreground">Select a gender and zone first.</p>
              )}
            </div>

            {program && (
              <div className="rounded-sm border border-border bg-card px-4 py-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{program.gender} · {program.zone}</div>
                <div className="font-display text-lg font-semibold">{program.name}</div>
                <div className="gold-rule my-3" />
                {!result.loaded ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !result.data ? (
                  <p className="text-sm font-medium italic" style={{ color: 'hsl(var(--gold))' }}>Results not announced yet</p>
                ) : (
                  <div>
                    <PlaceRow place="1st" entry={result.data.first} />
                    <PlaceRow place="2nd" entry={result.data.second} />
                    <PlaceRow place="3rd" entry={result.data.third} />
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Participants score lookup */}
        <Section id="score-lookup" label="Participants Score" title="Check a Participant's Score">
          <form onSubmit={lookupScore} className="flex gap-2">
            <Input
              value={chest}
              onChange={(e) => setChest(e.target.value)}
              placeholder="Enter Chest No. (e.g. JR-100)"
              className="h-11 font-mono"
              aria-label="Chest number"
            />
            <Button type="submit" className="h-11 gap-1.5"><Search className="h-4 w-4" /> Find</Button>
          </form>
          {scoreErr && <p className="mt-3 text-sm font-medium text-destructive">{scoreErr}</p>}
          {scoreOut && (
            <div className="mt-4 rounded-sm border border-border bg-card px-4 py-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-lg font-semibold">{scoreOut.participant.name}</span>
                <span className="font-mono text-sm text-muted-foreground">{scoreOut.participant.chest_no}</span>
                <span className="text-xs text-muted-foreground">{scoreOut.participant.gender} · {scoreOut.participant.zone}{scoreOut.participant.team_name ? ` · ${scoreOut.participant.team_name}` : ''}</span>
              </div>
              <div className="mt-2 text-sm">Total score: <span className="text-2xl font-semibold tabular-nums">{scoreOut.score}</span></div>
            </div>
          )}
        </Section>

        {/* Star of the Fest — Boys */}
        <Section id="star" label="Honours" title="Star of the Fest — Boys">
          <div className="divide-y divide-border rounded-sm border border-border bg-card">
            {STAR_ZONES.map((z) => (
              <div key={z} className="flex items-center gap-3 px-4 py-3">
                <Medal className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                <span className="w-28 shrink-0 text-sm text-muted-foreground md:w-36">{z === 'General' ? 'General' : z}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {stars.star?.[z]?.name
                    ? <>{stars.star[z].name} <span className="ml-1 font-mono text-xs text-muted-foreground">{stars.star[z].chest_no}</span></>
                    : <span className="italic font-normal text-muted-foreground">Not announced yet</span>}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'hsl(43 60% 94%)' }}>
              <Trophy className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
              <span className="w-28 shrink-0 text-sm font-semibold md:w-36">Overall Star</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {stars.star?.['Overall']?.name
                  ? <>{stars.star['Overall'].name} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{stars.star['Overall'].chest_no}</span></>
                  : <span className="italic font-normal text-muted-foreground">Not announced yet</span>}
              </span>
            </div>
          </div>
        </Section>

        {/* Pen of the Fest — Girls */}
        <Section id="pen" label="Honours" title="Pen of the Fest — Girls">
          <div className="divide-y divide-border rounded-sm border border-border bg-card">
            {PEN_ZONES.map((z) => (
              <div key={z} className="flex items-center gap-3 px-4 py-3">
                <PenLine className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                <span className="w-28 shrink-0 text-sm text-muted-foreground md:w-36">{z}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {stars.pen?.[z]?.name
                    ? <>{stars.pen[z].name} <span className="ml-1 font-mono text-xs text-muted-foreground">{stars.pen[z].chest_no}</span></>
                    : <span className="italic font-normal text-muted-foreground">Not announced yet</span>}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'hsl(43 60% 94%)' }}>
              <Trophy className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
              <span className="w-28 shrink-0 text-sm font-semibold md:w-36">Overall Pen</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {stars.pen?.['Overall']?.name
                  ? <>{stars.pen['Overall'].name} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{stars.pen['Overall'].chest_no}</span></>
                  : <span className="italic font-normal text-muted-foreground">Not announced yet</span>}
              </span>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <div className="gold-rule mx-auto mb-4 w-40" />
          <p className="font-display text-sm font-medium">Hidayathussibiyan Madarasa</p>
          <p className="mt-1 text-xs text-muted-foreground">Jashne Rabeeh — managed by the Madarasa administration.</p>
        </div>
      </footer>
    </div>
  );
}
