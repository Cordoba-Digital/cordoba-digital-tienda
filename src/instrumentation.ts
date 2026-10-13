import type { Instrumentation } from "next";

/**
 * Cada error que una página o una ruta de API no atrapa queda en Admin →
 * Errores y les llega por email a los dueños del panel (ver `error-log.ts`).
 * Solo en Node: el registro usa la base.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : "";
  const { recordServerError } = await import("@/lib/error-log");
  await recordServerError({
    message: digest && !err.message ? `Error ${digest}` : err.message,
    stack: err.stack,
    route: context.routePath,
    path: request.path,
    method: request.method,
  });
};
