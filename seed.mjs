// Namuna ma'lumot: turli lavozimdagi xodimlar + bugungi davomat (o'rin rasmlari bilan).
// Rasmlar — oddiy rangli avatar (ism bosh harfi). Haqiqiy selfi keyin Android ilovadan keladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const UP = path.join(dir, "uploads");
fs.mkdirSync(UP, { recursive: true });
fs.mkdirSync(path.join(dir, "data"), { recursive: true });

const TZ = 5 * 60 * 60 * 1000;
const bugunStr = new Date(Date.now() + TZ).toISOString().slice(0, 10);
// Toshkent bugungi HH:MM ni epoch ms ga
const vaqt = (hhmm) => {
  const ms = Date.parse(`${bugunStr}T${hhmm}:00.000Z`) - TZ;
  return ms;
};

// ── O'rin avatar: 160x160 JPEG, rangli fon + bosh harf (minimal, kutubxonasiz) ──
// JPEG ni qo'lda yozish murakkab, shuning uchun 1x1 rangli JPEG shablonini kattalashtirmay,
// to'g'ridan-to'g'ri tayyor minimal JPEG baytlarini ishlatamiz (bir rangli to'rtburchak).
function rangliJpeg(r, g, b) {
  // Minimal 8x8 bir rangli JPEG yasash o'rniga, PPM->emas; eng oddiyi: SVG... lekin <img> uploads/*.jpg kutadi.
  // Shuning uchun Java bilan yasaymiz (pastda). Bu funksiya ishlatilmaydi.
  return null;
}

const xodimlar = [
  { id: 1, ism: "Alijon Qorovulov", lavozim: "qorovul", bolim: "Qorovullar bo'limi", rasm: "a1.jpg" },
  { id: 2, ism: "Bekzod Operatorov", lavozim: "operator", bolim: "Ishlab chiqarish", rasm: "a2.jpg" },
  { id: 3, ism: "Dilshod Operatorov", lavozim: "operator", bolim: "Ishlab chiqarish", rasm: "a3.jpg" },
  { id: 4, ism: "Eldor Haydovchiyev", lavozim: "haydovchi", bolim: "Transport bo'limi", rasm: "a4.jpg" },
  { id: 5, ism: "Farrux Qorovulov", lavozim: "qorovul", bolim: "Qorovullar bo'limi", rasm: "a5.jpg" },
];

// Bugungi qaydlar: ba'zi vaqtida, ba'zi kech; bittasi SOXTA (jonli=false)
const davomat = [
  { xodimId: 1, yonalish: "KIRISH", hhmm: "06:12", rasm: "e1.jpg", jonli: true },
  { xodimId: 1, yonalish: "CHIQISH", hhmm: "14:03", rasm: "e2.jpg", jonli: true },
  { xodimId: 2, yonalish: "KIRISH", hhmm: "07:40", rasm: "e3.jpg", jonli: true },
  { xodimId: 3, yonalish: "KIRISH", hhmm: "08:35", rasm: "e4.jpg", jonli: true }, // kech
  { xodimId: 4, yonalish: "KIRISH", hhmm: "06:55", rasm: "e5.jpg", jonli: false }, // soxta deb belgilangan
  { xodimId: 4, yonalish: "CHIQISH", hhmm: "18:20", rasm: "e6.jpg", jonli: true },
  // 5-xodim (Farrux) bugun kelmagan
];

const db = {
  xodimlar,
  davomat: davomat.map((d, i) => ({
    id: i + 1, xodimId: d.xodimId,
    ism: xodimlar.find((x) => x.id === d.xodimId).ism,
    lavozim: xodimlar.find((x) => x.id === d.xodimId).lavozim,
    yonalish: d.yonalish, vaqt: vaqt(d.hhmm), rasm: d.rasm, jonli: d.jonli, lat: null, lng: null,
  })),
  jadvallar: {
    qorovul: { kirishDan: "06:00", kirishGacha: "06:30", chiqishDan: "14:00", chiqishGacha: "14:00" },
    operator: { kirishDan: "06:00", kirishGacha: "08:00", chiqishDan: "17:00", chiqishGacha: "21:00" },
    haydovchi: { kirishDan: "06:00", kirishGacha: "08:00", chiqishDan: "17:00", chiqishGacha: "21:00" },
  },
  keyingiXodim: 6,
  keyingiDavomat: davomat.length + 1,
};

fs.writeFileSync(path.join(dir, "data", "data.json"), JSON.stringify(db, null, 2));
console.log("data.json yozildi:", xodimlar.length, "xodim,", davomat.length, "qayd, sana", bugunStr);
