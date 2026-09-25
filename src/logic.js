// 判断：药箱领域规则（余量、待补、合并、服药扣减、筛选）

export const REPLENISH_MONTHS = 3;

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function remainingOf(med) {
  return Math.max(0, med.total - med.used);
}

export function openedDays(med, now = new Date()) {
  if (!med.openedAt) return 0;
  const start = new Date(`${med.openedAt}T00:00:00`);
  return Math.max(0, Math.floor((now - start) / 86400000));
}

export function isOpenedOverMonths(med, now = new Date()) {
  if (!med.openedAt) return false;
  const deadline = new Date(`${med.openedAt}T00:00:00`);
  deadline.setMonth(deadline.getMonth() + REPLENISH_MONTHS);
  return deadline <= now;
}

// 待补：开封满三个月，或数量已用完
export function needsReplenish(med, now = new Date()) {
  return remainingOf(med) <= 0 || isOpenedOverMonths(med, now);
}

export function isSameBox(a, b) {
  return a.name === b.name && a.spec === b.spec;
}

// 登记：同名同规格并入原药盒，数量累加，服药记录保留
export function registerMedicine(meds, input) {
  const existing = meds.find((med) => isSameBox(med, input));
  if (existing) {
    existing.total += input.total;
    existing.purpose = input.purpose || existing.purpose;
    existing.location = input.location || existing.location;
    return { med: existing, merged: true };
  }
  const med = {
    id: crypto.randomUUID(),
    name: input.name,
    spec: input.spec,
    purpose: input.purpose,
    location: input.location,
    total: input.total,
    used: 0,
    openedAt: input.openedAt,
    records: []
  };
  meds.unshift(med);
  return { med, merged: false };
}

// 服药：余量不足则不扣减、不记录
export function takeDose(med, count, at) {
  const n = Number(count);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, reason: "invalid" };
  }
  if (remainingOf(med) < n) {
    return { ok: false, reason: "insufficient" };
  }
  med.used += n;
  med.records.push({ id: crypto.randomUUID(), at, count: n });
  return { ok: true };
}

export function filterMedicines(meds, filters, now = new Date()) {
  return meds.filter((med) => {
    if (filters.location !== "all" && med.location !== filters.location) return false;
    if (filters.purpose !== "all" && med.purpose !== filters.purpose) return false;
    if (filters.replenish === "need" && !needsReplenish(med, now)) return false;
    if (filters.replenish === "ok" && needsReplenish(med, now)) return false;
    return true;
  });
}

export function distinctValues(meds, key) {
  return [...new Set(meds.map((med) => med[key]).filter(Boolean))];
}

// 首次打开时的示例药箱
export function createSampleBox(now = new Date()) {
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return toDateStr(d);
  };
  const record = (days, count) => ({ id: crypto.randomUUID(), at: daysAgo(days), count });

  return [
    {
      id: crypto.randomUUID(),
      name: "氯雷他定片",
      spec: "10mg×12片",
      purpose: "抗过敏",
      location: "卫生间镜柜",
      total: 12,
      used: 3,
      openedAt: daysAgo(10),
      records: [record(9, 1), record(6, 1), record(2, 1)]
    },
    {
      id: crypto.randomUUID(),
      name: "布洛芬缓释胶囊",
      spec: "0.3g×20粒",
      purpose: "退烧止痛",
      location: "客厅抽屉",
      total: 20,
      used: 6,
      openedAt: daysAgo(40),
      records: [record(35, 2), record(20, 2), record(5, 2)]
    },
    {
      id: crypto.randomUUID(),
      name: "蒙脱石散",
      spec: "3g×10袋",
      purpose: "止泻",
      location: "客厅抽屉",
      total: 10,
      used: 2,
      openedAt: daysAgo(100),
      records: [record(95, 1), record(94, 1)]
    },
    {
      id: crypto.randomUUID(),
      name: "连花清瘟胶囊",
      spec: "0.35g×24粒",
      purpose: "感冒咳嗽",
      location: "卧室床头柜",
      total: 24,
      used: 24,
      openedAt: daysAgo(150),
      records: [record(140, 4), record(139, 4), record(138, 4), record(137, 4), record(136, 4), record(135, 4)]
    }
  ];
}
