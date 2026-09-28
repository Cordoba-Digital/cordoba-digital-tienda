# Inventario del catálogo WooCommerce

Generado por `npm run audit:wp` (2026-09-28).
Fuente: https://www.cordobadigital.net · WC Store API pública + sitemaps XML. **Sin credenciales.**

## Resumen

| Métrica | Valor |
| --- | --- |
| Categorías | 128 (21 raíz, profundidad 3 niveles) |
| Productos (API) | 2588 |
| Productos (sitemaps) | 2379 |
| Marcas | 22 |
| Tags | 3950 (se listan los primeros 300) |
| En oferta | 2383 (92.1%) |
| Sin stock | 220 (8.5%) |
| Multi-categoría | 1105 (42.7%) |
| Con marca asignada | 233 (9.0%) |
| Con descripción > 2000 chars | 411 (15.9%) |
| Con imagen | 2587 (100.0%) |
| Con rating nativo | 0 |
| Productos variables (`has_options`) | 0 |
| Productos con atributos | 7 |
| Precio mediana | $3.391 · mín $40 · máx $195.333 |
| Longitud de descripción | mediana 691 chars · p90 3730 |

> **Conclusión:** el 100% del catálogo es de productos simples (sin variaciones ni
> atributos), por lo que la migración es 1:1 sin motor de variantes. La API pública
> no expone `stock_quantity`, por eso el stock se migra como 1/0 según `is_in_stock`.

## Árbol de categorías (128)

Ordenado por cantidad de productos descendientes. `count` es el total que declara
WooCommerce (incluye subcategorías).

| Categoría | slug (ruta) | wpId | count | subcats | chars desc | imagen |
| --- | --- | --- | --- | --- | --- | --- |
| `COMPUTACIÓN` | `computacion` | 30 | 996 | 20 | 2460 | sí |
|   `Memoria Ram` | `computacion/memoria-ram` | 7265 | 147 | 0 | 966 | sí |
|   `Gabinetes` | `computacion/gabinetes` | 90 | 118 | 0 | 0 | sí |
|   `Motherboards Placas madre` | `computacion/motherboards-placas-madre` | 89 | 114 | 0 | 0 | sí |
|   `Computadoras de Escritorio` | `computacion/computadoras-de-escritorio` | 51 | 99 | 2 | 2385 | sí |
|     `Computadoras AMD` | `computacion/computadoras-de-escritorio/amd` | 3196 | 36 | 0 | 74 | sí |
|     `Computadoras Intel` | `computacion/computadoras-de-escritorio/intel` | 3197 | 34 | 0 | 30 | sí |
|   `Disco SSD / HDD` | `computacion/disco-ssd-hdd` | 6705 | 84 | 0 | 100 | sí |
|   `Microprocesadores` | `computacion/microprocesadores` | 88 | 74 | 0 | 48 | sí |
|   `Monitores LED` | `computacion/monitores-led` | 68 | 74 | 0 | 2058 | sí |
|   `Notebooks` | `computacion/notebooks-cordoba` | 85 | 74 | 11 | 2062 | sí |
|     `Notebooks Apple` | `computacion/notebooks-cordoba/apple-notebooks` | 2948 | 36 | 0 | 2215 | sí |
|     `Notebooks para Oficina` | `computacion/notebooks-cordoba/uso-oficina` | 5250 | 23 | 0 | 2798 | sí |
|     `Notebooks para Diseño Gráfico y Arquitectura` | `computacion/notebooks-cordoba/diseno-grafico` | 5251 | 19 | 0 | 3091 | sí |
|     `Notebooks HP` | `computacion/notebooks-cordoba/hp-notebooks` | 2953 | 13 | 0 | 2223 | sí |
|     `Notebooks uso Doméstico` | `computacion/notebooks-cordoba/uso-domestico` | 5249 | 11 | 0 | 3010 | sí |
|     `Notebooks Gamer` | `computacion/notebooks-cordoba/gamer` | 5252 | 10 | 0 | 3080 | sí |
|     `Notebooks Lenovo` | `computacion/notebooks-cordoba/notebooks-lenovo` | 2946 | 6 | 0 | 2328 | sí |
|     `Notebooks MSI` | `computacion/notebooks-cordoba/msi` | 7971 | 5 | 0 | 2332 | sí |
|     `Notebooks Asus` | `computacion/notebooks-cordoba/asus` | 2947 | 3 | 0 | 2240 | sí |
|     `Notebooks Dell` | `computacion/notebooks-cordoba/dell` | 2951 | 3 | 0 | 2312 | sí |
|     `Notebooks Gateway` | `computacion/notebooks-cordoba/gateway` | 7826 | 1 | 0 | 0 | sí |
|   `ESTABILIZADORES- UPS` | `computacion/estabilizadores-ups` | 7710 | 62 | 0 | 2250 | sí |
|   `Periféricos Pc` | `computacion/perifericos-pc` | 8231 | 46 | 0 | 211 | sí |
|   `TABLET` | `computacion/tablet` | 75 | 33 | 0 | 2083 | sí |
|   `Fuentes PC` | `computacion/fuentes-pc` | 6704 | 21 | 0 | 200 | sí |
|   `Computadoras All in One` | `computacion/computadoras-all-in-one` | 44 | 7 | 0 | 2448 | sí |
|   `Tarjetas de Memoria` | `computacion/tarjetas-de-memoria` | 8122 | 6 | 0 | 66 | sí |
|   `Sillas Gamer` | `computacion/sillas-gamer` | 6701 | 5 | 0 | 371 | sí |
|   `Calculadoras Científicas` | `computacion/calculadoras-cientificas` | 7923 | 2 | 0 | 2324 | sí |
|   `Combo de Actualización` | `computacion/combo-de-actualizacion` | 3664 | 2 | 0 | 122 | sí |
|   `Discos Duros Externos` | `computacion/discos-duros-externos` | 3244 | 2 | 0 | 330 | sí |
|   `Joystick` | `computacion/joystick` | 8233 | 2 | 0 | 39 | sí |
|   `Placas de Video` | `computacion/placas-de-video` | 602 | 2 | 0 | 62 | sí |
| `CAMARAS DIGITALES FOTO` | `camaras-digitales` | 28 | 352 | 8 | 2696 | sí |
|   `Lentes - Objetivos` | `camaras-digitales/lentes-objetivos` | 76 | 233 | 3 | 2557 | sí |
|     `Lentes para Canon` | `camaras-digitales/lentes-objetivos/lentes-para-canon` | 96 | 90 | 0 | 0 | sí |
|     `Lentes para Sony` | `camaras-digitales/lentes-objetivos/lentes-para-sony` | 8937 | 81 | 0 | 27 | sí |
|     `Lentes para Nikon` | `camaras-digitales/lentes-objetivos/lentes-para-nikon` | 101 | 62 | 0 | 0 | sí |
|   `Camaras Reflex y Mirrorless` | `camaras-digitales/camaras-reflex` | 53 | 79 | 4 | 2294 | sí |
|     `Nikon` | `camaras-digitales/camaras-reflex/nikon` | 98 | 29 | 0 | 2903 | sí |
|     `Canon` | `camaras-digitales/camaras-reflex/canon` | 93 | 23 | 0 | 2437 | sí |
|     `Sony` | `camaras-digitales/camaras-reflex/sony-camaras-reflex` | 110 | 18 | 0 | 0 | sí |
|     `Fujifilm` | `camaras-digitales/camaras-reflex/fujifilm` | 9334 | 2 | 0 | 0 | sí |
|   `Camaras GoPro` | `camaras-digitales/camaras-gopro` | 47 | 14 | 0 | 2479 | sí |
|   `Filmadoras / Videocámaras` | `camaras-digitales/filmadoras-videocamaras` | 50 | 10 | 0 | 459 | sí |
|   `Gimbals - Estabilizadores` | `camaras-digitales/gimbals-estabilizadores` | 3407 | 8 | 0 | 95 | sí |
|   `Camaras Compactas` | `camaras-digitales/camaras-compactas` | 43 | 7 | 0 | 0 | sí |
|   `Camaras Semi-Reflex / Bridge` | `camaras-digitales/camaras-semi-reflex-bridge` | 57 | 5 | 1 | 0 | sí |
|     `Nikon` | `camaras-digitales/camaras-semi-reflex-bridge/nikon-camaras-semi-reflex-bridge` | 100 | 1 | 0 | 0 | sí |
|   `Flash` | `camaras-digitales/flash` | 73 | 3 | 0 | 0 | sí |
| `CONECTIVIDAD` | `conectividad` | 3072 | 236 | 8 | 2182 | sí |
|   `Telefonía IP` | `conectividad/telefonia` | 6778 | 18 | 0 | 79 | sí |
|   `Router` | `conectividad/router` | 3147 | 16 | 0 | 43 | sí |
|   `Switch` | `conectividad/switch` | 3149 | 15 | 1 | 26 | sí |
|     `Tp Link` | `conectividad/switch/tp-link` | 8065 | 1 | 0 | 7 | sí |
|   `Access Point` | `conectividad/access-point` | 7036 | 6 | 0 | 0 | sí |
|   `Extensor de Señal Wifi` | `conectividad/extensor-de-senal-wifi` | 6706 | 6 | 0 | 0 | sí |
|   `Placas de red` | `conectividad/placas-de-red` | 3148 | 6 | 0 | 35 | sí |
|   `Cableado Estructurado` | `conectividad/cableado-estructurado` | 6777 | 1 | 0 | 108 | sí |
|   `Router AP` | `conectividad/router-ap` | 6776 | 1 | 0 | 88 | sí |
| `CELULARES LIBERADOS` | `celulares-cordoba` | 29 | 190 | 10 | 2956 | sí |
|   `Celulares Xiaomi` | `celulares-cordoba/xiaomi-cordoba` | 1160 | 72 | 0 | 2211 | sí |
|   `Celulares por menos de $500.000` | `celulares-cordoba/celulares-por-menos-de-500-000` | 17289 | 44 | 0 | 1370 | sí |
|   `Celulares Samsung` | `celulares-cordoba/samsung` | 83 | 42 | 2 | 2252 | sí |
|     `Galaxy Serie A` | `celulares-cordoba/samsung/galaxy-serie-a` | 104 | 26 | 0 | 0 | sí |
|     `Galaxy Serie S` | `celulares-cordoba/samsung/galaxy-serie-s` | 99 | 12 | 0 | 227 | sí |
|   `Celulares Motorola` | `celulares-cordoba/motorola` | 81 | 33 | 0 | 2117 | sí |
|   `Celulares Apple` | `celulares-cordoba/iphone-cordoba` | 70 | 24 | 0 | 2077 | sí |
|   `Celulares por menos de $300.000` | `celulares-cordoba/celulares-por-menos-de-300-000` | 17263 | 20 | 0 | 1370 | sí |
|   `Celulares Infinix` | `celulares-cordoba/infinix` | 9857 | 10 | 0 | 2142 | sí |
|   `Celulares Realme` | `celulares-cordoba/realme` | 10049 | 7 | 0 | 441 | sí |
|   `Celulares Google` | `celulares-cordoba/celulares-google` | 16918 | 1 | 0 | 1762 | sí |
|   `Celulares Huawei` | `celulares-cordoba/celulares-huawei` | 16908 | 1 | 0 | 571 | sí |
| `ELECTRODOMESTICOS` | `electrodomesticos-cordoba` | 33 | 124 | 19 | 142 | sí |
|   `Pavas Eléctricas` | `electrodomesticos-cordoba/pavas-electricas` | 3909 | 24 | 0 | 2035 | sí |
|   `Termos` | `electrodomesticos-cordoba/termos` | 8205 | 20 | 0 | 135 | sí |
|   `Calefactor - Estufa - Caloventor` | `electrodomesticos-cordoba/calefactores-estufas` | 6581 | 19 | 0 | 2146 | sí |
|   `Freidoras` | `electrodomesticos-cordoba/freidoras` | 6665 | 10 | 0 | 2330 | sí |
|   `Licuadoras` | `electrodomesticos-cordoba/licuadoras` | 3913 | 7 | 0 | 0 | sí |
|   `Mates` | `electrodomesticos-cordoba/mates` | 8204 | 6 | 0 | 31 | sí |
|   `Anafe Eléctrico` | `electrodomesticos-cordoba/anafe-electrico` | 8068 | 5 | 0 | 0 | sí |
|   `Aspiradoras Robot` | `electrodomesticos-cordoba/aspiradoras-robot` | 8042 | 5 | 0 | 85 | sí |
|   `Cafeteras` | `electrodomesticos-cordoba/cafeteras` | 6580 | 5 | 0 | 96 | sí |
|   `Aspiradoras` | `electrodomesticos-cordoba/aspiradoras` | 42 | 4 | 0 | 127 | sí |
|   `Batidoras` | `electrodomesticos-cordoba/batidoras` | 6661 | 4 | 0 | 81 | sí |
|   `Hornos Eléctricos` | `electrodomesticos-cordoba/hornos-electricos` | 6678 | 4 | 0 | 17 | sí |
|   `Tostadoras` | `electrodomesticos-cordoba/tostadoras` | 6699 | 3 | 0 | 96 | sí |
|   `Jugueras y Exprimidores` | `electrodomesticos-cordoba/jugueras-y-exprimidores` | 8585 | 2 | 0 | 0 | sí |
|   `Lavarropas` | `electrodomesticos-cordoba/lavarropas` | 67 | 2 | 0 | 79 | sí |
|   `Microondas` | `electrodomesticos-cordoba/microondas` | 6674 | 2 | 0 | 116 | sí |
|   `Planchas` | `electrodomesticos-cordoba/planchas` | 6662 | 2 | 0 | 58 | sí |
|   `Cortadora de Pelo y Barba` | `electrodomesticos-cordoba/cortadora-de-pelo-y-barba` | 8588 | 1 | 0 | 58 | sí |
|   `Heladeras` | `electrodomesticos-cordoba/heladeras-y-frezzer` | 54 | 1 | 0 | 111 | sí |
| `ACCESORIOS P/ CELULARES` | `accesorios-p-celulares` | 26 | 121 | 6 | 1991 | sí |
|   `Auriculares` | `accesorios-p-celulares/auriculares` | 39 | 49 | 0 | 0 | sí |
|   `Parlantes Bluetooth` | `accesorios-p-celulares/parlantes-bluetooth` | 64 | 23 | 0 | 0 | sí |
|   `SMARTWATCH` | `accesorios-p-celulares/smartwatch-cordoba` | 78 | 19 | 0 | 2041 | sí |
|   `Cargadores y Powerbank` | `accesorios-p-celulares/cargadores` | 56 | 13 | 0 | 92 | sí |
|   `Cables USB` | `accesorios-p-celulares/cables-usb` | 46 | 5 | 0 | 25 | sí |
|   `Adaptadores` | `accesorios-p-celulares/adaptadores` | 8230 | 2 | 0 | 0 | sí |
| `CAMARAS CCTV - SEGURIDAD` | `sistemas-de-seguridad` | 35 | 116 | 2 | 1938 | sí |
|   `Cámaras de seguridad Wi-Fi` | `sistemas-de-seguridad/camaras-ip` | 4971 | 26 | 0 | 2326 | sí |
|   `Cajas Fuertes` | `sistemas-de-seguridad/cajas-de-seguridad-caja-fuerte` | 7883 | 1 | 0 | 0 | sí |
| `AUDIO Y VIDEO` | `audio-y-video` | 27 | 109 | 5 | 2171 | sí |
|   `PARLANTES BLUETOOTH` | `audio-y-video/parlantes-cordoba` | 66 | 28 | 0 | 1901 | sí |
|   `TELEVISORES - SMART TV` | `audio-y-video/televisores` | 71 | 19 | 0 | 141 | sí |
|   `PROYECTORES` | `audio-y-video/proyectores` | 63 | 10 | 0 | 1985 | sí |
|   `Paneles Interactivos` | `audio-y-video/paneles-interactivos` | 6547 | 3 | 0 | 2567 | sí |
|   `Convertidor Smart TV` | `audio-y-video/convertidor-smart-tv` | 9646 | 1 | 0 | 2066 | sí |
| `IMPRESORAS` | `impresoras-cordoba` | 3073 | 86 | 5 | 2117 | sí |
|   `Impresoras para la Oficina` | `impresoras-cordoba/impresoras-para-la-oficina` | 6529 | 8 | 0 | 64 | sí |
|   `Impresoras para el Hogar` | `impresoras-cordoba/impresoras-para-el-hogar` | 6528 | 7 | 0 | 53 | sí |
|   `Impresoras 3D` | `impresoras-cordoba/impresoras-3d` | 6667 | 1 | 0 | 117 | sí |
|   `Impresoras para Gigantografías` | `impresoras-cordoba/impresoras-para-gigantografias` | 6527 | 1 | 0 | 69 | sí |
|   `Impresoras para Sublimación` | `impresoras-cordoba/sublimacion` | 6526 | 1 | 0 | 124 | sí |
| `AIRES ACONDICIONADOS` | `aires-acondicionados` | 6693 | 34 | 0 | 2060 | sí |
| `HERRAMIENTAS` | `herramientas` | 6750 | 34 | 0 | 228 | sí |
| `DRONES` | `drones` | 31 | 23 | 0 | 2619 | sí |
| `MUEBLES` | `muebles` | 7891 | 19 | 0 | 0 | sí |
| `MONOPATINES ELECTRICOS` | `monopatines-electricos` | 8056 | 15 | 0 | 555 | sí |
| `CONSOLAS PLAYSTATION` | `consolas-playstation` | 41 | 12 | 0 | 1961 | sí |
| `ELECTRONICA` | `electronica` | 32 | 12 | 0 | 0 | sí |
| `MOCHILAS` | `mochilas` | 6537 | 12 | 0 | 72 | sí |
| `JUGUETES` | `juguetes` | 9753 | 9 | 0 | 0 | sí |
| `SERVIDORES` | `servidores` | 6942 | 9 | 0 | 2393 | sí |
| `HANDY / HANDIES` | `handy-handies` | 2545 | 7 | 0 | 2275 | sí |
| `CALEFACCION` | `calefaccion` | 10199 | 1 | 0 | 180 | sí |

## Marcas (22)

| # | Marca | slug |
| --- | --- | --- |
| 1 | Apple | `apple` |
| 2 | Asus | `asus` |
| 3 | Canon | `canon` |
| 4 | Dell | `dell` |
| 5 | DJI | `dji` |
| 6 | Ezviz | `ezviz` |
| 7 | Garmin | `garmin` |
| 8 | Hp | `hp` |
| 9 | Huawei | `huawei` |
| 10 | Infinix | `infinix` |
| 11 | JBL | `jbl` |
| 12 | Lenovo | `lenovo` |
| 13 | Logitech | `logitech` |
| 14 | Motorola | `motorola` |
| 15 | MSI | `msi` |
| 16 | Nikon | `nikon` |
| 17 | Panasonic | `panasonic` |
| 18 | Realme | `realme` |
| 19 | Samsung | `samsung` |
| 20 | Sony | `sony` |
| 21 | TP-Link | `tp-link` |
| 22 | Xiaomi | `xiaomi` |

## Tags (3950 en total, muestra de 300)

`10-20mm-gran-angular`, `10-metros`, `100-400mm-contemporary`, `1000va`, `100hz`, `10gb`, `11-iphone`, `12-24mm`, `12-24mm-f4`, `12-nucleos`, `1200va`, `128gb-almacenamiento`, `12gb-ram`, `12mm-f1-4-contemporary`, `135mm-f1-8`, `14-pro-max`, `150-600mm-sport`, `16-300mm-contemporary`, `16-30mm-f2-8`, `16-35`, `16-35mm`, `1600va`, `16gb`, `16gb-3200mhz`, `16gb-4800mhz`, `16gb-5600mhz`, `16gb-gaming`, `16gb-ram`, `16gb-ram-1tb`, `16gb-ram-512gb`, `17-40mm-f1-8`, `17-50mm-f4`, `18-300mm-sony`, `18-35mm-f1-8`, `180hz`, `1tb-ssd`, `20-2000mm-contemporary`, `2000va`, `210hz`, `2200va`, `23200110`, `24-35mm-f2`, `24-70mm-f-2-8`, `24-70mm-f2-8`, `24-70mm-f4`, `24gb-ram`, `256gb-12gb-ram`, `256gb-8gb-ram`, `256gb-almacenamiento`, `256gb-ssd`, `256gb-storage`, `2666mhz`, `26mm-f2-8`, `28-105-f2-8`, `28-45mm-f1-8`, `2tb-ssd`, `300-mbps`, `3000va`, `300mbps`, `31310019401`, `31310055401`, `3200mhz`, `3200mhz-gaming`, `32gb-3200mhz`, `32gb-3600mhz`, `32gb-gaming`, `32gb-ram-gaming`, `3450w`, `350w`, `35mm`, `35mm-f1-2`, `35mm-f1-4`, `35mm-f1-8`, `3600mhz`, `36gb-ram`, `3d-v-cache`, `3s`, `48gb-ram`, `48gb-ram-profesional`, `4gb`, `5-puertos`, `50mm`, `50mm-f1-4`, `50mm-f1-4-art`, `512gb-almacenamiento`, `512gb-ssd`, `5500w`, `5600g`, `5600mhz`, `5600mhz-gaming`, `5d`, `5d-mark-iv`, `5e`, `5mp`, `60-600mm-sony`, `6000mhz`, `600va`, `600w`, `64gb-almacenamiento`, `6gb-ram`, `70-200-f2-8`, `750w-modular`, `80-bronce`, `80-gold-modular`, `80-plus-bronce`, `80-plus-gold`, `820`, `822n`, `850-re`, `8gb-5600mhz`, `8gb-ram`, `8gb-ram-256gb`, `8gb-ram-512gb-ssd`, `9103-53748-rh`, `9103-53862xe2-00`, `9103-73887xe2-00`, `9105-32344-rh`, `9105-62201-rh`, `9106-52217ea1`, `920-004422`, `920-007820`, `920-013052`, `9e`, `9px`, `9sx`, `a400-240gb`, `ac1300`, `ac1900`, `ac750`, `acces-point`, `accesorio`, `accesorio-oficina`, `accesorios`, `accesorios-camara`, `accesorios-de-camara`, `accesorios-dron`, `accesorios-fotografia-sony`, `accesorios-gaming`, `accesorios-gopro`, `accesorios-nikon`, `accesorios-nikon-z`, `accesorios-pc-gaming`, `accesorios-servidor`, `access-point`, `acero-inoxidable`, `activetrack`, `activetrack-360`, `actualizacion-pc`, `adaptador-150-mbps`, `adaptador-bluetooth-auto`, `adaptador-carplay-inalambrico`, `adaptador-de-montura-nikon`, `adaptador-ethernet-wifi`, `adaptador-hdmi`, `adaptador-inalambrico`, `adaptador-montura-canon-r`, `adaptador-multiconector`, `adaptador-samsung`, `adaptador-usb-inalambrico-tenda`, `adaptador-usb-tipo-c`, `adaptador-usb-wifi`, `adaptador-usb-wifi-dual`, `adaptador-wifi-linksys`, `adaptador-wifi-pc`, `adaptador-wifi-pci-express`, `adaptador-wifi-usb`, `adata-16gb`, `adata-3200mhz`, `adata-32gb`, `adata-5600mhz`, `adata-8gb`, `aerocool-abyss`, `aerocool-cylon-700w`, `aerocool-designer`, `aerocool-falcon-gaming`, `aerocool-oasis`, `aerocool-ore-saturn`, `aerocool-tern-mini`, `ai-sound-boost`, `airdpods-originales`, `aire`, `aire-aconcionado`, `aire-acondicionado`, `aire-acondicionado-3300`, `aire-acondicionado-5000`, `aire-acondicionado-alaska-bgh`, `aire-acondicionado-digital-inverter`, `aire-acondicionado-frio-calor`, `aire-acondicionado-inverter`, `aire-acondicionado-inverter-5300w`, `aire-acondicionado-portatil`, `aire-acondicionado-samsung`, `aire-acondicionado-samsung-inverter`, `aire-acondicionado-split`, `aire-frio-calor`, `aire-inverter`, `aires-acondicionados`, `aires-acondicionados-cordoba`, `aires-acondicionados-inverter`, `aires-aconidicionados`, `airpods-pro-segunda-generacion`, `alarma`, `alarma-inteligente`, `alimentacion-eficiente`, `alimentacion-pc`, `alimentacion-pc-gaming`, `alimentacion-rgb-pc`, `alimentador-automatico-80-hojas`, `almacenamiento-1tb`, `almacenamiento-1tb-ssd`, `almacenamiento-256gb`, `almacenamiento-2tb`, `almacenamiento-480gb`, `almacenamiento-4tb`, `almacenamiento-dvr`, `almacenamiento-empresarial`, `almacenamiento-gaming`, `almacenamiento-interno`, `almacenamiento-nvme`, `almacenamiento-nvr`, `almacenamiento-pc`, `almacenamiento-pcie-gen3`, `almacenamiento-pcie-nvme`, `almacenamiento-portatil`, `almacenamiento-rapido`, `almacenamiento-servidor`, `almacenamiento-ssd`, `almacenamiento-videovigilancia`, `alpha`, `alpha-6700`, `alpha-a6400`, `alpha-a6700`, `alpha-a7`, `alpha-a7-iii`, `alpha-a7-iv`, `alpha-zve10-ii`, `alta-definicion`, `alta-velocidad`, `altavoz-800w-potencia`, `altavoz-inalambrico`, `am5-ddr5`, `amazon-alexa`, `amazon-e-reader`, `amazon-ereader`, `amazon-fire`, `amazon-kindle`, `amd-32mb-cache`, `amd-5700g`, `amd-athlon`, `amd-athlon-3000g`, `amd-box-cooler`, `amd-rx-580`, `amd-rx580`, `amd-ryzen`, `amd-ryzen-3`, `amd-ryzen-3-3200g`, `amd-ryzen-3-5300g`, `amd-ryzen-3200g`, `amd-ryzen-5`, `amd-ryzen-5-7600x`, `amd-ryzen-5-8500g`, `amd-ryzen-5-8600g`, `amd-ryzen-5-9600x`, `amd-ryzen-5500`, `amd-ryzen-5500h`, `amd-ryzen-5600gt`, `amd-ryzen-7-5700g`, `amd-ryzen-7-8700f`, `amd-ryzen-7-8700g`, `amd-ryzen-7-9800x3d`, `amd-ryzen-7000`, `amd-ryzen-9900x`, `amd-ryzen-compatible`, `amoladora`, `amp`, `amplificador-senal`, `amplificador-senal-wifi`, `anafe-electrico`, `anafe-winco-doble`, `anafes-electricos`, `android-256gb`, `android-4gb-ram`, `android-6gb-ram`, `android-8gb-ram`, `android-economico`, `android-motorola`, `android-premium`, `android-xiaomi`, `antena-wifi-150-mbps`, `antenas-wifi`, `apc`, `apc-modbus`, `apc-netshelter`, `apc-smart-ups`, `apc-srt-rail-kit`, `apertura-f-1-4`, `apertura-f-2`, `apertura-f-2-8`, `apertura-f1-4`, `cpu-cooler`

## Mapeo de precios y flags (muestra de 50 productos)

| slug | nombre | precio | precio lista | stock | marca | cats | highlights | chars desc | imgs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `samsung-galaxy-z-fold-8-ultra-5g-512gb-12gb` | Samsung Galaxy Z Fold 8 Ultra 5G 512gb 12gb | $34.600 | $50.000 | 1 | Samsung | 2 | 6 | 5958 | 1 |
| `samsung-galaxy-z-fold-8-5g-512gb-12gb` | Samsung Galaxy Z Fold 8 5G 512gb 12gb | $30.000 | $40.000 | 1 | Samsung | 2 | 2 | 5617 | 1 |
| `samsung-galaxy-z-flip-8-5g-512gb-12gb` | Samsung Galaxy Z Flip 8 5G 512gb 12gb | $21.900 | $26.000 | 1 | Samsung | 2 | 3 | 5376 | 1 |
| `samsung-galaxy-z-flip-8-5g-256gb-12gb` | Samsung Galaxy Z Flip 8 5G 256gb 12gb | $19.000 | $24.000 | 1 | Samsung | 2 | 3 | 5376 | 1 |
| `parlante-jbl-xtreme-4` | Parlante JBL Xtreme 4 | $5.300 | $7.000 | 1 | JBL | 4 | 3 | 4945 | 2 |
| `parlante-jbl-boombox-4` | Parlante JBL Boombox 4 | $8.650 | $10.000 | 1 | JBL | 4 | 2 | 5113 | 2 |
| `dron-dji-mini-5-pro-rc2-bundle-4-baterias` | Dron DJI Mini 5 Pro RC2 Bundle 4 Baterias | $22.800 | $28.000 | 1 | DJI | 1 | 5 | 5503 | 2 |
| `macbook-pro-m5-pro-14%e2%80%b3-24gb-1tb-silver` | MacBook Pro M5 Pro 14″ 24gb 1tb Silver | $48.000 | $60.000 | 1 | Apple | 4 | 3 | 5547 | 2 |
| `samsung-galaxy-s26-fe-5g-256gb-8gb` | Samsung Galaxy S26 Fe 5G 256gb 8gb | $12.600 | $18.000 | 1 | Samsung | 3 | 2 | 5497 | 2 |
| `notebook-lenovo-ideapad-ryzen-5-40-8gb-256gb-ssd-15-6%e2%80%b3-fhd-w11-abyss-blue` | Notebook Lenovo Ideapad Ryzen 5 40 8GB 256GB SSD 15. | $10.000 | $13.000 | 1 | Lenovo | 6 | 3 | 5143 | 4 |
| `auriculares-bluetooth-jbl-tune-730bt-white` | Auriculares Bluetooth JBL Tune 730BT White | $1.100 | $1.800 | 1 | JBL | 3 | 2 | 4551 | 2 |
| `xiaomi-redmi-note-17-5g-256gb-6gb` | Xiaomi Redmi Note 17 5G 256gb 6gb | $5.600 | $7.000 | 1 | Xiaomi | 2 | 3 | 4711 | 4 |
| `xiaomi-redmi-note-17-pro-5g-256gb-8gb` | Xiaomi Redmi Note 17 Pro 5G 256gb 8gb | $7.000 | $10.000 | 1 | Xiaomi | 2 | 3 | 4981 | 2 |
| `xiaomi-redmi-note-17-pro-max-5g-256gb-8gb` | Xiaomi Redmi Note 17 Pro Max 5G 256gb 8gb | $8.650 | $10.000 | 1 | Xiaomi | 2 | 3 | 5055 | 2 |
| `xiaomi-redmi-note-17-pro-max-5g-512gb-12gb` | Xiaomi Redmi Note 17 Pro Max 5G 512gb 8gb | $10.000 | $13.000 | 1 | Xiaomi | 2 | 3 | 5070 | 2 |
| `iphone-18-pro-max-512gb` | iPhone 18 Pro Max 512gb | $33.000 | - | 1 | Apple | 2 | 5 | 5169 | 4 |
| `iphone-18-pro-max-256gb` | iPhone 18 Pro Max 256gb | $29.000 | - | 1 | Apple | 2 | 6 | 5165 | 4 |
| `iphone-18-pro-256gb` | iPhone 18 Pro 256gb | $26.400 | - | 1 | Apple | 2 | 5 | 5224 | 1 |
| `camara-ip-tp-link-tapo-c201-ptz-full-hd-1080p` | Camara IP Tp-Link Tapo C201 PTZ Full HD 1080P | $450 | $500 | 1 | TP-Link | 2 | 4 | 3664 | 3 |
| `tablet-xiaomi-redmi-pad-2-256gb-4gb-11` | Tablet Xiaomi Redmi Pad 2 256gb 4gb 11&#8243; | $4.500 | $7.000 | 1 | Xiaomi | 2 | 5 | 1104 | 2 |
| `xiaomi-redmi-note-14-5g-256gb-8gb-2` | Xiaomi Redmi Note 14 5G 256gb 8gb | $4.600 | $6.980 | 1 | Xiaomi | 3 | 0 | 3443 | 2 |
| `motorola-moto-g06-128gb-4gb-2` | Motorola Moto G06 128gb 4gb | $2.750 | $3.500 | 1 | Motorola | 3 | 3 | 4452 | 2 |
| `motorola-moto-g06-64gb-4gb` | Motorola Moto G06 64gb 4gb | $2.200 | $2.500 | 1 | Motorola | 3 | 3 | 4449 | 2 |
| `garmin-forerunner-55` | Garmin Forerunner 55 | $3.650 | $5.000 | 1 | Garmin | 2 | 6 | 5295 | 2 |
| `motorola-moto-signature-5g-1tb-16gb` | Motorola Moto Signature 5G 1tb 16gb | $21.600 | $24.000 | 1 | Motorola | 2 | 6 | 5083 | 2 |
| `xiaomi-poco-f9-ultra-5g-512gb-12gb` | Xiaomi Poco F9 Ultra 5G 512gb 12gb | $18.200 | $24.000 | 1 | Xiaomi | 2 | 3 | 4524 | 2 |
| `xiaomi-poco-f9-ultra-5g-256gb-12gb` | Xiaomi Poco F9 Ultra 5G 256gb 12gb | $17.000 | $22.000 | 1 | Xiaomi | 2 | 3 | 4562 | 2 |
| `xiaomi-redmi-note-17-256gb-8gb` | Xiaomi Redmi Note 17 256gb 8gb | $5.500 | $7.000 | 1 | Xiaomi | 2 | 2 | 4171 | 3 |
| `notebook-dell-i7-1355u-16gb-ssd-512gb-156-fhd-touchscreen` | Notebook Dell i7-1355U 16gb SSD 512gb 15,6&#8243; FH | $16.600 | $20.000 | 1 | Dell | 5 | 4 | 4729 | 1 |
| `filmadora-panasonic-hc-v900-hd` | Filmadora Panasonic HC-V900 HD | $15.000 | $24.000 | 1 | Panasonic | 3 | 3 | 4640 | 2 |
| `dji-osmo-mobile-8p-creator-combo` | Dji Osmo Mobile 8P Creator Combo | $6.250 | $9.000 | 1 | DJI | 4 | 3 | 4632 | 2 |
| `monopatin-electrico-daihatsu-v301` | Monopatin Electrico Daihatsu V301 | $20.700 | $25.000 | 1 | General | 1 | 0 | 3971 | 2 |
| `monopatin-electrico-daihatsu-v401` | Monopatin Electrico Daihatsu V401 | $20.700 | $25.000 | 1 | General | 1 | 0 | 3845 | 2 |
| `monopatin-electrico-daihatsu-v400` | Monopatin Electrico Daihatsu V400 | $15.300 | $19.000 | 1 | General | 1 | 0 | 3973 | 2 |
| `monopatin-electrico-daihatsu-v300` | Monopatin Electrico Daihatsu V300 | $15.300 | $19.000 | 1 | General | 1 | 0 | 3950 | 2 |
| `monopatin-electrico-daihatsu-v201` | Monopatin Electrico Daihatsu V201 | $11.700 | $14.000 | 1 | General | 1 | 3 | 4031 | 2 |
| `monopatin-electrico-daihatsu-v200` | Monopatin Electrico Daihatsu V200 | $9.500 | $12.000 | 1 | General | 1 | 3 | 3791 | 2 |
| `monopatin-electrico-daihatsu-v101` | Monopatin Electrico Daihatsu V101 | $6.200 | $8.000 | 1 | General | 1 | 3 | 3887 | 2 |
| `monopatin-electrico-daihatsu-v100` | Monopatin Electrico Daihatsu V100 | $5.500 | $7.000 | 1 | General | 1 | 3 | 3968 | 2 |
| `volante-logitech-g29-racing-pc-ps3-ps4-ps5` | Volante Logitech G29 Racing PC PS3 PS4 PS5 | $5.600 | $8.000 | 1 | General | 2 | 2 | 4579 | 7 |
| `xiaomi-17t-pro-5g-512gb-12gb-2` | Xiaomi 17T Pro 5G 512gb 12gb | $15.500 | $19.000 | 1 | Xiaomi | 2 | 4 | 4691 | 4 |
| `dron-dji-mavic-4-pro-512gb-creator-combo` | Dron DJI Mavic 4 Pro 512gb Creator Combo | $70.000 | $90.000 | 1 | DJI | 1 | 4 | 4857 | 2 |
| `disco-duro-externo-adata-4tb-slim` | Disco Duro Externo Adata 4TB Slim | $3.200 | $3.800 | 1 | General | 2 | 0 | 4150 | 2 |
| `pendrive-hiksemi-64gb-usb-2-0` | Pendrive Hiksemi 64gb USB 2.0 | $200 | $260 | 1 | General | 2 | 0 | 3791 | 3 |
| `dron-dji-lito-x1-fly-more-combo-rc2` | Dron DJI Lito X1 Fly More Combo RC2 | $15.000 | $20.000 | 1 | DJI | 1 | 6 | 5359 | 2 |
| `dron-dji-lito-x1-fly-more-combo-rc-n3` | Dron DJI Lito X1 Fly More Combo RC-N3 | $13.000 | $16.000 | 1 | DJI | 1 | 4 | 4904 | 2 |
| `dron-dji-lito-1-fly-more-combo-rc-n3` | Dron DJI Lito 1 Fly More Combo RC-N3 | $11.000 | $14.000 | 1 | DJI | 1 | 4 | 4695 | 2 |
| `meta-quest-3s-256gb` | Meta Quest 3s 256gb | $11.000 | $15.000 | 1 | General | 2 | 0 | 4798 | 3 |
| `dron-dji-mini-5-pro-fly-more-combo-rc2` | Dron Dji Mini 5 Pro Fly More Combo RC2 | $24.000 | $30.000 | 1 | DJI | 1 | 4 | 5403 | 5 |
| `monopatin-xiaomi-electric-scooter-6-ultra` | Monopatin Xiaomi Electric Scooter 6 Ultra | $17.300 | $22.000 | 1 | Xiaomi | 1 | 3 | 5278 | 7 |

## Reconciliación API vs sitemaps

- Solo en la API (no indexados): **209**
- Solo en sitemaps (no en la API): **0**

- `samsung-galaxy-z-fold-8-ultra-5g-512gb-12gb`
- `samsung-galaxy-z-fold-8-5g-512gb-12gb`
- `samsung-galaxy-z-flip-8-5g-512gb-12gb`
- `samsung-galaxy-z-flip-8-5g-256gb-12gb`
- `notebook-dell-inspiron-15-i5-1334u-8gb-ssd-512gb-156-fhd-touchscreen-w11`
- `motorola-moto-edge-60-fusion-5g-256gb-12gb`
- `motorola-moto-g15-power-512gb-8gb-slim`
- `motorola-moto-g15-power-256gb-8gb-slim`
- `netmak-teclado-gamer-mecanico-retroiluminado-usb-nm-alliance`
- `netmak-teclado-gamer-mecanico-retroiluminado-usb-apoya-muneca-nm-legend`
- `netmak-pad-mouse-gamer-grande-90x40cm-negro-nm-mp758`
- `netmak-teclado-y-mouse-minimalista-led-usb-nm-tm34`
- `mother-ecs-h610h7-m2-h-v-dp-ddr4-1700-bulk`
- `mother-ecs-a520am4-m3d-h-v-am4`
- `cpu-cooler-liquido-aerocool-abyss-l360r-digi-3x-120mm-fan-argb-suport-soket-1851-1700-1200-115x-a`
- `cpu-cooler-aerocool-oasis-l240-argb-2x-120mm-fan-liquida-suport-soket-1700-am5`
- `gabinete-msi-mag-shield-m301-micro-atx-mini-atx-1fan`
- `cpu-hpe-intel-xeon-silver-4510-12c-2`
- `bateria-ext-eaton-9px-240v-gen-2-p-ups-11kva`
- `bateria-eaton-9e-ebm240-p-ups10-20kva-al-2`
- `bateria-apc-easy-srv-36v-1kva-torre-2`
- `apc-tarjeta-snmp-card-p-smart-ups`
- `apc-sensor-temp-p-centro-datos-c-pantalla-2`
- `apc-sensor-monit-acceso-p-netshelter-sx-12ft-demo-2`
- `apc-netshelter-sx-42u-48u-baying-trim-kit-black-2`
- `apc-modbus-jbus-interface-card-2`
- `apc-bateria-de-reemplazo-cartucho-140-2`
- `camara-ip-cloud-tp-link-tapo-c500-ptz-exterior-360`
- `camara-ip-2mp-ezviz-h3c-2-8mm-exterior-expo`
- `camara-4mp-hikvision-easylink-kit-nks424w03h`
- `camara-2mp-hikvision-easylink-kit-nks422w0h`
- `camara-2mp-hikvision-easylink-kit-nks422w03h`
- `monitor-27-asus-xg27ucs-j-rog-s-caja-danada`
- `monitor-27-gamemax-180hz-ips-fhd-hdmi-dport-pixel`
- `monitor-27-gamemax-100hz-ips-fhd-hdmi-vga-pixel`
- `monitor-19-cx-185h-vga-hdmi-vesa-expo`
- `gab-perf-kitx3-6810-tecmoupsu-500w`
- `router-3p-mercusys-mw325r-300mbps`
- `router-3p-mercusys-mw305r-300mbps`
- `router-3p-mercusys-mr25be-be3600`



## Redirecciones 301 (WooCommerce → Next.js)

| Origen (WP) | Destino (Next) |
| --- | --- |
| /categoria-producto/accesorios-p-celulares/ | /categoria/accesorios-p-celulares |
| /categoria-producto/conectividad/access-point/ | /categoria/conectividad/access-point |
| /categoria-producto/accesorios-p-celulares/adaptadores/ | /categoria/accesorios-p-celulares/adaptadores |
| /categoria-producto/aires-acondicionados/ | /categoria/aires-acondicionados |
| /categoria-producto/computacion/computadoras-de-escritorio/amd/ | /categoria/computacion/computadoras-de-escritorio/amd |
| /categoria-producto/electrodomesticos-cordoba/anafe-electrico/ | /categoria/electrodomesticos-cordoba/anafe-electrico |
| /categoria-producto/computacion/notebooks-cordoba/apple-notebooks/ | /categoria/computacion/notebooks-cordoba/apple-notebooks |
| /categoria-producto/electrodomesticos-cordoba/aspiradoras/ | /categoria/electrodomesticos-cordoba/aspiradoras |
| /categoria-producto/electrodomesticos-cordoba/aspiradoras-robot/ | /categoria/electrodomesticos-cordoba/aspiradoras-robot |
| /categoria-producto/computacion/notebooks-cordoba/asus/ | /categoria/computacion/notebooks-cordoba/asus |
| /categoria-producto/audio-y-video/ | /categoria/audio-y-video |
| /categoria-producto/accesorios-p-celulares/auriculares/ | /categoria/accesorios-p-celulares/auriculares |
| /categoria-producto/electrodomesticos-cordoba/batidoras/ | /categoria/electrodomesticos-cordoba/batidoras |
| /categoria-producto/conectividad/cableado-estructurado/ | /categoria/conectividad/cableado-estructurado |
| /categoria-producto/accesorios-p-celulares/cables-usb/ | /categoria/accesorios-p-celulares/cables-usb |
| /categoria-producto/electrodomesticos-cordoba/cafeteras/ | /categoria/electrodomesticos-cordoba/cafeteras |
| /categoria-producto/sistemas-de-seguridad/cajas-de-seguridad-caja-fuerte/ | /categoria/sistemas-de-seguridad/cajas-de-seguridad-caja-fuerte |
| /categoria-producto/computacion/calculadoras-cientificas/ | /categoria/computacion/calculadoras-cientificas |
| /categoria-producto/calefaccion/ | /categoria/calefaccion |
| /categoria-producto/electrodomesticos-cordoba/calefactores-estufas/ | /categoria/electrodomesticos-cordoba/calefactores-estufas |
| /categoria-producto/camaras-digitales/camaras-compactas/ | /categoria/camaras-digitales/camaras-compactas |
| /categoria-producto/camaras-digitales/ | /categoria/camaras-digitales |
| /categoria-producto/camaras-digitales/camaras-gopro/ | /categoria/camaras-digitales/camaras-gopro |
| /categoria-producto/sistemas-de-seguridad/camaras-ip/ | /categoria/sistemas-de-seguridad/camaras-ip |
| /categoria-producto/camaras-digitales/camaras-reflex/ | /categoria/camaras-digitales/camaras-reflex |
| /categoria-producto/camaras-digitales/camaras-semi-reflex-bridge/ | /categoria/camaras-digitales/camaras-semi-reflex-bridge |
| /categoria-producto/camaras-digitales/camaras-reflex/canon/ | /categoria/camaras-digitales/camaras-reflex/canon |
| /categoria-producto/accesorios-p-celulares/cargadores/ | /categoria/accesorios-p-celulares/cargadores |
| /categoria-producto/celulares-cordoba/ | /categoria/celulares-cordoba |
| /categoria-producto/celulares-cordoba/celulares-google/ | /categoria/celulares-cordoba/celulares-google |
| /categoria-producto/celulares-cordoba/celulares-huawei/ | /categoria/celulares-cordoba/celulares-huawei |
| /categoria-producto/celulares-cordoba/celulares-por-menos-de-300-000/ | /categoria/celulares-cordoba/celulares-por-menos-de-300-000 |
| /categoria-producto/celulares-cordoba/celulares-por-menos-de-500-000/ | /categoria/celulares-cordoba/celulares-por-menos-de-500-000 |
| /categoria-producto/computacion/combo-de-actualizacion/ | /categoria/computacion/combo-de-actualizacion |
| /categoria-producto/computacion/ | /categoria/computacion |
| /categoria-producto/computacion/computadoras-all-in-one/ | /categoria/computacion/computadoras-all-in-one |
| /categoria-producto/computacion/computadoras-de-escritorio/ | /categoria/computacion/computadoras-de-escritorio |
| /categoria-producto/conectividad/ | /categoria/conectividad |
| /categoria-producto/consolas-playstation/ | /categoria/consolas-playstation |
| /categoria-producto/audio-y-video/convertidor-smart-tv/ | /categoria/audio-y-video/convertidor-smart-tv |
| /categoria-producto/electrodomesticos-cordoba/cortadora-de-pelo-y-barba/ | /categoria/electrodomesticos-cordoba/cortadora-de-pelo-y-barba |
| /categoria-producto/computacion/notebooks-cordoba/dell/ | /categoria/computacion/notebooks-cordoba/dell |
| /categoria-producto/computacion/disco-ssd-hdd/ | /categoria/computacion/disco-ssd-hdd |
| /categoria-producto/computacion/discos-duros-externos/ | /categoria/computacion/discos-duros-externos |
| /categoria-producto/computacion/notebooks-cordoba/diseno-grafico/ | /categoria/computacion/notebooks-cordoba/diseno-grafico |
| /categoria-producto/drones/ | /categoria/drones |
| /categoria-producto/electrodomesticos-cordoba/ | /categoria/electrodomesticos-cordoba |
| /categoria-producto/electronica/ | /categoria/electronica |
| /categoria-producto/computacion/estabilizadores-ups/ | /categoria/computacion/estabilizadores-ups |
| /categoria-producto/conectividad/extensor-de-senal-wifi/ | /categoria/conectividad/extensor-de-senal-wifi |
| /categoria-producto/camaras-digitales/filmadoras-videocamaras/ | /categoria/camaras-digitales/filmadoras-videocamaras |
| /categoria-producto/camaras-digitales/flash/ | /categoria/camaras-digitales/flash |
| /categoria-producto/electrodomesticos-cordoba/freidoras/ | /categoria/electrodomesticos-cordoba/freidoras |
| /categoria-producto/computacion/fuentes-pc/ | /categoria/computacion/fuentes-pc |
| /categoria-producto/camaras-digitales/camaras-reflex/fujifilm/ | /categoria/camaras-digitales/camaras-reflex/fujifilm |
| /categoria-producto/computacion/gabinetes/ | /categoria/computacion/gabinetes |
| /categoria-producto/celulares-cordoba/samsung/galaxy-serie-a/ | /categoria/celulares-cordoba/samsung/galaxy-serie-a |
| /categoria-producto/celulares-cordoba/samsung/galaxy-serie-s/ | /categoria/celulares-cordoba/samsung/galaxy-serie-s |
| /categoria-producto/computacion/notebooks-cordoba/gamer/ | /categoria/computacion/notebooks-cordoba/gamer |
| /categoria-producto/computacion/notebooks-cordoba/gateway/ | /categoria/computacion/notebooks-cordoba/gateway |
| /categoria-producto/camaras-digitales/gimbals-estabilizadores/ | /categoria/camaras-digitales/gimbals-estabilizadores |
| /categoria-producto/handy-handies/ | /categoria/handy-handies |
| /categoria-producto/electrodomesticos-cordoba/heladeras-y-frezzer/ | /categoria/electrodomesticos-cordoba/heladeras-y-frezzer |
| /categoria-producto/herramientas/ | /categoria/herramientas |
| /categoria-producto/electrodomesticos-cordoba/hornos-electricos/ | /categoria/electrodomesticos-cordoba/hornos-electricos |
| /categoria-producto/computacion/notebooks-cordoba/hp-notebooks/ | /categoria/computacion/notebooks-cordoba/hp-notebooks |
| /categoria-producto/impresoras-cordoba/impresoras-3d/ | /categoria/impresoras-cordoba/impresoras-3d |
| /categoria-producto/impresoras-cordoba/ | /categoria/impresoras-cordoba |
| /categoria-producto/impresoras-cordoba/impresoras-para-el-hogar/ | /categoria/impresoras-cordoba/impresoras-para-el-hogar |
| /categoria-producto/impresoras-cordoba/impresoras-para-gigantografias/ | /categoria/impresoras-cordoba/impresoras-para-gigantografias |
| /categoria-producto/impresoras-cordoba/impresoras-para-la-oficina/ | /categoria/impresoras-cordoba/impresoras-para-la-oficina |
| /categoria-producto/celulares-cordoba/infinix/ | /categoria/celulares-cordoba/infinix |
| /categoria-producto/computacion/computadoras-de-escritorio/intel/ | /categoria/computacion/computadoras-de-escritorio/intel |
| /categoria-producto/celulares-cordoba/iphone-cordoba/ | /categoria/celulares-cordoba/iphone-cordoba |
| /categoria-producto/computacion/joystick/ | /categoria/computacion/joystick |
| /categoria-producto/electrodomesticos-cordoba/jugueras-y-exprimidores/ | /categoria/electrodomesticos-cordoba/jugueras-y-exprimidores |
| /categoria-producto/juguetes/ | /categoria/juguetes |
| /categoria-producto/electrodomesticos-cordoba/lavarropas/ | /categoria/electrodomesticos-cordoba/lavarropas |
| /categoria-producto/camaras-digitales/lentes-objetivos/ | /categoria/camaras-digitales/lentes-objetivos |
| /categoria-producto/camaras-digitales/lentes-objetivos/lentes-para-canon/ | /categoria/camaras-digitales/lentes-objetivos/lentes-para-canon |
| /categoria-producto/camaras-digitales/lentes-objetivos/lentes-para-nikon/ | /categoria/camaras-digitales/lentes-objetivos/lentes-para-nikon |
| /categoria-producto/camaras-digitales/lentes-objetivos/lentes-para-sony/ | /categoria/camaras-digitales/lentes-objetivos/lentes-para-sony |
| /categoria-producto/electrodomesticos-cordoba/licuadoras/ | /categoria/electrodomesticos-cordoba/licuadoras |
| /categoria-producto/electrodomesticos-cordoba/mates/ | /categoria/electrodomesticos-cordoba/mates |
| /categoria-producto/computacion/memoria-ram/ | /categoria/computacion/memoria-ram |
| /categoria-producto/electrodomesticos-cordoba/microondas/ | /categoria/electrodomesticos-cordoba/microondas |
| /categoria-producto/computacion/microprocesadores/ | /categoria/computacion/microprocesadores |
| /categoria-producto/mochilas/ | /categoria/mochilas |
| /categoria-producto/computacion/monitores-led/ | /categoria/computacion/monitores-led |
| /categoria-producto/monopatines-electricos/ | /categoria/monopatines-electricos |
| /categoria-producto/computacion/motherboards-placas-madre/ | /categoria/computacion/motherboards-placas-madre |
| /categoria-producto/celulares-cordoba/motorola/ | /categoria/celulares-cordoba/motorola |
| /categoria-producto/computacion/notebooks-cordoba/msi/ | /categoria/computacion/notebooks-cordoba/msi |
| /categoria-producto/muebles/ | /categoria/muebles |
| /categoria-producto/camaras-digitales/camaras-reflex/nikon/ | /categoria/camaras-digitales/camaras-reflex/nikon |
| /categoria-producto/camaras-digitales/camaras-semi-reflex-bridge/nikon-camaras-semi-reflex-bridge/ | /categoria/camaras-digitales/camaras-semi-reflex-bridge/nikon-camaras-semi-reflex-bridge |
| /categoria-producto/computacion/notebooks-cordoba/ | /categoria/computacion/notebooks-cordoba |
| /categoria-producto/computacion/notebooks-cordoba/notebooks-lenovo/ | /categoria/computacion/notebooks-cordoba/notebooks-lenovo |
| /categoria-producto/audio-y-video/paneles-interactivos/ | /categoria/audio-y-video/paneles-interactivos |
| /categoria-producto/accesorios-p-celulares/parlantes-bluetooth/ | /categoria/accesorios-p-celulares/parlantes-bluetooth |
| /categoria-producto/audio-y-video/parlantes-cordoba/ | /categoria/audio-y-video/parlantes-cordoba |
| /categoria-producto/electrodomesticos-cordoba/pavas-electricas/ | /categoria/electrodomesticos-cordoba/pavas-electricas |
| /categoria-producto/computacion/perifericos-pc/ | /categoria/computacion/perifericos-pc |
| /categoria-producto/conectividad/placas-de-red/ | /categoria/conectividad/placas-de-red |
| /categoria-producto/computacion/placas-de-video/ | /categoria/computacion/placas-de-video |
| /categoria-producto/electrodomesticos-cordoba/planchas/ | /categoria/electrodomesticos-cordoba/planchas |
| /categoria-producto/audio-y-video/proyectores/ | /categoria/audio-y-video/proyectores |
| /categoria-producto/celulares-cordoba/realme/ | /categoria/celulares-cordoba/realme |
| /categoria-producto/conectividad/router/ | /categoria/conectividad/router |
| /categoria-producto/conectividad/router-ap/ | /categoria/conectividad/router-ap |
| /categoria-producto/celulares-cordoba/samsung/ | /categoria/celulares-cordoba/samsung |
| /categoria-producto/servidores/ | /categoria/servidores |
| /categoria-producto/computacion/sillas-gamer/ | /categoria/computacion/sillas-gamer |
| /categoria-producto/sistemas-de-seguridad/ | /categoria/sistemas-de-seguridad |
| /categoria-producto/accesorios-p-celulares/smartwatch-cordoba/ | /categoria/accesorios-p-celulares/smartwatch-cordoba |
| /categoria-producto/camaras-digitales/camaras-reflex/sony-camaras-reflex/ | /categoria/camaras-digitales/camaras-reflex/sony-camaras-reflex |
| /categoria-producto/impresoras-cordoba/sublimacion/ | /categoria/impresoras-cordoba/sublimacion |
| /categoria-producto/conectividad/switch/ | /categoria/conectividad/switch |
| /categoria-producto/computacion/tablet/ | /categoria/computacion/tablet |
| /categoria-producto/computacion/tarjetas-de-memoria/ | /categoria/computacion/tarjetas-de-memoria |
| /categoria-producto/conectividad/telefonia/ | /categoria/conectividad/telefonia |
| /categoria-producto/audio-y-video/televisores/ | /categoria/audio-y-video/televisores |
| /categoria-producto/electrodomesticos-cordoba/termos/ | /categoria/electrodomesticos-cordoba/termos |
| /categoria-producto/electrodomesticos-cordoba/tostadoras/ | /categoria/electrodomesticos-cordoba/tostadoras |
| /categoria-producto/conectividad/switch/tp-link/ | /categoria/conectividad/switch/tp-link |
| /categoria-producto/computacion/notebooks-cordoba/uso-domestico/ | /categoria/computacion/notebooks-cordoba/uso-domestico |
| /categoria-producto/computacion/notebooks-cordoba/uso-oficina/ | /categoria/computacion/notebooks-cordoba/uso-oficina |
| /categoria-producto/celulares-cordoba/xiaomi-cordoba/ | /categoria/celulares-cordoba/xiaomi-cordoba |

## Mapeo de campos

| Campo Next.js | Origen WooCommerce | Nota |
| --- | --- | --- |
| `products.slug` | `slug` | 1:1 exacto, sin cambios |
| `products.sku` | `sku` | |
| `products.name` | `name` | |
| `products.brand` | `brands[0].name` | fallback `General` (2355 sin marca) |
| `products.categorySlug` | categoría raíz más cercana | sigue siendo la principal para compatibilidad |
| `productCategories` | `categories[]` | puente para el 42.7% multi-categoría |
| `products.price` | `prices.price` | centavos ARS |
| `products.compareAtPrice` | `prices.regular_price` si `on_sale` | |
| `products.stock` | `is_in_stock` ? 1 : 0 | la API pública no da cantidad |
| `products.shortDescription` | `short_description` | HTML a texto |
| `products.descriptionHtml` | `description` | HTML saneado |
| `products.description` | `description` | texto plano |
| `products.highlights` | `<li>` de la descripción | hasta 6 |
| `products.images` | `images[].src` | servidas desde el WP viejo |
| `products.tags` | `tags[].slug` | |
| `products.specs` | — | WooCommerce no publica atributos: queda vacío |
| `products.badge` | derivado de `on_sale` | |
| `products.rating` / `reviewCount` | 48 / 0 | WP no tiene ratings (`average_rating` = 0) |
| `categories.parentId` | `parent` | árbol real 1:1 |
| `categories.descriptionHtml` | `description` | 63 con descripción SEO útil |
| `categories.imageUrl` | `image.src` | |

## Riesgos / pendientes

1. **Imágenes servidas desde el WP viejo**: el server debe seguir online hasta el corte
   y `next.config.ts` necesita `remotePatterns` para `wp-content`.
2. **Rank Math**: cada producto tiene `seoTitle`/`seoDescription` propios en WP. El
   Store API no los expone; si se quieren migrar hace falta `wc/v3` con claves.
3. **Reviews**: WooCommerce no tiene ratings nativos (`average_rating` = 0 en el
   100% del catálogo). Las reseñas de la home vienen de Google Places.
4. **Diferencia API vs sitemaps**: ver sección de reconciliación (209 +
   0 casos) antes de dar por buena la migración.

---

## Estado de la migración (verificado 2026-09-28)

Reejecutá con `npm run verify:wp`. WooCommerce: 2588 productos / 128 categorías.

| Métrica | WooCommerce | Nuestra base | ¿Coincide? |
| --- | --- | --- | --- |
| Categorías | 128 | 128 | ✅ |
| Productos | 2588 | 2588 | ✅ |
| Con stock | 2368 | 2368 | ✅ |
| En oferta | 2383 | 2383 | ✅ |
| Categorías raíz | 21 | 21 | ✅ |
| Puentes producto→categoría | — | 4374 | — |

Categorías de WooCommerce ausentes: **0**.

Categorías extra (no están en WooCommerce): **0**.

Productos con categoría principal distinta a la esperada: **0**.

> `con stock` y `en oferta` se comparan contra lo que la API pública expone
> (`is_in_stock`, `on_sale`); la API no da cantidades exactas por producto.
