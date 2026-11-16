# Guía de arte: RoboCell Tycoon 2.5D

Define cómo se ve el simulador. Se define una vez y se respeta.
Reglas de juego: `docs/GDD.md`. Modelo formal: `docs/modelo/`.

## 1. Lienzo y rejilla

| Parámetro | Valor |
|---|---|
| Tamaño del juego | 960 × 540 px lógicos; el canvas se dibuja a 1920 × 1080 (zoom 2 en las cámaras, GDD 18.11) |
| Escala | FIT (se ajusta a la ventana y conserva la proporción) |
| Rejilla | Isométrica 2:1, celdas de 64 × 32 px |
| Planta | 12 × 10 celdas (gx = 0..11, gy = 0..9) |
| Orden de profundidad | Por (x + y) de la celda: más grande se dibuja encima |
| Luz | Desde arriba a la izquierda, en todos los objetos |

**Conversión de celda a pantalla** (vértice superior de la celda):

- x = 448 + (gx − gy) × 32
- y = 90 + (gx + gy) × 16

La planta ocupa 704 × 352 px, centrada en x = 480, entre y = 90 y y = 442.
Las zonas de HUD quedan fuera: arriba 0 a 56 px, abajo desde 450 px.

## 2. Paleta (14 colores)

| N.º | Uso | Color |
|---|---|---|
| 1 | Estado: operación | `#2e9e5b` |
| 2 | Estado: espera | `#e0b21b` |
| 3 | Estado: fallo | `#d64545` |
| 4 | Estado: mantenimiento | `#3b7dd8` |
| 5 | Token Mesa_libre (tablero café) | `#b07a3c` |
| 6 | Token Robot (engranaje naranja) | `#f08a24` |
| 7 | Token AGV (rombo azul) | `#3fa7d6` |
| 8 | Token Celda_libre (llave dorada) | `#d4af37` |
| 9 | Suelo | `#2b323c` |
| 10 | Muros | `#4a5360` |
| 11 | Cuerpo de máquinas | `#8794a3` |
| 12 | Bandas y rutas de AGV | `#566170` |
| 13 | Panel del HUD | `#161b22` |
| 14 | Texto del HUD | `#e8edf2` |

Reglas:

- Para sombras y caras laterales se oscurece el color base (cara izquierda −20 %, cara derecha −35 %).
  Las caras superiores usan el color base. Esto da la luz desde arriba a la izquierda.
- El azul de mantenimiento (`#3b7dd8`) y el azul del AGV (`#3fa7d6`) se parecen. Se distinguen por la forma:
  el AGV es un rombo; el mantenimiento es un halo circular.
- No se añaden colores fuera de esta tabla sin actualizarla.

## 3. Planta: distribución en la rejilla

Celdas (gx, gy). Mapa de arriba hacia abajo por gy; de izquierda a derecha por gx.

```
gy\gx  0  1  2  3  4  5  6  7  8  9  10 11
 0     .  .  .  .  .  .  .  .  .  .  .  .
 1     .  .  .  .  .  .  .  .  .  .  D1 .
 2     .  .  .  C1 .  .  .  .  .  .  .  .
 3     .  .  .  .  .  .  .  .  S1 .  .  .
 4     .  .  .  .  .  B  .  M  .  .  .  .
 5     .  .  .  .  .  .  .  .  S2 .  .  .
 6     .  .  .  C2 .  .  .  .  .  .  .  .
 7     .  .  .  .  .  .  .  .  .  .  .  .
 8     .  .  .  .  .  .  .  .  .  .  D2 .
 9     .  .  .  .  .  .  .  .  .  .  .  .
```

| Símbolo | Objeto | Celda |
|---|---|---|
| C1 | CNC 1 | (3, 2) |
| C2 | CNC 2 | (3, 6) |
| B | Brazo (base) | (5, 4) |
| M | Mesa de descarga | (7, 4) |
| S1 | Estación del AGV1 | (8, 3) |
| S2 | Estación del AGV2 | (8, 5) |
| D1 | Depósito del AGV1 (estado Libre) | (10, 1) |
| D2 | Depósito del AGV2 (estado Libre) | (10, 8) |

Muros: borde de la planta, 24 px de alto, color de muros. Las bandas son líneas de 8 px de ancho en el suelo.

## 4. Máquinas

Todas se dibujan en código (formas isométricas). Misma escala y misma luz.

| Máquina | Forma | Tamaño | Detalle |
|---|---|---|---|
| CNC | Prisma con cara frontal de ventana | 1 × 1 celda, 40 px de alto | Husillo visible sobre la ventana |
| Brazo | Base cilíndrica y dos segmentos articulados | 1 × 1 celda, 56 px de alto | Pinza al final; el mandril se ve abierto o cerrado |
| Mesa | Plataforma plana | 1 × 1 celda, 12 px de alto | Tablero café `#b07a3c` |
| AGV | Plataforma baja con luz superior | 0,8 × 0,8 celda, 14 px de alto | Rombo azul `#3fa7d6` en el techo |

## 5. Estados: color e ícono

Cada estado de cada autómata tiene un **color** (los 4 colores fijos) y un **ícono** sobre la máquina.
Ícono de 16 × 16 px, centrado 8 px sobre la máquina.

### CNC (5 estados)

| Estado | Color | Ícono |
|---|---|---|
| Libre | Espera `#e0b21b` | Círculo vacío |
| Cargado | Espera `#e0b21b` | Pieza (caja) |
| Fresando | Operación `#2e9e5b` | **Chispas** (3 puntos que saltan) |
| Terminado | Espera `#e0b21b` | Marca de verificación |
| Falla | Fallo `#d64545` | **Rayo y humo** (humo gris que sube) |

Mientras la consola de reparación está abierta, la CNC lleva un halo de mantenimiento `#3b7dd8`.

### Brazo (4 estados)

| Estado | Color | Ícono |
|---|---|---|
| Reposo | Espera `#e0b21b` | Casa |
| Moviendo | Operación `#2e9e5b` | Flechas dobles |
| Mandril_Cerrado | Operación `#2e9e5b` | Pinza cerrada |
| Mandril_Abierto | Espera `#e0b21b` | Pinza abierta |

### AGV (4 estados)

| Estado | Color | Ícono |
|---|---|---|
| Libre | Espera `#e0b21b` | Círculo vacío |
| Viajando | Operación `#2e9e5b` | Flecha |
| Esperando | Espera `#e0b21b` | Reloj de arena |
| Descargando | Operación `#2e9e5b` | Caja bajando |

## 6. Tokens (fichas de la red de Petri)

Cada tipo de token tiene forma y color propios. Se dibujan 14 px de alto en el panel de fichas
y 20 px sobre la planta.

| Token | Lugar(es) | Forma | Color |
|---|---|---|---|
| Mesa | p1 Mesa_libre | Tablero (rectángulo con patas) | `#b07a3c` |
| Robot | p2 Robot_libre | Engranaje | `#f08a24` |
| AGV | p3 AGV1_listo, p4 AGV2_listo | Rombo | `#3fa7d6` |
| Celda | p10 Celda_libre | Llave | `#d4af37` |

Lugares combinados (se componen con los tokens base, sin colores nuevos):

| Lugar | Composición |
|---|---|
| p5 AGV1_con_mesa | Rombo azul con un tablero café pequeño en la esquina; etiqueta "1" |
| p6 AGV2_con_robot | Rombo azul con un engranaje naranja pequeño; etiqueta "2" |
| p7 AGV1_trabajando | Rombo azul con tablero y engranaje; etiqueta "1" |
| p8 AGV2_trabajando | Rombo azul con tablero y engranaje; etiqueta "2" |
| p9 Robot_en_CNC | Engranaje naranja con una CNC pequeña |

Los flujos entre lugares se animan con partículas del color del token. Un token que cambia de lugar
viaja en una línea corta entre los dos lugares del panel (0,3 s).

### 6.1 Ubicación de las fichas en la planta

Cada lugar flota sobre el objeto que representa y muestra su contador m/k debajo.
Las ubicaciones fueron elegidas por el equipo (opción "sobre el objeto que representan").

| Lugar | Celda (gx, gy) | Altura |
|---|---|---|
| p1 Mesa_libre | (7, 4), sobre la mesa | 28 px |
| p2 Robot_libre | (5, 5), junto a la base del brazo | 10 px |
| p3 AGV1_listo | (11, 1), junto a D1 | 10 px |
| p4 AGV2_listo | (11, 8), junto a D2 | 10 px |
| p5 AGV1_con_mesa | (8, 2), junto a S1 | 10 px |
| p7 AGV1_trabajando | (9, 2), junto a S1 | 10 px |
| p6 AGV2_con_robot | (8, 6), junto a S2 | 10 px |
| p8 AGV2_trabajando | (9, 6), junto a S2 | 10 px |
| p9 Robot_en_CNC | (4, 2) junto a CNC 1 o (4, 6) junto a CNC 2, según la CNC atendida; en reposo (4, 4) | 10 px |
| p10 Celda_libre | (6, 2) (solo con el Controlador de celda) | 10 px |

Un lugar vacío se dibuja como contorno tenue con el contador 0/k. Cuando se dispara una transición,
cada ficha consumida viaja al lugar donde se produce otra, con un tween de 0,3 s (dividido por la velocidad).

### 6.2 Red de Petri sobre la planta

- **Zonas del mapa:** cada lugar tiene su objeto o zona: la mesa (Mesa_libre), el brazo y la zona "Robot" (Robot_libre), la
  base, la zona de espera y la zona de trabajo de cada AGV. Las zonas son baldosas de la rejilla con su rótulo de 8 px.
- **Vuelo de fichas:** al disparar una transición, cada ficha de entrada viaja (tween de 0,3 s, dividido por la velocidad) a la
  estación de la transición, en el orden de Pre (p1, p2, …); cuando llegaron todas, las fichas de salida parten de la estación en
  el orden de Post. Estaciones: t1a, t1b y t1c en S1; t2a, t2b y t2c en S2; tr_ir y tr_volver en el brazo.
- **Conflictos:** cuando dos o más transiciones habilitadas comparten un lugar de entrada, ese lugar se rodea con un anillo
  naranja (robot `#f08a24`) que pulsa, y debajo se lee la lista de transiciones, por ejemplo "t1b ↔ t2a ↔ tr_ir".
- **AND-join:** si un AGV espera en su estación y la transición no está habilitada, la estación muestra
  "AGV1 espera: falta Robot_libre" (amarillo de espera).
- **Pedidos:** un círculo con el número de pedidos pendientes sobre la fila libre junto a cada base (D1 y D2). Pasa a rojo
  si algún pedido ya venció (30 s).

## 7. HUD de máquina (escena superpuesta)

- Panel `#161b22` al 90 % de opacidad, 300 × 220 px, anclado a la derecha de la máquina seleccionada.
- **Nodos circulares** de 36 px por estado, con el nombre debajo (fuente de 10 px).
- **Flechas** entre nodos con el **código del evento** (c, i, f, d, x, r, m, l, a, e, v, g, u, z).
- **Estado actual iluminado:** nodo relleno con su color de estado y borde blanco.
- **Eventos controlables habilitados:** botón con el color de operación.
- **Eventos deshabilitados por el supervisor:** botón **rojo `#d64545`**, con **glow** de Phaser 4 que pulsa.
- **Eventos que ahora no se pueden ejecutar** (falta el brazo, un recurso o la palabra de reparación): botón gris sin glow,
  con la explicación al pasar el mouse. Solo hay botón para los eventos de Γ(q).
- **Eventos no controlables:** botón gris solo informativo (por ejemplo `f` y `x` con la CNC fresando).
- Botones táctiles de 44 × 44 px como mínimo.

**Tamaño real (confirmado por el equipo):** el panel mide 460 × 392 px (ancho ampliado en docs/GDD.md, sección 18.2; la altura no pasa de y = 448 para no tapar las alertas) y se coloca junto a la máquina
(a la derecha, o a la izquierda si la máquina está en la mitad derecha de la pantalla). Con 300 × 220 px no cabían
el grafo, los botones de 44 px y los últimos 10 eventos. El grafo usa las coordenadas x, y del .jff escaladas al panel
(170 px de alto en las CNC, 228 px en las demás). Nodos de 44 px; flechas curvas con la etiqueta "código · nombre"; los eventos no
controlables van con línea punteada. Entre el mismo par de estados cada transición usa su propia curva (a ambos lados del eje) y las
flechas simples eligen la curvatura que las deja lejos de los demás nodos. El historial va en dos columnas de 5 filas alineadas
(tiempo, código, origen → destino).

Distribución del panel de una CNC, de arriba hacia abajo:

1. Título, pestañas **Autómata** y **Composición** (solo en las CNC), aviso "Brazo en camino…" (verde, arriba a la derecha, solo
   con el brazo en Moviendo) y botón X. La pestaña Composición reemplaza el cuerpo del panel con las cifras 20 / 19 y el estado
   compuesto actual en 20 px (espera `#e0b21b`; rojo si fuera el estado prohibido).
2. Grafo del autómata. Estado actual: nodo relleno con su color, borde blanco y glow que pulsa. Última transición: parpadea 0,5 s.
3. Botones de los eventos de Γ(q) (verde, gris o rojo con glow).
4. Sección **"Brazo en esta CNC"**: cuatro botones de 73 × 44 px: `m · mover`, `a · abrir`, `e · cerrar` y `m · volver`.
   Mismos colores que los demás. En gris, al pasar el mouse explican qué falta (por ejemplo "El brazo debe estar en Mandril_Abierto
   frente a esta CNC"). El panel del brazo, de los AGV y de la CNC en Falla no lleva esta sección.
5. Lista de los últimos 10 eventos (dos columnas de 5) con la palabra observada.
6. Aviso al pasar el mouse sobre un botón: texto de 10 px en la parte baja del panel.

**CNC en Falla:** la consola de reparación reemplaza a los botones y a la lista:

- Campo de 316 × 28 px con la palabra w en fuente monoespaciada de 18 px. Desde el primer símbolo sin transición, la palabra
  se ve en rojo `#d64545`.
- Línea del DFA: "DFA: qN" y los símbolos que pueden seguir; en verde con "(aceptada ✔)" al llegar a q4.
- Línea de aviso (10 px): lo que se espera, el error, el resultado o la ayuda (`^H(CT?)+R$` en espera `#e0b21b`, 5 s).
- Botones H, C, T, R en mantenimiento `#3b7dd8` y, debajo, Borrar (gris), Enviar (operación) y Ayuda −20 (espera).
- Alertas: la zona de abajo a la derecha (sección 8) muestra "CNC1: falla del husillo…" en rojo y los puntos de cada acción.

## 8. HUD general (zonas)

| Zona | Posición | Contenido |
|---|---|---|
| Arriba izquierda | x 8–190, y 8–48 | Reloj (s restantes), turno y velocidad. A su derecha, los botones x1, x2 y x4 (x 192–324) |
| Arriba centro | x 330–630, y 8–48 | Puntaje y piezas / meta (20 px, en blanco; el puntaje negativo en rojo). Junto al radar: botones de pausa e inspector (x 636–728) |
| Arriba derecha | x 770–952, y 8–48 | Radar del Árbol de Cobertura |
| Abajo izquierda | x 8–420, y 450–532 | Fichas por lugar: p1..p9 (y p10), cada una con su forma y color a 14 px, el contador m/k y el nombre del lugar |
| Abajo derecha | x 540–952, y 450–532 | Alertas. En el hueco central (x 424–536) van "Despachar AGV1", "Despachar AGV2" y "Controlador de celda" |

El radar es un círculo de 32 px con su etiqueta y, a su derecha, un mini-grafo con los últimos 5 marcados (cuadros de 22 × 14 px
con el nombre M0…M7, del color del radar en ese marcado, unidos por flechas; el último con borde blanco):

| Estado | Color | Comportamiento |
|---|---|---|
| Verde | `#2e9e5b` | Fijo |
| Amarillo | `#e0b21b` | Parpadea a 2 Hz |
| Rojo | `#d64545` | Fijo, con temblor de cámara al entrar |

## 9. Efectos (Phaser 4)

Cada efecto tiene un propósito. Ninguno es solo decoración.

| Efecto | Dónde | Propósito |
|---|---|---|
| **Glow** | Botón bloqueado por el supervisor | Llamar la atención al evento inhibido |
| Glow | Máquina seleccionada | Mostrar cuál está abierta |
| **Bloom** | Eventos críticos: falla del husillo, deadlock, pieza descargada | Subrayar el cambio importante |
| **Partículas** | Chispas en la CNC Fresando. Humo en la CNC en Falla. Flujo de tokens entre lugares | Mostrar el estado y el flujo |
| **Temblor de cámara** | Al fallar el husillo, al caer en deadlock y al insistir en un botón rojo del supervisor (0,3 s) | Marcar el evento negativo |
| **Path** | Rutas de los AGV | Mover cada AGV por una trayectoria |

### 9.1 Trayectorias de los AGV (Path)

Cada AGV sigue un `Path` de Phaser. Viaja de su depósito a su estación en 4 s (evento `v` a `g`).
Después de la descarga vuelve al depósito.

| AGV | Waypoints (celdas) |
|---|---|
| AGV1 | D1 (10, 1) → (10, 3) → S1 (8, 3) |
| AGV2 | D2 (10, 8) → (10, 5) → S2 (8, 5) |

La velocidad del recorrido se ajusta para que dure exactamente 4 s de simulación, también a x2 y x4.

**Supuestos visuales por confirmar** (el modelo y el GDD no los fijan; no cambian ningún estado ni tiempo):

- El regreso del AGV al depósito tras `z` (fin_descarga) dura 4 s en pantalla (igual que la ida). El autómata ya está en Libre.
- El brazo tarda 0,5 s en regresar a su reposo en pantalla; el modelo dice 0 s (tr_volver). La pinza tarda 0,3 s en abrir o cerrar.

## 10. Reglas de producción

- Máquinas y tokens se dibujan en código. Si se usan imágenes, deben tener **fondo magenta `#FF00FF`**
  (se elimina al cargar), la misma escala y la misma luz.
- No se copian personajes, logotipos, mapas ni música de juegos comerciales.
- Todo color usado debe estar en la tabla de la sección 2.

## 11. Cómo se revisa una captura

1. Comparar con esta guía: rejilla, posiciones, colores, tamaños y zonas de HUD.
2. Listar diferencias concretas con posición, color y tamaño. Ejemplo: "La CNC 2 está en (4, 6); debe estar en (3, 6)".
3. Comprobar que cada estado del autómata muestra su color e ícono, y que el radar coincide con el marcado.

## 12. Mejoras de lectura (docs/GDD.md, sección 18)

- **Rótulos de la planta:** los de las zonas de los lugares salen solo al pasar el mouse o tocar, en una etiqueta con fondo oscuro
  semitransparente (`#161b22` al 85 %) con el nombre, las fichas m/k y las transiciones en conflicto. Los rótulos cortos Mesa, S1, S2,
  D1 y D2 quedan siempre visibles sobre un fondo oscuro semitransparente (70 %).
- **Alertas:** se dibujan en la escena de más arriba (x 540–952, y 450–532); ningún panel las tapa.
- **Vista "Red de Petri"** (tecla R o botón "Red", azul de mantenimiento cuando está activa): la planta se oscurece un 55 %.
  Lugares: círculo de 30 px con borde blanco (con fichas) o gris (vacío) y su identificador (p1…p10) encima. Transiciones: barra de
  34 × 9 px con borde claro y su nombre a la derecha. Arcos con flecha de 1,5 px. Colores de las barras (y de sus arcos): negra
  (no habilitada), verde `#2e9e5b` (habilitada), naranja `#f08a24` (conflicto) y roja `#d64545` (bloqueada en deadlock).
  Posiciones: t1a, t1b y t1c apiladas junto a S1; t2a, t2b y t2c, junto a S2; tr_ir y tr_volver, encima del brazo.
- **Tutorial Turno 0:** caja de mensaje arriba a la izquierda (410 × 70 px) con "TURNO 0 · PASO n DE 17", una flecha amarilla que rebota
  (tween) sobre el objetivo y, en el último paso, los botones "Reintentar el final" y "Empezar el turno 1".
