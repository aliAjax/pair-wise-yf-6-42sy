import "./styles.css";
import * as rules from "./rules.js";
import { loadState, saveState } from "./storage.js";
import { mount } from "./page.js";

const state = loadState();

mount(document.querySelector("#app"), {
  state,
  rules,
  onChange: () => saveState(state)
});
