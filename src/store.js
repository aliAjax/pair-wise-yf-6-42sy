// 存档：本地持久化与首次初始化

import { createSampleBox } from "./logic.js";

// 换新 key：旧维修数据（zfl-14-repairs）不再读取、不再显示
const STORAGE_KEY = "zfl-14-medicines";

function defaultState() {
  return {
    filters: { location: "all", purpose: "all", replenish: "all" },
    meds: createSampleBox()
  };
}

function normalize(state) {
  const base = defaultState();
  return {
    filters: { ...base.filters, ...(state.filters || {}) },
    meds: Array.isArray(state.meds)
      ? state.meds.map((med) => ({ records: [], ...med }))
      : base.meds
  };
}

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalize(JSON.parse(saved));
    } catch {
      // 数据损坏时回退到示例药箱
    }
  }
  const state = defaultState();
  saveState(state);
  return state;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
