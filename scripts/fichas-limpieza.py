"""Limpieza determinística de fichas (sin modelo de lenguaje).

Entrada: todos.json (export de /api/fichas-export). Salida: lotes JSON con la
forma de data/fichas/lote-*.json, solo con los campos que cambian:
name (mayúsculas sostenidas), brand (si es "General" y el nombre la dice),
seoTitle, seoDescription y shortDescription (si es el relleno de WooCommerce).

Uso: python3 -I scripts/fichas-limpieza.py todos.json ya-hechos.json data/fichas

todos.json sale de /api/fichas-export (solo preview); ya-hechos.json es la lista
de slugs que ya tienen ficha reescrita en otro lote.
"""
import json
import re
import sys

# Forma canónica de marcas, por la palabra en mayúsculas.
MARCAS = {
    "TP-LINK": "TP-Link", "ASUS": "Asus", "AMD": "AMD", "INTEL": "Intel", "CANON": "Canon", "SIGMA": "Sigma",
    "MSI": "MSI", "KINGSTON": "Kingston", "HILOOK": "HiLook", "HIKSEMI": "Hiksemi", "NIKON": "Nikon", "APC": "APC",
    "GAMEMAX": "Gamemax", "SONY": "Sony", "XPG": "XPG", "HP": "HP", "HPE": "HPE", "EZVIZ": "Ezviz", "E-VIEW": "E-View",
    "THERMALTAKE": "Thermaltake", "GRANDSTREAM": "Grandstream", "SAMSUNG": "Samsung", "LOGITECH": "Logitech",
    "LENOVO": "Lenovo", "ADATA": "Adata", "GIGABYTE": "Gigabyte", "NETMAK": "Netmak", "MIKROTIK": "MikroTik",
    "WINCO": "Winco", "DEKKIN": "Dekkin", "TRV": "TRV", "MERCUSYS": "Mercusys", "TAMRON": "Tamron", "DELL": "Dell",
    "TARGUS": "Targus", "HUAWEI": "Huawei", "BROTHER": "Brother", "EATON": "Eaton", "AEROCOOL": "Aerocool",
    "PHILIPS": "Philips", "JAHRO": "Jahro", "EPSON": "Epson", "MEMOX": "Memox", "KODAK": "Kodak", "MIDEA": "Midea",
    "APPLE": "Apple", "LILIANA": "Liliana", "HIKVISION": "Hikvision", "XIAOMI": "Xiaomi", "X-SHOT": "X-Shot",
    "JBL": "JBL", "TAPO": "TP-Link", "BIOSTAR": "Biostar", "DAIHATSU": "Daihatsu", "PEABODY": "Peabody",
    "PATRIOT": "Patriot", "BAOFENG": "Baofeng", "POLY": "Poly", "CORSAIR": "Corsair", "WESTERN": "Western Digital",
    "WD": "Western Digital", "SEAGATE": "Seagate", "CRUCIAL": "Crucial", "LEXAR": "Lexar", "SANDISK": "SanDisk",
    "LG": "LG", "BGH": "BGH", "PHILCO": "Philco", "NOBLEX": "Noblex", "MOTOROLA": "Motorola", "DJI": "DJI",
    "GOPRO": "GoPro", "FUJIFILM": "Fujifilm", "PANASONIC": "Panasonic", "OLYMPUS": "Olympus", "YONGNUO": "Yongnuo",
    "GODOX": "Godox", "ZHIYUN": "Zhiyun", "DAHUA": "Dahua", "UBIQUITI": "Ubiquiti", "CISCO": "Cisco", "LYONN": "Lyonn",
    "ATOMLUX": "Atomlux", "GENIUS": "Genius", "REDRAGON": "Redragon", "HYPERX": "HyperX", "RAZER": "Razer",
    "COOLER": None, "NOGA": "Noga", "VIEWSONIC": "ViewSonic", "AOC": "AOC", "BENQ": "BenQ", "ACER": "Acer",
    "TOSHIBA": "Toshiba", "TEAMGROUP": "TeamGroup", "PNY": "PNY", "ZOTAC": "Zotac", "NZXT": "NZXT", "DEEPCOOL": "DeepCool",
    "ATMA": "Atma", "ULTRACOMB": "Ultracomb", "GADNIC": "Gadnic", "KANJI": "Kanji", "ELF": "ELF", "HYUNDAI": "Hyundai",
    "SIGNIFY": "Signify", "EVERLAST": "Everlast", "KASSEL": "Kassel", "EMBASSY": "Embassy", "ETHEOS": "Etheos",
    "STANLEY": "Stanley", "BOSCH": "Bosch", "DEWALT": "DeWalt", "BLACK+DECKER": "Black+Decker", "GAMMA": "Gamma",
    "LOTUS": "Lotus", "VIEWZ": "Viewz", "KOLKE": "Kolke", "SOYNTEC": "Soyntec", "NISUTA": "Nisuta", "SATE": "Sate",
    "IMOU": "Imou", "REOLINK": "Reolink", "ROBOTICA": None, "D-LINK": "D-Link", "NAKAN": "Nakan",
    "WHITENBLACK": "Whitenblack", "IPHONE": "iPhone", "IPAD": "iPad", "MACBOOK": "MacBook",
}
UNIDADES = {"MHZ": "MHz", "GHZ": "GHz", "MBPS": "Mbps", "GBPS": "Gbps", "HZ": "Hz", "GAB": "Gabinete"}
CORTAS_PALABRA = {"DE", "DEL", "LA", "EL", "LOS", "LAS", "Y", "CON", "SIN", "POR", "PARA", "RED", "KIT", "EN", "A", "O", "MAS", "SOL", "AL", "UNA", "UN", "USO", "GAS", "LUZ", "PIE", "MINI"}
PROMO = re.compile(r"descripci[oó]n breve|sku|contado|descuento|cuotas|\$|precio|oferta|env[ií]o gratis|compr[aá] (el|la|los|ya)", re.I)
# Siglas y palabras que se dejan como están.
SIGLAS = {
    "SSD", "HDD", "USB", "NVME", "DDR", "DDR3", "DDR4", "DDR5", "RGB", "ARGB", "LED", "IPS", "VA", "TN", "UPS", "AMD",
    "MSI", "ROG", "TUF", "APC", "IP", "PC", "CPU", "GPU", "RAM", "SATA", "HDMI", "VGA", "DVI", "WIFI", "POE", "NVR",
    "DVR", "XVR", "AP", "SFP", "LTE", "4G", "5G", "TV", "UHD", "FHD", "HD", "QHD", "OLED", "QLED", "AMOLED", "ATX",
    "MATX", "ITX", "AIO", "PCIE", "PCI-E", "M.2", "GB", "TB", "MB", "MHZ", "GHZ", "HZ", "MM", "MP", "VA", "W", "KVA",
    "AF-S", "AF-P", "EF", "EF-S", "RF", "RF-S", "STM", "USM", "IS", "DX", "FX", "VR", "OIS", "DG", "DN", "HSM", "OS",
    "II", "III", "IV", "PRO", "XL", "XXL", "BT", "NFC", "GPS", "LCD", "AC", "AX", "WI-FI", "SODIMM", "DIMM", "CL",
    "RTX", "GTX", "RX", "TDP", "BTU", "WIFI6", "PD", "QC", "ANC", "TWS", "DJI", "JBL", "HP", "LG", "BGH", "XPG", "TRV",
    "AOC", "NZXT", "PNY", "ELF", "UV", "CCTV", "PTZ", "POE+", "NAS", "SAS", "VPN", "MU-MIMO", "MIMO", "AM4", "AM5",
    "LGA", "S1700", "S1851", "FE", "SE", "GT", "GTS", "CX", "ST", "ES",
}
# Palabras cortas en minúscula (salvo al inicio).
MINUSCULAS = {"de", "del", "la", "el", "los", "las", "y", "para", "con", "en", "sin", "por", "a", "o", "e"}

PIE = "Garantía oficial y envíos a todo el país."
RELLENO = re.compile(r"Calidad garantizada y disponibilidad inmediata\.?", re.I)


def es_mayus_sostenida(nombre: str) -> bool:
    letras = re.sub(r"[^A-Za-zÁÉÍÓÚÑáéíóúñ]", "", nombre)
    return len(letras) >= 6 and sum(c.isupper() for c in letras) / len(letras) > 0.8


def normalizar_palabra(w: str, primera: bool) -> str:
    if "/" in w and len(w) > 2:
        return "/".join(normalizar_palabra(x, primera and i == 0) if x else x for i, x in enumerate(w.split("/")))
    base = w.upper()
    limpio = re.sub(r"[^\wÁÉÍÓÚÑ+\-.]", "", base)
    if limpio in MARCAS and MARCAS[limpio]:
        return w.replace(w.strip("()[],"), MARCAS[limpio]) if w.strip("()[],") else w
    if limpio in UNIDADES:
        return w.replace(w.strip("()[],."), UNIDADES[limpio]) if w.strip("()[],.") else w
    if limpio in SIGLAS or re.search(r"\d", w) or (len(limpio) <= 3 and limpio.isalpha() and limpio not in CORTAS_PALABRA):
        return w
    low = w.lower()
    if not primera and low in MINUSCULAS:
        return low
    return low[:1].upper() + low[1:]


def normalizar_nombre(nombre: str) -> str:
    partes = nombre.split()
    return " ".join(normalizar_palabra(w, i == 0) for i, w in enumerate(partes))


def marca_desde_nombre(nombre: str) -> str | None:
    for w in re.findall(r"[A-Za-z][A-Za-z0-9+\-]*", nombre)[:8]:
        m = MARCAS.get(w.upper())
        if m:
            return m
    return None


def recortar(texto: str, maximo: int) -> str:
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) <= maximo:
        return texto
    corte = texto[: maximo - 1]
    return corte[: corte.rfind(" ")].rstrip(" ,;:.-–") + "…"


def primera_frase(texto: str) -> str:
    texto = RELLENO.sub("", re.sub(r"\[cite:[^\]]*\]", "", texto))
    texto = re.sub(r"\s+", " ", texto).strip()
    m = re.match(r"(.{30,}?[.!?])(\s|$)", texto)
    frase = (m.group(1) if m else texto).strip()
    # Volcado de specs sin puntuación ("Megapixel 45,7 CMOS ... Monitor 8 Cm ...") o promo: no sirve.
    if PROMO.search(frase) or (not m and len(frase) > 110) or frase.isupper():
        return ""
    return frase


def seo_title(nombre: str) -> str:
    t = re.sub(r"\s+", " ", nombre).strip()
    if len(t) <= 45:
        return t
    palabras = t.split()
    while len(" ".join(palabras)) > 45 or (palabras and (palabras[-1].lower() in MINUSCULAS or palabras[-1].count("(") > palabras[-1].count(")"))):
        palabras.pop()
    return " ".join(palabras).rstrip(" ,-–/")


def seo_description(nombre: str, short: str) -> str:
    frase = primera_frase(short)
    if frase.lower().startswith("producto "):
        frase = ""
    texto = frase if frase else f"{nombre}."
    disponible = 160 - len(PIE) - 1
    texto = recortar(texto, disponible) if texto else recortar(nombre, disponible)
    if not texto.endswith((".", "…", "!", "?")):
        texto += "."
    return f"{texto} {PIE}"


def ficha(p: dict) -> dict:
    out = {"slug": p["slug"]}
    nombre = p["name"].strip()
    if es_mayus_sostenida(nombre):
        nombre = normalizar_nombre(nombre)
        out["name"] = nombre
    if p["brand"] in ("General", ""):
        m = marca_desde_nombre(nombre)
        if m:
            out["brand"] = m
    out["seoTitle"] = seo_title(nombre)
    out["seoDescription"] = seo_description(nombre, p["shortDescription"])
    if RELLENO.search(p["shortDescription"]) or not p["shortDescription"].strip():
        out["shortDescription"] = f"{nombre}. Producto nuevo con garantía oficial. Envíos a todo el país y retiro en Córdoba."
    return out


def main() -> None:
    todos = json.load(open(sys.argv[1]))
    hechos = set(json.load(open(sys.argv[2])))
    salida = sys.argv[3]
    fichas = [ficha(p) for p in todos if p["slug"] not in hechos]
    tam = 500
    for i in range(0, len(fichas), tam):
        n = i // tam + 1
        json.dump(
            {"lote": f"limpieza-{n}", "soloSinCurar": True, "nota": "Limpieza automática sin redactar: nombre, marca, título y descripción para Google.", "productos": fichas[i : i + tam]},
            open(f"{salida}/limpieza-{n}.json", "w"), ensure_ascii=False, indent=1,
        )
    print(len(fichas), "fichas")


if __name__ == "__main__":
    main()
