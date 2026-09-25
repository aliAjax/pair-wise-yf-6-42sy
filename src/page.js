// 页面：渲染家庭药箱、绑定登记/服药/筛选操作；业务判断走 rules，存档由外层负责。

const RESTOCK_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "restock", label: "待补" },
  { value: "ok", label: "在库" }
];

export function mount(app, { state, rules, onChange }) {
  let notice = null;

  function announce(type, message) {
    notice = { type, message };
  }

  function render() {
    const today = new Date();
    const medicines = rules.sortMedicines(state.medicines, today);
    const visible = rules.filterMedicines(medicines, state.filters, today);
    const restockCount = state.medicines.filter((medicine) =>
      rules.needsRestock(medicine, today)
    ).length;
    const totalRemaining = state.medicines.reduce(
      (sum, medicine) => sum + rules.remaining(medicine),
      0
    );

    app.innerHTML = `
      <main class="shell">
        <header class="header">
          <div>
            <p class="eyebrow">家庭常备药箱</p>
            <h1>家庭药箱</h1>
          </div>
          <section class="stats">
            <div class="stat"><span>药盒</span><strong>${state.medicines.length}</strong></div>
            <div class="stat ${restockCount ? "alert" : ""}"><span>待补</span><strong>${restockCount}</strong></div>
            <div class="stat"><span>剩余总数</span><strong>${totalRemaining}</strong></div>
          </section>
        </header>

        ${notice ? `<div class="notice ${notice.type}" role="status">${escapeHtml(notice.message)}</div>` : ""}

        <section class="layout">
          <aside class="panel">
            <h2>登记药品</h2>
            <p class="hint">同名同规格会并入原药盒，数量累加；开封日期与服药记录沿用原盒。</p>
            <form class="form" id="register-form">
              <label>名称<input name="name" required placeholder="例如布洛芬缓释胶囊"></label>
              <label>规格<input name="spec" required placeholder="例如0.3g*20粒"></label>
              <label>用途<input name="purpose" required placeholder="例如退烧止痛"></label>
              <label>位置<input name="location" required placeholder="例如客厅药箱"></label>
              <label>总数<input name="total" type="number" min="1" step="1" required placeholder="本次登记数量"></label>
              <label>开封日期<input name="openedAt" type="date" required value="${rules.formatDate(today)}"></label>
              <button class="primary" type="submit">放入药箱</button>
            </form>
          </aside>

          <section>
            <div class="toolbar">
              <label class="filter">位置
                <select data-filter="location">
                  <option value="">全部位置</option>
                  ${rules.uniqueValues(state.medicines, "location")
                    .map((value) => option(value, value, state.filters.location))
                    .join("")}
                </select>
              </label>
              <label class="filter">用途
                <select data-filter="purpose">
                  <option value="">全部用途</option>
                  ${rules.uniqueValues(state.medicines, "purpose")
                    .map((value) => option(value, value, state.filters.purpose))
                    .join("")}
                </select>
              </label>
              <label class="filter">状态
                <select data-filter="restock">
                  ${RESTOCK_OPTIONS.map(({ value, label }) => option(value, label, state.filters.restock)).join("")}
                </select>
              </label>
            </div>
            <div class="medicines">
              ${visible.length ? visible.map(renderMedicine).join("") : `<div class="empty">当前筛选条件下没有药品</div>`}
            </div>
          </section>
        </section>
      </main>
    `;
  }

  function option(value, label, selected) {
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function renderMedicine(medicine) {
    const today = new Date();
    const restock = rules.needsRestock(medicine, today);
    const reasons = rules.restockReasons(medicine, today);
    const left = rules.remaining(medicine);
    const days = rules.openedDays(medicine, today);

    return `
      <article class="medicine ${restock ? "restock" : ""}">
        <div class="content">
          <div class="row">
            <h3>${escapeHtml(medicine.name)}</h3>
            <span class="spec">${escapeHtml(medicine.spec)}</span>
            ${restock
              ? `<span class="badge bad">待补 · ${escapeHtml(reasons.join("、"))}</span>`
              : `<span class="badge good">在库</span>`}
          </div>
          <div class="row">
            <span class="chip">用途：${escapeHtml(medicine.purpose)}</span>
            <span class="chip">位置：${escapeHtml(medicine.location)}</span>
            <span class="chip">开封：${escapeHtml(medicine.openedAt)}（已开封 ${days} 天）</span>
          </div>
          <div class="counts">
            <span>总数 <strong>${medicine.total}</strong></span>
            <span>已用 <strong>${medicine.used}</strong></span>
            <span class="${restock ? "low" : ""}">剩余 <strong>${left}</strong></span>
          </div>
          <form class="dose-form" data-take="${medicine.id}">
            <input name="amount" type="number" min="1" step="1" max="${left}" value="1"
              ${restock || left <= 0 ? "disabled" : ""} aria-label="服用数量">
            <button class="ghost" type="submit" ${restock || left <= 0 ? "disabled" : ""}>
              ${restock ? "待补，暂不记账" : "服药扣减"}
            </button>
          </form>
          <details class="history">
            <summary>服药记录（${medicine.doses.length} 条，始终保留）</summary>
            ${medicine.doses.length ? `
              <ul>
                ${medicine.doses
                  .map(
                    (dose) => `
                    <li><span>${escapeHtml(formatDateTime(dose.at))}</span><strong>−${dose.amount}</strong></li>`
                  )
                  .join("")}
              </ul>` : `<p class="empty-history">暂无服药记录</p>`}
          </details>
        </div>
      </article>
    `;
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${rules.formatDate(d)} ${time}`;
  }

  app.addEventListener("submit", (event) => {
    const registerForm = event.target.closest("#register-form");
    if (registerForm) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));
      if (!Number(data.total) || Number(data.total) <= 0) {
        announce("error", "总数需为大于 0 的数字");
        render();
        return;
      }
      const result = rules.registerMedicine(state.medicines, data);
      if (result.merged) {
        announce("success", `已并入原药盒「${result.medicine.name} ${result.medicine.spec}」，数量 +${result.added}，共 ${result.medicine.total}`);
      } else {
        announce("success", `已登记「${result.medicine.name}」`);
      }
      registerForm.reset();
      registerForm.elements.openedAt.value = rules.formatDate(new Date());
      onChange();
      render();
      return;
    }

    const doseForm = event.target.closest(".dose-form");
    if (doseForm) {
      event.preventDefault();
      const medicine = state.medicines.find((item) => item.id === doseForm.dataset.take);
      const amount = new FormData(doseForm).get("amount");
      const result = rules.takeDose(medicine, amount);
      announce(result.ok ? "success" : "error", result.message);
      onChange();
      render();
    }
  });

  app.addEventListener("change", (event) => {
    const select = event.target.closest("[data-filter]");
    if (!select) return;
    state.filters[select.dataset.filter] = select.value;
    notice = null;
    onChange();
    render();
  });

  render();
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]
  );
}
