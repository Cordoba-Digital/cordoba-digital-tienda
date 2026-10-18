/**
 * Cómo se muestra quién hizo algo en el panel. El registro guarda "contraseña"
 * cuando se entró con ADMIN_PASSWORD (así quedan agrupados los movimientos
 * viejos y nuevos en el filtro), pero en pantalla se lee "Clave de administrador".
 */
export const PASSWORD_ACTOR = "contraseña";
export const PASSWORD_ACTOR_NAME = "Clave de administrador";

export function actorName(actor: string): string {
  return actor === PASSWORD_ACTOR ? PASSWORD_ACTOR_NAME : actor;
}

/** Los ingresos registrados antes de este cambio decían "Ingresó con la contraseña". */
export function activitySummary(summary: string): string {
  return summary === "Ingresó con la contraseña" ? "Ingresó con la clave de administrador" : summary;
}
