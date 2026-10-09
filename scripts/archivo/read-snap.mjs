/** Lee el snapshot de Orca y lista los elementos accionables con su ref. */
import { readFileSync } from "node:fs";

const raw = readFileSync(process.argv[2], "utf8").replace(/^﻿/, "");
const json = JSON.parse(raw);
const snap = json.result?.snapshot ?? json.result?.text ?? json.result ?? json;

const lines = String(snap)
  .split("\n")
  .filter((l) => /@e\d+/.test(l))
  .map((l) => l.trim());

console.log(lines.slice(0, 60).join("\n"));
