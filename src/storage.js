// 存档：localStorage 读写与首次示例药箱。旧维修数据(zfl-14-repairs)不读取、不展示。

import { formatDate, parseDate } from "./rules.js";

export const STORAGE_KEY = "zfl-14-medicine-cabinet";

function shiftDate(today, dayOffset) {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  return formatDate(d);
}

function dose(amount, dayOffset, today) {
  const at = new Date(parseDate(shiftDate(today, dayOffset)));
  at.setHours(8, 30, 0, 0);
  return { id: crypto.randomUUID(), amount, at: at.toISOString() };
}

// 首次打开时备好的示例药箱
export function seedState() {
  const today = new Date();
  return {
    medicines: [
      {
        id: crypto.randomUUID(),
        name: "布洛芬缓释胶囊",
        spec: "0.3g*20粒",
        purpose: "退烧止痛",
        location: "客厅药箱",
        total: 20,
        used: 3,
        openedAt: shiftDate(today, -12),
        doses: [dose(1, -1, today), dose(1, -3, today), dose(1, -5, today)]
      },
      {
        id: crypto.randomUUID(),
        name: "蒙脱石散",
        spec: "3g*10袋",
        purpose: "肠胃不适",
        location: "客厅药箱",
        total: 10,
        used: 2,
        openedAt: shiftDate(today, -40),
        doses: [dose(1, -2, today), dose(1, -4, today)]
      },
      {
        id: crypto.randomUUID(),
        name: "氯雷他定片",
        spec: "10mg*6片",
        purpose: "抗过敏",
        location: "卧室抽屉",
        total: 12,
        used: 12,
        openedAt: shiftDate(today, -60),
        doses: [dose(1, -20, today), dose(1, -22, today)]
      },
      {
        id: crypto.randomUUID(),
        name: "创可贴",
        spec: "标准型100片",
        purpose: "外伤处理",
        location: "客厅药箱",
        total: 100,
        used: 8,
        openedAt: shiftDate(today, -100),
        doses: [dose(2, -30, today), dose(2, -60, today)]
      },
      {
        id: crypto.randomUUID(),
        name: "维生素C片",
        spec: "100mg*100片",
        purpose: "日常补充",
        location: "厨房吊柜",
        total: 100,
        used: 15,
        openedAt: shiftDate(today, -20),
        doses: [dose(1, -1, today)]
      }
    ],
    filters: { location: "", purpose: "", restock: "all" }
  };
}

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const state = JSON.parse(saved);
      state.medicines ??= [];
      state.filters ??= { location: "", purpose: "", restock: "all" };
      return state;
    } catch {
      // 存档损坏时回到示例药箱
    }
  }
  return seedState();
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
