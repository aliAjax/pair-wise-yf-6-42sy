// 页面：渲染与交互

import "./styles.css";
import {
  remainingOf,
  openedDays,
  needsReplenish,
  registerMedicine,
  takeDose,
  filterMedicines,
  distinctValues,
  toDateStr
} from "./logic.js";
import { loadState, saveState } from "./store.js";

const state = loadState();
const app = document.querySelector("#app");

let flash = null; // { type: "ok" | "error", text: string }
const openHistory = new Set();

const replenishTabs = {
  all: "全部",
  need: "待补",
  ok: "正常"
};

function render() {
  const now = new Date();
  const meds = filterMedicines(state.meds, state.filters, now);
  const needCount = state.meds.filter((med) => needsReplenish(med, now)).length;
  const recordCount = state.meds.reduce((sum, med) => sum + med.records.length, 0);

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">本地家庭药箱</p>
          <h1>家庭药箱</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>在箱药盒</span><strong>${state.meds.length}</strong></div>
          <div class="stat"><span>待补药品</span><strong>${needCount}</strong></div>
          <div class="stat"><span>服药记录</span><strong>${recordCount}</strong></div>
        </section>
      </header>

      <section class="layout">
        <aside class="panel">
          <h2>登记药品</h2>
          <p class="hint">同名同规格会并入原药盒，数量累加。</p>
          <form class="form" id="med-form">
            <label>名称<input name="name" required placeholder="例如布洛芬缓释胶囊"></label>
            <label>规格<input name="spec" required placeholder="例如0.3g×20粒"></label>
            <label>用途<input name="purpose" required placeholder="例如退烧止痛"></label>
            <label>位置<input name="location" required placeholder="例如客厅抽屉"></label>
            <label>数量<input name="total" type="number" min="1" step="1" required placeholder="本次登记数量"></label>
            <label>开封日期<input name="openedAt" type="date" required value="${toDateStr(now)}"></label>
            <button class="primary" type="submit">登记入库</button>
          </form>
        </aside>

        <section>
          ${flash ? `<div class="notice ${flash.type}">${escapeHtml(flash.text)}</div>` : ""}
          <div class="toolbar">
            <select data-filter-key="location" aria-label="按位置筛选">
              <option value="all">全部位置</option>
              ${distinctValues(state.meds, "location").map((v) => `<option value="${escapeHtml(v)}" ${state.filters.location === v ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
            <select data-filter-key="purpose" aria-label="按用途筛选">
              <option value="all">全部用途</option>
              ${distinctValues(state.meds, "purpose").map((v) => `<option value="${escapeHtml(v)}" ${state.filters.purpose === v ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
            ${Object.entries(replenishTabs).map(([value, label]) => `<button class="seg ${state.filters.replenish === value ? "active" : ""}" data-replenish="${value}">${label}</button>`).join("")}
          </div>
          <div class="meds">
            ${meds.length ? meds.map((med) => renderMed(med, now)).join("") : `<div class="empty">当前筛选下没有药品</div>`}
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderMed(med, now) {
  const remaining = remainingOf(med);
  const replenish = needsReplenish(med, now);
  const percent = med.total > 0 ? Math.round((remaining / med.total) * 100) : 0;
  const reason = remaining <= 0 ? "已用完" : "开封满三个月";

  return `
    <article class="med ${replenish ? "warn" : ""}">
      <div class="content">
        <div class="row">
          <h3>${escapeHtml(med.name)}</h3>
          <span class="chip">${escapeHtml(med.spec)}</span>
          <span class="badge ${replenish ? "warn" : "ok"}">${replenish ? `待补 · ${reason}` : "正常"}</span>
        </div>
        <div class="row">
          <span class="chip">用途：${escapeHtml(med.purpose)}</span>
          <span class="chip">位置：${escapeHtml(med.location)}</span>
          <span class="chip">开封：${escapeHtml(med.openedAt)}（${openedDays(med, now)}天）</span>
        </div>
        <div class="meter" title="余量 ${percent}%"><span style="width:${percent}%"></span></div>
        <p class="count">余量 <strong>${remaining}</strong> / 共 ${med.total} · 已用 ${med.used}</p>
        <div class="actions">
          <form class="dose" data-dose="${med.id}">
            <input name="count" type="number" min="1" step="1" value="1" aria-label="本次服药数量">
            <button class="primary" type="submit">服药扣减</button>
          </form>
        </div>
        <details class="history" data-history="${med.id}" ${openHistory.has(med.id) ? "open" : ""}>
          <summary>服药记录（${med.records.length}）</summary>
          ${
            med.records.length
              ? `<ul>${med.records
                  .slice()
                  .reverse()
                  .map((r) => `<li>${escapeHtml(String(r.at).slice(0, 10))} 服用 ${r.count}</li>`)
                  .join("")}</ul>`
              : `<p class="hint">暂无服药记录</p>`
          }
        </details>
      </div>
    </article>
  `;
}

function bindEvents() {
  document.querySelector("#med-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const total = Number(data.total);
    if (!Number.isInteger(total) || total <= 0) {
      flash = { type: "error", text: "数量必须是大于 0 的整数" };
      render();
      return;
    }
    const input = {
      name: data.name.trim(),
      spec: data.spec.trim(),
      purpose: data.purpose.trim(),
      location: data.location.trim(),
      total,
      openedAt: data.openedAt
    };
    const { med, merged } = registerMedicine(state.meds, input);
    flash = merged
      ? { type: "ok", text: `「${med.name}」已并入原药盒，数量累加为 ${med.total}，服药记录保留` }
      : { type: "ok", text: `「${med.name}」已登记入库` };
    saveState(state);
    render();
  });

  document.querySelectorAll("[data-filter-key]").forEach((select) => {
    select.addEventListener("change", () => {
      state.filters[select.dataset.filterKey] = select.value;
      saveState(state);
      render();
    });
  });

  document.querySelectorAll("[data-replenish]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.replenish = button.dataset.replenish;
      saveState(state);
      render();
    });
  });

  document.querySelectorAll("[data-dose]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const med = state.meds.find((item) => item.id === form.dataset.dose);
      const count = Number(new FormData(form).get("count"));
      const result = takeDose(med, count, toDateStr(new Date()));
      if (result.ok) {
        flash = { type: "ok", text: `已记录服药 ${count}，「${med.name}」余量 ${remainingOf(med)}` };
      } else if (result.reason === "insufficient") {
        flash = { type: "error", text: `「${med.name}」余量不足（剩 ${remainingOf(med)}），本次服药未记录` };
      } else {
        flash = { type: "error", text: "请输入有效的服药数量" };
      }
      saveState(state);
      render();
    });
  });

  document.querySelectorAll("[data-history]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) openHistory.add(details.dataset.history);
      else openHistory.delete(details.dataset.history);
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
