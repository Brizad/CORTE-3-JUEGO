# RoboCell Tycoon 2.5D

Simulador-juego isométrico en el navegador de una **celda de manufactura** con 2 CNC, 1 brazo robótico y 2 AGV. El jugador es el jefe
de turno: decide cuándo disparar cada evento controlable. Las máquinas se gobiernan con **autómatas** (con un supervisor que impide un
estado prohibido) y los recursos compartidos (la mesa de descarga y el brazo) con una **red de Petri** que puede caer en **deadlock**.
El radar del árbol de cobertura avisa antes de que ocurra.

Proyecto 2 de la guía *Laboratorio 1: Sistemas de Eventos Discretos con Phaser, Autómatas y Redes de Petri* (FLA-23 v.00),
Modelado Discreto, Corte 3.

**Integrantes:** Brian Acevedo, Brayan Amado y Manuel Carvajal.

**Jugar en línea (Netlify):** https://flourishing-caramel-127c26.netlify.app

## Tecnología

Phaser 4.2.1 (por CDN, no se instala con npm), Vite y JavaScript. Mouse, teclado y táctil. Phaser se carga desde
`https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js`, así que hace falta conexión a internet para jugar.

## Cómo ejecutar

Requisitos: Node.js 20.19 o más nuevo y npm. Python 3 solo para empaquetar el ZIP.

```bash
npm install            # instala Vite (Phaser llega por CDN)
npm run dev            # servidor de desarrollo: http://localhost:5173
npm test               # pruebas del núcleo y del juego (node --test)
npm run build          # compila a dist/
npm run preview        # sirve dist/: http://localhost:4173
npm run pruebas        # conformidad modelo–juego y criterios del GDD
npm run modelos        # regenera src/sed/modelos/*.json desde modelos/
npm run empaquetar     # build + entrega/GrupoN_RoboCell.zip (index.html en la raíz)
node scripts/balance.mjs                 # mide el balance de los 3 turnos con el piloto (docs/datos/balance.json)
node scripts/azar-navegador.mjs juego 120 4   # clics y teclas al azar en Edge sin ventana (modos: juego, tutorial, flujos, galeria)
node scripts/movil-navegador.mjs         # tamaños de celular: sin scroll, aviso de girar, toques y pellizco
node scripts/juego-navegador.mjs 5173    # recorrido de los controles paso a paso, la barra, la consola, las entregas y el tutorial
node scripts/costo-cuadro.mjs 5173       # costo de JS por cuadro (los fps reales se leen con F1)
node scripts/revisar-tildes.mjs          # busca palabras sin tilde en los textos del juego
```

Los scripts del navegador necesitan `npm run dev` abierto en el puerto 5199 (`npx vite --port 5199`) y Microsoft Edge instalado.

La tecla **F** (fuerza una falla del husillo para probar la consola de reparación) solo existe con `npm run dev`.

## Cómo se juega

1. En el título: **Jugar**, **Tutorial** (Turno 0, paso a paso) o **Controles**. El título muestra tu mejor puntaje y tus logros (se guardan en el navegador).
2. **Opera el brazo paso a paso** con la barra de abajo (cada botón y cada tecla dispara UN evento del autómata): **Ir a CNC 1** (Z) o
   **Ir a CNC 2** (X), **Abrir pinza** (A), **Meter bloque** (C), **Cerrar pinza** (E; el brazo vuelve solo), y luego **Fresar** (F o G).
   Para descargar: ir (Z o X), abrir (A) y **Sacar pieza** (D), que suma +100. Verde = se puede, gris = ahora no (al pasar el mouse dice
   por qué), rojo = lo bloquea el supervisor (−15 puntos si insistes).
3. Haz clic en una máquina para ver su **autómata**: grafo, estado iluminado, botones de cada evento y los últimos eventos. **Tab** cambia
   a la pestaña «Acciones», con los mismos eventos como botones grandes.
4. Los AGV traen **metal**: atiéndelos con **Q** y **W** antes de que venza la entrega (30 s; 20 s en el turno 3). **Nunca atiendas los dos
   a la vez**: cada uno toma un recurso y espera el otro (deadlock). El radar pasa a amarillo cuando hay peligro. El **Controlador de celda**
   (−150) lo evita.
5. Si una CNC falla, su botón dice **Reparar**: escribe en su consola una palabra del lenguaje `^H(CT?)+R$` (por ejemplo `HCTCR`) y pulsa Enter.
6. Son 3 turnos de 180 s con metas de 6, 8 y 8 piezas. Hay 6 logros. Cada turno empieza con una tarjeta y la cuenta 3, 2, 1, ¡Ya!,
   y si el radar se pone amarillo la zona de alertas dice qué AGV no atender. Con **?** se abre «Cómo jugar» en cualquier momento.
7. En el celular, usa el teléfono en horizontal (en vertical aparece un aviso para girarlo). El pellizco acerca y aleja la planta.

## Controles

| Acción | Mouse y teclado | Táctil |
|---|---|---|
| Brazo: ir a CNC 1 / CNC 2 | **Z** / **X** | Botones de la barra |
| Brazo: abrir pinza / meter bloque / sacar pieza / cerrar pinza | **A** / **C** / **D** / **E** | Botones de la barra |
| Brazo: volver a reposo | **V** | Botón de la barra |
| Fresar en CNC 1 / CNC 2 (en Falla: Reparar) | **F** / **G** | Botones de la barra |
| Atender AGV 1 / AGV 2 | **Q** / **W** | Botones de la barra |
| Ver el autómata de una máquina | Clic en la máquina | Toque en la máquina |
| Cambiar entre «Autómata» y «Acciones» | **Tab** | Pestañas del panel |
| Pausa y menú (Continuar, Reiniciar turno, Ayuda, Sonido, Título) | **P** | Botón de pausa |
| Ayuda: cómo jugar, teclas, controles y colores | **?** | Botón "?" |
| Inspector (ecuación de estado y árbol de cobertura) | **I** | Botón "Insp." |
| Vista de la red de Petri | **R** | Botón "Red" |
| Velocidad x1, x2 y x4 | **1**, **2**, **4** | Botones x1, x2, x4 |
| Consola de reparación | **H**, **C**, **T**, **R**, Retroceso, Enter | Botones de comandos |
| Cerrar un panel | **Esc** | Botón X |
| Mover y acercar la cámara | Arrastrar y rueda | Arrastrar y pellizco |
| Pantalla completa | **L** | Botón ⛶ |
| Silenciar, fps y demostración | **M**, **F1**, **F2** | Botón del altavoz |

## Estructura

```
index.html, vite.config.js        Phaser por CDN y base './'
modelos/                          Archivos del software académico: .jff (JFLAP), .wmod (Supremica) y .pnml (PIPE2)
docs/
  GDD.md                          Documento de diseño del juego (sección 18: mejoras de jugabilidad)
  arte.md                         Guía de arte
  modelo/                         Modelo formal en Markdown (automatas.md y petri.md): manda sobre el GDD
  pruebas.md, informe.md          Pruebas de la guía 5.9 y el informe con el postmortem
  PLAN_FINAL.md, decisiones_por_confirmar.md
  capturas/                       Capturas de las pruebas y de las funciones
.agents/skills/                   Las 3 habilidades del agente (diseñador, ingeniero SED y director de arte)
src/sed/                          Núcleo formal SIN Phaser ni DOM: Automata, composición y supervisor, RedPetri,
                                  árbol de cobertura, Celda (sincroniza todo), consola de reparación, logros, tutorial
src/sed/modelos/                  JSON que salen de modelos/ (los importa el navegador)
src/entidades/, src/escenas/      Parte visible con Phaser: máquinas, fichas, vista de red, HUD, inspector, resultados, menú de pausa y ayuda
src/textos.js, src/guardado.js    Textos de ayuda (controles, leyenda, aviso de turno) y guardado local (sin Phaser)
src/disposicion.js, src/pantalla.js   Zonas y botones del HUD (con prueba de que no se encimen) y pantalla completa
src/arte/, src/iso/               Íconos, fichas y proyección isométrica 2:1
src/audio/                        Sonidos con Web Audio
test/                             Pruebas del núcleo (`npm test`)
scripts/                          Exportar modelos, pruebas de conformidad, balance, pruebas en el navegador y empaquetado
tmp-capturas/                     Capturas temporales de las pruebas (ignorada por git)
PROMPTS.md                        Prompts usados, en orden, y cuáles hubo que corregir
```

## Reglas de diseño

- El **modelo formal manda**: lo que digan `modelos/` y `docs/modelo/` no se cambia desde el juego.
- Todo cambio de estado de una máquina pasa por **δ** (`Automata.ejecutar`) y todo recurso se mueve solo por el **disparo de una transición**
  (`RedPetri.disparar`). Las animaciones solo muestran lo que ya pasó en el núcleo.
- Si el GDD no define algo, se elige la opción más simple y se anota en `docs/decisiones_por_confirmar.md`.

## Entrega

`npm run empaquetar` hace el build y deja en `entrega/` (carpeta ignorada por git):

- `Grupo2_RoboCell.zip`: contenido de `dist/` con `index.html` en la raíz (0,06 MB; el máximo es 25 MB). Para el aula virtual.
- `Grupo2_RoboCell_completo.zip`: `modelos/`, `.agents/skills/`, `docs/`, `src/`, `test/`, `scripts/`, `README.md`, `PROMPTS.md`,
  `package.json`, `index.html` y los archivos para volver a construirlo (`package-lock.json`, `vite.config.js`, `netlify.toml`). Sin
  `node_modules` ni `dist`.
- `ENTREGA.md`: la lista de la sección 5.12 de la guía con lo que está listo y lo pendiente.

El ZIP del juego se abre con un servidor local (por ejemplo `python -m http.server` dentro de la carpeta descomprimida) o en la
previsualización del aula virtual. Con doble clic (`file://`) el navegador bloquea el script de tipo módulo que genera Vite.

Versión publicada: https://flourishing-caramel-127c26.netlify.app (`netlify.toml`: comando `npm run build`, carpeta `dist`).
