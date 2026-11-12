const PDFDocument = require('pdfkit');
const fs = require('fs');

const TEAL = '#0c3b3e';
const GOLD = '#b08d2f';
const INK = '#1d222d';
const MUTED = '#5c6670';
const LINE = '#c9cdd2';

function teamName(team, fallback) {
  return (team && team.name && team.name.trim()) || fallback;
}

// ---------- Team members PDF: Name | Chest No. | Gender ----------
async function buildTeamPdf({ doc, teamNameStr, members, eventName }) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(doc);
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 44, right: 44 } });
    pdf.pipe(stream);
    pdf.on('end', resolve);
    pdf.on('error', reject);

    const colName = 300, colChest = 100, colGender = 112;
    const tableTop = 128, rowH = 24, headH = 26;
    const pageBottom = pdf.page.height - 46;

    function header(pageNo) {
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(GOLD).text(eventName.toUpperCase(), { align: 'center' });
      pdf.moveDown(0.15);
      pdf.font('Helvetica-Bold').fontSize(16).fillColor(TEAL).text(teamNameStr, { align: 'center' });
      pdf.moveDown(0.3);
      pdf.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(`Team Members List  ·  Generated ${new Date().toLocaleDateString('en-GB')}  ·  Page ${pageNo}`, { align: 'center' });
      pdf.moveDown(0.8);
      pdf.rect(44, pdf.y, 512, headH).fillAndStroke('#eef2f1', LINE);
      const hy = pdf.y;
      pdf.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
      pdf.text('NAME', 54, hy + 8, { width: colName });
      pdf.text('CHEST NO.', 54 + colName, hy + 8, { width: colChest, align: 'center' });
      pdf.text('GENDER', 54 + colName + colChest, hy + 8, { width: colGender, align: 'center' });
      pdf.y = hy + headH;
      return pdf.y;
    }

    let y = header(1);
    let pageNo = 1;
    pdf.font('Helvetica').fontSize(9.5).fillColor(INK);

    if (members.length === 0) {
      pdf.fillColor(MUTED).text('No members recorded for this team yet.', 54, y + 10);
    }

    members.forEach((m, i) => {
      if (y + rowH > pageBottom) {
        pdf.addPage();
        pageNo += 1;
        y = header(pageNo);
        pdf.font('Helvetica').fontSize(9.5).fillColor(INK);
      }
      if (i % 2 === 1) pdf.rect(44, y, 512, rowH).fill('#f7f8f7');
      pdf.fillColor(INK);
      pdf.text(m.name, 54, y + 7, { width: colName });
      pdf.text(m.chest_no, 54 + colName, y + 7, { width: colChest, align: 'center' });
      pdf.text(m.gender, 54 + colName + colChest, y + 7, { width: colGender, align: 'center' });
      pdf.moveTo(44, y + rowH).lineTo(556, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
      y += rowH;
    });
    pdf.end();
  });
}

// ---------- Participant competitions PDF: Participant Name | Chest No. | Competitions ----------
async function buildParticipantsPdf({ doc, gender, rows, eventName }) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(doc);
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 40, right: 40 } });
    pdf.pipe(stream);
    pdf.on('end', resolve);
    pdf.on('error', reject);

    const colName = 180, colChest = 90, colComp = 242;
    const headH = 26;
    const pageBottom = pdf.page.height - 46;

    function header(pageNo) {
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(GOLD).text(eventName.toUpperCase(), { align: 'center' });
      pdf.moveDown(0.15);
      pdf.font('Helvetica-Bold').fontSize(16).fillColor(TEAL).text(`${gender} — Participants & Competitions`, { align: 'center' });
      pdf.moveDown(0.3);
      pdf.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(`Generated ${new Date().toLocaleDateString('en-GB')}  ·  Page ${pageNo}`, { align: 'center' });
      pdf.moveDown(0.8);
      pdf.rect(40, pdf.y, 512, headH).fillAndStroke('#eef2f1', LINE);
      const hy = pdf.y;
      pdf.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
      pdf.text('PARTICIPANT NAME', 50, hy + 8, { width: colName });
      pdf.text('CHEST NO.', 50 + colName, hy + 8, { width: colChest, align: 'center' });
      pdf.text('COMPETITIONS', 50 + colName + colChest, hy + 8, { width: colComp });
      pdf.y = hy + headH;
      return pdf.y;
    }

    let y = header(1);
    let pageNo = 1;
    pdf.font('Helvetica').fontSize(9).fillColor(INK);

    if (rows.length === 0) {
      pdf.fillColor(MUTED).text('No participants recorded for this gender yet.', 50, y + 10);
    }

    rows.forEach((r, i) => {
      const lines = pdf.heightOfString(r.competitions, { width: colComp - 10 });
      const rowH = Math.max(24, lines + 14);
      if (y + rowH > pageBottom) {
        pdf.addPage();
        pageNo += 1;
        y = header(pageNo);
        pdf.font('Helvetica').fontSize(9).fillColor(INK);
      }
      if (i % 2 === 1) pdf.rect(40, y, 512, rowH).fill('#f7f8f7');
      pdf.fillColor(INK);
      pdf.text(r.name, 50, y + 7, { width: colName });
      pdf.text(r.chest_no, 50 + colName, y + 7, { width: colChest, align: 'center' });
      pdf.text(r.competitions, 50 + colName + colChest, y + 7, { width: colComp - 10 });
      pdf.moveTo(40, y + rowH).lineTo(552, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
      y += rowH;
    });
    pdf.end();
  });
}

// ---------- Judge marking sheets: 4 program sections per A4 sheet ----------
async function buildJudgeSheetsPdf({ doc, programs, eventName }) {
  // programs: [{ name, rows: [{ name, chest_no }] }]
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(doc);
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 26, bottom: 26, left: 34, right: 34 } });
    pdf.pipe(stream);
    pdf.on('end', resolve);
    pdf.on('error', reject);

    const PW = pdf.page.width - 68; // 527
    const gap = 10;
    const secH = (pdf.page.height - 52 - gap * 3) / 4; // four sections per sheet
    const colP = 170, colC = 80, colM = 92, colT = PW - colP - colC - colM;

    function sheetHeader(partNo) {
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(GOLD)
        .text(`${eventName.toUpperCase()} — JUDGE MARKING SHEET`, 34, 26, { align: 'center', width: PW });
      pdf.font('Helvetica').fontSize(7.5).fillColor(MUTED)
        .text(`Sheet part ${partNo} of 4 · Judge 1 / Judge 2 / Judge 3`, { align: 'center', width: PW });
    }

    const chunks = [];
    for (let i = 0; i < programs.length; i += 4) chunks.push(programs.slice(i, i + 4));

    chunks.forEach((chunk, ci) => {
      if (ci > 0) pdf.addPage();
      sheetHeader(4);
      chunk.forEach((prog, pi) => {
        const y0 = 44 + pi * (secH + gap);
        pdf.rect(34, y0, PW, secH).lineWidth(0.8).strokeColor(LINE).stroke();
        pdf.rect(34, y0, PW, 18).fill('#eef2f1');
        pdf.fillColor(TEAL).font('Helvetica-Bold').fontSize(9.5)
          .text(`PART ${pi + 1} — ${prog.name}`, 42, y0 + 5, { width: PW - 16 });
        // table header
        const hy = y0 + 18;
        pdf.fillColor(INK).font('Helvetica-Bold').fontSize(7.5);
        pdf.text('PARTICIPANT', 42, hy + 5, { width: colP });
        pdf.text('CHEST NO.', 42 + colP, hy + 5, { width: colC, align: 'center' });
        pdf.text('MARK', 42 + colP + colC, hy + 5, { width: colM, align: 'center' });
        pdf.text('TOTAL MARK', 42 + colP + colC + colM, hy + 5, { width: colT, align: 'center' });
        pdf.moveTo(34, hy + 15).lineTo(34 + PW, hy + 15).lineWidth(0.5).strokeColor(LINE).stroke();
        // rows
        let ry = hy + 15;
        const rowH = 16;
        const maxRows = Math.floor((secH - 33) / rowH);
        const rows = prog.rows.slice(0, maxRows);
        pdf.font('Helvetica').fontSize(7.5).fillColor(INK);
        rows.forEach((r) => {
          pdf.text(r.name, 42, ry + 4, { width: colP });
          pdf.text(r.chest_no, 42 + colP, ry + 4, { width: colC, align: 'center' });
          pdf.moveTo(34, ry + rowH).lineTo(34 + PW, ry + rowH).lineWidth(0.4).strokeColor('#e2e5e4').stroke();
          ry += rowH;
        });
        for (let k = rows.length; k < maxRows; k++) {
          pdf.moveTo(34, ry + rowH).lineTo(34 + PW, ry + rowH).lineWidth(0.4).strokeColor('#e2e5e4').stroke();
          ry += rowH;
        }
      });
    });
    pdf.end();
  });
}

module.exports = { buildTeamPdf, buildParticipantsPdf, buildJudgeSheetsPdf, teamName };
