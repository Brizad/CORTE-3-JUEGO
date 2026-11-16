# Decisiones por confirmar

Cosas que el GDD, el modelo y la guía no definen y que se resolvieron con la opción más simple y coherente. **Estado: el equipo aceptó todas las decisiones de esta lista tal como están** (decisión del 2026-11-16) y resolvió el balance del turno 3 (ver el final).
Cada una dice dónde se aplicó.

| N.º | Decisión | Dónde |
|---|---|---|
| 1 | Las piezas (bloques en bruto, pieza brillante, pila de terminadas) son solo una capa visual. No tienen estado propio: salen de los estados de las CNC y de los eventos `cargar` y `descargar`. La "Entrada" se rellena sola (los bloques en bruto no se acaban) | `src/entidades/Piezas.js`, GDD 18.6 |
| 2 | "Entrada" está en la celda (6, 5) y "Piezas terminadas" en la celda (6, 0), lejos de la mesa y de S1/S2 | `src/entidades/Piezas.js` |
| 3 | Las tarjetas de pedidos muestran hasta 3 pedidos (los más antiguos) y un "+n" si hay más | `src/escenas/HUDGeneral.js`, GDD 18.7 |
| 4 | En la pantalla de título solo "Jugar" (o Enter) inicia la partida; antes bastaba un clic en cualquier lugar | `src/escenas/Titulo.js`, GDD 18.8 |
| 5 | Phaser 4.2.1 no trae un filtro "Bloom" suelto: se arma con la acción `Phaser.Actions.AddEffectBloom` sobre la cámara y solo existe durante el pulso (0,7 s en una falla, 0,9 s en un deadlock) | `src/entidades/Efectos.js` |
| 6 | Los filtros de Phaser (glow, bloom) se crean solo cuando se necesitan: un filtro encendido en cada cuadro costaba unos 25 fps en el equipo de prueba | `src/entidades/Efectos.js`, `src/entidades/Piezas.js` |
| 7 | Modo reducido automático: si el juego baja de 50 fps durante 4 s seguidos, se apagan partículas, bloom y glow de las piezas. `?efectos=0` lo activa desde el inicio y `?auto=0` desactiva la vigilancia (para medir) | `src/escenas/Planta.js` |
| 8 | El radar se sigue calculando tras cada disparo (cuesta menos de 1 ms), no cada 0,5 s | `src/sed/celda.js` |
| 9 | Se agregó `<link rel="icon" href="data:,">` a `index.html` para que el navegador no pida `favicon.ico` (daba un 404 en la consola) | `index.html` |
| 10 | Los resultados "del software académico" (JFLAP, Supremica, PIPE2) se calcularon con un lector propio de los .jff y .pnml (`scripts/pruebas-modelo.mjs`), porque esos programas no se pueden abrir desde el entorno automático. El equipo debe confirmarlos con una captura de cada programa | `docs/pruebas.md` |
| 11 | El arrastre y el pellizco táctiles no se pudieron verificar en el navegador sin ventana (los toques sueltos sí). Hay que probarlos en un teléfono o una tableta | `docs/pruebas.md`, literal f |
| 12 | El playtest con otro equipo (literal h) queda pendiente | `docs/pruebas.md`, literal h |
| 13 | Phaser puede entregar el mismo evento de teclado varias veces en equipos lentos (se vio al escribir H, C, T, R rápido): cada evento se atiende una sola vez | `src/escenas/HUDMaquina.js`, `src/entrada/gestorEntrada.js` |
| 14 | "Desborde" no se usa en este proyecto (todos los lugares tienen k = 1 estricta), por eso la fila de la guía se marca "n/a" | `docs/pruebas.md` |
| 15 | Se agregó "Reiniciar turno" al menú de pausa: repite el mismo turno con la misma semilla y conserva el puntaje que se tenía al empezar el turno (igual que "Reintentar" de la pantalla de resultados) | `src/escenas/MenuPausa.js`, GDD 18.14 |
| 16 | El menú de pausa reemplaza al texto "PAUSA" suelto: P y el botón de pausa abren el menú (que detiene el reloj). El Inspector sigue pausando por su cuenta | `src/escenas/Planta.js`, GDD 18.14 |
| 17 | El mejor puntaje es el puntaje total acumulado al terminar cada turno (no solo el de la partida completa); los logros se unen sin repetirse. El tutorial no guarda. Clave `robocell-tycoon-2.5d` | `src/guardado.js`, GDD 18.14 |
| 18 | La pantalla completa usa la API del navegador sobre `#game-container` (no `scale.toggleFullscreen` de Phaser): el de Phaser lanzaba "HierarchyRequestError" al pulsar G varias veces y "not granted" si el navegador negaba el permiso | `src/pantalla.js`, `test/pantalla.test.js` |
| 19 | El aviso de 3 s al empezar el turno no pausa la simulación (el reloj corre desde el segundo 0) y se desvanece solo | `src/escenas/HUDGeneral.js`, GDD 18.13 |
| 20 | La alerta del radar amarillo usa el primer marcado muerto alcanzable en un paso: "si despachas AGV2 ahora, la celda se bloquea". Si el camino no es t1a ni t2a, nombra la transición | `src/textos.js` |
| 21 | **Celular:** en vertical (360 x 640) el juego de 16:9 quedaría con botones de 16 px, así que se muestra "Gira el teléfono a horizontal para jugar". En horizontal los botones miden 44 px lógicos, que en pantalla son 29 px en 640 x 360 y 35 px en 932 x 430; llegar a 44 px reales exigiría rediseñar la barra (botones de 66 px lógicos). Pendiente de decidir por el equipo | `index.html`, `docs/pruebas.md` literal i |
| 22 | La velocidad se muestra como "Vel. x1" (antes "Velocidad x1") para que quepa con los botones ⛶ y ? en el panel del turno; los botones siguen diciendo "Velocidad de la simulación x1 (tecla 1)" al pasar el mouse | `src/escenas/HUDGeneral.js` |
| 23 | El botón de despacho del Controlador pasó de 40 a 44 px de alto (ahora llega justo al borde inferior, y = 540) para cumplir el mínimo táctil | `src/disposicion.js` |

## Balance medido y decisión del equipo

`node scripts/balance.mjs` simula cada turno con el piloto automático (que nunca compra el Controlador) tomando una decisión cada *p*
segundos de simulación (un jugador rápido decide cada 1 s, el supuesto del GDD sección 15; uno tranquilo, cada 2 a 4 s), con 30 semillas
distintas por casilla. Datos completos en `docs/datos/balance.json`.

**Decisión del equipo (2026-11-16): la meta del turno 3 baja de 7 a 6 piezas.** Las fallas (30 %) y los pedidos (cada 12 s) no cambian.
Quedó escrito en el GDD (secciones 7, 15 y 17, decisión 14), en `src/config.js` y en las pruebas.

| Turno | Meta | p = 1 s | p = 2 s | p = 3 s | p = 4 s | p = 6 s |
|---|---|---|---|---|---|---|
| 1 (10 % fallas, pedidos cada 25 s) | 3 piezas | 30/30 | 30/30 | 30/30 | 29/30 | 0/30 |
| 2 (20 % fallas, pedidos cada 18 s) | 5 piezas | 30/30 | 29/30 | 7/30 | 0/30 | 0/30 |
| 3 antes (30 % fallas, pedidos cada 12 s) | 7 piezas | 21/30 | 0/30 | 0/30 | 0/30 | 0/30 |
| **3 ahora** (30 % fallas, pedidos cada 12 s) | **6 piezas** | 27/30 | 0/30 | 0/30 | 0/30 | 0/30 |

(victorias de 30 partidas por casilla; la fila "3 antes" es la medición con la meta de 7, guardada para comparar)

Medición adicional del turno 3 con 6 piezas (30 partidas): una decisión cada 1,25 s gana 19/30, cada 1,5 s gana 15/30 y cada 1,75 s gana 0/30.

- **Turno 1 se puede ganar sin el Controlador:** gana el 100 % con una decisión cada 1 a 3 s y termina en unos 40 a 100 s de los 180 s.
  Solo se pierde si el jugador decide más lento que cada 4 s. Para quien juega rápido es **fácil**; no se tocó.
- **Turno 2** es exigente pero justo: con decisiones cada 2 s gana casi siempre y con cada 3 s solo gana una de cada cuatro partidas.
- **Turno 3 con 6 piezas:** sigue siendo difícil pero posible. El piloto gana 27/30 con una decisión por segundo y 15 de 30 con una cada 1,5 s;
  con una decisión cada 2 s **no gana ninguna (0/30)**: el cambio de meta ayuda a quien decide rápido, pero no a quien decide cada 2 s o
  más (en esa casilla el piloto llega a 3,4 de 6 piezas). Si el equipo quiere que el turno 3 sea ganable a un clic cada 2 s habría que bajar
  también la probabilidad de falla o la meta (no se hizo: la decisión del equipo fue solo la meta a 6).
- Límite de la medición: el piloto trabaja con una acción a la vez y repara con una palabra fija; un jugador humano puede paralelizar mejor
  las dos CNC, de modo que los números del piloto son una cota pesimista para el humano.
