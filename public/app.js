// Yuz Nazorat admin panel — frontend (vanilla JS)

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
const api = async (yol, usul, tana) =>
  (await fetch(yol, { method: usul || "GET", headers: tana ? { "Content-Type": "application/json" } : {}, body: tana ? JSON.stringify(tana) : undefined })).json();

let LAVOZIMLAR = ["qorovul", "operator", "haydovchi"];

// ── Menyu / sahifalar ──
document.querySelectorAll("#menyu button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll("#menyu button").forEach((x) => x.classList.remove("faol"));
    document.querySelectorAll(".sahifa").forEach((x) => x.classList.remove("faol"));
    b.classList.add("faol");
    $("#" + b.dataset.sahifa).classList.add("faol");
    if (b.dataset.sahifa === "xodimlar") xodimlarniYukla();
    if (b.dataset.sahifa === "jadvallar") jadvallarniYukla();
  }),
);

// ── Oyna ──
const oynaOch = (sarlavha, tana) => { $("#oynaSarlavha").textContent = sarlavha; $("#oynaTana").innerHTML = ""; $("#oynaTana").append(tana); $("#oyna").classList.add("ochiq"); };
const oynaYop = () => $("#oyna").classList.remove("ochiq");
$("#oynaYop").addEventListener("click", oynaYop);
$("#oyna").addEventListener("click", (e) => { if (e.target.id === "oyna") oynaYop(); });

const rasmKorsat = (yol) => { $("#kattaRasm").src = yol; $("#rasmOyna").classList.add("ochiq"); };
$("#rasmOyna").addEventListener("click", () => $("#rasmOyna").classList.remove("ochiq"));

// ── Kunlik davomat ──
const belgiKlass = { vaqtida: "b-vaqtida", kech: "b-kech", erta: "b-erta", kelmagan: "b-kelmagan", "": "" };
const belgiMatn = { vaqtida: "vaqtida", kech: "kech", erta: "erta", kelmagan: "kelmagan", "": "" };

function belgi(holat) {
  if (!holat) return "";
  return `<span class="belgi ${belgiKlass[holat]}">${belgiMatn[holat]}</span>`;
}
function suratKat(rasm, jonli) {
  if (!rasm) return '<span class="yoq">—</span>';
  const t = jonli === false ? " title='SOXTA deb belgilangan'" : "";
  return `<img class="mini" src="/uploads/${rasm}"${t} data-rasm="/uploads/${rasm}" />`;
}

async function davomatYukla() {
  const sana = $("#sana").value;
  const j = await api("/api/davomat/kunlik?sana=" + sana);
  const tb = $("#davomatJadval tbody");
  tb.innerHTML = "";
  if (!j.qatorlar.length) { tb.innerHTML = '<tr><td colspan="7" class="bosh">Xodim yoki qayd yo‘q</td></tr>'; return; }
  for (const q of j.qatorlar) {
    const tr = el("tr");
    tr.innerHTML = `
      <td>${q.rasm ? `<img class="avatar" src="/uploads/${q.rasm}" />` : '<div class="avatar"></div>'}</td>
      <td><b>${q.ism}</b></td>
      <td style="text-transform:capitalize">${q.lavozim}</td>
      <td>${q.kirish ? `<span class="vaqt">${q.kirish}</span> ${belgi(q.kirishHolat)}` : belgi("kelmagan")}</td>
      <td>${q.chiqish ? `<span class="vaqt">${q.chiqish}</span> ${belgi(q.chiqishHolat)}` : '<span class="yoq">—</span>'}</td>
      <td>${suratKat(q.kirishRasm, q.kirishJonli)}</td>
      <td>${suratKat(q.chiqishRasm)}</td>`;
    tb.append(tr);
  }
  tb.querySelectorAll(".mini").forEach((im) => im.addEventListener("click", () => rasmKorsat(im.dataset.rasm)));
}
$("#sana").addEventListener("change", davomatYukla);

// ── Xodimlar ──
async function xodimlarniYukla() {
  const xs = await api("/api/xodimlar");
  const tb = $("#xodimJadval tbody");
  tb.innerHTML = "";
  if (!xs.length) { tb.innerHTML = '<tr><td colspan="5" class="bosh">Hali xodim yo‘q</td></tr>'; return; }
  for (const x of xs) {
    const tr = el("tr");
    tr.innerHTML = `<td>${x.id}</td><td><b>${x.ism}</b></td><td>${x.bolim || "—"}</td><td style="text-transform:capitalize">${x.lavozim}</td>
      <td style="text-align:right"><button class="oq tahrir">Tahrirlash</button> <button class="xavf ochir">O‘chirish</button></td>`;
    tr.querySelector(".tahrir").addEventListener("click", () => xodimForma(x));
    tr.querySelector(".ochir").addEventListener("click", async () => {
      if (confirm(`${x.ism} o‘chirilsinmi? Davomat qaydlari ham o‘chadi.`)) { await api("/api/xodimlar/" + x.id, "DELETE"); xodimlarniYukla(); }
    });
    tb.append(tr);
  }
}

function xodimForma(x) {
  const t = el("div");
  const tanlov = LAVOZIMLAR.map((l) => `<option value="${l}" ${x && x.lavozim === l ? "selected" : ""}>${l}</option>`).join("");
  t.innerHTML = `
    <div><label>Ism va familiya</label><input type="text" id="fIsm" value="${x ? x.ism : ""}" /></div>
    <div><label>Bo‘lim</label><input type="text" id="fBolim" value="${x ? x.bolim || "" : ""}" placeholder="Masalan: Ishlab chiqarish" /></div>
    <div><label>Lavozim</label><select id="fLavozim">${tanlov}</select></div>
    <button class="asosiy" id="fSaqla">Saqlash</button>`;
  oynaOch(x ? "Xodimni tahrirlash" : "Xodim qo‘shish", t);
  t.querySelector("#fSaqla").addEventListener("click", async () => {
    const ism = t.querySelector("#fIsm").value.trim();
    const lavozim = t.querySelector("#fLavozim").value;
    const bolim = t.querySelector("#fBolim").value.trim();
    if (!ism) return alert("Ism kerak");
    if (x) await api("/api/xodimlar/" + x.id, "PUT", { ism, lavozim, bolim });
    else await api("/api/xodimlar", "POST", { ism, lavozim, bolim });
    oynaYop();
    xodimlarniYukla();
  });
}
$("#xodimQosh").addEventListener("click", () => xodimForma(null));

// ── Jadvallar ──
async function jadvallarniYukla() {
  const j = await api("/api/jadvallar");
  const orn = $("#jadvalKartalar");
  orn.innerHTML = "";
  for (const [lavozim, v] of Object.entries(j)) {
    const k = el("div", "karta");
    k.innerHTML = `
      <h3>${lavozim}</h3>
      <div class="maydon"><label>Kirish oynasi</label><div class="ikki"><input type="time" id="kd_${lavozim}" value="${v.kirishDan}"><input type="time" id="kg_${lavozim}" value="${v.kirishGacha}"></div></div>
      <div class="maydon"><label>Chiqish oynasi</label><div class="ikki"><input type="time" id="cd_${lavozim}" value="${v.chiqishDan}"><input type="time" id="cg_${lavozim}" value="${v.chiqishGacha}"></div></div>
      <button class="asosiy" style="margin-top:6px" data-l="${lavozim}">Saqlash</button>`;
    k.querySelector("button").addEventListener("click", async () => {
      await api("/api/jadvallar/" + lavozim, "PUT", {
        kirishDan: k.querySelector("#kd_" + lavozim).value,
        kirishGacha: k.querySelector("#kg_" + lavozim).value,
        chiqishDan: k.querySelector("#cd_" + lavozim).value,
        chiqishGacha: k.querySelector("#cg_" + lavozim).value,
      });
      const b = k.querySelector("button");
      b.textContent = "Saqlandi ✓";
      setTimeout(() => (b.textContent = "Saqlash"), 1500);
    });
    orn.append(k);
  }
}

// ── Hisobot (Excel yuklab olish) ──
$("#hKunYukla").addEventListener("click", () => {
  const s = $("#hKunSana").value;
  window.location.href = "/api/hisobot/kunlik.xlsx?sana=" + s;
});
$("#hOyYukla").addEventListener("click", () => {
  const o = $("#hOy").value;
  window.location.href = "/api/hisobot/oylik.xlsx?oy=" + o;
});

// ── Telegram sozlama ──
async function telegramYukla() {
  const t = await api("/api/telegram");
  $("#tgFirma").value = t.firma || "";
  $("#tgToken").value = t.token || "";
  $("#tgAdmin").value = t.adminChatId || "";
  $("#tgChat").value = t.chatId || "";
  $("#tgThread").value = t.threadId || "";
  $("#tgAvto").checked = !!t.avto;
  $("#tgVaqt").value = t.vaqt || "09:30";
}
function tgSozlama() {
  return {
    firma: $("#tgFirma").value.trim(),
    token: $("#tgToken").value.trim(),
    adminChatId: $("#tgAdmin").value.trim(),
    chatId: $("#tgChat").value.trim(),
    threadId: $("#tgThread").value.trim(),
    avto: $("#tgAvto").checked,
    vaqt: $("#tgVaqt").value,
  };
}
$("#tgSaqla").addEventListener("click", async () => {
  await api("/api/telegram", "PUT", tgSozlama());
  $("#tgNatija").textContent = "Saqlandi ✓";
  $("#tgNatija").style.color = "var(--yashil)";
});
$("#tgSinov").addEventListener("click", async () => {
  $("#tgNatija").textContent = "Yuborilmoqda…";
  $("#tgNatija").style.color = "var(--kulrang)";
  await api("/api/telegram", "PUT", tgSozlama()); // avval saqlaymiz
  const r = await api("/api/telegram/yubor", "POST", { sana: $("#hKunSana").value });
  if (r.ok) { $("#tgNatija").textContent = "✓ " + r.matn; $("#tgNatija").style.color = "var(--yashil)"; }
  else { $("#tgNatija").textContent = "✗ " + (r.xato || "Xato"); $("#tgNatija").style.color = "var(--qizil)"; }
});

// ── Boshlash ──
(async () => {
  const h = await api("/api/holat");
  LAVOZIMLAR = h.lavozimlar || LAVOZIMLAR;
  $("#sana").value = h.bugun;
  $("#hKunSana").value = h.bugun;
  $("#hOy").value = h.bugun.slice(0, 7);
  davomatYukla();
  telegramYukla();
})();
