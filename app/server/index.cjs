const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const { db, UPLOAD_DIR, PDF_DIR, getSetting, setSetting, getJSON } = require('./db.cjs');
const pdfgen = require('./pdf.cjs');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'jashne-rabeeh-dev-secret-change-me';
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const ZONES = ['Ground Zone', 'Zero Zone', 'High Zone', 'General'];
const ZONE_BASE = { 'Ground Zone': 100, 'Zero Zone': 200, 'High Zone': 300, 'General': 400 };

// ---------- auth middleware ----------
function sign(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}
function authRequired(req, res, next) {
  const token = req.cookies.jr_token;
  if (!token) return res.status(401).json({ error: 'authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'invalid session' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid session' });
  }
}
function ownerRequired(req, res, next) {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'owner access required' });
  next();
}
// Enforce the Jashne Rabeeh lock on the backend for every mutating admin route.
function lockCheck(req, res, next) {
  if (getSetting('jr_locked') === '1') return res.status(423).json({ error: 'locked' });
  next();
}

// ---------- chest number helpers ----------
const usedSuffixes = db.prepare('SELECT chest_no FROM participants WHERE zone = ?');
const insertParticipant = db.prepare('INSERT INTO participants (name, team_id, zone, gender, chest_no) VALUES (?,?,?,?,?)');
function nextChestNo(zone) {
  const used = new Set(usedSuffixes.all(zone).map((r) => parseInt(r.chest_no.replace(/^JR-/, ''), 10)));
  let n = ZONE_BASE[zone];
  while (used.has(n)) n += 1;
  return `JR-${n}`;
}
function reassignChest(id, zone) {
  const chest = nextChestNo(zone);
  db.prepare('UPDATE participants SET chest_no = ?, zone = ? WHERE id = ?').run(chest, zone, id);
  return chest;
}

// ---------- score helpers ----------
const positionMarks = () => getJSON('position_marks');
function participantScore(pid) {
  const p = db.prepare('SELECT chest_no FROM participants WHERE id = ?').get(pid);
  if (!p) return 0;
  const pm = positionMarks();
  const pos = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN r.first_chest = :c THEN :f WHEN r.second_chest = :c THEN :s WHEN r.third_chest = :c THEN :t ELSE 0 END), 0) AS marks
    FROM results r`).get({ c: p.chest_no, f: pm.first, s: pm.second, t: pm.third });
  const judge = db.prepare('SELECT COALESCE(SUM(total),0) AS m FROM judge_marks WHERE participant_id = ?').get(pid);
  return (pos.marks || 0) + (judge.m || 0);
}
function teamScore(teamId) {
  const ids = db.prepare('SELECT id FROM participants WHERE team_id = ?').all(teamId);
  return ids.reduce((sum, r) => sum + participantScore(r.id), 0);
}
function teamLabel(team, idx) {
  return (team.name && team.name.trim()) || `Team ${idx + 1} (unnamed)`;
}

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  res.cookie('jr_token', sign(user), { httpOnly: true, sameSite: 'lax', maxAge: 12 * 3600 * 1000 });
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('jr_token');
  res.json({ ok: true });
});
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user, locked: getSetting('jr_locked') === '1' });
});

// ============================================================
// PUBLIC API
// ============================================================
app.get('/api/public/overview', (req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY id').all();
  const teamsOut = teams.map((t, i) => ({ id: t.id, name: teamLabel(t, i), score: teamScore(t.id) }));
  const ranked = [...teamsOut].sort((a, b) => b.score - a.score || a.id - b.id)
    .map((t, i) => ({ ...t, rank: i + 1 }));
  const totalParticipants = db.prepare('SELECT COUNT(*) c FROM participants').get().c;
  const totalPrograms = db.prepare('SELECT COUNT(*) c FROM programs').get().c;
  const announced = db.prepare('SELECT COUNT(*) c FROM programs WHERE announced = 1').get().c;
  res.json({
    event_name: getSetting('event_name'),
    logo_url: getSetting('logo_path') ? '/uploads/' + path.basename(getSetting('logo_path')) : '',
    stats: { participants: totalParticipants, totalPrograms, announced, remaining: totalPrograms - announced },
    teams: ranked,
  });
});

app.get('/api/public/pdfs', (req, res) => {
  const rows = db.prepare("SELECT id, kind, title, updated_at FROM pdfs WHERE published = 1 ORDER BY updated_at DESC").all();
  res.json({ pdfs: rows });
});
app.get('/api/public/pdfs/:id/file', (req, res) => {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.id);
  if (!row || row.published !== 1) return res.status(404).end();
  if (!fs.existsSync(row.file_path)) return res.status(404).end();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(row.file_path).pipe(res);
});

app.get('/api/public/programs', (req, res) => {
  const { gender, zone } = req.query;
  const rows = db.prepare('SELECT id, name, gender, zone FROM programs WHERE announced = 1 AND gender = ? AND zone = ? ORDER BY name')
    .all(String(gender), String(zone));
  res.json({ programs: rows });
});

app.get('/api/public/results/:programId', (req, res) => {
  const prog = db.prepare('SELECT id, name FROM programs WHERE id = ? AND announced = 1').get(req.params.programId);
  if (!prog) return res.status(404).json({ error: 'not found' });
  const r = db.prepare('SELECT * FROM results WHERE program_id = ?').get(prog.id);
  if (!r || r.published !== 1) return res.json({ program: prog, result: null });
  const lookup = (chest) => {
    if (!chest) return null;
    const p = db.prepare(`SELECT p.name, p.chest_no, p.zone, p.gender, t.name AS team_name
      FROM participants p JOIN teams t ON t.id = p.team_id WHERE p.chest_no = ?`).get(chest);
    return p || null;
  };
  res.json({
    program: prog,
    result: { first: lookup(r.first_chest), second: lookup(r.second_chest), third: lookup(r.third_chest) },
  });
});

app.get('/api/public/score/:chest', (req, res) => {
  const chest = String(req.params.chest || '').trim();
  const p = db.prepare(`SELECT p.id, p.name, p.chest_no, p.zone, p.gender, t.name AS team_name
    FROM participants p JOIN teams t ON t.id = p.team_id WHERE p.chest_no = ?`).get(chest);
  if (!p) return res.status(404).json({ error: 'Chest number not found' });
  res.json({ participant: p, score: participantScore(p.id) });
});

app.get('/api/public/stars', (req, res) => {
  const rows = db.prepare(`SELECT s.kind, s.zone, p.name, p.chest_no FROM stars s JOIN participants p ON p.id = s.participant_id`).all();
  const out = { star: {}, pen: {} };
  rows.forEach((r) => { out[r.kind][r.zone] = { name: r.name, chest_no: r.chest_no }; });
  res.json(out);
});

// ============================================================
// ADMIN API
// ============================================================
// ---- dashboard ----
app.get('/api/admin/dashboard', authRequired, (req, res) => {
  const counts = {
    participants: db.prepare('SELECT COUNT(*) c FROM participants').get().c,
    programs: db.prepare('SELECT COUNT(*) c FROM programs').get().c,
    announced: db.prepare('SELECT COUNT(*) c FROM programs WHERE announced = 1').get().c,
    results: db.prepare('SELECT COUNT(*) c FROM results').get().c,
    publishedResults: db.prepare('SELECT COUNT(*) c FROM results WHERE published = 1').get().c,
    pdfs: db.prepare('SELECT COUNT(*) c FROM pdfs').get().c,
    publishedPdfs: db.prepare('SELECT COUNT(*) c FROM pdfs WHERE published = 1').get().c,
  };
  const zoneCounts = ZONES.map((z) => ({ zone: z, count: db.prepare('SELECT COUNT(*) c FROM participants WHERE zone = ?').get(z).c }));
  const genderCounts = {};
  ['Boys', 'Girls'].forEach((g) => { genderCounts[g] = db.prepare('SELECT COUNT(*) c FROM participants WHERE gender = ?').get(g).c; });
  const teams = db.prepare('SELECT * FROM teams ORDER BY id').all().map((t, i) => ({
    id: t.id, name: teamLabel(t, i), raw: t.name, count: db.prepare('SELECT COUNT(*) c FROM participants WHERE team_id = ?').get(t.id).c, score: teamScore(t.id),
  }));
  res.json({ counts, zoneCounts, genderCounts, teams, locked: getSetting('jr_locked') === '1' });
});

// ---- lock ----
app.get('/api/admin/lock', authRequired, (req, res) => res.json({ locked: getSetting('jr_locked') === '1' }));
app.post('/api/admin/lock', authRequired, (req, res) => {
  const { locked } = req.body || {};
  setSetting('jr_locked', locked ? '1' : '0');
  res.json({ locked: getSetting('jr_locked') === '1' });
});

// ---- teams ----
app.get('/api/admin/teams', authRequired, (req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY id').all().map((t, i) => ({
    ...t, label: teamLabel(t, i), count: db.prepare('SELECT COUNT(*) c FROM participants WHERE team_id = ?').get(t.id).c,
  }));
  res.json({ teams });
});
app.put('/api/admin/teams/:id', authRequired, lockCheck, (req, res) => {
  const { name } = req.body || {};
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(String(name || '').trim(), team.id);
  res.json({ ok: true });
});

// ---- participants ----
app.get('/api/admin/participants', authRequired, (req, res) => {
  const { q = '', team = '', zone = '', gender = '' } = req.query;
  let sql = `SELECT p.*, t.name AS team_name FROM participants p JOIN teams t ON t.id = p.team_id WHERE 1=1`;
  const args = {};
  if (q) { sql += ' AND p.name LIKE @q'; args.q = `%${q}%`; }
  if (team) { sql += ' AND p.team_id = @team'; args.team = team; }
  if (zone) { sql += ' AND p.zone = @zone'; args.zone = zone; }
  if (gender) { sql += ' AND p.gender = @gender'; args.gender = gender; }
  sql += ' ORDER BY p.chest_no';
  const rows = db.prepare(sql).all(args).map((r) => {
    const teamRow = db.prepare('SELECT * FROM teams WHERE id = ?').get(r.team_id);
    return { ...r, team_label: teamLabel(teamRow, r.team_id - 1) };
  });
  res.json({ participants: rows });
});
app.post('/api/admin/participants', authRequired, lockCheck, (req, res) => {
  const { name, team_id, zone, gender } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id)) return res.status(400).json({ error: 'Invalid team' });
  if (!ZONES.includes(zone)) return res.status(400).json({ error: 'Invalid zone' });
  if (!['Boys', 'Girls'].includes(gender)) return res.status(400).json({ error: 'Invalid gender' });
  const chest = nextChestNo(zone);
  const info = insertParticipant.run(String(name).trim(), team_id, zone, gender, chest);
  res.json({ ok: true, id: info.lastInsertRowid, chest_no: chest });
});
app.put('/api/admin/participants/:id', authRequired, lockCheck, (req, res) => {
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Participant not found' });
  const { name = p.name, team_id = p.team_id, zone = p.zone, gender = p.gender } = req.body || {};
  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id)) return res.status(400).json({ error: 'Invalid team' });
  if (!ZONES.includes(zone)) return res.status(400).json({ error: 'Invalid zone' });
  db.prepare('UPDATE participants SET name = ?, team_id = ?, gender = ? WHERE id = ?').run(String(name).trim(), team_id, gender, p.id);
  let chest = p.chest_no;
  if (zone !== p.zone) chest = reassignChest(p.id, zone); // keep numbering rules consistent on moves
  res.json({ ok: true, chest_no: chest });
});
app.delete('/api/admin/participants/:id', authRequired, lockCheck, (req, res) => {
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Participant not found' });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE results SET first_chest = NULL WHERE first_chest = ?`).run(p.chest_no);
    db.prepare(`UPDATE results SET second_chest = NULL WHERE second_chest = ?`).run(p.chest_no);
    db.prepare(`UPDATE results SET third_chest = NULL WHERE third_chest = ?`).run(p.chest_no);
    db.prepare('DELETE FROM participants WHERE id = ?').run(p.id);
  });
  tx();
  res.json({ ok: true });
});

// ---- programs ----
app.get('/api/admin/programs', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT pr.*, (SELECT COUNT(*) FROM participations pa WHERE pa.program_id = pr.id) AS entrant_count,
           (SELECT published FROM results r WHERE r.program_id = pr.id) AS result_published
    FROM programs pr ORDER BY pr.gender, pr.zone, pr.name`).all();
  res.json({ programs: rows });
});
app.post('/api/admin/programs', authRequired, lockCheck, (req, res) => {
  const { name, gender, zone } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Program name is required' });
  if (!['Boys', 'Girls'].includes(gender)) return res.status(400).json({ error: 'Invalid gender' });
  if (!ZONES.includes(zone)) return res.status(400).json({ error: 'Invalid zone' });
  const info = db.prepare('INSERT INTO programs (name, gender, zone) VALUES (?,?,?)').run(String(name).trim(), gender, zone);
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.put('/api/admin/programs/:id', authRequired, lockCheck, (req, res) => {
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Program not found' });
  const { name = p.name, gender = p.gender, zone = p.zone } = req.body || {};
  db.prepare('UPDATE programs SET name = ?, gender = ?, zone = ? WHERE id = ?').run(String(name).trim(), gender, zone, p.id);
  res.json({ ok: true });
});
app.post('/api/admin/programs/:id/announce', authRequired, lockCheck, (req, res) => {
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Program not found' });
  db.prepare('UPDATE programs SET announced = ? WHERE id = ?').run(req.body.announced ? 1 : 0, p.id);
  res.json({ ok: true, announced: !!req.body.announced });
});
app.delete('/api/admin/programs/:id', authRequired, lockCheck, (req, res) => {
  db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- participations ----
app.post('/api/admin/participations', authRequired, lockCheck, (req, res) => {
  const { participant_id, program_id } = req.body || {};
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(participant_id);
  const pr = db.prepare('SELECT * FROM programs WHERE id = ?').get(program_id);
  if (!p || !pr) return res.status(400).json({ error: 'Invalid participant or program' });
  if (p.gender !== pr.gender) return res.status(400).json({ error: 'Participant gender does not match program' });
  db.prepare('INSERT OR IGNORE INTO participations (participant_id, program_id) VALUES (?,?)').run(participant_id, program_id);
  res.json({ ok: true });
});
app.delete('/api/admin/participations', authRequired, lockCheck, (req, res) => {
  const { participant_id, program_id } = req.body || {};
  db.prepare('DELETE FROM participations WHERE participant_id = ? AND program_id = ?').run(participant_id, program_id);
  res.json({ ok: true });
});

// ---- results ----
app.get('/api/admin/results', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, pr.name AS program_name, pr.gender, pr.zone FROM results r JOIN programs pr ON pr.id = r.program_id ORDER BY pr.gender, pr.zone, pr.name`).all();
  const programs = db.prepare('SELECT id, name, gender, zone FROM programs ORDER BY gender, zone, name').all();
  res.json({ results: rows, programs });
});
app.put('/api/admin/results/:programId', authRequired, lockCheck, (req, res) => {
  const prog = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.programId);
  if (!prog) return res.status(404).json({ error: 'Program not found' });
  const { first_chest = null, second_chest = null, third_chest = null } = req.body || {};
  for (const c of [first_chest, second_chest, third_chest]) {
    if (c && !db.prepare('SELECT id FROM participants WHERE chest_no = ?').get(String(c).trim())) {
      return res.status(400).json({ error: `Chest number ${c} does not exist` });
    }
  }
  const existing = db.prepare('SELECT * FROM results WHERE program_id = ?').get(prog.id);
  if (existing) {
    db.prepare(`UPDATE results SET first_chest = ?, second_chest = ?, third_chest = ?, published = ?, updated_at = datetime('now') WHERE program_id = ?`)
      .run(first_chest, second_chest, third_chest, req.body.published ? 1 : 0, prog.id);
  } else {
    db.prepare(`INSERT INTO results (program_id, first_chest, second_chest, third_chest, published) VALUES (?,?,?,?,?)`)
      .run(prog.id, first_chest, second_chest, third_chest, req.body.published ? 1 : 0);
  }
  res.json({ ok: true });
});

// ---- scores ----
app.get('/api/admin/scores', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.name, p.chest_no, p.zone, p.gender, p.team_id, t.name AS team_name
    FROM participants p JOIN teams t ON t.id = p.team_id ORDER BY p.chest_no`).all();
  const out = rows.map((r) => {
    const teamRow = db.prepare('SELECT * FROM teams WHERE id = ?').get(r.team_id);
    return { ...r, team_label: teamLabel(teamRow, r.team_id - 1), score: participantScore(r.id) };
  });
  const teams = db.prepare('SELECT * FROM teams ORDER BY id').all().map((t, i) => ({ id: t.id, name: teamLabel(t, i), score: teamScore(t.id) }));
  res.json({ participants: out, teams: teams.sort((a, b) => b.score - a.score || a.id - b.id) });
});

// ---- judge marks ----
app.get('/api/admin/judge-marks', authRequired, (req, res) => {
  const programId = Number(req.query.program_id);
  const scheme = getJSON('marking_scheme');
  const programs = db.prepare('SELECT id, name, gender, zone, announced FROM programs ORDER BY gender, zone, name').all();
  if (!programId) return res.json({ programs, scheme, participants: [], marks: {} });
  const prog = db.prepare('SELECT * FROM programs WHERE id = ?').get(programId);
  if (!prog) return res.json({ programs, scheme, participants: [], marks: {} });
  const participants = db.prepare(`
    SELECT p.id, p.name, p.chest_no, p.zone, p.gender FROM participations pa
    JOIN participants p ON p.id = pa.participant_id WHERE pa.program_id = ? ORDER BY p.chest_no`).all(programId);
  const marks = {};
  db.prepare('SELECT * FROM judge_marks WHERE program_id = ?').all(programId).forEach((m) => {
    marks[`${m.judge_no}:${m.participant_id}`] = { components: JSON.parse(m.components), total: m.total };
  });
  res.json({ programs, scheme, program: prog, participants, marks });
});
app.put('/api/admin/judge-marks', authRequired, lockCheck, (req, res) => {
  const { program_id, judge_no, participant_id, components } = req.body || {};
  const prog = db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
  if (!prog) return res.status(400).json({ error: 'Invalid program' });
  if (![1, 2, 3].includes(Number(judge_no))) return res.status(400).json({ error: 'Invalid judge' });
  if (!db.prepare('SELECT id FROM participants WHERE id = ?').get(participant_id)) return res.status(400).json({ error: 'Invalid participant' });
  if (!db.prepare('SELECT 1 FROM participations WHERE participant_id = ? AND program_id = ?').get(participant_id, program_id)) {
    return res.status(400).json({ error: 'Participant is not entered in this program' });
  }
  const comps = Array.isArray(components) ? components.map((c) => Math.max(0, Number(c) || 0)) : [];
  const total = comps.reduce((a, b) => a + b, 0);
  db.prepare(`INSERT INTO judge_marks (program_id, judge_no, participant_id, components, total) VALUES (?,?,?,?,?)
    ON CONFLICT(program_id, judge_no, participant_id) DO UPDATE SET components = excluded.components, total = excluded.total`)
    .run(program_id, Number(judge_no), participant_id, JSON.stringify(comps), total);
  res.json({ ok: true, total });
});

// ---- PDFs ----
async function generatePdfRecord(kind, title, meta, buildFn) {
  const id = db.prepare('INSERT INTO pdfs (kind, title, meta, file_path) VALUES (?,?,?,?)')
    .run(kind, title, JSON.stringify(meta), '').lastInsertRowid;
  const filePath = path.join(PDF_DIR, `${kind}-${id}.pdf`);
  await buildFn(filePath);
  db.prepare('UPDATE pdfs SET file_path = ?, updated_at = datetime(\'now\') WHERE id = ?').run(filePath, id);
  return id;
}

app.post('/api/admin/pdfs/generate', authRequired, lockCheck, async (req, res) => {
  try {
    const { kind } = req.body || {};
    const eventName = getSetting('event_name') || 'Jashne Rabeeh';
    let id, title;
    if (kind === 'team') {
      const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.body.team_id);
      if (!team) return res.status(400).json({ error: 'Invalid team' });
      const label = pdfgen.teamName(team, `Team ${team.id}`);
      const members = db.prepare('SELECT name, chest_no, gender FROM participants WHERE team_id = ? ORDER BY chest_no').all(team.id);
      title = `${label} — Members`;
      id = await generatePdfRecord('team', title, { team_id: team.id }, (fp) =>
        pdfgen.buildTeamPdf({ doc: fp, teamNameStr: label, members, eventName }));
    } else if (kind === 'participants') {
      const gender = req.body.gender === 'Girls' ? 'Girls' : 'Boys';
      const rows = db.prepare(`SELECT p.name, p.chest_no,
        (SELECT GROUP_CONCAT(pr.name, ' · ') FROM participations pa JOIN programs pr ON pr.id = pa.program_id WHERE pa.participant_id = p.id) AS competitions
        FROM participants p WHERE p.gender = ? ORDER BY p.chest_no`).all(gender)
        .map((r) => ({ ...r, competitions: r.competitions || '—' }));
      title = `${gender} — Participants & Competitions`;
      id = await generatePdfRecord('participants', title, { gender }, (fp) =>
        pdfgen.buildParticipantsPdf({ doc: fp, gender, rows, eventName }));
    } else if (kind === 'judges') {
      const { gender = '', zone = '' } = req.body;
      let sql = 'SELECT * FROM programs WHERE 1=1';
      const args = [];
      if (gender) { sql += ' AND gender = ?'; args.push(gender); }
      if (zone) { sql += ' AND zone = ?'; args.push(zone); }
      sql += ' ORDER BY gender, zone, name';
      const programs = db.prepare(sql).all(...args);
      if (programs.length === 0) return res.status(400).json({ error: 'No programs match the selected filter' });
      const progs = programs.map((p) => ({
        name: p.name,
        rows: db.prepare(`SELECT p.name, p.chest_no FROM participations pa JOIN participants p ON p.id = pa.participant_id
          WHERE pa.program_id = ? ORDER BY p.chest_no`).all(p.id),
      }));
      const filterLabel = [gender, zone].filter(Boolean).join(' · ') || 'All';
      title = `Judge Marking Sheets — ${filterLabel}`;
      id = await generatePdfRecord('judges', title, { gender, zone, program_ids: programs.map((p) => p.id) }, (fp) =>
        pdfgen.buildJudgeSheetsPdf({ doc: fp, programs: progs, eventName }));
    } else {
      return res.status(400).json({ error: 'Invalid PDF kind' });
    }
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

app.post('/api/admin/pdfs/:id/regenerate', authRequired, lockCheck, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'PDF not found' });
    const meta = JSON.parse(row.meta);
    const eventName = getSetting('event_name') || 'Jashne Rabeeh';
    if (row.kind === 'team') {
      const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(meta.team_id);
      if (!team) return res.status(400).json({ error: 'Team no longer exists' });
      const label = pdfgen.teamName(team, `Team ${team.id}`);
      const members = db.prepare('SELECT name, chest_no, gender FROM participants WHERE team_id = ? ORDER BY chest_no').all(team.id);
      await pdfgen.buildTeamPdf({ doc: row.file_path, teamNameStr: label, members, eventName });
    } else if (row.kind === 'participants') {
      const gender = meta.gender === 'Girls' ? 'Girls' : 'Boys';
      const rows = db.prepare(`SELECT p.name, p.chest_no,
        (SELECT GROUP_CONCAT(pr.name, ' · ') FROM participations pa JOIN programs pr ON pr.id = pa.program_id WHERE pa.participant_id = p.id) AS competitions
        FROM participants p WHERE p.gender = ? ORDER BY p.chest_no`).all(gender)
        .map((r) => ({ ...r, competitions: r.competitions || '—' }));
      await pdfgen.buildParticipantsPdf({ doc: row.file_path, gender, rows, eventName });
    } else {
      let sql = 'SELECT * FROM programs WHERE 1=1';
      const args = [];
      if (meta.gender) { sql += ' AND gender = ?'; args.push(meta.gender); }
      if (meta.zone) { sql += ' AND zone = ?'; args.push(meta.zone); }
      sql += ' ORDER BY gender, zone, name';
      const programs = db.prepare(sql).all(...args);
      if (programs.length === 0) return res.status(400).json({ error: 'No programs match; nothing to regenerate' });
      const progs = programs.map((p) => ({
        name: p.name,
        rows: db.prepare(`SELECT p.name, p.chest_no FROM participations pa JOIN participants p ON p.id = pa.participant_id
          WHERE pa.program_id = ? ORDER BY p.chest_no`).all(p.id),
      }));
      await pdfgen.buildJudgeSheetsPdf({ doc: row.file_path, programs: progs, eventName });
    }
    db.prepare('UPDATE pdfs SET updated_at = datetime(\'now\') WHERE id = ?').run(row.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF regeneration failed' });
  }
});

app.get('/api/admin/pdfs', authRequired, (req, res) => {
  res.json({ pdfs: db.prepare('SELECT * FROM pdfs ORDER BY updated_at DESC').all() });
});
app.put('/api/admin/pdfs/:id', authRequired, lockCheck, (req, res) => {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'PDF not found' });
  db.prepare('UPDATE pdfs SET published = ? WHERE id = ?').run(req.body.published ? 1 : 0, row.id);
  res.json({ ok: true });
});
app.delete('/api/admin/pdfs/:id', authRequired, lockCheck, (req, res) => {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'PDF not found' });
  if (fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
  db.prepare('DELETE FROM pdfs WHERE id = ?').run(row.id);
  res.json({ ok: true });
});
app.get('/api/admin/pdfs/:id/file', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.id);
  if (!row || !fs.existsSync(row.file_path)) return res.status(404).end();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(row.file_path).pipe(res);
});

// ---- settings ----
app.get('/api/admin/settings', authRequired, (req, res) => {
  res.json({
    event_name: getSetting('event_name'),
    position_marks: getJSON('position_marks'),
    marking_scheme: getJSON('marking_scheme'),
    logo_set: !!getSetting('logo_path'),
    locked: getSetting('jr_locked') === '1',
  });
});
app.put('/api/admin/settings', authRequired, lockCheck, (req, res) => {
  const { event_name, position_marks, marking_scheme } = req.body || {};
  if (event_name !== undefined) setSetting('event_name', String(event_name).trim() || 'Jashne Rabeeh');
  if (position_marks) {
    const pm = {
      first: Math.max(0, Number(position_marks.first) || 0),
      second: Math.max(0, Number(position_marks.second) || 0),
      third: Math.max(0, Number(position_marks.third) || 0),
    };
    setSetting('position_marks', JSON.stringify(pm));
  }
  if (marking_scheme && Array.isArray(marking_scheme.components)) {
    const comps = marking_scheme.components
      .map((c) => ({ label: String(c.label || '').trim() || 'Component', max: Math.max(0, Number(c.max) || 0) }))
      .filter((c) => c.max > 0);
    if (comps.length > 0) setSetting('marking_scheme', JSON.stringify({ components: comps }));
  }
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `logo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});
app.post('/api/admin/settings/logo', authRequired, lockCheck, (req, res) => {
  upload.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const old = getSetting('logo_path');
    if (old && fs.existsSync(old) && path.dirname(old) === UPLOAD_DIR) fs.unlinkSync(old);
    setSetting('logo_path', req.file.path);
    res.json({ ok: true });
  });
});
app.delete('/api/admin/settings/logo', authRequired, lockCheck, (req, res) => {
  const old = getSetting('logo_path');
  if (old && fs.existsSync(old) && path.dirname(old) === UPLOAD_DIR) fs.unlinkSync(old);
  setSetting('logo_path', '');
  res.json({ ok: true });
});
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- star / pen of the fest ----
const STAR_ZONES = { star: [...ZONES, 'Overall'], pen: [...ZONES, 'Overall'] };
app.get('/api/admin/stars', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT s.kind, s.zone, p.name, p.chest_no, p.id AS participant_id FROM stars s
    JOIN participants p ON p.id = s.participant_id`).all();
  const out = { star: {}, pen: {} };
  rows.forEach((r) => { out[r.kind][r.zone] = { participant_id: r.participant_id, name: r.name, chest_no: r.chest_no }; });
  res.json(out);
});
app.put('/api/admin/stars', authRequired, lockCheck, (req, res) => {
  const { kind, zone, chest_no } = req.body || {};
  const zones = STAR_ZONES[kind];
  if (!zones || !zones.includes(zone)) return res.status(400).json({ error: 'Invalid selection' });
  if (!chest_no) {
    db.prepare('DELETE FROM stars WHERE kind = ? AND zone = ?').run(kind, zone);
    return res.json({ ok: true });
  }
  const p = db.prepare('SELECT * FROM participants WHERE chest_no = ?').get(String(chest_no).trim());
  if (!p) return res.status(400).json({ error: 'Chest number not found' });
  db.prepare(`INSERT INTO stars (kind, zone, participant_id) VALUES (?,?,?)
    ON CONFLICT(kind, zone) DO UPDATE SET participant_id = excluded.participant_id`).run(kind, zone, p.id);
  res.json({ ok: true, name: p.name });
});

// ---- users (owner only) ----
app.get('/api/admin/users', authRequired, ownerRequired, (req, res) => {
  res.json({ users: db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all() });
});
app.post('/api/admin/users', authRequired, ownerRequired, lockCheck, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: 'Username must be 3–32 characters (letters, numbers, _ . -)' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['admin', 'owner'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return res.status(400).json({ error: 'Username already exists' });
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)').run(username, bcrypt.hashSync(String(password), 10), role);
  res.json({ ok: true });
});
app.put('/api/admin/users/:id/password', authRequired, ownerRequired, lockCheck, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), target.id);
  res.json({ ok: true });
});
app.delete('/api/admin/users/:id', authRequired, ownerRequired, lockCheck, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner') return res.status(400).json({ error: 'The Owner account cannot be removed' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

// change own password (any authenticated user)
app.put('/api/auth/password', authRequired, lockCheck, (req, res) => {
  const { current, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), user.id);
  res.json({ ok: true });
});

// ---- static frontend (production) ----
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => console.log(`Jashne Rabeeh server running on http://localhost:${PORT}`));
