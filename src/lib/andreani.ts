
/**
 * Cliente de la API de Andreani para tiendas online (PyME y Middle Market).
 *
 * Es la misma API que usa el plugin oficial "Andreani Envíos" para
 * WooCommerce (`andreani-shipping` en wordpress.org), que es lo que el local
 * usaba en el sitio viejo. Se lee del código del plugin, no de una
 * documentación publicada:
 *
 *   POST /api/v1/Login                    Authorization: <credencial>  → response.accessToken
 *   POST /api/v1/Pyme/rates               cotización (una tarifa por modalidad)
 *   GET  /api/v1/Branch?postalCode=       sucursales de destino
 *   POST /api/v1/Pyme/ShippingRegistration alta del envío → response.pedidoId
 *   POST /api/v1/Shipments/ByOrderNumbers  número de seguimiento y estado
 *   POST /api/v1/Pyme/ticket              etiqueta en PDF
 *
 * La credencial es el "ID de credencial" que da pymes.andreani.com en
 * Integraciones. Vive SOLO en la variable `ANDREANI_CREDENTIAL` de Vercel: no
 * se loguea ni se manda al navegador. No hacen falta números de contrato
 * aparte: los contratos de la cuenta vienen en la respuesta del login.
 *
 * Flujo PyME: al dar de alta el envío Andreani devuelve un `pedidoId`, pero el
 * envío se paga en el portal de PyMEs (pymes.andreani.com, "Ver envíos").
 * Recién después aparece el número de seguimiento y se puede bajar la etiqueta.
 */

const BASE_URL = "https://woocommerce-api-acom.andreani.com";

/** CP desde donde despacha el local (27 de Abril, Córdoba Capital). */
export const CP_ORIGEN = "5000";

/** Portal donde el local paga los envíos dados de alta. */
export const PORTAL_PYMES = "https://pymes.andreani.com/ver-envios?tab=integraciones";

export function urlSeguimiento(numero: string): string {
  return `https://www.andreani.com/envio/${encodeURIComponent(numero)}`;
}

export type Modalidad = "domicilio" | "sucursal";

export type ContratoAndreani = {
  id: number | string;
  numero: string;
  modalidad: Modalidad | null;
  nombre: string;
};

export type CuentaAndreani = {
  tipo: string;
  nombre: string;
  contratos: ContratoAndreani[];
};

export type ProductoCotizacion = {
  cantidad: number;
  /** Valor declarado por unidad, en pesos enteros. */
  precio: number;
  largo: number;
  ancho: number;
  alto: number;
  kilos: number;
};

export type SucursalAndreani = {
  codigo: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  cp: string;
  horario: string;
};

export type EstadoEnvio = {
  pedido: string;
  seguimiento: string;
  estado: string;
};

export class AndreaniError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "AndreaniError";
  }
}

function credencial(): string {
  return process.env.ANDREANI_CREDENTIAL?.trim() ?? "";
}

/** Si la tienda tiene credencial cargada. Sin ella todo cae a la tarifa fija. */
export function andreaniConfigurado(): boolean {
  return credencial() !== "";
}

/** Tipo de cuenta según el prefijo de la credencial ("Pyme|…" en base64). */
export function tipoDeCredencial(valor: string): "pyme" | "corporativo" | null {
  try {
    const texto = Buffer.from(valor, "base64").toString("utf8");
    const prefijo = texto.split("|")[0]?.trim().toLowerCase();
    if (prefijo === "pyme") return "pyme";
    if (prefijo === "corpo" || prefijo === "corporativo") return "corporativo";
  } catch {
    // cae al null
  }
  return null;
}

/** "A domicilio" / "Estándar" → domicilio; "A sucursal" → sucursal. */
export function modalidadDe(nombre: string): Modalidad | null {
  const n = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (n.includes("sucursal")) return "sucursal";
  if (n.includes("domicilio") || n.includes("estandar") || n.includes("standard")) return "domicilio";
  return null;
}

type Sesion = { token: string; cuenta: CuentaAndreani; vence: number };

// El plugin no maneja vencimiento del token: se reusa un rato y ante un 401
// se vuelve a loguear una vez.
const DURACION_SESION_MS = 30 * 60 * 1000;
let sesion: Sesion | null = null;

function texto(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function detalleDeError(cuerpo: unknown, crudo: string): string {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const anidado = (k: string) => texto((c[k] as Record<string, unknown> | undefined)?.message);
  return texto(c.message) || anidado("error") || anidado("response") || texto(c.title) || crudo.slice(0, 200);
}

async function pedir(ruta: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15_000, ...resto } = init;
  try {
    return await fetch(`${BASE_URL}${ruta}`, { ...resto, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const corte = error instanceof Error && error.name === "TimeoutError";
    throw new AndreaniError(corte ? "Andreani no respondió a tiempo." : "No se pudo conectar con Andreani.");
  }
}

async function login(): Promise<Sesion> {
  const valor = credencial();
  if (!valor) throw new AndreaniError("Falta la credencial de Andreani (ANDREANI_CREDENTIAL).");
  const res = await pedir("/api/v1/Login", {
    method: "POST",
    headers: { Authorization: valor, "Content-Type": "application/json" },
  });
  const crudo = await res.text();
  const cuerpo = (() => {
    try {
      return JSON.parse(crudo) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (res.status === 401 || res.status === 403) {
    throw new AndreaniError("Andreani rechazó la credencial. Hay que generar una nueva en pymes.andreani.com.", res.status);
  }
  const datos = (cuerpo?.response ?? null) as Record<string, unknown> | null;
  const token = texto(datos?.accessToken);
  if (!res.ok || !datos || !token) {
    throw new AndreaniError(`Andreani no aceptó el ingreso: ${detalleDeError(cuerpo, crudo)}`, res.status);
  }
  const contratos = (Array.isArray(datos.contratos) ? datos.contratos : []).map((raw) => {
    const c = raw as Record<string, unknown>;
    const nombre = texto(c.modoDeEntregaNombre) || texto(c.tipoDeEnvioNombre);
    return { id: (c.id as number | string) ?? "", numero: texto(c.numeroDeContrato), nombre, modalidad: modalidadDe(nombre) };
  });
  const cuenta: CuentaAndreani = {
    tipo: texto(datos.clientType).toLowerCase() || tipoDeCredencial(valor) || "",
    nombre: texto(datos.nombreFantasia) || texto(datos.razonSocial),
    contratos,
  };
  // Sin datos sensibles: sirve para ver en los logs de Vercel qué modalidades
  // tiene la cuenta la primera vez que se conecta.
  console.info("[andreani] sesión iniciada", {
    tipo: cuenta.tipo,
    contratos: contratos.map((c) => `${c.nombre} → ${c.modalidad ?? "?"}`),
  });
  sesion = { token, cuenta, vence: Date.now() + DURACION_SESION_MS };
  return sesion;
}

// Si el ingreso falla (credencial vencida, Andreani caído), no se reintenta en
// cada visita al checkout: durante 2 minutos se responde el mismo error al
// instante y el checkout usa la tarifa fija sin esperar.
const PAUSA_TRAS_FALLA_MS = 2 * 60 * 1000;
let ultimaFalla: { error: AndreaniError; hasta: number } | null = null;

async function sesionVigente(): Promise<Sesion> {
  if (sesion && sesion.vence > Date.now()) return sesion;
  if (ultimaFalla && ultimaFalla.hasta > Date.now()) throw ultimaFalla.error;
  try {
    const nueva = await login();
    ultimaFalla = null;
    return nueva;
  } catch (error) {
    const andreaniError = error instanceof AndreaniError ? error : new AndreaniError("No se pudo conectar con Andreani.");
    ultimaFalla = { error: andreaniError, hasta: Date.now() + PAUSA_TRAS_FALLA_MS };
    throw andreaniError;
  }
}

/** Llamada autenticada; ante un 401 renueva el token y reintenta una vez. */
async function llamar(ruta: string, init: RequestInit & { timeoutMs?: number } = {}, reintento = true): Promise<Response> {
  const { token } = await sesionVigente();
  const res = await pedir(ruta, {
    ...init,
    headers: { "X-Auth-Token": token, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 401 && reintento) {
    sesion = null;
    return llamar(ruta, init, false);
  }
  return res;
}

async function json(res: Response): Promise<Record<string, unknown>> {
  const crudo = await res.text();
  let cuerpo: Record<string, unknown> | null = null;
  try {
    cuerpo = JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    cuerpo = null;
  }
  if (!res.ok || !cuerpo) {
    throw new AndreaniError(`Andreani respondió ${res.status}: ${detalleDeError(cuerpo, crudo)}`, res.status);
  }
  return cuerpo;
}

/** Datos de la cuenta conectada (tipo, nombre y contratos). */
export async function cuentaAndreani(): Promise<CuentaAndreani> {
  return (await sesionVigente()).cuenta;
}

// ---------------------------------------------------------------------------
// Cotización

export type Cotizacion = Partial<Record<Modalidad, number>>;

const DURACION_COTIZACION_MS = 15 * 60 * 1000;
const cotizaciones = new Map<string, { valor: Cotizacion; vence: number }>();

/**
 * Precio de envío por modalidad para un CP y un carrito. El checkout y
 * `/api/shipping` llaman a esta misma función con los mismos productos, y el
 * caché de 15 minutos hace que el servidor cobre lo mismo que se mostró.
 */
export async function cotizar(cpDestino: string, productos: ProductoCotizacion[]): Promise<Cotizacion> {
  const clave = JSON.stringify([cpDestino, productos]);
  const guardada = cotizaciones.get(clave);
  if (guardada && guardada.vence > Date.now()) return guardada.valor;

  // Corto: el cliente está esperando en el checkout, y si Andreani tarda se
  // usa la tarifa fija.
  const res = await llamar("/api/v1/Pyme/rates", {
    method: "POST",
    timeoutMs: 8_000,
    body: JSON.stringify({
      postal_code_origin: CP_ORIGEN,
      postal_code_destination: cpDestino,
      products: productos.map((p) => ({
        quantity: p.cantidad,
        price: Math.trunc(p.precio),
        dimensions: { width: p.ancho, height: p.alto, depth: p.largo, grams: Math.round(p.kilos * 1000) },
      })),
    }),
  });
  const cuerpo = await json(res);
  const tarifas = ((cuerpo.response as Record<string, unknown> | undefined)?.rates ?? []) as Record<string, unknown>[];
  const valor: Cotizacion = {};
  const sinMapear: string[] = [];
  for (const tarifa of Array.isArray(tarifas) ? tarifas : []) {
    const codigo = texto(tarifa.code);
    const total = Number(tarifa.total);
    const modalidad = modalidadDe(codigo);
    if (!modalidad || !Number.isFinite(total) || total <= 0) {
      sinMapear.push(codigo);
      continue;
    }
    if (valor[modalidad] === undefined) valor[modalidad] = Math.round(total);
  }
  if (sinMapear.length) console.warn("[andreani] tarifas sin modalidad reconocida", sinMapear);
  cotizaciones.set(clave, { valor, vence: Date.now() + DURACION_COTIZACION_MS });
  return valor;
}

// ---------------------------------------------------------------------------
// Sucursales

const DURACION_SUCURSALES_MS = 2 * 60 * 60 * 1000;
const cacheSucursales = new Map<string, { valor: SucursalAndreani[]; vence: number }>();

export async function sucursales(cp: string): Promise<SucursalAndreani[]> {
  const guardada = cacheSucursales.get(cp);
  if (guardada && guardada.vence > Date.now()) return guardada.valor;
  const valor = await pedirSucursales(cp);
  cacheSucursales.set(cp, { valor, vence: Date.now() + DURACION_SUCURSALES_MS });
  return valor;
}

async function pedirSucursales(cp: string): Promise<SucursalAndreani[]> {
  const res = await llamar(`/api/v1/Branch?postalCode=${encodeURIComponent(cp)}`, { method: "GET" });
  const cuerpo = await json(res);
  const lista = ((cuerpo.response as Record<string, unknown> | undefined)?.data ?? []) as Record<string, unknown>[];
  return (Array.isArray(lista) ? lista : [])
    .map((s) => {
      const campo = (k: string) => s[k] ?? s[k.charAt(0).toLowerCase() + k.slice(1)];
      const dir = (campo("Direccion") ?? {}) as Record<string, unknown>;
      const dirCampo = (k: string) => texto(dir[k] ?? dir[k.charAt(0).toLowerCase() + k.slice(1)]);
      return {
        codigo: texto(campo("Codigo")),
        nombre: texto(campo("Descripcion")),
        direccion: [dirCampo("Calle"), dirCampo("Numero")].filter(Boolean).join(" "),
        localidad: dirCampo("Localidad"),
        provincia: dirCampo("Provincia"),
        cp: dirCampo("CodigoPostal"),
        horario: texto(campo("HorarioDeAtencion")),
      };
    })
    .filter((s) => s.codigo);
}

// ---------------------------------------------------------------------------
// Alta del envío, seguimiento y etiqueta

export type AltaEnvio = {
  /** Código del pedido de la tienda; Andreani lo devuelve como `salesOrderNumber`. */
  remito: string;
  modalidad: Modalidad;
  costo: number;
  destino: { calle: string; numero: string; piso: string; cp: string; localidad: string; sucursal: string };
  destinatario: { nombre: string; apellido: string; telefono: string; dni: string; email: string };
  productos: ProductoCotizacion[];
  emailComercio: string;
};

export async function altaEnvio(datos: AltaEnvio): Promise<{ pedidoId: string; numeroInterno: string }> {
  const { cuenta } = await sesionVigente();
  const contrato = cuenta.contratos.find((c) => c.modalidad === datos.modalidad);
  if (!contrato) {
    throw new AndreaniError(
      datos.modalidad === "sucursal"
        ? "La cuenta de Andreani no tiene contrato de envío a sucursal."
        : "La cuenta de Andreani no tiene contrato de envío a domicilio.",
    );
  }
  if (datos.modalidad === "sucursal" && !datos.destino.sucursal) {
    throw new AndreaniError("Falta la sucursal de destino.");
  }
  // Sin reintentos: un reintento automático puede dar de alta el envío dos veces.
  const res = await llamar("/api/v1/Pyme/ShippingRegistration", {
    method: "POST",
    timeoutMs: 30_000,
    body: JSON.stringify({
      contract: { id_contract: contrato.id },
      price_shipment: datos.costo,
      origin: { postal_code: CP_ORIGEN },
      destination: {
        street: datos.destino.calle,
        number: datos.destino.numero || "S/N",
        floor: datos.destino.piso,
        postal_code: datos.destino.cp,
        locality: datos.destino.localidad,
        code_branch: datos.modalidad === "sucursal" ? datos.destino.sucursal : "",
      },
      recipient: {
        name: datos.destinatario.nombre,
        last_name: datos.destinatario.apellido,
        phone_number: datos.destinatario.telefono,
        dni: datos.destinatario.dni,
        email: datos.destinatario.email,
      },
      products: datos.productos.map((p) => ({
        price: Math.trunc(p.precio),
        quantity: p.cantidad,
        kgrams: p.kilos,
        width: p.ancho,
        depth: p.largo,
        height: p.alto,
      })),
      email_merchant: datos.emailComercio,
      remito: datos.remito,
    }),
  });
  const cuerpo = await json(res);
  const respuesta = (cuerpo.response ?? {}) as Record<string, unknown>;
  const pedidoId = texto(respuesta.pedidoId) || texto(respuesta.trackingNumber);
  // El plugin da por bueno un alta sin pedidoId; acá es un error, porque sin
  // ese dato no hay forma de seguir el envío desde la tienda.
  if (!pedidoId) throw new AndreaniError("Andreani no devolvió el número de pedido del envío.");
  return { pedidoId, numeroInterno: texto(respuesta.numeroInterno) };
}

/** Número de seguimiento y estado por código de pedido (hasta 100 por llamada). */
export async function estadosDeEnvio(remitos: string[]): Promise<EstadoEnvio[]> {
  if (!remitos.length) return [];
  const res = await llamar("/api/v1/Shipments/ByOrderNumbers", {
    method: "POST",
    timeoutMs: 10_000,
    body: JSON.stringify({ salesOrderNumbers: remitos.slice(0, 100) }),
  });
  const cuerpo = await json(res);
  const datos = cuerpo.response ?? cuerpo;
  const lista = (Array.isArray(datos) ? datos : ((datos as Record<string, unknown>).data ?? [])) as Record<string, unknown>[];
  return (Array.isArray(lista) ? lista : []).map((e) => ({
    pedido: texto(e.salesOrderNumber),
    seguimiento: texto(e.trackingNumber),
    estado: texto(e.trackingStatus),
  }));
}

/** Etiqueta en PDF de un envío ya pagado (necesita el número de seguimiento). */
export async function etiqueta(numeroSeguimiento: string): Promise<ArrayBuffer> {
  const res = await llamar("/api/v1/Pyme/ticket", {
    method: "POST",
    timeoutMs: 30_000,
    body: JSON.stringify({ trackingNumbers: [numeroSeguimiento] }),
  });
  if (!res.ok) {
    const crudo = await res.text();
    throw new AndreaniError(`Andreani no devolvió la etiqueta (${res.status}): ${crudo.slice(0, 200)}`, res.status);
  }
  return res.arrayBuffer();
}

/** El único estado final que reconoce el plugin. */
export function envioEntregado(estado: string): boolean {
  return estado.trim().toLowerCase() === "entregado";
}
