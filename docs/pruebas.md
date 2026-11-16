# Pruebas y conformidad (guía 5.9)

Resultados reales de RoboCell Tycoon 2.5D. Cada tabla dice cómo se obtuvo el dato. Capturas en `docs/capturas/`.

**Cómo repetir las pruebas**

- `npm test`: pruebas del núcleo y del juego (Node, `node --test`).
- `npm run pruebas`: conformidad modelo–juego (`scripts/pruebas-modelo.mjs`) y criterios del GDD (`scripts/pruebas-gdd.mjs`).
- Las pruebas en el navegador (HUD, consola, deadlock, supervisor, controles, fps y los 3 turnos) se hicieron con Edge sin ventana y
  quedaron guardadas en `docs/datos/` (`navegador.json`, `fps.json`, `tres_turnos.json`).

**Límites que conviene decir con claridad**

- JFLAP, Supremica y PIPE2 no se pueden abrir desde el entorno de trabajo automático. Los resultados "del software académico" se calcularon
  con un **lector propio de los archivos .jff y .pnml** (independiente del exportador que usa el juego). El equipo debe confirmarlos
  con una captura de cada programa antes de entregar el informe.
- La prueba táctil se hizo con eventos de toque emulados en un navegador sin ventana, no en un teléfono real.
- El playtest con otro equipo (literal h) todavía no se ha hecho.

---

## a) Criterios del GDD

### a.1 Criterios de la guía

| Criterio de aceptación | Cómo se prueba | ¿Cumple? | Observación |
|---|---|---|---|
| El color e ícono de cada máquina coinciden con el estado de su autómata | HUD de 3 máquinas en momentos distintos | sí | CNC1 en Fresando: operacion y chispas; BRAZO en Moviendo: operacion y flechas; AGV1 en Viajando: operacion y flecha; AGV1 en Esperando: espera y relojArena (según docs/arte.md, sección 5) |
| El grafo del HUD es igual al de JFLAP | HUD de CNC1, brazo y AGV1 contra los .jff | sí | Mismas aristas (código y extremos) y mismas coordenadas: CNC 6/6, Brazo 7/7, AGV 4/4. El nodo iluminado coincide con el estado del autómata (Fresando, Mandril_Cerrado, Esperando) |
| Ninguna máquina cambia de estado sin un evento | Historial de cada autómata contra la bitácora de eventos tras 40 s de demostración a x4 | sí | CNC1: 7 eventos; CNC2: 5 eventos; BRAZO: 32 eventos; AGV1: 4 eventos; AGV2: 0 eventos; en cada una la cadena origen → destino es continua y termina en el estado actual |
| La consola repara con palabras de L y rechaza las demás | Tabla del literal c | sí | 4 válidas reparan (+50) y 4 inválidas no (−30) |
| El supervisor nunca deja alcanzar el estado prohibido | Tabla del literal e | sí | Tres intentos de iniciar el fresado con el mandril abierto y uno de abrirlo con la CNC fresando: ninguno se ejecutó |
| Ninguna transición se dispara sin sus tokens de entrada | Intentar disparar una estación incompleta | sí | AGV2 con el robot ocupado: `{"ok":false,"motivo":"recurso"}` y el marcado no cambió; ver también `test/redPetri.test.js` (disparar lanza un error si M < Pre y el test de capacidad k) |
| El desborde de un lugar con capacidad "desborde" penaliza | No aplica: todos los lugares de este proyecto tienen capacidad estricta k = 1 | n/a | La capacidad "desborde" está implementada y probada en `test/redPetri.test.js` pero la ficha no la usa |
| El radar pasa por verde, amarillo y rojo; el deadlock termina la partida | Tabla del literal d | sí | verde → amarillo → rojo; el reloj se detuvo y salió "Game over por interbloqueo" |
| El inspector calcula bien M_k = M_{k−1} + Aᵀ·u_k | 3 disparos a mano (t1a, tr_ir, tr_volver) | sí | Marcado a mano [0,1,0,1,1,0,0,0,0] = marcado del juego [0,1,0,1,1,0,0,0,0]; el inspector muestra: "k = 3   u_k = [0, 0, 0, 0, 0, 0, 0, 1]ᵀ  (dispara tr_volver) M_k = M_{k−1} + Aᵀ·u_k" |
| HUD completo en las zonas del GDD y 6 logros con aviso | Comparar con la sección 14 del GDD | sí | Captura `docs/capturas/hud_partida_turno1.png`. En los 3 turnos a x4 salieron 5 de los 6 logros con su aviso; Doble husillo se comprueba en `test/turnos.test.js` |

### a.2 Criterios CA del GDD (sección 16) comprobados con el núcleo

| N.º | Criterio | Cómo se prueba | Observado | ¿Cumple? |
|---|---|---|---|---|
| CA-04 | El estado prohibido nunca se alcanza | i con el mandril abierto y a con la CNC fresando | i: supervisor; a: supervisor; CNC = Fresando, Brazo = Mandril_Cerrado | sí |
| CA-05 | Cada intento bloqueado resta 15 puntos | Dos intentos bloqueados | puntaje -30 (−30 de dos intentos; la pieza aún no se descarga) | sí |
| CA-06 | Despachar AGV1 y AGV2 lleva a game over con [0,0,0,0,1,1,0,0,0] y −200 | Dos despachos seguidos en M0 | M = [0,0,0,0,1,1,0,0,0], deadlock = true, puntaje = -200 | sí |
| CA-07 | Con el Controlador, t2a no se dispara tras t1a, hay aviso y no se restan puntos | Comprar, despachar AGV1 y AGV2 | motivo = celda; puntaje antes -150 y después -150; deadlock = false | sí |
| CA-08 | Árbol de cobertura: 14 nodos, 8 marcados, 1 muerto; con el Controlador 12, 7 y 0 | arbolCobertura desde M0 en las dos redes | original 14 / 8 / 1; corregida 12 / 7 / 0 | sí |
| CA-09 | Radar: verde en M0, amarillo en M1/M2 y rojo en el marcado muerto | Despachar AGV1, esperar t1b, y provocar el deadlock | colores: verde → amarillo → verde → rojo | sí |
| CA-10 | De amarillo a verde suma +25 | Despachar AGV1 y esperar t1b | puntaje tras volver a verde = 25 | sí |
| CA-11 | Tiempos: brazo 2 s, fresado 10 s, viaje del AGV 4 s, descarga 5 s | Medir con el reloj a velocidad x1 | brazo 2 s, fresado 10 s, viaje 4 s, descarga 5 s | sí |
| CA-12 | Falla entre 2 y 8 s después de i; con la semilla 2026 la secuencia siempre es la misma | Dos corridas de 120 s con la semilla 2026 y una con otra | misma semilla: idéntica; otra semilla: distinta | sí |
| CA-12b | El instante de la falla es uniforme entre 2 s y 8 s | 200 fallas con semillas distintas | mínimo 2.00 s, máximo 7.98 s | sí |
| CA-13 | Probabilidad de falla 10 %, 20 % y 30 % por turno | 1000 fresados por turno | turno 1: 10.6 %; turno 2: 19.3 %; turno 3: 29.7 % | sí |
| CA-14 | Pedidos cada 25, 18 y 12 s y un pedido sin atender vence a los 30 s con −20 | Contar pedidos en 179 s y esperar un vencimiento | pedidos por turno: 7, 9, 14; primer pedido vence a los 55 s, puntaje -20 | sí |
| CA-16 | Un AGV no descarga sin la mesa y el brazo (AND-join) | AGV1 llega con el brazo fuera | AGV1 = Esperando; falta: Robot_libre; t1b habilitada = false | sí |
| CA-17 | El puntaje de cada acción coincide con la sección 8 | Ejecutar cada acción | pieza +100; ayuda -20; Controlador -150; palabra inválida -30; reparación válida +50; ciclo de AGV +40, bloqueo −15, pedido vencido −20, radar +25 y deadlock −200 (ver CA-05, CA-06, CA-10, CA-14 y tests) | sí |
| CA-19 | Las velocidades y la pausa no cambian el resultado del turno | Misma partida con pasos de reloj de 0,05 s, 0,25 s y 1 s | resultados idénticos | sí |
| CA-23 | El Controlador no se compra en el marcado muerto y se pierde al terminar el turno | Intentar comprarlo en deadlock; terminar un turno con Controlador | en deadlock: deadlock; desactivarControlador() devuelve la red original (ver tests/turnos.test.js) | sí |

Cumplen 16 de 16. Los demás criterios (CA-01 a CA-03, CA-18, CA-20 a CA-22) se comprueban en las tablas de arriba y de los literales c y f, y con `npm test`.

### a.3 Tres turnos completos a velocidad x4 (demostración, Edge sin ventana)

| Turno | Resultado | Piezas / meta | Fallas (reparadas) | Intentos bloqueados | Pedidos vencidos | Deadlocks evitados | Puntaje del turno | Tiempo (s) | Logros nuevos |
|---|---|---|---|---|---|---|---|---|---|
| 1 | victoria | 3 / 3 | 0 (0) | 0 | 0 | 1 | 365 | 47.1 | primera_pieza, manos_seguras |
| 2 | victoria | 5 / 5 | 3 (3) | 0 | 0 | 7 | 950 | 106.5 | ojo_de_radar, mecanico_fino |
| 3 | victoria | 7 / 7 | 3 (3) | 0 | 0 | 16 | 1545 | 169.7 | sin_red_de_seguridad |

Puntaje total: 2860. Sin errores en la consola del navegador. Capturas: `docs/capturas/pruebas_resultados_turno1.png`, `..._turno2.png` y `..._turno3.png`.
**Nota (balance):** esta corrida es anterior al ajuste de balance y se hizo con la meta del turno 3 en 7 piezas (por eso dice 7 / 7). El equipo bajó esa meta a 6 piezas (GDD, sección 17, decisión 14); con la meta nueva el turno 3 se midió con `scripts/balance.mjs`: el piloto gana 27 de 30 con una decisión por segundo y 0 de 30 con una cada 2 s (`docs/datos/balance.json`).


---

## b) Conformidad entre el modelo y el juego

Resultado del cálculo independiente sobre los archivos de `modelos/` contra el núcleo del juego (68 comparaciones, 0 diferencias).

### b.1 Secuencias de eventos o de disparos

| Secuencia | Resultado en JFLAP o PIPE2 (estado o marcado) | Resultado en el juego | ¿Coincide? |
|---|---|---|---|
| CNC: `cifd` | Libre | Libre | sí |
| CNC: `cixr` | Libre | Libre | sí |
| CNC: `cif` | Terminado | Terminado | sí |
| Brazo: `mlaedm` | null | null | sí |
| Brazo: `mlace` | Mandril_Cerrado | Mandril_Cerrado | sí |
| AGV: `vguz` | Libre | Libre | sí |
| Disparos: t1a → t2a | [0,0,0,0,1,1,0,0,0] | [0,0,0,0,1,1,0,0,0] | sí |
| Disparos: t1a → t1b → t1c | [1,1,1,1,0,0,0,0,0] | [1,1,1,1,0,0,0,0,0] | sí |
| Disparos: tr_ir → t1a | [0,0,0,1,1,0,0,0,1] | [0,0,0,1,1,0,0,0,1] | sí |

Total de comparaciones: 68. Diferencias: 0.

### b.2 Datos de la composición y de la red

| Dato | Software académico (cálculo independiente sobre los .jff) | Juego | ¿Coincide? |
|---|---|---|---|
| N.º de estados de CNC ‖ Brazo | 20 | 20 | sí |
| N.º de transiciones de CNC ‖ Brazo | 43 | 43 | sí |
| N.º de estados del sistema supervisado | 19 | 19 | sí |
| N.º de transiciones del sistema supervisado | 38 | 38 | sí |
| Eventos controlables que deshabilita | a en (Fresando, Mandril_Cerrado); i en (Cargado, Mandril_Abierto) | 2 (iniciar_fresado y abrir_mandril) | sí |

| Propiedad | Software académico (cálculo propio sobre el .pnml) | Juego | ¿Coincide? |
|---|---|---|---|
| N.º de lugares y de transiciones | 9 y 8 | 9 y 8 | sí |
| Marcado inicial M0 | [1,1,1,1,0,0,0,0,0] | [1,1,1,1,0,0,0,0,0] | sí |
| Capacidad k por lugar | 1 (todos) | 1 (todos) | sí |
| Marcados alcanzables distintos | 8 | 8 | sí |
| N.º de nodos del árbol de cobertura desde M0 | 14 | 14 | sí |
| Marcado muerto (deadlock) | [0,0,0,0,1,1,0,0,0] | [0,0,0,0,1,1,0,0,0] | sí |
| Secuencia más corta al deadlock | t1a → t2a | t1a y t2a (en cualquier orden) | sí |
| ¿Acotada y segura (1-acotada)? | sí: ningún marcado supera k = 1 | sí (sin ω) | sí |
| Invariantes P (cada suma vale 1 en todo marcado alcanzable) | IP1 a IP4 se conservan | se comprueban en test/redPetri.test.js | sí |
| Red corregida (Celda_libre): nodos / marcados / muertos | 12 / 7 / 0 | 12 / 7 / 0 | sí |

### b.3 Palabras de prueba por máquina

| Autómata | Palabra | Resultado en JFLAP (.jff) | Resultado en el juego | ¿Coincide? |
|---|---|---|---|---|
| CNC | `ε` | acepta, estado Libre | acepta, estado Libre | sí |
| CNC | `cifd` | acepta, estado Libre | acepta, estado Libre | sí |
| CNC | `cixr` | acepta, estado Libre | acepta, estado Libre | sí |
| CNC | `cifdcifd` | acepta, estado Libre | acepta, estado Libre | sí |
| CNC | `cixrcifd` | acepta, estado Libre | acepta, estado Libre | sí |
| CNC | `ci` | rechaza, estado Fresando | rechaza, estado Fresando | sí |
| CNC | `cif` | rechaza, estado Terminado | rechaza, estado Terminado | sí |
| CNC | `ifd` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| CNC | `cc` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| CNC | `cifdd` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| Brazo | `ε` | acepta, estado Reposo | acepta, estado Reposo | sí |
| Brazo | `mlm` | acepta, estado Reposo | acepta, estado Reposo | sí |
| Brazo | `mlaedm` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| Brazo | `mlacedm` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| Brazo | `mlaedmmlm` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| Brazo | `ml` | rechaza, estado Mandril_Cerrado | rechaza, estado Mandril_Cerrado | sí |
| Brazo | `mla` | rechaza, estado Mandril_Abierto | rechaza, estado Mandril_Abierto | sí |
| Brazo | `mlace` | rechaza, estado Mandril_Cerrado | rechaza, estado Mandril_Cerrado | sí |
| Brazo | `ma` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| Brazo | `mm` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| AGV | `ε` | acepta, estado Libre | acepta, estado Libre | sí |
| AGV | `vguz` | acepta, estado Libre | acepta, estado Libre | sí |
| AGV | `vguzvguz` | acepta, estado Libre | acepta, estado Libre | sí |
| AGV | `v` | rechaza, estado Viajando | rechaza, estado Viajando | sí |
| AGV | `vg` | rechaza, estado Esperando | rechaza, estado Esperando | sí |
| AGV | `vgu` | rechaza, estado Descargando | rechaza, estado Descargando | sí |
| AGV | `gu` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| AGV | `vv` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |
| AGV | `vguzv` | rechaza, estado Viajando | rechaza, estado Viajando | sí |
| AGV | `z` | rechaza (paso sin definir) | rechaza (paso sin definir) | sí |

---

## c) Consola de reparación

Se escribió cada palabra con el teclado en el HUD de la CNC1 en Falla y se pulsó Enter. Capturas: `pruebas_consola_HCTCR.png` y `pruebas_consola_HTCR.png`.

| Palabra ingresada | ¿Pertenece a L según JFLAP? | Resultado en el juego (reparó o no) | Estado final de la máquina | Puntos |
|---|---|---|---|---|
| `HCTCR` | sí | reparó | Libre | +50 |
| `HCR` | sí | reparó | Libre | +50 |
| `HCTR` | sí | reparó | Libre | +50 |
| `HCCTCR` | sí | reparó | Libre | +50 |
| `HTCR` | no | no reparó (la consola se borra) | Falla | -30 |
| `HR` | no | no reparó (la consola se borra) | Falla | -30 |
| `HCT` | no | no reparó (la consola se borra) | Falla | -30 |
| `HCTTR` | no | no reparó (la consola se borra) | Falla | -30 |

---

## d) Deadlock: provocar y prevenir

| Prueba | Secuencia de decisiones del jugador | Color del radar antes del final | Resultado |
|---|---|---|---|
| Provocar el deadlock de la ficha | Despachar AGV1 y, sin esperar, Despachar AGV2 (botones de la barra) | verde → amarillo → rojo | Marcado muerto [0,0,0,0,1,1,0,0,0], reloj detenido, "Game over por interbloqueo" y -200 puntos. Captura `pruebas_deadlock_game_over.png` |
| Repetir aplicando la regla de prevención | "Reintentar y comprar el Controlador de celda"; luego Despachar AGV1 y Despachar AGV2 | verde → verde → verde | t2a no se dispara (aviso "Controlador de celda activo"), marcado [0,1,0,1,1,0,0,0,0,0], sin deadlock, sin restar puntos por el aviso; AGV1 terminó su ciclo (1 ciclo) y el radar sigue en verde. Captura `pruebas_controlador_previene.png` |
| Llegar a amarillo y salir a verde con una buena decisión | Despachar solo el AGV1 y esperar a que t1b se dispare | verde → amarillo → verde | +25 puntos (puntaje 25). Capturas `pruebas_radar_amarillo.png` y `pruebas_radar_verde.png` |

---

## e) Supervisor

Con el HUD de la CNC1 abierto y haciendo clic en los botones en rojo.

| Intento o evento no observable | Lo esperado según el modelo | Lo que pasó en el juego | ¿Cumple? |
|---|---|---|---|
| Iniciar el fresado con el mandril abierto (clic en el botón rojo i), 3 veces | `i` está deshabilitado en (Cargado, Mandril_Abierto); no se ejecuta y cada intento resta 15 | Estado (CNC · Brazo · puntos · bloqueos): antes "Cargado · Mandril_Abierto · 0 · 0", tras el 1.º "Cargado · Mandril_Abierto · -15 · 1", tras el 3.º "Cargado · Mandril_Abierto · -45 · 3" | sí |
| Abrir el mandril con la CNC fresando (clic en el botón rojo a) | `a` está deshabilitado en (Fresando, Mandril_Cerrado) | antes "Fresando · Mandril_Cerrado · -45 · 3", después "Fresando · Mandril_Cerrado · -60 · 4" | sí |
| Despachar el AGV2 con el robot ocupado (estación incompleta, AND-join) | No se dispara sin la ficha Robot_libre (no es un intento bloqueado: no resta puntos) | {"ok":false,"motivo":"recurso"}; 1,0,1,1,0,0,0,0,1 falta: Robot_libre | sí |

El proyecto no tiene eventos no observables (Σuo = ∅), por eso no hay autómata observador. Capturas: `pruebas_supervisor_boton_rojo.png` y `pruebas_supervisor_abrir_con_cnc_fresando.png`.

---

## f) Controles alternos

| Acción | Mouse y teclado | ¿Funciona? | Táctil | ¿Funciona? |
|---|---|---|---|---|
| Seleccionar máquina y abrir HUD | Clic | sí | Tocar | sí |
| Disparar evento o transición | Clic en el botón | sí | Tocar el botón | sí |
| Escribir en la consola de reparación | Teclado (H, C, T, R, Retroceso, Enter) | sí | Botones de comandos (se tocó H, C, R y Enviar: palabra "HCR", CNC Libre) | sí |
| Pausa e inspector | P, I | sí | Botones en pantalla | sí |
| Velocidad de simulación | 1, 2, 4 (se leyó 2 y 4) | sí | Botón de velocidad (x4: 4) | sí |
| Mover la cámara | Arrastre | sí | Arrastre con un dedo | sí (emulación móvil, `scripts/movil-navegador.mjs`) |
| Acercar la cámara | Rueda | sí | Pellizco con dos dedos | sí (emulación móvil: zoom 1,00 → 2,00) |

Nota (actualizada): con la emulación móvil de Edge (`Emulation.setTouchEmulationEnabled` y `Input.dispatchTouchEvent`) el arrastre y el pellizco sí llegan a Phaser y se verificaron en la última ronda; la versión anterior de esta nota decía que no (se usaba otra emulación). Sigue pendiente probar en un teléfono real. Texto anterior: El arrastre y el pellizco están implementados (dos punteros, ver `src/entrada/gestorEntrada.js`), pero hay que probarlos en un teléfono o una tableta antes de entregar.

---

## g) Rendimiento

Medido con `juego.loop.actualFps` (promedio de 8 muestras). Equipo de prueba: Windows 11, Microsoft Edge sin ventana con render por software (SwiftShader, sin GPU). Es un caso mucho más lento que un computador con GPU.

| Momento | fps sin efectos | fps con efectos | Equipo y navegador |
|---|---|---|---|
| Inicio del turno | 53 | 60 | Edge sin ventana, render por software |
| Hora pico a velocidad x4 | 53 | 55 | Edge sin ventana, render por software |
| Inspector abierto con el árbol de cobertura | 43 | 22 | Edge sin ventana, render por software |

"Sin efectos" es `?efectos=0`: sin partículas, bloom ni glow. Si el juego baja de 50 fps durante 4 s seguidos, el modo reducido se activa solo (docs/decisiones_por_confirmar.md, n.º 7). El radar se calcula en menos de 1 ms por disparo, así que no hizo falta calcularlo cada 0,5 s.

---

## h) Prueba de juego con otro equipo (playtest)

**Pendiente.** Requiere que otro equipo juegue un turno sin explicaciones. Preguntas para después de jugar: ¿entendieron por qué un botón estaba en rojo?, ¿vieron venir el deadlock en el radar?, ¿qué fue lo más difícil? y ¿qué cambiarían?

| Observación del otro equipo | Cambio realizado | Sección a la que se regresó |
|---|---|---|
| (sin datos todavía) | | |

---

## i) Mejoras tras el playtest (revisión final)

Ver `docs/informe.md`, sección 2.i, y `docs/GDD.md`, secciones 18.10 a 18.16. Resumen de lo medido:

| Prueba | Script | Resultado |
|---|---|---|
| Clics, ruedas y teclas al azar, 3 turnos a x4 y a x2 | `scripts/azar-navegador.mjs juego` | 0 excepciones, 0 bloqueos de la interfaz, los 3 turnos llegan a resultados |
| Tutorial completo | `scripts/azar-navegador.mjs tutorial` | Llega al paso "fin" con la vista de red abierta |
| Flujos de pausa, ayuda, game over y título | `scripts/azar-navegador.mjs flujos` | 16 de 16 |
| Celular (360 x 640, 640 x 360, 800 x 360, 844 x 390) | `scripts/movil-navegador.mjs` | Sin scroll, aviso de girar en vertical, toque, arrastre y pellizco bien; botones de 29 a 32 px en pantalla |
| Balance | `scripts/balance.mjs` | Con la meta nueva del turno 3 (6 piezas, decisión del equipo): el piloto gana 27/30 a 1 s por decisión, 15/30 a 1,5 s y 0/30 a 2 s (con 7 piezas: 21/30, y 0/30 a 2 s). Tabla en `docs/decisiones_por_confirmar.md` |
| Pruebas unitarias | `npm test` | 137 de 137 (las de turnos y de textos ya comprueban la meta de 6 piezas) |

Las capturas de esta ronda están en `docs/capturas/` con el prefijo `final_`.

