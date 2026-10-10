"use client";

import { useState } from "react";

export type SpecRow = { label: string; value: string };

// Las que ya están cargadas no se muestran.
const SUGGESTED = [
  "Procesador",
  "Gráficos",
  "Memoria RAM",
  "Almacenamiento",
  "Pantalla",
  "Teclado",
  "Cámara",
  "Audio",
  "Conectividad inalámbrica",
  "Puertos",
  "Batería",
  "Peso",
  "Sistema operativo",
  "Potencia (W)",
  "Color",
];

/** Ejemplo de valor según el dato elegido (sin mayúsculas ni acentos). */
const EXAMPLES: Record<string, string> = {
  procesador: "Intel Core i5-12450H",
  graficos: "NVIDIA RTX 4060 8GB",
  "memoria ram": "16GB DDR5",
  ram: "8GB",
  almacenamiento: "512GB SSD",
  memoria: "128GB",
  pantalla: '15.6" Full HD 144Hz',
  teclado: "Retroiluminado en español",
  camara: "12 MP + 12 MP",
  audio: "Parlantes estéreo",
  "conectividad inalambrica": "Wi-Fi 6 y Bluetooth 5.2",
  conectividad: "Wi-Fi 6 y Bluetooth 5.2",
  puertos: "2× USB-C, 1× HDMI",
  bateria: "4000 mAh",
  peso: "1.8 kg",
  "sistema operativo": "Windows 11",
  "potencia (w)": "65 W",
  potencia: "65 W",
  color: "Rojo",
  modelo: "A2633",
  garantia: "12 meses",
  medidas: "20 × 12 × 6 cm",
  resolucion: "1920 × 1080",
  capacidad: "1 TB",
  material: "Aluminio",
};

function valueExample(label: string): string {
  const key = label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!key) return "Ej. 4000 mAh";
  return EXAMPLES[key] ? `Ej. ${EXAMPLES[key]}` : "Valor";
}

const cell =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink-900 outline-none hover:border-ink-200 focus:border-ink-400 focus:bg-surface";

/**
 * Convierte texto pegado en filas. Acepta "Dato: valor", "Dato<TAB>valor"
 * (copiado de una tabla de la web del fabricante) o "Dato - valor".
 */
export function parseSpecsText(text: string): SpecRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*(?:\t|:|\s-\s)\s*(.+)$/);
      return match ? { label: match[1].trim(), value: match[2].trim() } : { label: line, value: "" };
    });
}

/** Ficha técnica como tabla editable: agregar, quitar, reordenar y pegar en bloque. */
export function AdminSpecsEditor({ rows, onChange }: { rows: SpecRow[]; onChange: (next: SpecRow[]) => void }) {
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const update = (index: number, patch: Partial<SpecRow>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const swap = (a: number, b: number) => {
    if (b < 0 || b >= rows.length) return;
    const next = [...rows];
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
  };
  const used = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  const btn = "rounded px-1.5 py-1 text-xs font-bold text-ink-400 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-20";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-ink-100">
        <table className="w-full text-left">
          <thead className="bg-ink-50 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            <tr>
              <th className="w-[38%] px-3 py-2">Dato</th>
              <th className="px-3 py-2">Valor</th>
              <th className="w-24 px-2 py-2 text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-center text-sm text-ink-500">
                  Sin características. Agregá una fila o pegá una lista.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-t border-ink-100">
                  <td className="px-1 py-1">
                    <input value={row.label} onChange={(e) => update(index, { label: e.target.value })} maxLength={80} placeholder="Ej. Batería" aria-label={`Dato ${index + 1}`} className={`${cell} font-semibold`} />
                  </td>
                  <td className="px-1 py-1">
                    <input value={row.value} onChange={(e) => update(index, { value: e.target.value })} maxLength={300} placeholder={valueExample(row.label)} aria-label={`Valor ${index + 1}`} className={cell} />
                  </td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">
                    <button type="button" onClick={() => swap(index, index - 1)} disabled={index === 0} aria-label="Subir fila" className={btn}>↑</button>
                    <button type="button" onClick={() => swap(index, index + 1)} disabled={index === rows.length - 1} aria-label="Bajar fila" className={btn}>↓</button>
                    <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Quitar fila ${index + 1}`} className={`${btn} hover:text-red-600`}>✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange([...rows, { label: "", value: "" }])} disabled={rows.length >= 40} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 disabled:opacity-40">
          ＋ Agregar fila
        </button>
        <button type="button" onClick={() => setPasting((v) => !v)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700">
          {pasting ? "Cancelar" : "Pegar lista"}
        </button>
        {SUGGESTED.filter((s) => !used.has(s.toLowerCase())).map((label) => (
          <button key={label} type="button" onClick={() => onChange([...rows, { label, value: "" }])} disabled={rows.length >= 40} className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-100">
            ＋ {label}
          </button>
        ))}
      </div>

      {pasting ? (
        <div className="space-y-2 rounded-xl bg-ink-50 p-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={"Una característica por línea, por ejemplo:\nPantalla: 6.1\" OLED\nBatería: 4000 mAh\n(también sirve copiar una tabla de la web del fabricante)"}
            aria-label="Lista de características"
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
          />
          <button
            type="button"
            onClick={() => {
              onChange([...rows.filter((r) => r.label.trim() || r.value.trim()), ...parseSpecsText(pasteText)].slice(0, 40));
              setPasteText("");
              setPasting(false);
            }}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed"
          >
            Agregar a la tabla
          </button>
        </div>
      ) : null}
    </div>
  );
}
