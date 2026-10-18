"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { EnvioAndreani, ShippingAddress } from "@/db/schema";
import { useSucursales } from "@/lib/shipping-quote";

const PORTAL_PYMES = "https://pymes.andreani.com/ver-envios?tab=integraciones";

const botonCls =
  "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-[background-color,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400";
const botonSecundarioCls =
  "rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm font-bold text-ink-800 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Envío del pedido en Andreani: crearlo, mandar a pagarlo al portal de PyMEs,
 * traer el número de seguimiento y bajar la etiqueta.
 */
export function AdminOrderAndreani({
  code,
  deliveryMethod,
  address,
  andreani,
  trackingCode,
  status,
  configurado,
}: {
  code: string;
  deliveryMethod: string;
  address: ShippingAddress | null;
  andreani: EnvioAndreani | null;
  trackingCode: string;
  status: string;
  configurado: boolean;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [sucursal, setSucursal] = useState("");
  const faltaSucursal = deliveryMethod === "express" && !address?.sucursal?.codigo && !andreani?.pedidoId;
  const { sucursales, loading } = useSucursales(faltaSucursal && configurado ? (address?.zip ?? "") : "");

  if (deliveryMethod === "pickup") return null;

  async function accion(cuerpo: Record<string, string>, ok: string) {
    setTrabajando(true);
    setError("");
    setAviso("");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(code)}/andreani`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; actualizados?: number };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo completar.");
        return;
      }
      setAviso(cuerpo.accion === "actualizar" && json.actualizados === 0 ? "Sin novedades en Andreani todavía." : ok);
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  const pagoPendiente = status === "pendiente_pago" || status === "cancelado";

  return (
    <div className="admin-card space-y-3 p-5">
      <h2 className="text-sm font-bold text-ink-900">Envío por Andreani</h2>

      {!configurado ? (
        <p className="text-sm text-ink-500">Andreani no está conectado. Cargá el código de seguimiento a mano arriba.</p>
      ) : !andreani?.pedidoId ? (
        <>
          {andreani?.estado === "creando" ? (
            <p className="text-sm text-amber-700">
              Se está creando el envío. Si quedó así más de un minuto, revisá en el portal de Andreani si se creó antes de
              volver a intentar.
            </p>
          ) : null}
          {address?.sucursal ? (
            <p className="text-sm text-ink-600">
              Sucursal elegida: <strong>{address.sucursal.nombre}</strong> · {address.sucursal.direccion}
            </p>
          ) : null}
          {faltaSucursal && !pagoPendiente ? (
            <label className="block">
              <span className="text-xs font-bold text-ink-600">Sucursal donde retira el cliente (CP {address?.zip})</span>
              <select
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
              >
                <option value="">{loading ? "Buscando sucursales…" : sucursales.length ? "Elegí una sucursal" : "No hay sucursales para ese CP"}</option>
                {sucursales.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {[s.nombre, s.direccion, s.localidad].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {pagoPendiente ? (
            // Sin pago no hay botón: uno deshabilitado en naranja se confundía con uno activo.
            <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
              {status === "cancelado"
                ? "El pedido está cancelado, no hace falta crear el envío."
                : "Vas a poder crear el envío cuando el pago del pedido esté acreditado."}
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-500">
                Crea el envío en tu cuenta de Andreani con el peso y las medidas de los productos. Después lo pagás en el
                portal de PyMEs.
              </p>
              <button
                type="button"
                className={botonCls}
                disabled={trabajando || (faltaSucursal && !sucursal)}
                onClick={() => accion({ accion: "crear", sucursal }, "Envío creado. Ahora pagalo en el portal de Andreani.")}
              >
                {trabajando ? "Creando…" : "Crear envío en Andreani"}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
            <div><dt className="text-xs text-ink-500">Pedido en Andreani</dt><dd className="mt-0.5 font-mono text-ink-900">{andreani.pedidoId}</dd></div>
            <div><dt className="text-xs text-ink-500">Seguimiento</dt><dd className="mt-0.5 font-mono text-ink-900">{trackingCode || "—"}</dd></div>
            <div><dt className="text-xs text-ink-500">Estado</dt><dd className="mt-0.5 text-ink-900">{andreani.estado || "Falta pagar el envío"}</dd></div>
            <div><dt className="text-xs text-ink-500">Modalidad</dt><dd className="mt-0.5 text-ink-900">{andreani.modalidad === "sucursal" ? "A sucursal" : "A domicilio"}</dd></div>
          </dl>
          {!trackingCode ? (
            <p className="text-xs text-ink-500">
              El número de seguimiento y la etiqueta aparecen cuando pagás el envío en el portal de PyMEs.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!trackingCode ? (
              <a href={PORTAL_PYMES} target="_blank" rel="noreferrer" className={botonCls}>
                Pagar en Andreani
              </a>
            ) : (
              <a href={`/api/admin/orders/${encodeURIComponent(code)}/andreani`} target="_blank" rel="noreferrer" className={botonCls}>
                Descargar etiqueta
              </a>
            )}
            <button
              type="button"
              className={botonSecundarioCls}
              disabled={trabajando}
              onClick={() => accion({ accion: "actualizar" }, "Seguimiento actualizado.")}
            >
              {trabajando ? "Consultando…" : "Actualizar seguimiento"}
            </button>
          </div>
        </>
      )}

      {aviso ? <p className="text-xs font-bold text-emerald-700">{aviso}</p> : null}
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
