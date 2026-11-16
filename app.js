const CFG = window.APP_CONFIG;
const Store = window.Store;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rub = n => Math.round(n).toLocaleString("ru-RU") + "\u00a0₽";
const plus = n => "+\u00a0" + Math.round(n).toLocaleString("ru-RU") + "\u00a0₽";
const NS = CFG.dbName + ":";
const LS = { get: k => { try { return JSON.parse(localStorage.getItem(NS + k)); } catch { return null; } }, set: (k, v) => localStorage.setItem(NS + k, JSON.stringify(v)) };
const STATUS = { new: "Новая", talk: "Обсуждаем проект", contract: "Договор", build: "В производстве", done: "Установлена", canceled: "Отказ" };

const ICONS = {
  msg: "M4 5h16v11H9l-5 4z", check: "M5 12.5 10 17 19 7", arrow: "M5 12h14M13 6l6 6-6 6", x: "M6 6l12 12M18 6 6 18",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  ruler: "M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2", users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6",
  door: "M6 21V4h12v17M3 21h18M14.5 12.5h.01", leaf: "M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8",
  fire: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3-1-3 0-6 0-8z",
  shield: "M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6zM9 12l2.2 2.2L15.5 10",
  plan: "M4 4h16v16H4zM4 12h8M12 4v16M16 12v8",
  chev: "M9 6l6 6-6 6", lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3", logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13", inbox: "M4 13l2.5-8h11l2.5 8v6H4zM4 13h5l1 2h4l1-2h5", tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
};
const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ICONS.check}"/></svg>`;

// ---------------- прайс (переопределяется из кабинета) ----------------
let OVR = { models: {}, opts: {} };
const modelPrice = m => (m.id in OVR.models ? OVR.models[m.id] : m.price);
const optPrice = (g, it) => { const k = g.id + "." + it.id; return k in OVR.opts ? OVR.opts[k] : it.price; };
const modelById = id => CFG.models.find(m => m.id === id) || CFG.models[0];
const groupsFor = m => m.kind === "house" ? CFG.houseGroups : CFG.groups.map(g => ({ ...g, items: g.items.filter(i => !i.only || i.only.includes(m.id)) })).filter(g => g.items.length);
const deliveryFor = m => CFG.delivery[m.delivery] || CFG.delivery.any;

// ---------------- черновик ----------------
const fresh = (mid = "n625") => ({ model: mid, sel: {}, delivery: null, plan: 0, form: { name: "", phone: "", place: "", when: "season", comment: "", call: true } });
let D = LS.get("draft") || fresh();
const save = () => LS.set("draft", D);

function calc(d = D) {
  const m = modelById(d.model);
  const groups = groupsFor(m);
  const lines = [], ask = [];
  for (const g of groups) {
    const v = d.sel[g.id];
    const ids = g.type === "radio" ? (v ? [v] : []) : (v || []);
    for (const id of ids) {
      const it = g.items.find(i => i.id === id); if (!it) continue;
      const p = optPrice(g, it);
      if (p === null || p === undefined) ask.push(it.t);
      else if (p > 0) lines.push({ t: it.t, p, from: !!it.from });
    }
  }
  const del = deliveryFor(m).find(x => x.id === d.delivery) || deliveryFor(m)[0];
  const base = modelPrice(m);
  if (base == null) return { m, base: null, lines, ask, del, total: null };
  const opts = lines.reduce((a, l) => a + l.p, 0);
  const pctAdd = Math.round((base + opts) * (del.pct || 0) / 100);
  return { m, base, lines, ask, del, opts, pctAdd, total: base + opts + pctAdd };
}

// ---------------- каркас ----------------
function header(admin = false) {
  return `<header class="top"><div class="wrap top-in">
    <a class="brand" href="#/"><span class="logo"><img src="icons/icon-192.png" alt=""></span><span><b>${esc(CFG.brand.name)}</b><small>${esc(CFG.brand.tagline)} · ${esc(CFG.brand.city)}</small></span></a>
    <div class="top-r">${admin ? `<button class="btn ghost sm" id="logout">${ic("logout")}<span>Выйти</span></button>` :
      `<a class="btn vk sm" href="${CFG.brand.vk}" target="_blank" rel="noopener">${ic("msg")}<span>Написать в ВК</span></a>`}</div>
  </div></header>`;
}
function toast(t) { const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.append(el); setTimeout(() => el.classList.add("on"), 10); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 300); }, 2200); }

// ---------------- клиентская часть ----------------
function modelCard(m) {
  const p = modelPrice(m);
  return `<button class="mcard ${D.model === m.id ? "on" : ""}" data-model="${m.id}">
    <span class="mimg"><img src="${m.img}" alt="${esc(m.title)}" loading="lazy"><em>${esc(m.badge)}</em></span>
    <span class="mbody"><b>${esc(m.title)}</b><small>${esc(m.size)}</small>
    <span class="mprice">${p == null ? "цена по запросу" : "от " + rub(p)}</span>
    <span class="mmeta">${ic("users")}${esc(m.people)}</span></span></button>`;
}
function optRow(g, it) {
  const p = optPrice(g, it);
  const v = D.sel[g.id];
  const on = g.type === "radio" ? (v || g.items[0].id) === it.id : (v || []).includes(it.id);
  const price = p == null ? `<span class="pr ask">по запросу</span>` : p === 0 ? `<span class="pr zero">в базе</span>` : `<span class="pr">${it.from ? "от " : ""}${plus(p)}</span>`;
  return `<label class="opt ${on ? "on" : ""}"><input type="${g.type === "radio" ? "radio" : "checkbox"}" name="g_${g.id}" value="${it.id}" data-g="${g.id}" ${on ? "checked" : ""}>
    <span class="box">${ic("check")}</span><span class="ot"><b>${esc(it.t)}</b>${it.d ? `<small>${esc(it.d)}</small>` : ""}</span>${price}</label>`;
}
function groupCount(g) { const v = D.sel[g.id]; if (g.type === "radio") return v && v !== g.items[0].id ? 1 : 0; return (v || []).length; }
function configurator() {
  const m = modelById(D.model);
  const groups = groupsFor(m);
  const dels = deliveryFor(m);
  if (!dels.find(x => x.id === D.delivery)) D.delivery = dels[0].id;
  const plans = m.plans || [];
  return `
  <section class="sec" id="config"><div class="wrap">
    <div class="eyebrow">Шаг 1 · модель</div>
    <h2>Выберите баню</h2>
    <div class="models">${CFG.models.map(modelCard).join("")}</div>

    <div class="cfg">
      <div class="cfg-main">
        <div class="mhead">
          <img src="${m.img}" alt="${esc(m.title)}">
          <div><div class="eyebrow">${esc(m.size)} · ${esc(m.rooms)}</div><h3>${esc(m.title)}</h3><p>${esc(m.lead)}</p>
          ${m.quote ? `<p class="quote">«${esc(m.quote)}»<span>— из каталога</span></p>` : ""}</div>
        </div>

        ${plans.length ? `<div class="block"><div class="eyebrow">Шаг 2 · планировка</div>
          <h3>Примеры планировок ${esc(m.title.replace("Наутилус ", ""))}</h3>
          <p class="muted">Это реальные проекты из каталога. Для вас нарисуют индивидуальную — отметьте, какая ближе.</p>
          <div class="plans">${plans.map((p, i) => `<button class="plan ${D.plan === i + 1 ? "on" : ""}" data-plan="${i + 1}"><img src="${p}" alt="Планировка ${i + 1}" loading="lazy"><span>${D.plan === i + 1 ? ic("check") : ""}Вариант ${i + 1}</span></button>`).join("")}
          <button class="plan own ${D.plan === 0 ? "on" : ""}" data-plan="0"><span class="ownin">${ic("plan")}<b>Своя планировка</b><small>обсудим и нарисуем</small></span><span>${D.plan === 0 ? ic("check") : ""}Индивидуально</span></button></div></div>` : ""}

        ${m.kind === "banya" ? `<details class="block base"><summary><span><span class="eyebrow">Уже в цене</span><b>Базовая комплектация — баней можно пользоваться сразу</b></span>${ic("chev")}</summary>
          <ul>${CFG.base.map(b => `<li>${ic("check")}${esc(b)}</li>`).join("")}</ul></details>` : ""}

        <div class="block"><div class="eyebrow">Шаг ${plans.length ? 3 : 2} · ${m.kind === "banya" ? "допы" : "пожелания"}</div>
          <h3>${m.kind === "banya" ? "Что добавить" : "Что важно в домике"}</h3>
          ${m.kind === "banya" ? `<p class="muted">Цены допов — из каталога. Позиции «по запросу» мастер посчитает отдельно.</p>` : `<p class="muted">Отметьте пожелания — мастер подберёт размер и пришлёт расчёт.</p>`}
          <div class="groups">${groups.map((g, gi) => `<details class="grp" ${gi < 2 || groupCount(g) ? "open" : ""}><summary><b>${esc(g.t)}</b>${groupCount(g) ? `<span class="cnt">${groupCount(g)}</span>` : ""}${ic("chev")}</summary>
            <div class="opts">${g.items.map(it => optRow(g, it)).join("")}</div></details>`).join("")}</div>
        </div>

        <div class="block"><div class="eyebrow">Шаг ${plans.length ? 4 : 3} · доставка</div><h3>Как привезти</h3>
          <div class="dels">${dels.map(x => `<label class="opt ${D.delivery === x.id ? "on" : ""}"><input type="radio" name="del" value="${x.id}" ${D.delivery === x.id ? "checked" : ""}><span class="box">${ic("check")}</span><span class="ot"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span>${x.pct ? `<span class="pr">+${x.pct}%</span>` : ""}</label>`).join("")}</div>
          <p class="muted small">${ic("truck")} Строим в Вологде, ставим по всей России. Стоимость перевозки считается по адресу.</p>
        </div>
      </div>
      <aside class="cfg-side" id="summary"></aside>
    </div>
  </div></section>`;
}
function summaryHtml() {
  const c = calc();
  const head = c.total == null ? `<div class="tot"><small>Ориентировочно</small><b>по запросу</b></div>` : `<div class="tot"><small>Ориентировочно, от</small><b>${rub(c.total)}</b></div>`;
  const rows = [];
  if (c.base != null) rows.push(`<li><span>${esc(c.m.title)}, база</span><b>${rub(c.base)}</b></li>`);
  for (const l of c.lines) rows.push(`<li><span>${esc(l.t)}</span><b>${l.from ? "от " : ""}${plus(l.p)}</b></li>`);
  if (c.pctAdd) rows.push(`<li><span>${esc(c.del.t)} (+${c.del.pct}%)</span><b>${plus(c.pctAdd)}</b></li>`);
  if (c.ask.length) rows.push(`<li class="ask"><span>По запросу: ${esc(c.ask.join(", ").toLowerCase())}</span><b>—</b></li>`);
  return `<div class="sum-card">${head}<ul class="lines">${rows.join("")}</ul>
    <p class="note">Цены из каталога на ${esc(CFG.priceDate)}. Итог фиксируется в договоре после согласования проекта.</p>
    <button class="btn primary wide" data-go="form">Оставить заявку ${ic("arrow")}</button></div>`;
}
function barHtml() {
  const c = calc();
  return `<div class="bar-in wrap"><div><small>${c.total == null ? "Стоимость" : "Ориентировочно, от"}</small><b>${c.total == null ? "по запросу" : rub(c.total)}</b></div><button class="btn primary" data-go="form">Заявка ${ic("arrow")}</button></div>`;
}
function refreshSummary() { $("#summary").innerHTML = summaryHtml(); $("#bar").innerHTML = barHtml(); }

function formHtml() {
  const f = D.form;
  return `<section class="sec form-sec" id="form"><div class="wrap narrow">
    <div class="eyebrow">Заявка</div><h2>Куда прислать расчёт</h2>
    <p class="muted">Мастер посмотрит конфигурацию, уточнит детали и пришлёт проект и точную стоимость. Ни к чему не обязывает.</p>
    <form id="req" novalidate class="fcard">
      <label class="fld"><span>Имя</span><input name="name" autocomplete="given-name" value="${esc(f.name)}" placeholder="Как к вам обращаться"><em>Укажите имя</em></label>
      <label class="fld"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(f.phone)}" placeholder="+7 (___) ___-__-__"><em>Проверьте номер</em></label>
      <label class="fld"><span>Населённый пункт для доставки</span><input name="place" value="${esc(f.place)}" placeholder="Например: Вологодский р-н, д. Марфино"><em>Куда везти баню</em></label>
      <label class="fld"><span>Когда планируете</span><select name="when">
        ${[["season", "В этом сезоне"], ["spring", "К весне"], ["year", "В течение года"], ["look", "Пока присматриваюсь"]].map(([v, t]) => `<option value="${v}" ${f.when === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="fld"><span>Комментарий</span><textarea name="comment" rows="3" placeholder="Например: участок без подъезда для крана, хотим парилку побольше">${esc(f.comment)}</textarea></label>
      <label class="chk"><input type="checkbox" name="call" ${f.call ? "checked" : ""}><span class="box">${ic("check")}</span><span>Удобно обсудить проект созвоном</span></label>
      <button class="btn primary wide" type="submit">Отправить заявку ${ic("arrow")}</button>
      <p class="muted small">Нажимая кнопку, вы соглашаетесь на обработку контактных данных для ответа по заявке.</p>
    </form></div></section>`;
}

function renderClient() {
  $("#app").innerHTML = header() + `
  <section class="hero"><img class="hero-img" src="img/hero.webp" alt="Баня «Наутилус» на участке">
    <div class="wrap hero-in"><div class="eyebrow light">Вологда · бани по своей технологии</div>
      <h1>Баня «Наутилус» —<br><span>посчитайте свою за 2 минуты</span></h1>
      <p>Выберите габарит, планировку и допы — сразу увидите ориентировочную стоимость по каталогу. Мастер пришлёт проект и точный расчёт.</p>
      <div class="hero-cta"><a class="btn primary" href="#config" data-scroll="config">Собрать баню ${ic("arrow")}</a><a class="btn glass" href="${CFG.brand.vk}" target="_blank" rel="noopener">${ic("msg")}Написать в ВК</a></div>
      <ul class="facts"><li>${ic("leaf")}Северный лес зимней рубки, камерная сушка</li><li>${ic("shield")}Пол утеплён на 200 мм — для зимы</li><li>${ic("truck")}Привозим готовой — до 7×3,4 м</li></ul>
    </div></section>
  ${configurator()}
  <section class="sec why"><div class="wrap"><div class="eyebrow">Почему «Наутилус»</div><h2>Не бочка и не квадро — другая конструкция</h2>
    <div class="why-grid">
      ${[["ruler", "Прямоугольный пол", "Нет сужения по краям — мебель и полки встают рационально."],
         ["shield", "Без стяжных лент", "Не нужно следить за натяжением, нет связанных с этим рисков."],
         ["fire", "Готова сразу", "Не нужно ждать усадки: ставится с финишной отделкой."],
         ["door", "Ремонтопригодный пол", "Пол можно заменить по элементам, не меняя всю баню."]].map(([i, t, d]) => `<div class="why-c">${ic(i)}<b>${t}</b><p>${d}</p></div>`).join("")}
    </div>
    <div class="gallery">${["g1", "g2", "g3", "g4", "g5", "g6"].map(g => `<img src="img/${g}.webp" alt="Баня «Наутилус» — пример работы" loading="lazy">`).join("")}</div>
    <p class="muted small center">Фото готовых бань «Спасибо за баньку». Больше работ — <a href="${CFG.brand.vkGroup}" target="_blank" rel="noopener">в группе ВК</a>.</p>
  </div></section>
  ${formHtml()}
  <footer class="foot"><div class="wrap"><div><b>${esc(CFG.brand.name)}</b><small>${esc(CFG.brand.tagline)} · ${esc(CFG.brand.city)}</small></div>
    <a href="${CFG.brand.vk}" target="_blank" rel="noopener">Написать в ВК</a><a href="#/admin" class="adm">${ic("lock")}Вход для мастера</a></div></footer>
  <div class="bar" id="bar"></div>`;
  refreshSummary();
  bindClient();
}
function rerenderConfig() {
  const y = window.scrollY;
  $("#config").outerHTML = configurator();
  refreshSummary(); bindConfig(); window.scrollTo(0, y);
}
function bindConfig() {
  $$("[data-model]").forEach(b => b.onclick = () => { if (D.model !== b.dataset.model) { D = { ...fresh(b.dataset.model), form: D.form }; save(); rerenderConfig(); $(".mhead").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  $$("[data-plan]").forEach(b => b.onclick = () => { D.plan = +b.dataset.plan; save(); $$("[data-plan]").forEach(x => { const on = +x.dataset.plan === D.plan; x.classList.toggle("on", on); x.lastElementChild.innerHTML = (on ? ic("check") : "") + (x.dataset.plan === "0" ? "Индивидуально" : "Вариант " + x.dataset.plan); }); });
  $$("input[data-g]").forEach(i => i.onchange = () => {
    const g = i.dataset.g;
    if (i.type === "radio") D.sel[g] = i.value;
    else { const s = new Set(D.sel[g] || []); i.checked ? s.add(i.value) : s.delete(i.value); D.sel[g] = [...s]; }
    $$(`input[name="g_${g}"]`).forEach(x => x.closest(".opt").classList.toggle("on", x.checked));
    const grp = i.closest(".grp"); const gg = groupsFor(modelById(D.model)).find(x => x.id === g); const n = groupCount(gg);
    let cnt = $(".cnt", grp.firstElementChild); if (n) { if (!cnt) { cnt = document.createElement("span"); cnt.className = "cnt"; grp.firstElementChild.querySelector("b").after(cnt); } cnt.textContent = n; } else cnt?.remove();
    save(); refreshSummary();
  });
  $$('input[name="del"]').forEach(i => i.onchange = () => { D.delivery = i.value; $$('input[name="del"]').forEach(x => x.closest(".opt").classList.toggle("on", x.checked)); save(); refreshSummary(); });
}
function bindClient() {
  bindConfig();
  const f = $("#req");
  f.oninput = () => { const fd = new FormData(f); D.form = { name: fd.get("name"), phone: fd.get("phone"), place: fd.get("place"), when: fd.get("when"), comment: fd.get("comment"), call: !!fd.get("call") }; save(); };
  f.onsubmit = async e => {
    e.preventDefault(); f.oninput();
    const bad = []; const F = D.form;
    if (!F.name.trim()) bad.push("name");
    if (F.phone.replace(/\D/g, "").length < 10) bad.push("phone");
    if (!F.place.trim()) bad.push("place");
    $$(".fld", f).forEach(l => l.classList.toggle("err", bad.includes(l.querySelector("input,select,textarea").name)));
    if (bad.length) { $(".fld.err input", f)?.focus(); return; }
    const c = calc();
    const r = await Store.create(snapshot(c, D));
    LS.set("mine", [...(LS.get("mine") || []), r.id]);
    D = { ...fresh(D.model), form: { ...fresh().form, name: F.name, phone: F.phone, place: F.place } }; save();
    location.hash = "#/r/" + r.id;
  };
}
function snapshot(c, d) {
  const m = c.m;
  return { client: { ...d.form }, model: { id: m.id, title: m.title, size: m.size, base: c.base },
    plan: m.plans?.length ? (d.plan ? "Вариант " + d.plan + " из каталога" : "Индивидуальная") : "—",
    planImg: d.plan && m.plans?.[d.plan - 1] || "", lines: c.lines, ask: c.ask, delivery: c.del.t + (c.del.pct ? ` (+${c.del.pct}%)` : ""),
    pctAdd: c.pctAdd || 0, estimate: c.total };
}
const WHEN = { season: "В этом сезоне", spring: "К весне", year: "В течение года", look: "Пока присматриваюсь" };
function reqDetails(r, admin = false) {
  return `<ul class="lines">
    <li><span>${esc(r.model.title)}, база</span><b>${r.model.base == null ? "по запросу" : rub(r.model.base)}</b></li>
    ${r.lines.map(l => `<li><span>${esc(l.t)}</span><b>${l.from ? "от " : ""}${plus(l.p)}</b></li>`).join("")}
    ${r.pctAdd ? `<li><span>${esc(r.delivery)}</span><b>${plus(r.pctAdd)}</b></li>` : ""}
    ${r.ask?.length ? `<li class="ask"><span>По запросу: ${esc(r.ask.join(", ").toLowerCase())}</span><b>—</b></li>` : ""}
  </ul>
  <dl class="kv"><dt>Планировка</dt><dd>${esc(r.plan)}</dd><dt>Доставка</dt><dd>${esc(r.delivery)}</dd><dt>Куда</dt><dd>${esc(r.client.place)}</dd><dt>Сроки</dt><dd>${esc(WHEN[r.client.when] || "")}</dd>
  ${admin ? `<dt>Телефон</dt><dd><a href="tel:${esc(r.client.phone.replace(/[^+\d]/g, ""))}">${esc(r.client.phone)}</a>${r.client.call ? " · просит созвон" : ""}</dd>` : ""}
  ${r.client.comment ? `<dt>Комментарий</dt><dd>${esc(r.client.comment)}</dd>` : ""}</dl>
  ${r.planImg ? `<img class="planthumb" src="${r.planImg}" alt="Выбранная планировка">` : ""}`;
}
async function renderStatus(id) {
  const r = await Store.get(id);
  $("#app").innerHTML = header() + `<section class="sec"><div class="wrap narrow">${!r ? `<div class="fcard"><h2>Заявка не найдена</h2><p><a href="#/">На главную</a></p></div>` : `
    <div class="fcard done-card"><div class="okmark">${ic("check")}</div><div class="eyebrow">Заявка № ${esc(r.id)}</div>
      <h2>Спасибо, ${esc(r.client.name)}! Заявка у мастера</h2>
      <p class="muted">Статус: <b class="st st-${r.status}">${STATUS[r.status]}</b>. Мастер изучит конфигурацию и свяжется с вами, чтобы обсудить проект и прислать точный расчёт.</p>
      <div class="tot inline"><small>Ориентировочно</small><b>${r.estimate == null ? "по запросу" : "от " + rub(r.estimate)}</b></div>
      ${reqDetails(r)}
      ${r.masterNote ? `<p class="mnote"><b>Комментарий мастера:</b> ${esc(r.masterNote)}</p>` : ""}
      <div class="row-btns"><a class="btn vk" href="${CFG.brand.vk}" target="_blank" rel="noopener">${ic("msg")}Написать в ВК</a><a class="btn ghost" href="#/">Собрать ещё вариант</a></div>
    </div>`}</div></section>`;
}

// ---------------- кабинет мастера ----------------
const authed = () => sessionStorage.getItem(NS + "adm") === "1";
let tab = "req", filter = "all";
async function renderAdmin() {
  if (!authed()) {
    $("#app").innerHTML = header() + `<section class="sec"><div class="wrap narrow"><form class="fcard pin" id="pin"><div class="okmark dark">${ic("lock")}</div><h2>Кабинет мастера</h2><p class="muted">Заявки и прайс «${esc(CFG.brand.name)}». Демо-PIN: 1234</p>
      <input name="pin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="PIN" class="pin-in"><button class="btn primary wide">Войти</button><p class="err-t" hidden>Неверный PIN</p></form></div></section>`;
    $("#pin").onsubmit = async e => { e.preventDefault(); if (await Store.login(e.target.pin.value.trim())) { sessionStorage.setItem(NS + "adm", "1"); await seed(); renderAdmin(); } else $(".err-t").hidden = false; };
    return;
  }
  const all = await Store.list();
  const list = all.filter(r => filter === "all" || r.status === filter);
  const sumNew = all.filter(r => r.status === "new").length;
  const pipe = all.filter(r => !["canceled", "done"].includes(r.status) && r.estimate).reduce((a, r) => a + r.estimate, 0);
  $("#app").innerHTML = header(true) + `<section class="sec admin"><div class="wrap">
    <div class="ahead"><div><div class="eyebrow">Кабинет мастера</div><h2>${tab === "req" ? "Заявки" : "Прайс"}</h2></div>
      <div class="tabs"><button data-tab="req" class="${tab === "req" ? "on" : ""}">Заявки${sumNew ? `<span class="cnt">${sumNew}</span>` : ""}</button><button data-tab="price" class="${tab === "price" ? "on" : ""}">Прайс</button></div></div>
    ${tab === "req" ? `
    <div class="kpis"><div><small>Всего заявок</small><b>${all.length}</b></div><div><small>Новых</small><b>${sumNew}</b></div><div><small>В работе, сумма «от»</small><b>${rub(pipe)}</b></div></div>
    <div class="filters">${[["all", "Все"], ...Object.entries(STATUS)].map(([k, t]) => `<button data-f="${k}" class="${filter === k ? "on" : ""}">${t}</button>`).join("")}</div>
    <div class="reqs">${list.length ? list.map(r => `<article class="req">
      <div class="rq-h"><div><b>${esc(r.client.name)}</b><small>№ ${esc(r.id)} · ${new Date(r.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
        <select data-st="${r.id}" class="st-sel st-${r.status}">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="rq-m"><span>${esc(r.model.title)}</span><b>${r.estimate == null ? "по запросу" : "от " + rub(r.estimate)}</b></div>
      <details><summary>Конфигурация и контакты ${ic("chev")}</summary>${reqDetails(r, true)}</details>
      <div class="rq-n"><input data-note="${r.id}" value="${esc(r.masterNote || "")}" placeholder="Комментарий клиенту (виден на странице заявки)"><button class="icbtn" data-del="${r.id}" aria-label="Удалить">${ic("trash")}</button></div>
    </article>`).join("") : `<div class="empty">${ic("inbox")}<p>Заявок с этим статусом нет</p></div>`}</div>` : priceEditor()}
  </div></section>`;
  $("#logout").onclick = () => { sessionStorage.removeItem(NS + "adm"); location.hash = "#/"; };
  $$("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; renderAdmin(); });
  $$("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderAdmin(); });
  $$("[data-st]").forEach(s => s.onchange = async () => { await Store.update(s.dataset.st, { status: s.value }); toast("Статус обновлён"); renderAdmin(); });
  $$("[data-note]").forEach(i => i.onchange = async () => { await Store.update(i.dataset.note, { masterNote: i.value }); toast("Комментарий сохранён"); });
  $$("[data-del]").forEach(b => b.onclick = async () => { if (confirm("Удалить заявку?")) { await Store.remove(b.dataset.del); renderAdmin(); } });
  if (tab === "price") bindPrice();
}
function priceEditor() {
  const inp = (key, v, ph) => `<input class="pin-num" data-pk="${key}" inputmode="numeric" value="${v == null ? "" : v}" placeholder="${ph}">`;
  return `<p class="muted">Меняйте цены — калькулятор у клиентов пересчитается сразу. Пустое поле — «цена по запросу».</p>
  <div class="ptable"><h3>Модели (база, ₽)</h3>${CFG.models.map(m => `<label class="prow"><span>${esc(m.title)}<small>${esc(m.size)}</small></span>${inp("m." + m.id, modelPrice(m), "по запросу")}</label>`).join("")}</div>
  ${CFG.groups.map(g => `<div class="ptable"><h3>${esc(g.t)}</h3>${g.items.map(it => `<label class="prow"><span>${esc(it.t)}</span>${inp("o." + g.id + "." + it.id, optPrice(g, it), "по запросу")}</label>`).join("")}</div>`).join("")}
  <div class="row-btns"><button class="btn primary" id="psave">Сохранить прайс</button><button class="btn ghost" id="preset">Вернуть цены каталога</button></div>`;
}
function bindPrice() {
  $("#psave").onclick = async () => {
    const o = { models: {}, opts: {} };
    $$("[data-pk]").forEach(i => { const raw = i.value.replace(/\D/g, ""); const v = raw === "" ? null : +raw; const k = i.dataset.pk;
      if (k.startsWith("m.")) { const m = modelById(k.slice(2)); if (v !== m.price) o.models[m.id] = v; }
      else { const [, g, id] = k.split("."); const it = CFG.groups.find(x => x.id === g).items.find(x => x.id === id); if (v !== it.price) o.opts[g + "." + id] = v; } });
    OVR = o; await Store.saveSettings(o); toast("Прайс сохранён");
  };
  $("#preset").onclick = async () => { OVR = { models: {}, opts: {} }; await Store.saveSettings(OVR); toast("Цены каталога восстановлены"); renderAdmin(); };
}
async function seed() {
  if (LS.get("seeded")) return; LS.set("seeded", true);
  const mk = async (d, status, note) => { const r = await Store.create(snapshot(calc(d), d)); if (status) await Store.update(r.id, { status, masterNote: note || "" }); };
  await mk({ ...fresh("n63"), plan: 3, sel: { stove: "geyser", steam: ["breath", "flood2"], lights: "ceramic", comfort: ["bed"] }, delivery: "crane",
    form: { name: "Андрей", phone: "+7 (921) 234-56-78", place: "Череповецкий р-н, д. Ирдоматка", when: "spring", comment: "Подъезд для крана есть, ворота 4 м", call: true } });
  await mk({ ...fresh("n42"), plan: 1, sel: { steam: ["shelf"], doors: "metal" }, delivery: "ready",
    form: { name: "Ольга", phone: "+7 (911) 555-12-34", place: "Вологда, СНТ «Берёзка»", when: "season", comment: "Баня для родителей, чтобы было тепло зимой", call: false } }, "talk", "Пришлём проект с планировкой на этой неделе");
  await mk({ ...fresh("n64"), plan: 4, sel: { comfort: ["kitchen", "cab"], layout: ["pano"], water: ["flood1", "plumb"] }, delivery: "assembly",
    form: { name: "Игорь", phone: "+7 (981) 777-00-11", place: "Ленобласть, Тосненский р-н", when: "year", comment: "Нужен санузел", call: true } }, "contract");
}

// ---------------- роутер ----------------
async function route() {
  const h = location.hash || "#/";
  if (h === "#config" || h === "#form") return;
  window.scrollTo(0, 0);
  document.body.dataset.page = h.startsWith("#/admin") ? "admin" : h.startsWith("#/r/") ? "status" : "client";
  if (h.startsWith("#/admin")) return renderAdmin();
  if (h.startsWith("#/r/")) return renderStatus(decodeURIComponent(h.slice(4)));
  renderClient();
}
(async () => {
  const s = await Store.getSettings().catch(() => null); if (s) OVR = { models: s.models || {}, opts: s.opts || {} };
  window.addEventListener("hashchange", route);
  document.addEventListener("click", e => {
    const go = e.target.closest("[data-go],[data-scroll]"); if (!go) return;
    e.preventDefault(); $("#" + (go.dataset.go || go.dataset.scroll))?.scrollIntoView({ behavior: "smooth" });
  });
  await route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
