// Yuz Nazorat — veb admin panel backend.
// Oddiy, serverlik bog'liqliksiz: ma'lumot data/data.json da, rasmlar uploads/ da.
// Keyin Android ilova shu API ga davomatni yuboradi, Telegram bot shu yerdan hisobot oladi.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kunlikXlsx, oylikXlsx } from "./hisobot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "data", "data.json");
const UPLOADS = path.join(__dirname, "uploads");
const PORT = process.env.PORT || 4100;

// Toshkent vaqti (+05:00) — sana chegaralari shunga ko'ra hisoblanadi
const TZ = 5 * 60 * 60 * 1000;

// ───────── Ma'lumot bazasi (JSON) ─────────

const LAVOZIMLAR = ["qorovul", "operator", "rahbar", "haydovchi"];

function boshlangich() {
  return {
    xodimlar: [],
    davomat: [],
    // kirishGacha — oxirgi kirish vaqti (undan keyin "kech"); chiqishGacha — ish tugashi (undan keyin "qo'shimcha").
    // kirishDan=00:00 — erta kelish jazolanmaydi, faqat haqiqiy vaqt yoziladi.
    jadvallar: {
      qorovul: { kirishDan: "00:00", kirishGacha: "07:00", chiqishDan: "00:00", chiqishGacha: "02:00" },
      operator: { kirishDan: "00:00", kirishGacha: "08:00", chiqishDan: "00:00", chiqishGacha: "17:00" },
      rahbar: { kirishDan: "00:00", kirishGacha: "10:00", chiqishDan: "00:00", chiqishGacha: "17:00" },
      haydovchi: { kirishDan: "00:00", kirishGacha: "08:00", chiqishDan: "00:00", chiqishGacha: "17:00" },
    },
    telegram: { token: "", chatId: "", adminChatId: "", threadId: "", firma: "GREAT BUILDING HOLDING MChJ", avto: false, vaqt: "09:30", oxirgiYuborilgan: "", hodisaYubor: false },
    keyingiXodim: 1,
    keyingiDavomat: 1,
  };
}

function oqi() {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(DATA, "utf8"));
  } catch {
    return boshlangich();
  }
  const b = boshlangich();
  const db = { ...b, ...d };
  // Yangi lavozim jadvallari va yangi telegram maydonlari mavjud bazaga ham qo'shilsin
  db.jadvallar = { ...b.jadvallar, ...(d.jadvallar || {}) };
  db.telegram = { ...b.telegram, ...(d.telegram || {}) };
  return db;
}

let db = oqi();
function saqla() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2));
}

// Jadval vaqtlari yangilandi (bir martalik) — mavjud bazaga ham yangi lavozim qoidalarini qo'llaydi.
// Keyin panelning "Jadvallar" sahifasidan o'zgartirilsa — o'zgarishlar saqlanadi.
if (db.jadvalV !== 2) {
  db.jadvallar = boshlangich().jadvallar;
  db.jadvalV = 2;
  saqla();
}

// ───────── Yordamchilar ─────────

/** epoch ms → "YYYY-MM-DD" (Toshkent) */
function sana(ms) {
  return new Date(ms + TZ).toISOString().slice(0, 10);
}
/** epoch ms → "HH:MM" (Toshkent) */
function soat(ms) {
  return new Date(ms + TZ).toISOString().slice(11, 16);
}
/** "YYYY-MM-DD" bugunmi (Toshkent) */
function bugun() {
  return sana(Date.now());
}

/** kirish holati: vaqtida / kech / erta / belgilanmagan */
function kirishHolati(hhmm, jadval) {
  if (!hhmm || !jadval) return "";
  if (hhmm < jadval.kirishDan) return "erta";
  if (hhmm > jadval.kirishGacha) return "kech";
  return "vaqtida";
}
function chiqishHolati(hhmm, jadval) {
  if (!hhmm || !jadval) return "";
  if (hhmm < jadval.chiqishDan) return "erta";
  if (hhmm > jadval.chiqishGacha) return "kech";
  return "vaqtida";
}

/** Lavozimdan taxminiy bo'lim (hisobotda guruhlash uchun). Panelda keyin qo'lda o'zgartirilishi mumkin. */
function bolimLavozimdan(lavozim) {
  const s = String(lavozim || "").toLowerCase();
  if (s.includes("rahbar") || s.includes("раҳбар") || s.includes("director") || s.includes("boshliq")) return "Rahbariyat";
  if (s.includes("qorovul") || s.includes("qоровул") || s.includes("qarovul")) return "Qorovullar";
  if (s.includes("haydovchi") || s.includes("shofyor")) return "Transport";
  if (s.includes("operator") || s.includes("ishchi") || s.includes("mashinist")) return "Ishlab chiqarish";
  return "Asosiy bo'lim";
}

// ───────── Server ─────────

const app = express();
app.use(express.json({ limit: "15mb" }));

// Himoya (deploy uchun). PANEL_PAROL o'rnatilsa — brauzer oddiy parol so'raydi.
// Android ilova POST /api/davomat ga API_KALIT bilan kiradi (basic auth emas).
const PAROL = process.env.PANEL_PAROL || "";
const API_KALIT = process.env.API_KALIT || "";
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/davomat") {
    if (!API_KALIT || req.headers["x-api-key"] === API_KALIT) return next();
    return res.status(401).json({ xato: "API kalit noto'g'ri" });
  }
  if (!PAROL) return next(); // lokal rejim — parolsiz
  const h = req.headers.authorization || "";
  const [u, p] = Buffer.from(h.startsWith("Basic ") ? h.slice(6) : "", "base64").toString("utf8").split(":");
  if (p === PAROL) return next();
  res.set("WWW-Authenticate", 'Basic realm="Yuz Nazorat"').status(401).send("Parol kerak");
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS));

// --- Xodimlar CRUD ---
app.get("/api/xodimlar", (req, res) => {
  res.json(db.xodimlar.slice().sort((a, b) => a.id - b.id));
});

app.post("/api/xodimlar", (req, res) => {
  const { ism, lavozim } = req.body || {};
  if (!ism || !String(ism).trim()) return res.status(400).json({ xato: "Ism kerak" });
  const id = db.keyingiXodim++;
  const x = { id, ism: String(ism).trim(), lavozim: lavozim || "operator", bolim: (req.body.bolim || "Asosiy bo'lim").trim(), rasm: null, yaratilgan: Date.now() };
  db.xodimlar.push(x);
  saqla();
  res.json(x);
});

app.put("/api/xodimlar/:id", (req, res) => {
  const x = db.xodimlar.find((e) => e.id === Number(req.params.id));
  if (!x) return res.status(404).json({ xato: "Topilmadi" });
  const { ism, lavozim, bolim } = req.body || {};
  if (ism !== undefined) x.ism = String(ism).trim();
  if (lavozim !== undefined) x.lavozim = lavozim;
  if (bolim !== undefined) x.bolim = String(bolim).trim();
  saqla();
  res.json(x);
});

app.delete("/api/xodimlar/:id", (req, res) => {
  const id = Number(req.params.id);
  db.xodimlar = db.xodimlar.filter((e) => e.id !== id);
  db.davomat = db.davomat.filter((d) => d.xodimId !== id);
  saqla();
  res.json({ ok: true });
});

// --- Lavozim jadvallari ---
app.get("/api/jadvallar", (req, res) => {
  res.json(db.jadvallar);
});

app.put("/api/jadvallar/:lavozim", (req, res) => {
  const l = req.params.lavozim;
  if (!db.jadvallar[l]) db.jadvallar[l] = {};
  const { kirishDan, kirishGacha, chiqishDan, chiqishGacha } = req.body || {};
  const j = db.jadvallar[l];
  if (kirishDan !== undefined) j.kirishDan = kirishDan;
  if (kirishGacha !== undefined) j.kirishGacha = kirishGacha;
  if (chiqishDan !== undefined) j.chiqishDan = chiqishDan;
  if (chiqishGacha !== undefined) j.chiqishGacha = chiqishGacha;
  saqla();
  res.json(db.jadvallar);
});

// --- Kunlik davomat: har xodimga birinchi kirish + oxirgi chiqish ---
app.get("/api/davomat/kunlik", (req, res) => {
  const kun = /^\d{4}-\d{2}-\d{2}$/.test(req.query.sana) ? req.query.sana : bugun();
  const kunlik = db.davomat.filter((d) => sana(d.vaqt) === kun);

  const natija = db.xodimlar
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((x) => {
      const uniki = kunlik.filter((d) => d.xodimId === x.id).sort((a, b) => a.vaqt - b.vaqt);
      const kirishlar = uniki.filter((d) => d.yonalish === "KIRISH");
      const chiqishlar = uniki.filter((d) => d.yonalish === "CHIQISH");
      const kir = kirishlar[0] || null;
      const chiq = chiqishlar[chiqishlar.length - 1] || null;
      const jadval = db.jadvallar[x.lavozim];
      return {
        id: x.id,
        ism: x.ism,
        lavozim: x.lavozim,
        rasm: x.rasm,
        kirish: kir ? soat(kir.vaqt) : null,
        kirishRasm: kir?.rasm || null,
        kirishJonli: kir?.jonli ?? null,
        kirishHolat: kir ? kirishHolati(soat(kir.vaqt), jadval) : "kelmagan",
        chiqish: chiq ? soat(chiq.vaqt) : null,
        chiqishRasm: chiq?.rasm || null,
        chiqishHolat: chiq ? chiqishHolati(soat(chiq.vaqt), jadval) : "",
      };
    });
  res.json({ sana: kun, qatorlar: natija });
});

// --- Xom qaydlar (kim qachon, rasm bilan) ---
app.get("/api/davomat/hom", (req, res) => {
  const kun = /^\d{4}-\d{2}-\d{2}$/.test(req.query.sana) ? req.query.sana : bugun();
  const qaydlar = db.davomat
    .filter((d) => sana(d.vaqt) === kun)
    .sort((a, b) => b.vaqt - a.vaqt)
    .map((d) => ({ ...d, soat: soat(d.vaqt) }));
  res.json({ sana: kun, qaydlar });
});

// --- Davomat qo'shish (keyin Android ilova shu yerga yuboradi; hozir qo'lda/sinov uchun) ---
app.post("/api/davomat", (req, res) => {
  const { xodimId, ism, lavozim, bolim, yonalish, vaqt, rasm, jonli, lat, lng } = req.body || {};
  const id = Number(xodimId);
  let x = db.xodimlar.find((e) => e.id === id);
  if (!x) {
    // Xodimlar ilovada yuz bilan qo'shiladi — panelda bo'lmasa, kirish kelganda avtomatik yaratamiz
    if (!id || !ism || !String(ism).trim()) return res.status(400).json({ xato: "Xodim topilmadi" });
    const lv = (lavozim || "operator").trim();
    x = { id, ism: String(ism).trim(), lavozim: lv, bolim: (bolim || bolimLavozimdan(lv)).trim(), rasm: null, yaratilgan: Date.now() };
    db.xodimlar.push(x);
    if (id >= db.keyingiXodim) db.keyingiXodim = id + 1;
  } else {
    // ilovada o'zgargan bo'lsa yangilaymiz
    if (ism && String(ism).trim()) x.ism = String(ism).trim();
    if (lavozim) x.lavozim = String(lavozim).trim();
    if (bolim) x.bolim = String(bolim).trim();
  }
  let rasmNom = null;
  if (rasm && /^data:image\/jpe?g;base64,/.test(rasm)) {
    fs.mkdirSync(UPLOADS, { recursive: true });
    rasmNom = `ev_${Date.now()}_${x.id}.jpg`;
    fs.writeFileSync(path.join(UPLOADS, rasmNom), Buffer.from(rasm.split(",")[1], "base64"));
    if (!x.rasm) x.rasm = rasmNom; // xodim surati bo'lmasa — birinchi selfini qo'yamiz
  }
  const d = {
    id: db.keyingiDavomat++,
    xodimId: x.id,
    ism: x.ism,
    lavozim: x.lavozim,
    yonalish: yonalish === "CHIQISH" ? "CHIQISH" : "KIRISH",
    vaqt: Number(vaqt) || Date.now(),
    rasm: rasmNom,
    jonli: jonli ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
  };
  db.davomat.push(d);
  saqla();
  res.json(d);

  // Har kirish/chiqishda selfini guruhga yuboramiz (javobni kutmasdan)
  const t = db.telegram;
  if (t.token && t.chatId && t.hodisaYubor && rasmNom) {
    const buf = Buffer.from(rasm.split(",")[1], "base64");
    const yon = d.yonalish === "KIRISH" ? "КИРИШ ✅" : "ЧИҚИШ 🔴";
    const jonliMatn = d.jonli === false ? "\n⚠️ Соxта (экран/расм) деб белгиланган" : "";
    const izoh = `${yon}\n👤 ${x.ism}\n🏢 ${x.bolim || "-"} · ${x.lavozim}\n🕐 ${soat(d.vaqt)}${jonliMatn}`;
    telegramRasm(t.token, t.chatId, buf, izoh).catch((e) => console.error("[telegram rasm]", e.message));
  }
});

// ───────── Hisobot (Excel) ─────────

const daqiqa = (hhmm) => (hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : 0);
const idMatn = (id) => String(id).padStart(8, "0");
/** daqiqa → "N соат M дақ" / "M дақ" / "" */
function muddat(min) {
  if (!min || min <= 0) return "";
  const s = Math.floor(min / 60);
  const d = min % 60;
  return s > 0 ? `${s} соат ${d} дақ` : `${d} дақ`;
}

/** Bir kunlik hisobot ma'lumoti — bo'limlar bo'yicha guruhlangan */
function kunlikMalumot(kun) {
  const kunlik = db.davomat.filter((d) => sana(d.vaqt) === kun);
  const xlar = db.xodimlar.slice().sort((a, b) => (a.bolim || "").localeCompare(b.bolim || "") || a.ism.localeCompare(b.ism));

  let jami = 0, kelgan = 0, n = 0;
  const bolimMap = new Map();
  for (const x of xlar) {
    jami++;
    const uniki = kunlik.filter((d) => d.xodimId === x.id).sort((a, b) => a.vaqt - b.vaqt);
    const kir = uniki.find((d) => d.yonalish === "KIRISH") || null;
    const chiqlar = uniki.filter((d) => d.yonalish === "CHIQISH");
    const chiq = chiqlar[chiqlar.length - 1] || null;
    const jadval = db.jadvallar[x.lavozim];
    const bor = Boolean(kir);
    if (bor) kelgan++;
    const kirH = kir ? soat(kir.vaqt) : null;
    const chiqH = chiq ? soat(chiq.vaqt) : null;
    const kechMin = kir && jadval ? Math.max(0, daqiqa(kirH) - daqiqa(jadval.kirishGacha)) : 0;
    const qoshMin = chiq && jadval ? Math.max(0, daqiqa(chiqH) - daqiqa(jadval.chiqishGacha)) : 0;
    const ishMin = kir && chiq ? Math.round((chiq.vaqt - kir.vaqt) / 60000) : 0;
    const q = {
      n: ++n, id: idMatn(x.id), fio: x.ism, bolim: x.bolim || "Asosiy bo'lim", lavozim: x.lavozim,
      keldiKetdi: bor ? `${kirH} - ${chiqH || "X"}` : "",
      ishlagan: muddat(ishMin),
      kechikish: bor ? (kechMin > 0 ? muddat(kechMin) : "-") : "",
      qoshimcha: muddat(qoshMin),
      holat: bor ? "Келган" : "Келмаган",
    };
    const bnom = q.bolim;
    if (!bolimMap.has(bnom)) bolimMap.set(bnom, []);
    bolimMap.get(bnom).push(q);
  }
  return { sana: kun, jami, kelgan, kelmagan: jami - kelgan, bolimlar: [...bolimMap].map(([nom, qatorlar]) => ({ nom, qatorlar })) };
}

/** Oylik jamlanma (oy — "YYYY-MM") */
function oylikMalumot(oy) {
  const kunlar = new Set();
  db.davomat.forEach((d) => { const s = sana(d.vaqt); if (s.startsWith(oy)) kunlar.add(s); });
  const ishKunlari = [...kunlar].sort();
  const xlar = db.xodimlar.slice().sort((a, b) => (a.bolim || "").localeCompare(b.bolim || "") || a.ism.localeCompare(b.ism));

  let n = 0;
  const bolimMap = new Map();
  for (const x of xlar) {
    const jadval = db.jadvallar[x.lavozim];
    let kelgan = 0, kechKun = 0, jamiKech = 0;
    for (const kun of ishKunlari) {
      const uniki = db.davomat.filter((d) => d.xodimId === x.id && sana(d.vaqt) === kun && d.yonalish === "KIRISH").sort((a, b) => a.vaqt - b.vaqt);
      const kir = uniki[0];
      if (kir) {
        kelgan++;
        const kech = jadval ? Math.max(0, daqiqa(soat(kir.vaqt)) - daqiqa(jadval.kirishGacha)) : 0;
        if (kech > 0) { kechKun++; jamiKech += kech; }
      }
    }
    const q = {
      n: ++n, id: idMatn(x.id), fio: x.ism, bolim: x.bolim || "Asosiy bo'lim", lavozim: x.lavozim,
      kelgan, kelmagan: ishKunlari.length - kelgan, kechikishlar: kechKun ? `${kechKun} кун` : "-", jamiKechikish: muddat(jamiKech) || "-",
    };
    const bnom = q.bolim;
    if (!bolimMap.has(bnom)) bolimMap.set(bnom, []);
    bolimMap.get(bnom).push(q);
  }
  return { oy, kunSoni: ishKunlari.length, bolimlar: [...bolimMap].map(([nom, qatorlar]) => ({ nom, qatorlar })) };
}

app.get("/api/hisobot/kunlik.xlsx", async (req, res) => {
  const kun = /^\d{4}-\d{2}-\d{2}$/.test(req.query.sana) ? req.query.sana : bugun();
  const kunNuqta = kun.split("-").reverse().join(".");
  const m = kunlikMalumot(kun);
  const buf = await kunlikXlsx({ ...m, sana: kunNuqta, firma: db.telegram.firma });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Report_Kunlik_${kun}.xlsx"`);
  res.send(Buffer.from(buf));
});

app.get("/api/hisobot/oylik.xlsx", async (req, res) => {
  const oy = /^\d{4}-\d{2}$/.test(req.query.oy) ? req.query.oy : bugun().slice(0, 7);
  const buf = await oylikXlsx(oylikMalumot(oy));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Report_Oylik_${oy}.xlsx"`);
  res.send(Buffer.from(buf));
});

// ───────── Telegram ─────────

const XLSX_TUR = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** xlsx buferini chat (guruh yoki lichka) ga fayl qilib yuboradi. threadId — mavzuli guruh uchun. replyMarkup — tugmalar. */
async function telegramFayl(token, chatId, buf, nom, izoh, threadId, replyMarkup) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (threadId) form.append("message_thread_id", String(threadId));
  if (izoh) form.append("caption", izoh);
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("document", new Blob([buf], { type: XLSX_TUR }), nom);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const j = await r.json().catch(() => ({ ok: false, description: "javob o'qilmadi" }));
  if (!j.ok) throw new Error(j.description || "Telegram xatosi");
  return j;
}

/** Telegram Bot API ga JSON so'rov (sendMessage, answerCallbackQuery, editMessageCaption...) */
async function tgFetch(token, metod, tana) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metod}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tana),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, description: e.message };
  }
}

/** Bitta selfi rasmni izoh bilan guruhga yuboradi (har kirish/chiqishda) */
async function telegramRasm(token, chatId, buf, izoh) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (izoh) form.append("caption", izoh);
  form.append("photo", new Blob([buf], { type: "image/jpeg" }), "selfi.jpg");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.description || "Telegram rasm xatosi");
  return j;
}

const kutilayotgan = new Map(); // tasdiq_id -> { kun }

/** Kunlik hisobot buferi, izohi va fayl nomini tayyorlaydi */
async function kunlikTayyor(kun) {
  const firma = db.telegram.firma || "GREAT BUILDING HOLDING MChJ";
  const m = kunlikMalumot(kun);
  const kunNuqta = kun.split("-").reverse().join(".");
  const buf = Buffer.from(await kunlikXlsx({ ...m, sana: kunNuqta, firma }));
  const foiz = m.jami ? Math.round((m.kelgan / m.jami) * 100) : 0;
  const n = new Date(Date.now() + TZ).toISOString();
  const yuborilgan = `${n.slice(8, 10)}.${n.slice(5, 7)}.${n.slice(0, 4)} ${n.slice(11, 16)}`;
  const izoh = `📊 Кунлик давомат ҳисоботи — ${kunNuqta}\nЖами: ${m.jami} | Келган: ${m.kelgan} (${foiz}%) | Келмаган: ${m.kelmagan}\n\n🏢 ${firma}\n🕐 Юборилди: ${yuborilgan}`;
  return { buf, izoh, nom: `Report_Kunlik_${kun}.xlsx` };
}

/** AVVAL admin lichkasiga tasdiqlash uchun yuboradi (tugma bilan). Guruhga faqat tasdiqdan keyin boradi. */
async function kunlikYubor(kun) {
  const t = db.telegram;
  if (!t.token) throw new Error("Bot tokeni kiritilmagan");
  if (!t.adminChatId) throw new Error("Admin lichka ID kiritilmagan — tasdiqlash uchun shart");
  const { buf, izoh, nom } = await kunlikTayyor(kun);
  const id = String(Date.now()).slice(-9);
  kutilayotgan.set(id, { kun });
  const markup = { inline_keyboard: [[
    { text: "✅ Тасдиқлаш", callback_data: `ok:${id}` },
    { text: "❌ Рад этиш", callback_data: `no:${id}` },
  ]] };
  await telegramFayl(t.token, t.adminChatId, buf, nom, `${izoh}\n\n⏳ Тасдиқласангиз гуруҳга юборилади.`, null, markup);
  return { tasdiq: true };
}

/** Tasdiqdan keyin hisobotni guruhga (mavzuli bo'lsa — mavzuga) yuboradi */
async function guruhgaYubor(kun) {
  const t = db.telegram;
  if (!t.chatId) throw new Error("Guruh ID kiritilmagan");
  const { buf, izoh, nom } = await kunlikTayyor(kun);
  await telegramFayl(t.token, t.chatId, buf, nom, izoh, t.threadId);
}

app.get("/api/telegram", (req, res) => {
  const t = db.telegram;
  res.json({ token: t.token, chatId: t.chatId, adminChatId: t.adminChatId, threadId: t.threadId, firma: t.firma, avto: t.avto, vaqt: t.vaqt, oxirgiYuborilgan: t.oxirgiYuborilgan, hodisaYubor: t.hodisaYubor });
});

app.put("/api/telegram", (req, res) => {
  const { token, chatId, adminChatId, threadId, firma, avto, vaqt, hodisaYubor } = req.body || {};
  if (token !== undefined) db.telegram.token = String(token).trim();
  if (chatId !== undefined) db.telegram.chatId = String(chatId).trim();
  if (adminChatId !== undefined) db.telegram.adminChatId = String(adminChatId).trim();
  if (threadId !== undefined) db.telegram.threadId = String(threadId).trim();
  if (firma !== undefined) db.telegram.firma = String(firma).trim();
  if (avto !== undefined) db.telegram.avto = Boolean(avto);
  if (hodisaYubor !== undefined) db.telegram.hodisaYubor = Boolean(hodisaYubor);
  if (vaqt !== undefined && /^\d{2}:\d{2}$/.test(vaqt)) db.telegram.vaqt = vaqt;
  saqla();
  res.json({ ok: true });
});

app.post("/api/telegram/yubor", async (req, res) => {
  try {
    const kun = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.sana) ? req.body.sana : bugun();
    await kunlikYubor(kun);
    res.json({ ok: true, matn: "Admin lichkangizga tasdiqlash uchun yuborildi — tasdiqlasangiz guruhga boradi" });
  } catch (e) {
    res.status(400).json({ xato: e.message });
  }
});

// Har kuni belgilangan vaqtda KECHAGI kunlik hisobotni admin lichkasiga (tasdiqlashga) yuboradi
setInterval(async () => {
  const t = db.telegram;
  if (!t.avto || !t.token || !t.adminChatId) return;
  const hozir = soat(Date.now());
  const bugunKun = bugun();
  if (hozir !== t.vaqt || t.oxirgiYuborilgan === bugunKun) return;
  const kecha = sana(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await kunlikYubor(kecha);
    t.oxirgiYuborilgan = bugunKun;
    saqla();
    console.log(`[telegram] ${kecha} hisoboti admin lichkasiga tasdiqlashga yuborildi`);
  } catch (e) {
    console.error("[telegram] yuborilmadi:", e.message);
  }
}, 60 * 1000);

// ───────── Telegram tugma (tasdiq/rad) va ID yordamchisi — getUpdates polling ─────────
const yangi = (ms) => new Promise((r) => setTimeout(r, ms));
let tgOffset = 0;

async function tgYangilik(u, t) {
  // /start yoki /id — chat (va mavzu) ID sini javob qiladi (ID larni olish uchun)
  if (u.message && typeof u.message.text === "string" && /^\/(start|id)\b/.test(u.message.text)) {
    const chat = u.message.chat;
    const thread = u.message.message_thread_id;
    let matn = `🆔 Chat ID: ${chat.id}`;
    if (thread) matn += `\n🧵 Мавзу (thread) ID: ${thread}`;
    matn += chat.type === "private"
      ? `\n→ Панелдаги "Admin личка ID" майдонига қўйинг`
      : `\n→ Панелдаги "Гуруҳ ID"${thread ? ' ва "Мавзу ID"' : ""} майдонига қўйинг`;
    await tgFetch(t.token, "sendMessage", thread ? { chat_id: chat.id, message_thread_id: thread, text: matn } : { chat_id: chat.id, text: matn });
    return;
  }
  // Tugma bosildi — tasdiq yoki rad
  if (u.callback_query) {
    const cq = u.callback_query;
    const [amal, id] = String(cq.data || "").split(":");
    const p = id && kutilayotgan.get(id);
    const xabarTuzat = (qoshimcha) =>
      tgFetch(t.token, "editMessageCaption", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, caption: `${cq.message.caption || ""}\n\n${qoshimcha}` });
    if (!p) {
      await tgFetch(t.token, "answerCallbackQuery", { callback_query_id: cq.id, text: "Муддати ўтган ёки аллақачон ҳал қилинган" });
      await xabarTuzat("ℹ️ Бу сўров аллақачон ҳал қилинган");
      return;
    }
    kutilayotgan.delete(id);
    if (amal === "ok") {
      try {
        await guruhgaYubor(p.kun);
        await tgFetch(t.token, "answerCallbackQuery", { callback_query_id: cq.id, text: "✅ Гуруҳга юборилди" });
        await xabarTuzat("✅ Тасдиқланди — гуруҳга юборилди");
      } catch (e) {
        kutilayotgan.set(id, p); // xato bo'lsa qayta urinish uchun saqlab qolamiz
        await tgFetch(t.token, "answerCallbackQuery", { callback_query_id: cq.id, text: "Хато: " + e.message, show_alert: true });
      }
    } else {
      await tgFetch(t.token, "answerCallbackQuery", { callback_query_id: cq.id, text: "❌ Рад этилди" });
      await xabarTuzat("❌ Рад этилди — гуруҳга юборилмади");
    }
  }
}

async function tgPolling() {
  for (;;) {
    const t = db.telegram;
    if (!t.token) { await yangi(2000); continue; }
    try {
      const r = await fetch(`https://api.telegram.org/bot${t.token}/getUpdates?timeout=30&offset=${tgOffset}`);
      const j = await r.json();
      if (j.ok && Array.isArray(j.result)) {
        for (const u of j.result) {
          tgOffset = u.update_id + 1;
          try { await tgYangilik(u, db.telegram); } catch (e) { console.error("[telegram] yangilik:", e.message); }
        }
      } else if (!j.ok) {
        await yangi(3000);
      }
    } catch (e) {
      await yangi(3000);
    }
  }
}
tgPolling();

app.get("/api/holat", (req, res) => {
  res.json({ xodimlar: db.xodimlar.length, davomat: db.davomat.length, bugun: bugun(), lavozimlar: LAVOZIMLAR });
});

app.listen(PORT, () => console.log(`Panel: http://localhost:${PORT}`));
