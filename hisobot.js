// Excel hisobotlar — iVMS "Кунлик Давомат" uslubida (kirill).
import ExcelJS from "exceljs";

const USTUN_KENG = [5, 12, 28, 24, 20, 18, 16, 14, 16, 14];
const SARLAVHALAR = ["№", "Ходим ID", "Ф.И.Ш.", "Бўлими", "Лавозими", "Келди - Кетди", "Ишлаган вақти", "Кечикиш", "Қўшимча соат", "Ҳолати"];

// Bo'lim sarlavhasi ranglari (navbat bilan)
const BOLIM_RANG = ["FFD9E1F2", "FFE2EFDA", "FFFCE4D6", "FFD9D2E9", "FFD0E0E3", "FFFFF2CC"];

const chegara = { style: "thin", color: { argb: "FFBFBFBF" } };
const hammaChegara = { top: chegara, left: chegara, bottom: chegara, right: chegara };

function ustunlarniSozla(ws) {
  USTUN_KENG.forEach((w, i) => (ws.getColumn(i + 1).width = w));
}

function sarlavhaBloki(ws, sarlavha, kichik) {
  ws.mergeCells(1, 1, 1, 10);
  const t = ws.getCell(1, 1);
  t.value = sarlavha;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 10);
  const s = ws.getCell(2, 1);
  s.value = kichik;
  s.font = { size: 11, color: { argb: "FF333333" } };
  s.alignment = { horizontal: "center", vertical: "middle" };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
  ws.getRow(2).height = 20;
}

function ustunSarlavha(ws, qator) {
  const r = ws.getRow(qator);
  SARLAVHALAR.forEach((h, i) => {
    const c = r.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    c.border = hammaChegara;
  });
  r.height = 26;
}

function bolimSarlavha(ws, qator, matn, rang) {
  ws.mergeCells(qator, 1, qator, 10);
  const c = ws.getCell(qator, 1);
  c.value = matn;
  c.font = { bold: true, size: 12, color: { argb: "FF1F3864" } };
  c.alignment = { horizontal: "left", vertical: "middle" };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rang } };
  c.border = hammaChegara;
  ws.getRow(qator).height = 22;
}

/** Kunlik hisobot — namuna format bilan bir xil */
export async function kunlikXlsx({ sana, jami, kelgan, kelmagan, bolimlar, firma }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Кунлик Давомат");
  ustunlarniSozla(ws);

  const bosh = firma ? String(firma).toUpperCase() : "КОРХОНА";
  const foiz = jami ? Math.round((kelgan / jami) * 100) : 0;
  sarlavhaBloki(ws, `📊 ${bosh} — КУНЛИК ДАВОМАТ ҲИСОБОТИ (${sana})`,
    `Сана: ${sana} | Жами: ${jami} нафар | Келган: ${kelgan} нафар (${foiz}%) | Келмаган: ${kelmagan} нафар`);

  let r = 4;
  bolimlar.forEach((b, bi) => {
    bolimSarlavha(ws, r, `🏢 ${b.nom.toUpperCase()} (${b.qatorlar.length} нафар)`, BOLIM_RANG[bi % BOLIM_RANG.length]);
    r++;
    ustunSarlavha(ws, r);
    r++;
    for (const q of b.qatorlar) {
      const row = ws.getRow(r);
      const qiymat = [q.n, q.id, q.fio, q.bolim, q.lavozim, q.keldiKetdi, q.ishlagan, q.kechikish, q.qoshimcha, q.holat];
      qiymat.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.border = hammaChegara;
        c.alignment = { vertical: "middle", horizontal: i === 2 || i === 3 || i === 4 ? "left" : "center", wrapText: false };
      });
      // Holat rangi
      const h = row.getCell(10);
      if (q.holat === "Келган") {
        h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD3" } };
        h.font = { color: { argb: "FF276A3C" }, bold: true };
      } else {
        h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
        h.font = { color: { argb: "FFC00000" }, bold: true };
      }
      row.height = 20;
      r++;
    }
    r++; // bo'limlar orasida bo'sh qator
  });

  return wb.xlsx.writeBuffer();
}

/** Oylik hisobot — har xodimga oylik jamlanma (shu uslubda) */
export async function oylikXlsx({ oy, kunSoni, bolimlar }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ойлик Давомат");
  const keng = [5, 12, 28, 24, 20, 14, 14, 16, 16];
  keng.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const sarl = ["№", "Ходим ID", "Ф.И.Ш.", "Бўлими", "Лавозими", "Келган кун", "Келмаган", "Кечикишлар", "Жами кечикиш"];

  ws.mergeCells(1, 1, 1, 9);
  const t = ws.getCell(1, 1);
  t.value = `📊 КОРХОНА ОЙЛИК ДАВОМАТ ҲИСОБОТИ (${oy})`;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.getRow(1).height = 30;
  ws.mergeCells(2, 1, 2, 9);
  const s = ws.getCell(2, 1);
  s.value = `Ой: ${oy} | Иш кунлари: ${kunSoni} кун`;
  s.font = { size: 11, color: { argb: "FF333333" } };
  s.alignment = { horizontal: "center", vertical: "middle" };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };

  let r = 4;
  bolimlar.forEach((b, bi) => {
    ws.mergeCells(r, 1, r, 9);
    const hc = ws.getCell(r, 1);
    hc.value = `🏢 ${b.nom.toUpperCase()} (${b.qatorlar.length} нафар)`;
    hc.font = { bold: true, size: 12, color: { argb: "FF1F3864" } };
    hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BOLIM_RANG[bi % BOLIM_RANG.length] } };
    hc.border = hammaChegara;
    ws.getRow(r).height = 22;
    r++;
    const hr = ws.getRow(r);
    sarl.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
      c.border = hammaChegara;
    });
    hr.height = 26;
    r++;
    for (const q of b.qatorlar) {
      const row = ws.getRow(r);
      [q.n, q.id, q.fio, q.bolim, q.lavozim, q.kelgan, q.kelmagan, q.kechikishlar, q.jamiKechikish].forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.border = hammaChegara;
        c.alignment = { vertical: "middle", horizontal: i === 2 || i === 3 || i === 4 ? "left" : "center" };
      });
      r++;
    }
    r++;
  });
  return wb.xlsx.writeBuffer();
}
