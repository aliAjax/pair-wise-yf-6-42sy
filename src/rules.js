// 判断：家庭药箱的全部业务规则（余量、待补状态、服药扣减、同名同规格合并、列表筛选）

export const RESTOCK_MONTHS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 余量 = 总数 - 已用数
export function remaining(medicine) {
  return Math.max(0, Number(medicine.total) - Number(medicine.used));
}

export function openedDays(medicine, today = new Date()) {
  const opened = parseDate(medicine.openedAt);
  if (!opened) return 0;
  return Math.max(0, Math.round((startOfDay(today) - startOfDay(opened)) / DAY_MS));
}

// 开封满三个月的到期日（按自然月顺延）
export function restockDueDate(medicine) {
  const opened = parseDate(medicine.openedAt);
  if (!opened) return null;
  return new Date(opened.getFullYear(), opened.getMonth() + RESTOCK_MONTHS, opened.getDate());
}

export function isStale(medicine, today = new Date()) {
  const due = restockDueDate(medicine);
  return Boolean(due) && startOfDay(today).getTime() >= startOfDay(due).getTime();
}

export function isUsedUp(medicine) {
  return remaining(medicine) <= 0;
}

// 待补：开封满三个月，或数量用完
export function needsRestock(medicine, today = new Date()) {
  return isUsedUp(medicine) || isStale(medicine, today);
}

export function restockReasons(medicine, today = new Date()) {
  const reasons = [];
  if (isUsedUp(medicine)) reasons.push("数量用完");
  if (isStale(medicine, today)) reasons.push(`开封满${RESTOCK_MONTHS}个月`);
  return reasons;
}

// 服药扣减；过期或余量不足都不记
export function takeDose(medicine, amount, now = new Date()) {
  const qty = Math.floor(Number(amount));
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, message: "请输入大于 0 的服用数量" };
  }
  if (isStale(medicine, now)) {
    return { ok: false, message: `已开封满${RESTOCK_MONTHS}个月，按待补处理，未记录服药` };
  }
  const left = remaining(medicine);
  if (qty > left) {
    return { ok: false, message: `余量不足（仅剩 ${left}），未记录服药` };
  }
  medicine.used += qty;
  medicine.doses.unshift({ id: crypto.randomUUID(), amount: qty, at: now.toISOString() });
  return { ok: true, message: `已记录服用 ${qty}，剩余 ${remaining(medicine)}` };
}

const normalizeText = (value) => String(value ?? "").trim();

export function findSameMedicine(medicines, name, spec) {
  const targetName = normalizeText(name);
  const targetSpec = normalizeText(spec);
  return medicines.find(
    (medicine) =>
      normalizeText(medicine.name) === targetName && normalizeText(medicine.spec) === targetSpec
  );
}

// 登记药品：同名同规格并入原药盒（数量累加、服药记录保留、开封日期沿用原盒），否则新建药盒
export function registerMedicine(medicines, input) {
  const total = Math.floor(Number(input.total));
  const data = {
    name: normalizeText(input.name),
    spec: normalizeText(input.spec),
    purpose: normalizeText(input.purpose),
    location: normalizeText(input.location),
    total: Number.isInteger(total) && total > 0 ? total : 0,
    openedAt: normalizeText(input.openedAt)
  };

  const existing = findSameMedicine(medicines, data.name, data.spec);
  if (existing) {
    existing.total += data.total;
    return { ok: true, merged: true, medicine: existing, added: data.total };
  }

  const medicine = {
    id: crypto.randomUUID(),
    ...data,
    used: 0,
    doses: []
  };
  medicines.unshift(medicine);
  return { ok: true, merged: false, medicine, added: data.total };
}

export function filterMedicines(medicines, filters, today = new Date()) {
  return medicines.filter((medicine) => {
    const restock = needsRestock(medicine, today);
    if (filters.restock === "restock" && !restock) return false;
    if (filters.restock === "ok" && restock) return false;
    if (filters.location && medicine.location !== filters.location) return false;
    if (filters.purpose && medicine.purpose !== filters.purpose) return false;
    return true;
  });
}

// 待补优先，其次按位置、名称排序
export function sortMedicines(medicines, today = new Date()) {
  return [...medicines].sort((a, b) => {
    const restockDiff = Number(needsRestock(b, today)) - Number(needsRestock(a, today));
    if (restockDiff) return restockDiff;
    const locationDiff = a.location.localeCompare(b.location, "zh-Hans-CN");
    if (locationDiff) return locationDiff;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

export function uniqueValues(medicines, key) {
  return [...new Set(medicines.map((medicine) => medicine[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );
}
