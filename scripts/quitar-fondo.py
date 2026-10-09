"""
Quita el fondo de fotos de producto para Córdoba Digital.

Método híbrido:
  1) Rápido: flood-fill desde los bordes. Solo borra el blanco CONECTADO al borde,
     así un producto blanco (JBL, aires) conserva su interior.
  2) Fallback con rembg cuando la foto es dudosa (producto toca el borde, huecos
     de fondo encerrados como el arco de unos auriculares, fondo no blanco).

Uso:
  pip install pillow numpy scipy "rembg[cpu]"
  python quitar_fondo.py images_original public/products
Revisá reporte.csv: los 'revisar' conviene mirarlos a ojo.
"""
import csv
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

TOL_FONDO = 244     # canal >= este valor se considera "casi blanco"
TOL_PURO = 253      # blanco de estudio puro, para detectar huecos encerrados
PADDING = 0.04      # margen alrededor del producto
LADO = 1200         # lado del lienzo final (cuadrado)

try:
    from rembg import new_session, remove
    SESION = new_session("isnet-general-use")
except Exception:
    SESION = None


def por_floodfill(img: Image.Image):
    rgb = np.asarray(img.convert("RGB")).astype(np.uint8)
    h, w, _ = rgb.shape
    casi_blanco = (rgb >= TOL_FONDO).all(axis=2)

    etiquetas, _ = ndi.label(casi_blanco)
    borde = np.unique(np.concatenate([
        etiquetas[0, :], etiquetas[-1, :], etiquetas[:, 0], etiquetas[:, -1]
    ]))
    borde = borde[borde != 0]
    fondo = np.isin(etiquetas, borde)

    # Huecos encerrados de blanco puro (arcos, asas): señal para revisar
    puro = (rgb >= TOL_PURO).all(axis=2)
    huecos = puro & ~fondo
    huecos_ratio = huecos.sum() / (h * w)

    fondo_ratio = fondo.sum() / (h * w)
    toca_borde = (~fondo[0, :]).mean() > 0.02 or (~fondo[-1, :]).mean() > 0.02 \
        or (~fondo[:, 0]).mean() > 0.02 or (~fondo[:, -1]).mean() > 0.02

    # Alfa suave: erosiona 1px para evitar halo blanco y difumina el borde
    producto = ~fondo
    producto = ndi.binary_opening(producto, iterations=1)
    producto = ndi.binary_erosion(producto, iterations=1)
    alfa = ndi.gaussian_filter(producto.astype(np.float32), sigma=0.9)
    alfa = np.clip(alfa * 1.15, 0, 1)

    rgba = np.dstack([rgb, (alfa * 255).astype(np.uint8)])
    dudosa = (
        fondo_ratio < 0.15 or fondo_ratio > 0.97
        or toca_borde or huecos_ratio > 0.01
    )
    return Image.fromarray(rgba, "RGBA"), dudosa


def centrar(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    util = int(LADO * (1 - 2 * PADDING))
    img.thumbnail((util, util), Image.LANCZOS)
    lienzo = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
    lienzo.paste(img, ((LADO - img.width) // 2, (LADO - img.height) // 2), img)
    return lienzo


def main(origen: str, destino: str):
    src, dst = Path(origen), Path(destino)
    dst.mkdir(parents=True, exist_ok=True)
    filas = []
    for f in sorted(src.glob("*.*")):
        if f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        original = Image.open(f).convert("RGBA")
        resultado, dudosa = por_floodfill(original)
        metodo = "floodfill"
        if dudosa and SESION is not None:
            resultado = remove(original, session=SESION)
            metodo = "rembg"
        estado = "revisar" if (dudosa and SESION is None) or dudosa else "ok"
        centrar(resultado).save(dst / f"{f.stem}.webp", quality=92, method=6)
        filas.append([f.name, metodo, estado])
        print(f"{f.name}: {metodo} [{estado}]")

    with open(dst / "reporte.csv", "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows([["archivo", "metodo", "estado"], *filas])


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: python quitar_fondo.py <carpeta_origen> <carpeta_destino>")
    main(sys.argv[1], sys.argv[2])
