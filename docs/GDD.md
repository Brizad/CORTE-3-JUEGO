# GDD: RoboCell Tycoon 2.5D

Documento de diseño del juego. Versión 1.0.

- **Plataforma:** navegador. Phaser 4.2.1 por CDN, Vite y JavaScript. Mouse, teclado y táctil.
- **Modelo formal:** `docs/modelo/automatas.md` y `docs/modelo/petri.md`. Mandan sobre este documento.
  Este GDD no cambia ningún estado, evento, peso, capacidad ni M0.
- **Arte:** `docs/arte.md`.
- **Tiempo:** todos los tiempos son segundos de simulación (s), no segundos de reloj de pared.

## 1. Concepto

El jugador es el **jefe de turno** de una celda de manufactura con **2 CNC, 1 brazo y 2 AGV**.
Los dos AGV comparten **1 mesa de descarga** y el **brazo**. El mismo brazo atiende las CNC.

- **Gana el turno** si cumple la meta de piezas dentro de los 180 s.
- **Pierde el turno** si la celda queda en deadlock.
- Son 3 turnos con dificultad creciente.

El juego es una simulación de eventos discretos. El jugador no mueve piezas con la mano.
Decide **cuándo disparar** cada evento controlable. El resto del sistema avanza solo,
según los autómatas y la red de Petri.

## 2. Pilares

1. **El modelo manda.** Cada botón, cada color y cada penalización viene de un estado, un evento
   o una transición del modelo formal.
2. **Un deadlock se ve venir.** El radar avisa antes de que ocurra. El jugador que lee el radar lo evita.
3. **Una mala decisión cuesta.** Despachar los dos AGV a la vez bloquea la celda. No hay trampas ocultas.
4. **Dificultad por presión de tiempo y de recursos,** no por reglas nuevas.

## 3. MDA

| Capa | Contenido |
|---|---|
| **Mecánicas** | Disparar eventos controlables (c, i, d, r, m, a, e y t1a, t2a, tr_ir). Teclear la palabra de reparación (H, C, T, R). Comprar el Controlador de celda. Cambiar la velocidad y pausar. |
| **Dinámicas** | Competencia por la mesa y el brazo entre AGV1, AGV2 y las CNC. Riesgo de deadlock cuando se despachan los dos AGV. Fallas aleatorias del husillo que obligan a reparar. Presión de pedidos que vencen a los 30 s. |
| **Estéticas** | **Desafío:** cumplir la meta sin bloquear la celda. **Descubrimiento:** entender por qué el supervisor deshabilita un botón. **Sumisión:** el ritmo de la planta. **Narrativa mínima:** ser el jefe de turno. |

## 4. Ciclos de juego

### 4.1 Ciclo corto: atender una máquina (5 a 25 s)

1. El jugador hace clic en una máquina y se abre su HUD.
2. Ve el estado actual del autómata y los eventos controlables. Los habilitados están activos y los
   deshabilitados por el supervisor están en rojo.
3. Dispara un evento. El estado cambia por δ.
4. Recibe retroalimentación: color e ícono del estado, sonido, puntos flotantes.

Ejemplo, cargar una CNC: `m` (mandar el brazo), esperar `l` (2 s), `a` (abrir), `c` (cargar), `e` (cerrar).
El brazo vuelve solo con tr_volver. Luego `i` (iniciar fresado).

### 4.2 Ciclo medio: completar un pedido o una pieza (20 a 60 s)

- **Pieza:** cargar una CNC, fresar 10 s, descargar con el brazo. Cuenta como pieza descargada (+100).
- **Pedido de AGV:** despachar un AGV (t1a o t2a), esperar 4 s a que llegue, dejar que el brazo
  lo descargue 5 s y cerrar el ciclo (t1c o t2c, +40). Eso atiende el pedido más antiguo.
- Si una CNC falla, el jugador repara con la consola (H, C, T, R) antes de volver a usarla.

### 4.3 Ciclo largo: terminar el turno (180 s)

1. Empieza el turno con M0 y las dos CNC libres.
2. El jugador alterna piezas, pedidos y reparaciones mientras vigila el radar.
3. El turno termina al cumplir la meta (victoria) o al llegar a 180 s sin meta, o por deadlock.
4. Pantalla de resumen: puntaje, logros y botón para el siguiente turno o para reintentar.

## 5. Mecánicas y su elemento formal

Cada fila cita lo que la produce. El juego no añade reglas fuera de esta tabla.

| Mecánica | Elemento formal que la produce | Fuente |
|---|---|---|
| Cargar una CNC | Evento `c` cargar (controlable, compartido). CNC: Libre → Cargado. Brazo: Mandril_Abierto → Mandril_Abierto (bucle) | `CNC.jff`, `Brazo.jff` |
| Iniciar fresado | Evento `i` (controlable). CNC: Cargado → Fresando | `CNC.jff` |
| Fresado termina solo | Evento `f` fin_fresado (no controlable). CNC: Fresando → Terminado | `CNC.jff` |
| Falla del husillo | Evento `x` falla_husillo (no controlable). CNC: Fresando → Falla | `CNC.jff` |
| Reparar | Evento `r` reset (controlable). CNC: Falla → Libre. Se habilita si la palabra tecleada es aceptada por el DFA de reparación | `CNC.jff`, `Reparacion_DFA.jff` |
| Descargar una CNC (pieza) | Evento `d` descargar (controlable, compartido). CNC: Terminado → Libre. Brazo: Mandril_Abierto → Mandril_Cerrado | `CNC.jff`, `Brazo.jff` |
| Mandar el brazo | Evento `m` mover (controlable). Brazo: Reposo → Moviendo. Transición **tr_ir** (Robot_libre → Robot_en_CNC) | `Brazo.jff`, `robocell.pnml` |
| Brazo llega | Evento `l` llegar (no controlable). Brazo: Moviendo → Mandril_Cerrado | `Brazo.jff` |
| Abrir y cerrar el mandril | Eventos `a` abrir_mandril y `e` cerrar_mandril (controlables) | `Brazo.jff` |
| Brazo vuelve a reposo (a mano, botón "volver") | Evento `m` desde Mandril_Cerrado, solo con el brazo en Mandril_Cerrado. Transición **tr_volver** | `Brazo.jff`, `robocell.pnml` |
| Brazo vuelve a reposo (automático) | Evento `m` desde Mandril_Cerrado. Transición **tr_volver** (Robot_en_CNC → Robot_libre) | `Brazo.jff`, `robocell.pnml` |
| Despachar AGV1 | Transición **t1a** (AGV1_listo + Mesa_libre → AGV1_con_mesa). Evento `v` reservar (controlable). AGV: Libre → Viajando | `AGV.jff`, `robocell.pnml` |
| Despachar AGV2 | Transición **t2a** (AGV2_listo + Robot_libre → AGV2_con_robot). Evento `v` reservar. AGV: Libre → Viajando | `AGV.jff`, `robocell.pnml` |
| AGV llega a la estación (automático) | Evento `g` llegar_estacion (no controlable). AGV: Viajando → Esperando. Sin transición en la red | `AGV.jff` |
| AGV empieza a descargar (automático) | Transiciones **t1b** / **t2b**. Evento `u` iniciar_descarga. AGV: Esperando → Descargando | `AGV.jff`, `robocell.pnml` |
| AGV termina y libera recursos (automático) | Transiciones **t1c** / **t2c**. Evento `z` fin_descarga (no controlable). AGV: Descargando → Libre | `AGV.jff`, `robocell.pnml` |
| Un recurso a la vez | Capacidad k = 1 en los lugares. Invariantes IP1 (mesa) e IP2 (brazo) | `petri.md` §2 y §7 |
| Botón en rojo (CNC y brazo) | Regla del supervisor: ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto). Deshabilita `i` en (Cargado, Mandril_Abierto) y `a` en (Fresando, Mandril_Cerrado) | `automatas.md` §6 |
| Deadlock y game over | Marcado muerto [0,0,0,0,1,1,0,0,0], tras `t1a` y `t2a` | `petri.md` §6.3 |
| Radar del árbol de cobertura | Marcados alcanzables en un disparo desde el marcado actual (árbol de 14 nodos) | `petri.md` §6.4 |
| Controlador de celda | Lugar monitor **Celda_libre** (p10, k = 1), red `robocell_corregida.pnml`. Invariante IP5 | `petri.md` §8 |
| Inspector | Muestra marcado M, transiciones habilitadas, estado de cada autómata y los nodos del árbol | `petri.md` |
| Pedido de AGV | Llegada externa del reloj. No es un evento de los autómatas ni una transición | Ficha del proyecto |

### 5.1 Reglas de integración (sin cambiar el modelo)

- **Sincronización por producto.** Una transición de la red de Petri y su evento del autómata se disparan
  juntos solo si ambos están habilitados. Ejemplo: t1b se dispara cuando AGV1_con_mesa y Robot_libre
  tienen ficha **y** el AGV1 está en Esperando.
- **Dos CNC, un supervisor por CNC.** Hay una instancia del supervisor por cada CNC. La regla vale
  para la CNC **que el brazo atiende**. El jugador la elige al mandar el brazo (m). La otra CNC puede
  estar fresando sin restricción. Esto hace posible el logro Doble husillo.
- **Todo cambio de estado pasa por δ o por un disparo.** No hay atajos con `if` en el juego.
- **Pedidos independientes de las piezas.** Los AGV no entregan materia prima. Las piezas dependen
  solo del ciclo CNC + brazo. Los AGV compiten con ellas por el brazo y la mesa.

## 6. Tiempos (segundos de simulación)

| Evento o proceso | Duración | Elemento formal |
|---|---|---|
| mover → llegar (brazo, ida a una CNC) | **2 s** | `m` → `l` |
| tr_volver (brazo regresa a Reposo) | 0 s | `m` desde Mandril_Cerrado (no tiene `llegar`) |
| Fresado completo (iniciar_fresado → fin_fresado) | **10 s** | `i` → `f` |
| falla_husillo si hay falla | entre **2 s y 8 s** después de `i`, al azar uniforme | `i` → `x` |
| reservar → llegar_estacion (AGV viaja) | **4 s** | `v` → `g` |
| iniciar_descarga → fin_descarga (AGV descarga) | **5 s** | `u` → `z` |
| Pedido de AGV (llegada del reloj) | cada **25 s**, **18 s** o **12 s** según el turno | Reloj externo |
| Pedido vencido | **30 s** sin ser atendido | Reloj externo |
| Duración del turno | **180 s** | Reloj |

- **Velocidades:** x1, x2 y x4. Cambian cuántos segundos de simulación pasan por cada segundo real.
  El resultado no cambia con la velocidad.
- **Semilla:** **2026**. Un solo generador pseudoaleatorio decide si cada fresado falla y cuándo.
  Con la misma semilla y las mismas acciones, el turno es idéntico.
- **Reintento:** al reintentar un turno se restaura el estado del generador del inicio de ese turno.

### 6.1 Entregas de metal por turno (los "pedidos" de AGV)

Los pedidos llegan en t = n × intervalo, para n ≥ 1 y t < 180 s.

| Turno | Intervalo | Pedidos en el turno |
|---|---|---|
| 1 | 25 s | 7 (25, 50, …, 175 s) |
| 2 | 20 s | 8 (20, 40, …, 160 s) |
| 3 | 18 s, y cada 4 entregas llega otra 2 s después | 11 (18, 36, 54, 72, 74, 90, 108, 126, 144, 146, 162 s) |

**Actualizado en 18.20:** el equipo cambió estos valores (la guía no los fija) y en el juego cada pedido es una **entrega de metal**
que trae un AGV. El modelo no cambia: es el mismo evento `v` y las mismas transiciones t1a y t2a.

## 7. Turnos y dificultad

| Turno | Duración | Meta | Prob. de falla por fresado | Intervalo de pedidos |
|---|---|---|---|---|
| 1 | 180 s | 6 piezas | 10 % | 25 s (plazo 30 s) |
| 2 | 180 s | 8 piezas | 15 % | 20 s (plazo 30 s) |
| 3 | 180 s | 8 piezas | 20 % | 18 s con parejas (plazo **20 s**) |

**Valores actualizados en 18.20** (decisión del equipo, calibrada con `scripts/balance.mjs`). Los de antes eran 3, 5 y 6 piezas, fallas de
10, 20 y 30 % y pedidos cada 25, 18 y 12 s. Los valores de puntaje (sección 8) no cambian.

- **Historia del balance:** el turno 3 pasó de 7 a 6 piezas por la medición con el piloto (sección 15) y luego se recalibraron los 3 turnos en 18.20 (jugadores que operan paso a paso).
- Cada turno empieza en M0 y con las 2 CNC y el brazo en su estado inicial (q0).
- El Controlador de celda **no se conserva** entre turnos (ver 10).
- El puntaje se acumula entre turnos.

## 8. Puntaje

| Acción | Puntos |
|---|---|
| Pieza descargada (evento `d` de la CNC) | **+100** |
| Ciclo de AGV (t1c o t2c) | **+40** |
| Reparación válida | **+50** |
| Palabra de reparación inválida | **−30** |
| Pedir ayuda (ver la expresión regular) | **−20** |
| Intento bloqueado por el supervisor | **−15** |
| Pedido vencido (a los 30 s) | **−20** |
| Radar de amarillo a verde | **+25** |
| Comprar el Controlador de celda | **−150** |
| Deadlock (game over del turno) | **−200** |

Reglas de aplicación:

- **Intento bloqueado:** un clic en un botón en rojo. Rojo significa que el evento está definido en δ y
  los recursos están, pero el **supervisor CNC ‖ Brazo** lo inhibe. Un botón en gris significa
  que el evento no existe en ese estado: el clic no hace nada y no cuesta puntos.
- **Bloqueo por Celda_libre:** no es un intento bloqueado. Si el Controlador de celda está activo y el
  jugador pulsa t1a o t2a sin ficha en Celda_libre, el juego muestra el aviso "Controlador de celda activo"
  en la zona de alertas. No resta puntos y no cuenta para el logro Manos seguras.
- **Pedir ayuda:** muestra la expresión regular `^H(CT?)+R$` durante 5 s. Se puede pedir más de una vez y
  cada vez cuesta −20.
- **Radar de amarillo a verde:** se otorga una vez por cada regreso a verde, con un enfriamiento de
  **20 s** entre dos premios. Evita ganar puntos repitiendo la misma jugada.
- **Ciclo de AGV:** cada t1c o t2c da +40 y atiende el pedido pendiente más antiguo, si lo hay.
- **Pedido vencido:** cada pedido penaliza una sola vez, al cumplir 30 s sin ser atendido.
  Un pedido vencido sigue pendiente y puede atenderse más tarde.

## 9. Radar del árbol de cobertura

El radar se calcula a partir del marcado actual M de la red de Petri.

| Color | Condición | En la red original |
|---|---|---|
| **Verde** | Ningún disparo habilitado lleva a un marcado muerto | Marcados M0, M3, M4, M6 y M7 |
| **Amarillo** (parpadea) | Algún disparo habilitado lleva a un marcado muerto | Marcados M1 (t2a lleva a M5) y M2 (t1a lleva a M5) |
| **Rojo** | El marcado es muerto | Marcado M5 = [0,0,0,0,1,1,0,0,0] |

Los nombres M0..M7 son los de `petri.md` §6.2. Con el Controlador de celda activo el radar es siempre verde
mientras no haya deadlock, porque el árbol corregido (12 nodos) no tiene marcados muertos.

## 10. Mejora: Controlador de celda

- Cuesta **−150 puntos**. Se puede comprar antes de empezar el turno o durante él, con el botón "Controlador de celda (−150)"
  de la barra de despacho (abajo a la izquierda). Cambia a `red_agv_corregida.json` conservando el marcado.
- Activa el lugar monitor **Celda_libre** (p10, k = 1) de la red corregida `robocell_corregida.pnml`.
- Al activarse, Celda_libre recibe 1 − (p5 + p6 + p7 + p8) fichas, para respetar el invariante IP5.
  No se puede comprar en el marcado muerto (suma = 2).
- Efecto: t1a y t2a toman la ficha de Celda_libre y t1c y t2c la devuelven. Solo un AGV puede estar
  en la celda a la vez, así que el deadlock deja de ser alcanzable.
- Dura **solo el turno actual**. Al terminar el turno se desactiva y la red vuelve a la original.
- Costo oculto: los AGV se serializan, así que el rendimiento de pedidos baja.

## 11. Victoria y derrota

**Victoria del turno:** el contador de piezas llega a la meta antes de los 180 s y no hay deadlock.

**Victoria de la partida:** se ganan los 3 turnos.

**Derrota del turno:**

| Causa | Qué pasa |
|---|---|
| **Deadlock** (marcado muerto, sin transición habilitada) | Game over del turno. Se aplica **−200**. La pantalla muestra el marcado muerto [0,0,0,0,1,1,0,0,0] y la secuencia que lo produjo |
| Se acaban los 180 s sin cumplir la meta | Turno fallido. Sin penalización de puntos extra |

**Pantalla de game over por interbloqueo:** la simulación se detiene (reloj en pausa) y se aplica −200 una sola vez. Muestra el
marcado muerto [0,0,0,0,1,1,0,0,0], la secuencia de disparos desde el último marcado verde (t1a → t2a), qué espera cada AGV y la
regla de prevención: el lugar monitor Celda_libre (p10) y el invariante IP5. Dos botones: **Reintentar desde el último marcado
verde** y **Reintentar y comprar el Controlador de celda** (−150). El reintento restaura el marcado, los autómatas, los pedidos y el
generador de ese instante, y vuelve a programar los eventos que estaban en curso con su duración completa. El puntaje se conserva.

Tras una derrota, el jugador puede **reintentar el turno** con la misma semilla y el estado del generador
del inicio del turno. El puntaje del turno fallido se conserva (incluido el −200).

## 12. Logros

| N.º | Logro | Condición verificable |
|---|---|---|
| L1 | **Primera pieza** | Se dispara el evento `d` de una CNC por primera vez en la partida |
| L2 | **Mecánico fino** | 3 reparaciones válidas seguidas, sin ninguna palabra inválida entre ellas |
| L3 | **Manos seguras** | Terminar un turno ganado con 0 intentos bloqueados por el supervisor |
| L4 | **Ojo de radar** | 3 cambios del radar de amarillo a verde dentro de un mismo turno |
| L5 | **Sin red de seguridad** | Ganar el turno 3 sin haber comprado el Controlador de celda y sin deadlock |
| L6 | **Doble husillo** | Las 2 CNC en el estado Fresando a la vez, **30 s acumulados** en un turno |

El inspector (tecla I) muestra el progreso de cada logro.

## 13. Controles

| Acción | Mouse | Teclado | Táctil |
|---|---|---|---|
| Abrir el HUD de una máquina | Clic en la máquina | — | Toque en la máquina |
| Disparar un evento controlable | Clic en su botón (pestaña «Autómata» o «Acciones») | — | Toque en su botón |
| Brazo: ir a CNC 1 / CNC 2 (m, tr_ir) | Botón de la barra de control | **Z** / **X** | Botón de la barra |
| Brazo: abrir pinza (a) / meter bloque (c) / sacar pieza (d) / cerrar pinza (e) | Botón de la barra | **A** / **C** / **D** / **E** | Botón de la barra |
| Brazo: volver (m, tr_volver) | Botón de la barra | **V** | Botón de la barra |
| Fresar en CNC 1 / CNC 2 (i); en Falla, «Reparar» | Botón de la barra | **F** / **G** | Botón de la barra |
| Atender AGV 1 / AGV 2 (v, t1a o t2a) | Botón de la barra | **Q** / **W** | Botón de la barra |
| Pausa | Botón de pausa | **P** | Botón de pausa |
| Inspector | Botón del inspector | **I** | Botón del inspector |
| Velocidad x1, x2, x4 | Botones de velocidad | **1**, **2**, **4** | Botones de velocidad |
| Cambiar entre «Autómata» y «Acciones» en el panel | Pestañas del panel | **Tab** | Pestañas del panel |
| Cerrar el HUD o un panel | Botón X | **Esc** | Botón X |
| Consola de reparación: símbolos | Botones H, C, T, R | **H**, **C**, **T**, **R** | Botones H, C, T, R |
| Consola de reparación: enviar | Botón Enviar | **Enter** | Botón Enviar |
| Contador de fps | — | **F1** | — |
| Pantalla completa | Botón ⛶ | **L** | Botón ⛶ |
| Silenciar o activar los sonidos | Botón del altavoz | **M** | Botón del altavoz |
| Vista de la red de Petri | Botón "Red" | **R** | Botón "Red" |
| Modo demostración (el piloto juega solo) | — | **F2** | — |
| Mover la cámara | Arrastrar con el botón izquierdo | — | Arrastrar con un dedo |
| Acercar y alejar | Rueda del mouse | — | Pellizco con dos dedos |

Los botones táctiles miden al menos 44 × 44 px de área de toque.

## 14. HUD por zonas

El juego es 960 × 540 px con escala FIT.

| Zona | Contenido |
|---|---|
| **Arriba izquierda** | Reloj del turno (s restantes de 180 s), número de turno (por ejemplo "Turno 2 de 3") y velocidad actual |
| **Arriba centro** | Puntaje y piezas / meta (por ejemplo 2 / 5) |
| **Arriba derecha** | Radar del Árbol de Cobertura (verde, amarillo parpadeante o rojo) con el mini-grafo de los últimos 5 marcados (M0…M7). Se recalcula tras cada disparo con `explorar(red, M, 1)`. De amarillo a verde suma +25 (enfriamiento de 20 s) |
| **Abajo izquierda** | **Fichas por lugar:** p1..p9, y p10 si el Controlador está activo. Cada ficha con su forma y color, 14 px de alto, y su contador m/k. Al pasar el mouse sale el nombre completo del lugar |
| **Abajo derecha** | Alertas: falla de husillo, intento bloqueado, pedido vencido, puntos, Controlador de celda activo y deadlock. El logro sale como un aviso animado arriba, en el centro |
| **Centro** | Planta isométrica de 12 × 10 celdas y el HUD de la máquina seleccionada |

### 14.1 HUD de máquina

Aparece como escena superpuesta al hacer clic en una máquina:

- Grafo del autómata: nodos circulares y flechas con el código del evento.
- Estado actual iluminado.
- Botones de los eventos controlables. Los que el supervisor inhibe se ven en rojo con **glow**.
  Los que inhibe Celda_libre (t1a, t2a) se ven en gris y muestran el aviso "Controlador de celda activo".
- Botones en gris: el evento no es controlable (solo informativo) o ahora no se puede ejecutar. Al pasar el mouse
  explican qué falta. Ejemplo para `cargar` o `descargar`: "El brazo debe estar en Mandril_Abierto frente a esta CNC
  (ahora: Mandril_Cerrado)". También dicen si el brazo atiende a otra CNC o si la CNC no está en el estado que exige el evento.
- Botones en rojo: los inhibe el supervisor. Al pasar el mouse muestran la razón formal ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)
  y el estado (CNC, Brazo).
- **Sección "Brazo en esta CNC"** (solo en el HUD de las CNC): botones del brazo que sirven para esa CNC, con los mismos
  colores verde, gris y rojo. Cada uno se ejecuta por δ del autómata del brazo y, si corresponde, por su transición:
  `m` mover (tr_ir, hacia esta CNC), `a` abrir_mandril, `e` cerrar_mandril y `m` volver (tr_volver, a mano). Así el jugador
  carga y descarga sin cambiar de HUD. Si el brazo atiende a otra CNC, estos botones quedan en gris.
- **Volver (manual):** evento `m` del brazo desde Mandril_Cerrado, con la transición tr_volver. Es el mismo evento de la vuelta
  automática (decisión 4 de la sección 17); solo se puede pedir con el brazo en Mandril_Cerrado.
- Mientras el brazo está en Moviendo, el HUD muestra "Brazo en camino…".
- **Pestaña "Composición"** (solo en el HUD de las CNC, junto a "Autómata"): muestra el tamaño de CNC ‖ Brazo (20 estados,
  43 transiciones), el del sistema supervisado (19 estados, 38 transiciones), el estado prohibido y la regla, el
  **estado compuesto actual** de esa CNC (por ejemplo (Cargado, Mandril_Abierto)), si el supervisor está activo para ella
  (solo lo está cuando el brazo la atiende), los eventos que deshabilita ahora y los intentos bloqueados.
- **Insistir en un botón rojo:** el evento no se ejecuta, la cámara tiembla 0,3 s, la zona de alertas registra el intento y se
  restan −15 puntos. El bloqueo por Celda_libre no cuenta aquí (sección 8).
- Para la CNC en Falla: la consola de reparación (14.2) reemplaza a los botones y a la lista de eventos.
- Para el brazo: "m → CNC1" y "m → CNC2" desde Reposo (tr_ir) y "volver" desde Mandril_Cerrado. Para los AGV: "Despachar AGV1"
  o "Despachar AGV2" según el HUD abierto.
- Mientras un HUD está abierto, el modo demostración no toca esa máquina.
- El panel mide 340 × 392 px y se coloca junto a la máquina (a la derecha, o a la izquierda si la máquina está en la mitad
  derecha de la pantalla). Un HUD abierto tapa lo que queda debajo del panel: se cierra con Esc o con la X.
- Lista de los últimos 10 eventos de la máquina (su palabra observada), con el tiempo de cada uno.

### 14.3 Inspector (tecla I)

Pausa la simulación mientras está abierto y la reanuda al cerrar (si no estaba en pausa antes). Desde 18.21 ocupa toda la pantalla y oculta la barra, las fichas y el tutorial. Pestañas (más «Logros», 18.21):

- **Matrices:** Pre, Post y A = Post − Pre con los nombres de lugares y transiciones; las transiciones habilitadas se resaltan en verde.
  Debajo, la ecuación de estado con números: k, u_k y M_k = M_{k−1} + Aᵀ·u_k. **Probar disparo:** se elige una fila y se ve el
  marcado que resultaría sin aplicarlo; si la transición no está habilitada, la tabla marca en rojo el lugar que no alcanza
  (M < Pre, o lugar lleno por la capacidad) y lo explica.
- **Árbol:** árbol de cobertura desde M0 (14 nodos y 8 marcados en la red original; 12 y 7 con el Controlador) o desde el
  marcado actual con profundidad 4. Los marcados muertos van en rojo, los repetidos en gris y el marcado actual con borde amarillo.
  Muestra el número de nodos.

### 14.4 Botones táctiles, despacho y textos

- **Botones en pantalla** (táctiles, de 44 × 44 px): velocidad x1, x2 y x4 junto al reloj; pausa e inspector junto al radar.
  Tocar equivale a hacer clic.
- **Despacho de AGV:** entre las fichas y las alertas (abajo, en el centro): "Despachar AGV1" (t1a), "Despachar AGV2" (t2a) y
  "Controlador de celda (−150)". Verdes si se pueden usar y grises si no.
- **Sin textos de ayuda fijos:** durante la partida no hay instrucciones escritas en pantalla. Las explicaciones salen solo al pasar el
  mouse o tocar un botón (qué ficha falta, por qué está en gris, qué hace el Controlador).

### 14.5 Turnos, resultados y logros

- **Turnos:** 3 turnos de 180 s con metas de 6, 8 y 8 piezas, falla por fresado de 10, 15 y 20 % y entregas de metal cada 25, 20 y 18 s (18.20).
  El puntaje se acumula entre turnos. Cada turno empieza en M0 con las 2 CNC y el brazo en su estado inicial.
- **Fin del turno:** el turno termina al descargar la pieza de la meta (victoria) o al llegar a 180 s sin ella (derrota). Al terminar se
  llama a `desactivarControlador()` y sale la pantalla de **Resultados**: piezas / meta, fallas reparadas, intentos bloqueados,
  pedidos vencidos, deadlocks evitados (veces que el radar volvió de amarillo a verde), deadlocks sufridos, ciclos de AGV, puntaje del
  turno y total, y los logros. Botón **Siguiente turno** si se ganó, **Reintentar** si se perdió. El reintento usa el estado del
  generador del inicio del turno y conserva el puntaje. Al ganar el turno 3 sale la pantalla de victoria de la partida.
- **Logros** (aviso animado con un tween al ganarlos; el Inspector muestra el progreso en su pestaña Logros):
  Primera pieza (primer evento `d` de una CNC), Mecánico fino (3 reparaciones válidas seguidas), Manos seguras (turno ganado con
  0 intentos bloqueados), Ojo de radar (3 cambios de amarillo a verde en un turno), Sin red de seguridad (ganar el turno 3 sin
  Controlador y sin deadlock) y Doble husillo (las 2 CNC fresando a la vez, 30 s acumulados en un turno).
- **Sonidos** (Web Audio, generados con osciladores): disparo de transición, falla del husillo, reparación válida, botón bloqueado
  por el supervisor, logro y deadlock. La tecla **M** los activa o los silencia.

### 14.2 Consola de reparación

- Cuando una CNC entra en Falla (`x` falla_husillo) aparece una alerta abajo a la derecha y, si su HUD está abierto,
  la consola. Tiene un campo con la palabra w y los comandos del alfabeto: **H** (home de ejes), **C** (chequeo de herramienta),
  **T** (cambio de herramienta) y **R** (reset). También se escribe con el teclado: H, C, T, R, Retroceso y Enter.
- Cada comando avanza el DFA mínimo de 5 estados (`Reparacion_DFA.jff`) y la consola muestra en qué estado va (q0…q4)
  y qué símbolos pueden seguir.
- Si un símbolo no tiene transición, desde ese símbolo la palabra se marca en rojo y la consola explica qué se esperaba.
  Ejemplo: "Después de H se espera C (chequeo de herramienta)". Se puede seguir tecleando; Retroceso quita el último símbolo.
- Al enviar, w se valida con la RegExp anclada `^H(CT?)+R$` y con el DFA; los dos deben coincidir.
- **Válida** (por ejemplo HCTCR o HCR): se dispara `r` por δ y la CNC pasa de Falla a Libre. +50.
- **Inválida** (por ejemplo HTCR, HR o HCT): la CNC sigue en Falla y la consola se borra. −30.
- **Pedir ayuda** muestra `^H(CT?)+R$` durante 5 s de simulación y cuesta −20 cada vez.
- **Solo en desarrollo** (`npm run dev`): la tecla **F** fuerza una `falla_husillo` por δ en la CNC que esté fresando.
  No existe en la versión publicada.

## 15. Análisis de balance

**El deadlock se evita con una buena decisión y se provoca con una mala.**

- Mala: despachar AGV1 y AGV2 casi a la vez (t1a y t2a). Cada uno toma un recurso y espera el otro.
- Buena: después de t1a, esperar a que el radar vuelva a verde (t1b) antes de despachar el otro.
  También sirve mandar el brazo a una CNC (tr_ir), porque con Robot_libre vacío t2a no se habilita.
- Alternativa segura y cara: el Controlador de celda cuesta 150 puntos y serializa los AGV.

**Ninguna estrategia gana siempre.** Carga del brazo estimada por turno (180 s disponibles; la fila del turno 3 ya usa la meta de 6 piezas):

| Turno | Fresados esperados (meta / (1 − p)) | Brazo en piezas | Brazo en AGV (pedidos × 5 s) | Total | Uso del brazo |
|---|---|---|---|---|---|
| 1 | 3,3 | 3,3 × 5 s + 3 × 4 s = 29 s | 7 × 5 s = 35 s | 64 s | 36 % |
| 2 | 6,3 | 6,3 × 5 s + 5 × 4 s = 51 s | 9 × 5 s = 45 s | 96 s | 53 % |
| 3 | 8,6 | 8,6 × 5 s + 6 × 4 s = 67 s | 14 × 5 s = 70 s | 137 s | 76 % |

- **Actualización (18.20):** los tiempos de esta tabla son los de los turnos originales; la calibración vigente está en la tabla de 18.20.
- En el turno 3 el brazo está muy cargado (76 % con la meta de 6 piezas; era 82 % con 7). El jugador no puede atender todo: debe elegir entre
  los pedidos (+40 cada uno, −20 si vencen) y las piezas (+100 y necesarias para ganar).
- Ignorar todos los pedidos cuesta 14 × 20 = 280 puntos en el turno 3.
- Priorizar solo los AGV no cumple la meta de piezas.
- Comprar el Controlador evita el deadlock pero baja el rendimiento de los AGV.
- Los valores de 5 s y 4 s por operación del brazo asumen 1 s de reacción por clic. Se midieron con el piloto automático (`scripts/balance.mjs`): el turno 3 con meta de 7 era casi imposible para una persona, y por eso se bajó a 6 (decisión 14 de la sección 17).

## 16. Criterios de aceptación

Cada criterio se comprueba jugando o con el inspector.

| N.º | Criterio | Cómo se comprueba |
|---|---|---|
| CA-01 | La palabra **HCTCR** repara la CNC en Falla: pasa a Libre y suma +50 | Provocar una falla, teclear H, C, T, C, R y Enter |
| CA-02 | La palabra **HTCR** no repara: la CNC sigue en Falla y suma −30 | Teclear H, T, C, R y Enter |
| CA-03 | Las palabras HCR, HCTR y HCCTCR reparan. HR, CR, HCTTR y HCT no | Probar las 7 palabras |
| CA-04 | El estado prohibido nunca se alcanza: para la CNC atendida, no existe un instante con CNC = Fresando y Brazo = Mandril_Abierto | Intentar `i` con el mandril abierto y `a` con la CNC fresando. Ambos botones aparecen en rojo y el estado no cambia |
| CA-05 | Cada intento bloqueado resta 15 puntos | Hacer clic en un botón en rojo y ver el puntaje |
| CA-06 | **t1a y luego t2a** sin el Controlador lleva a game over con marcado **[0,0,0,0,1,1,0,0,0]**, y se aplica −200 | Despachar AGV1 y AGV2 seguidos en M0. El inspector muestra el marcado y el radar queda en rojo |
| CA-07 | Con el Controlador de celda comprado, la misma jugada **no bloquea**: t2a no se dispara después de t1a, aparece el aviso "Controlador de celda activo" y **no se restan puntos** | Comprar, despachar AGV1, pulsar t2a, ver el aviso y comprobar que el puntaje no baja; el turno sigue |
| CA-08 | El **árbol de cobertura desde M0 tiene 14 nodos**, 8 marcados distintos y 1 muerto. Con el Controlador tiene 12 nodos, 7 marcados y 0 muertos | Leer el inspector |
| CA-09 | El radar es verde en M0, amarillo en M1 y M2, y rojo en el marcado muerto | Mirar el radar después de t1a, y luego tras t1b |
| CA-10 | El radar de amarillo a verde suma +25, con enfriamiento de 20 s | Despachar AGV1 y esperar t1b |
| CA-11 | Los tiempos coinciden con la tabla: 2 s del brazo, 10 s de fresado, 4 s de viaje del AGV, 5 s de descarga | Medir con el reloj del turno a velocidad x1 |
| CA-12 | Una falla ocurre entre 2 s y 8 s después de `i`. Con semilla 2026 la secuencia de fallas es siempre la misma | Repetir el turno con las mismas acciones |
| CA-13 | La probabilidad de falla es 10 %, 15 % y 20 % en los turnos 1, 2 y 3 (18.20) | Simular 1000 fresados por turno en una prueba automática y comparar |
| CA-14 | Las entregas de metal llegan cada 25 s, 20 s y 18 s según el turno (con parejas en el turno 3), y una sin atender se pierde a los 30 s (20 s en el turno 3) con −20 (18.20) | Dejar un pedido pendiente y observar |
| CA-15 | Las metas son 6, 8 y 8 piezas (18.20). Cumplir la meta termina el turno como victoria | Jugar cada turno |
| CA-16 | Un AGV no puede descargar sin la mesa y el brazo: t1b y t2b solo se disparan con ambos recursos | Inspector: marcado antes y después de t1b |
| CA-17 | El puntaje de cada acción coincide con la sección 8 | Ejecutar cada acción y comprobar |
| CA-18 | Cada uno de los 6 logros se desbloquea con su condición y no antes | Jugar cada condición |
| CA-19 | Las velocidades x1, x2 y x4 y la pausa no cambian el resultado del turno | Repetir el turno a distintas velocidades |
| CA-20 | Todos los controles de la sección 13 funcionan con mouse, teclado y táctil | Probar cada fila de la tabla |
| CA-21 | El HUD ocupa las zonas de la sección 14 y se ve completo en 960 × 540 y con escala FIT | Revisar en pantallas de distinto tamaño |
| CA-22 | Todo cambio de estado de una máquina pasa por δ o por una transición de la red | Las pruebas con `node --test` reproducen las palabras de `automatas.md` y los marcados de `petri.md` |
| CA-23 | El Controlador de celda no se puede comprar en el marcado muerto y se pierde al terminar el turno | Intentar comprarlo en deadlock; ganar el turno y ver el turno siguiente |

## 17. Decisiones derivadas (confirmadas por el equipo)

Estas decisiones cierran huecos de la lista original. El equipo las confirmó, con el cambio de la decisión 7.

1. **Se acaban los 180 s sin la meta:** el turno se pierde, sin penalización de puntos.
2. **Reintento de turno:** se conserva el puntaje (incluido el −200) y se restaura la semilla del inicio del turno.
3. **tr_volver dura 0 s,** porque el autómata del brazo no tiene un evento `llegar` en esa ruta.
4. **El brazo vuelve solo** después de `e` (cerrar) o de `d` (descargar) cuando ya hizo su tarea.
5. **Radar +25 con enfriamiento de 20 s** para evitar repetir una misma jugada.
6. **Ciclo de AGV +40 atiende el pedido más antiguo,** si hay alguno pendiente.
7. **Intento bloqueado** es solo el bloqueo del supervisor CNC ‖ Brazo. El bloqueo por Celda_libre
   muestra el aviso "Controlador de celda activo" y no resta puntos.
8. **Los tiempos de clic del jugador** (1 s por acción) usados en el balance son una suposición.
9. **Volver manual del brazo:** el botón "volver" dispara tr_volver desde Mandril_Cerrado (confirmado por el equipo).
10. **HUD de máquina:** panel de 340 × 392 px, botón de reset en gris hasta la consola, "m → CNC1/CNC2" desde el brazo y
    paneles que tapan lo que queda debajo (confirmado por el equipo).
11. **Consola de reparación:** la palabra sigue aceptando símbolos después de un error (marcado en rojo) para poder enviar
    palabras como HTCR. La tecla F de desarrollo no forma parte del juego publicado.
12. **Supervisor:** hay una instancia por CNC (la que el brazo atiende) y se consulta en cada paso con el estado compuesto
    (CNC, Brazo). Una CNC que el brazo no atiende no tiene restricción: puede estar en Fresando mientras el brazo está en
    Mandril_Abierto frente a la otra.

13. **Turnos y resultados:** "deadlocks evitados" cuenta las veces que el radar vuelve de amarillo a verde en el turno (el premio de +25
    sigue con su enfriamiento de 20 s). Al perder por tiempo no hay penalización de puntos extra. Tras un deadlock, el game over
    (reintentar desde el último verde) sigue siendo la pantalla de ese momento; el turno continúa si se reintenta.

14. **Meta del turno 3 = 6 piezas (antes 7).** El equipo la bajó después de la medición de balance: con 7 piezas el turno 3 solo se ganaba con una decisión por segundo y sin errores (21 de 30 partidas del piloto) y con una decisión cada 2 s no se ganaba ninguna (0 de 30). Las fallas (30 %), los pedidos (cada 12 s), la duración (180 s) y los puntajes no cambian. Con 6 piezas el piloto gana 27/30 de 30 a 1 s por decisión y 0/30 a 2 s (ver `docs/decisiones_por_confirmar.md`).

## 18. Mejoras de jugabilidad (agregadas por el equipo después del playtest interno)

Estas mejoras no cambian `docs/modelo/` ni las reglas del juego. Todo cambio de estado sigue pasando por δ de un autómata o por el
disparo de una transición de la red de Petri. Son mejoras de lectura, de ayuda y de enseñanza.

### 18.1 Textos que no se encimen

- **Planta:** los rótulos de las zonas de los lugares ("Robot", "Base AGV1", "Espera AGV2", "Trabajo AGV2"…) ya no están siempre a la
  vista. Salen al pasar el mouse (o tocar) sobre el lugar, en una etiqueta con fondo oscuro semitransparente junto al puntero, con el
  nombre del lugar, su marcado m/k y, si está en conflicto, las transiciones que compiten (por ejemplo "t2a ↔ tr_ir").
  Los rótulos cortos de los objetos (Mesa, S1, S2, D1, D2) quedan siempre visibles, con fondo oscuro semitransparente.
  El anillo naranja del conflicto sigue visible sin texto.
- **Historial del HUD de máquina:** los últimos 10 eventos se muestran en columnas alineadas: tiempo (alineado a la derecha),
  código del evento y "origen → destino". Dos columnas de 5 filas que no se montan.

### 18.2 Grafo del HUD más claro

- Nodos de 44 px (antes 36), más separados; el panel crece a 460 px de ancho (la altura sigue en 392 px para no tapar las alertas).
- Las flechas son curvas. Cuando hay varias transiciones entre el mismo par de estados (en el brazo: abrir_mandril, cerrar_mandril y
  descargar entre Mandril_Cerrado y Mandril_Abierto) cada una usa su propia curva, repartidas a los dos lados, y el bucle de `cargar`
  se dibuja hacia afuera del grafo.
- Cada flecha lleva la etiqueta "código · nombre" (por ejemplo "c · cargar"). Los eventos no controlables van con línea punteada.
  El estado actual lleva glow (como antes).

### 18.3 Alertas siempre visibles

La zona de alertas (abajo a la derecha) se dibuja por encima de todos los paneles y ya no la tapa el HUD de máquina ni el Inspector.

### 18.4 Vista "Red de Petri" (tecla R y botón "Red")

Dibuja la red sobre la planta (la planta se oscurece un poco):

- Cada **lugar** es un círculo sobre su objeto, con su identificador (p1…p10), sus fichas y su contador m/k.
- Cada **transición** es una barra negra en su estación con su nombre: t1a, t1b y t1c en S1; t2a, t2b y t2c en S2; tr_ir y tr_volver
  junto al brazo.
- Los **arcos** son flechas lugar → transición (Pre) y transición → lugar (Post).
- Colores: la barra de una transición **habilitada** va en verde; las que **compiten por una ficha** (conflicto) y su lugar, en naranja;
  en **deadlock**, las barras bloqueadas van en rojo.
- Las **fichas viajan siguiendo las flechas**: del lugar de entrada a la barra y de la barra al lugar de salida.
- La tecla R no se usa para la vista cuando la consola de reparación está abierta (ahí R es el comando de reset).

### 18.5 Tutorial "Turno 0" (opcional, desde el título)

Turno sin límite de tiempo, sin fallas y sin meta, en el que los **pedidos no vencen**. Mensajes cortos y una flecha señalan cada paso.
El paso avanza cuando el estado del modelo cumple la condición (no cuando se hace clic). **Actualizado en 18.19:** ahora son 12 pasos
y usan los botones de la pestaña «Acciones» («Cargar bloque», «Fresar», «Sacar pieza»). Pasos originales:

1. Mandar el brazo a la CNC 1 (`m`, tr_ir) y esperar a que llegue (`l`).
2. Abrir la pinza (`a`), cargar (`c`), cerrar (`e`) y ver cómo el brazo vuelve solo (tr_volver).
3. Iniciar el fresado (`i`), esperar a que termine (`f`).
4. Mandar el brazo otra vez, abrir y descargar (`d`).
5. Despachar el AGV1 (t1a) y esperar su ciclo completo (t1b, t1c).
6. Provocar el deadlock a propósito: Despachar AGV1 y luego AGV2. Se ve el radar pasar a amarillo y a rojo y se abre la vista de red con
   las barras bloqueadas en rojo. En el tutorial no hay game over ni penalización: el jugador puede reintentar el final o empezar el turno 1.

El tutorial no guarda puntaje ni logros.

### 18.6 Piezas visibles

Capa solo visual: no agrega estados, eventos ni reglas. Todo sale de los estados de las CNC y de los eventos `c` y `d` del modelo.

- **Entrada:** una zona junto al brazo, en la celda (6, 5), con 3 bloques en bruto (grises). Los bloques en bruto no se acaban: la zona se
  rellena sola después de cada carga.
- **Al cargar (`c`):** un bloque sale de la Entrada y el brazo lo lleva a la CNC (viaja en arco por encima de la pinza). Mientras la CNC está
  en Cargado o Fresando, el bloque se ve sobre la máquina.
- **Al terminar el fresado (`f`):** el bloque se convierte en una pieza brillante (dorada, con glow) sobre la CNC en Terminado.
- **Falla (`x`):** el bloque de la CNC en Falla se ve rojo.
- **Al descargar (`d`):** la pieza viaja a la zona **Piezas terminadas**, en la celda (6, 3), y se apila (hasta 10 visibles). La zona
  muestra un contador con las piezas del turno.

### 18.7 Pedidos como tarjetas

Arriba al centro, debajo del puntaje, cada pedido pendiente es una tarjeta con su número y una barra del tiempo que le queda de los
30 s (verde, luego amarilla en el último tercio y roja en el último sexto). Un pedido vencido (sigue pendiente) se ve rojo y fijo con
"vencido". Se muestran hasta 3 tarjetas (los pedidos más antiguos) y un "+n" si hay más. Los pedidos y su vencimiento son los de la
sección 6; las tarjetas solo los muestran.

### 18.8 Pantalla de título

Nombre del juego, integrantes del equipo (Brian Acevedo, Brayan Amado y Manuel Carvajal) y tres botones: **Jugar**, **Tutorial**
(Turno 0, sección 18.5) y **Controles** (la tabla de controles de la sección 13 en un panel). La partida empieza solo con Jugar o con Enter.

### 18.9 Efectos de pulido (Phaser 4)

Cada efecto tiene un propósito y no cambia reglas:

| Efecto | Dónde | Propósito |
|---|---|---|
| Glow | Máquina seleccionada; estado actual en el HUD; botón bloqueado por el supervisor | Mostrar qué está abierto y qué está inhibido |
| Bloom | Cámara, unos instantes, al fallar el husillo y en el deadlock | Subrayar el evento crítico |
| Partículas | Chispas en la CNC mientras fresa; humo en la CNC en Falla | Mostrar el estado de la máquina |
| Temblor de cámara | Al bloquear un evento prohibido, al fallar una CNC y en el deadlock | Marcar el evento negativo |
| Destello de cámara | Al ganar un logro | Premiar |
| Transiciones | Fundido entre Título, Planta y Resultados | Dar continuidad |
| Tweens | Fichas entre lugares, aviso de logro, pulso del radar al cambiar de color | Mostrar el flujo y el cambio |
| Cámara | Arrastre, rueda y pellizco | Explorar la planta |

### 18.10 Pantalla completa y escalado

El juego conserva su resolución interna de 960x540 y no cambia el modelo. Cambios:

- `#game-container` ocupa `100vw x 100vh`; Phaser usa `Scale.FIT` con `autoCenter: CENTER_BOTH`, así que el juego crece manteniendo 16:9 y
  deja franjas negras si la ventana no es 16:9. Phaser convierte las coordenadas del puntero al espacio interno, por lo que clics y toques caen bien.
- Pantalla completa: botón ⛶ (arriba a la izquierda, junto al reloj) y tecla **G** (la F sigue forzando fallas en desarrollo), con `scale.toggleFullscreen()`.
- Los textos se crean con `resolution` = max(2, devicePixelRatio) para verse nítidos al agrandar.

### 18.11 Alta resolución

El canvas se dibuja a 1920x1080 (`RES = 2` en `src/config.js`) y se muestra con `Scale.FIT` (se reduce por CSS en pantallas menores, así que se
ve nítido en 1366x768, 1920x1080 y celulares). La resolución lógica sigue siendo 960x540: cada escena llama a `camaraLogica(this)`
(`src/escenas/camara.js`), que pone la cámara en zoom 2 con origen arriba a la izquierda, y todo el código sigue usando coordenadas de 960x540.

- Entrada: `GestorEntrada` divide las coordenadas del puntero entre `RES`; la planta las vuelve a multiplicar al llamar a `getWorldPoint`.
  Clic, toque, arrastre, rueda y pellizco caen en el mismo lugar que antes (comprobado con un clic real sobre "Jugar" y sobre la CNC 1).
- La vista de la planta (zoom y desplazamiento) se guarda en coordenadas lógicas (`Planta.vista`) y `_aplicarVista()` la pasa a la cámara real.
- `render: { antialias: true, roundPixels: false }`; los textos usan `resolution: RES`. Los trazos de Graphics se escalan con la cámara y conservan su grosor visual.
- El contador de FPS solo aparece con F1. Si el juego baja de 50 fps se reducen los efectos (ya existía); si aun así no alcanza, bajar `RES` a 1.67 (1600x900).
- Capturas a 1920x1080: `docs/capturas/hd_planta.png`, `hd_hud_maquina.png` y `hd_vista_red.png`. Medición de fps: en el navegador sin GPU (WebGL por software) dio 28 fps y bajó con el bloom, por lo que no es representativa; debe confirmarse en un equipo real y, si baja de 50, usar `RES` = 1.67.

### 18.12 Ajustes visuales (revisión en 1920x1080)

Sin cambios al modelo ni a las reglas:

- **F1:** el contador de FPS y el tiempo de simulación se dibujan en el HUD general, debajo del panel del turno, y solo con F1 activo.
- **Piezas terminadas:** la zona pasa a la celda (6, 0), lejos de la mesa y de S1/S2, con su rótulo debajo y fondo semitransparente.
- **Pedidos:** el círculo con el número y la palabra "pedidos" quedan al costado de cada base (AGV1 al este, AGV2 al oeste) y ya no tocan D1, D2 ni el aviso del AGV.
- **Lugares vacíos:** con 0 fichas se muestra solo un círculo punteado tenue con "0/1" pequeño debajo; los lugares de espera y trabajo de los AGV flotan 26 px sobre el suelo (y el de espera del AGV2 pasa a la fila 7) para no montarse con los rótulos S1, S2 y Mesa.
- **Alertas:** sin avisos la zona es un recuadro pequeño con "Sin alertas" tenue; con avisos crece hacia arriba lo justo.
- **Radar:** muestra en grande el nombre del marcado actual (M0, M3…), el nivel debajo y el mini-grafo de los 3 últimos marcados con nodos más grandes.
- **Botón ⛶:** pasa al panel del turno (arriba a la izquierda) para no tapar la X del HUD de máquina; el texto de velocidad se acorta a "Vel. x1".
- Las capturas de comprobación se guardan en `tmp-capturas/` (ignorada por git).

### 18.13 Claridad para quien juega por primera vez

Sin cambios al modelo ni a las reglas. Todo el texto está en español y usa los mismos nombres de estados y eventos del modelo.

- **Una frase por botón y por máquina.** Al pasar el mouse (o al tocar) sale en una línea qué hace: los botones de velocidad, pausa, Insp., Red,
  pantalla completa y ayuda, la zona de despacho y los botones de cada HUD de máquina ya la tenían o la ganaron. Las 5 máquinas muestran
  su frase (`DESCRIPCION_MAQUINA` en `src/textos.js`); en táctil la frase dura 2,5 s al tocar la máquina. En el título, cada botón explica
  qué hace debajo de la fila.
- **Ayuda (tecla ? y botón "?", arriba a la izquierda junto al ⛶).** Panel con la tabla de controles y la leyenda de colores: verde (en marcha o botón que se puede pulsar),
  gris (botón que todavía no se puede pulsar), rojo (falla o botón que bloquea el supervisor), naranja (ficha del robot o conflicto entre
  transiciones), amarillo (espera) y azul (consola o botón activo), más el radar verde, amarillo y rojo. Pausa la simulación mientras está abierta.
- **Aviso al empezar cada turno** (3 s, sin pausar): "Turno 2: 5 piezas, fallas 20 %, pedidos cada 18 s". Los valores salen de `TURNOS`.
  El tutorial dice que no tiene límite de tiempo ni fallas.
- **Alerta del radar amarillo.** Al pasar de verde a amarillo, la zona de alertas dice por qué, a partir del marcado muerto alcanzable en
  un paso (`explorar`): "Radar amarillo: si despachas AGV2 ahora, la celda se bloquea."

### 18.14 Menú de pausa y guardado local

- **Menú de pausa** (P o el botón de pausa; Esc lo cierra): Continuar, Reiniciar turno (mismo turno y misma semilla; el puntaje de antes del
  turno se conserva), Ayuda, Silenciar o Activar sonido y Volver al título. Detiene el reloj de simulación mientras está abierto y no hace
  nada si la partida ya terminó o el Inspector está abierto. El texto "PAUSA" suelto de la planta ya no se dibuja.
- **Guardado en `localStorage`** (clave `robocell-tycoon-2.5d`, `src/guardado.js`; ampliado en 18.21 con jugadores, logros por jugador y «Mejores puntajes»): el mejor puntaje y los logros ganados se guardan al
  terminar cada turno (no en el tutorial) y se muestran en el título ("Mejor puntaje: 1315 · Logros: 2 de 6"). Todo va dentro de `try/catch`:
  si el almacenamiento falla o está bloqueado, el juego funciona igual y el título muestra 0.

### 18.15 Celular

- Sin desplazamiento de la página (`overflow: hidden`, `position: fixed`, `overscroll-behavior: none`) y sin zoom del navegador.
- Horizontal: el juego se ajusta con `Scale.FIT`. Los botones miden 44 px lógicos, que en pantalla son 44 px solo si la ventana mide 960 x 540 o más;
  en 640 x 360 miden unos 29 px (ver `docs/decisiones_por_confirmar.md`). El pellizco acerca y aleja la planta (GDD 13).
- Vertical (360 x 640): el juego sería diminuto, así que se muestra el aviso "Gira el teléfono a horizontal para jugar".

### 18.16 Revisión de errores con clics y teclas al azar

Se juega en Edge sin ventana (`scripts/azar-navegador.mjs`) con clics, ruedas y teclas al azar (incluidos abrir y cerrar el HUD, el Inspector,
la vista de red, la pausa, la ayuda, el game over y los botones de resultados), a x1, x2 y x4, y con un recorrido guiado del tutorial completo
(los pasos de `src/sed/tutorial.js` hasta el deadlock). Qué se buscó y qué se encontró:

| Hallazgo | Causa | Arreglo y prueba |
|---|---|---|
| Excepción "HierarchyRequestError: The new child element contains the parent" al pulsar G varias veces | `scale.toggleFullscreen()` de Phaser crea un contenedor extra cada vez | Pantalla completa con la API del navegador sobre `#game-container` (`src/pantalla.js`); `test/pantalla.test.js` |
| Excepción sin capturar "TypeError: not granted" | El navegador negó el permiso de pantalla completa y la promesa se rechazó | Igual: la promesa se atiende; misma prueba |
| El botón "?" (puesto en 144, 52) tapaba el título del Inspector y el cuadro del tutorial | Disposición del HUD sin comprobar | Los botones pasaron a la barra superior y las zonas a `src/disposicion.js`; `test/disposicion.test.js` comprueba que nada se encima, que todo cabe y que los botones miden 44 px |
| El botón del Controlador medía 40 px de alto | Disposición anterior | 44 px (llega al borde inferior); misma prueba |

Resultado final: sin excepciones ni errores de consola, sin interfaz bloqueada (la simulación avanza salvo en pausa, deadlock o fin de turno),
los 3 turnos se recorren hasta la pantalla de resultados y el tutorial llega a su último paso. Las pruebas de flujo con clics y teclas reales
(game over y las dos formas de reintentar, menú de pausa, ayuda, sonido, reiniciar turno, F1 y volver al título) pasan todas.
Nota sobre el entorno: en Edge sin GPU el dibujado va a 1 a 40 fps y a veces la pestaña queda "oculta" (se detiene `requestAnimationFrame`); el
script lo evita con banderas de Edge y adelanta el reloj de simulación a mano. Eso no es un error del juego.

### 18.17 Correcciones de jugabilidad (sin filtros en el HUD)
- **Lentitud al abrir una CNC:** la causa eran los filtros glow de Phaser 4 (nodo del estado actual, botones rojos y la máquina seleccionada), que se re-renderizaban en cada cuadro. Se quitaron: ahora todo es relleno y borde planos.
- **Estado actual del grafo:** relleno con el color de su estado (arte.md), borde blanco grueso (5 px) y halo plano.
- **Botones vetados por el supervisor:** botón rojo relleno con borde y texto blancos; la razón sale al pasar el mouse.
- **Máquina seleccionada:** contorno amarillo plano sobre su silueta (en lugar del glow).
- **Tarjetas de pedidos:** con el HUD de máquina abierto se desplazan 170 px hacia el lado libre para no tapar su título ni sus pestañas.
No cambian estados, eventos, δ, Pre/Post ni puntajes.

### 18.18 Parpadeo de transiciones
- **Decisión del equipo:** la guía (5.7.3, punto 2) pide 0,5 s de parpadeo; se usan **3 s** (6 parpadeos de 0,5 s) para que se note al jugar y en la sustentación.
- **HUD (CNC, brazo y AGV):** al ocurrir un evento de la máquina, su flecha y su etiqueta se pintan de amarillo grueso y parpadean 3 s; el nodo de destino pulsa de tamaño; después queda relleno fijo. Un evento nuevo reemplaza al parpadeo anterior. Vale también para los no controlables que ocurren solos (llegar, fin_fresado, falla_husillo).
- **Botón pulsado:** destella en amarillo unos 0,45 s.
- **Planta:** la máquina que cambió de estado muestra un destello amarillo de 0,7 s en su contorno.
- Todo es dibujo plano y tweens (sin filtros glow). No cambia estados, δ, Pre/Post ni puntajes.

### 18.19 Juego más claro e inmersivo (reemplazado en parte por 18.20: las macros y los atajos 1, 2, Espacio y Tab de la versión de «Acciones» ya no existen)
Objetivo: que se sienta como un juego y que alguien que no leyó la guía lo entienda en 1 minuto. **No cambian** los modelos
(autómatas, red de Petri, JSON de `src/sed/modelos/`), δ, el supervisor ni el puntaje. Cada acción del jugador sigue disparando los
eventos reales del autómata, uno por uno, y todos quedan en el historial del HUD.

**A. Claridad**
1. **Texto del AGV:** "AGV i: trae material. Para descargarlo necesita la MESA y el ROBOT al mismo tiempo." (antes decía que llevaba
   la pieza de la mesa al pedido, y en la red de la ficha D.2 el AGV no depende de las piezas).
2. **Intro de 5 líneas** antes del turno 1 (una vez por partida) y en el botón «?»: jefe de turno y meta, brazo y reparación H C T C R,
   carritos y pedidos de 30 s, interbloqueo, radar. La ayuda tiene dos páginas: «Cómo se juega» (intro y atajos) y «Controles y colores».
3. **Rótulos fijos en el mapa:** "CNC 1", "CNC 2", "Brazo", "Mesa", "AGV 1" y "AGV 2" (el del AGV lo sigue por su ruta). Se esconden
   con la vista de la red de Petri.
4. **Pedidos:** cada tarjeta dice "AGV 1 espera · 12 s" con la cuenta regresiva de 30 s en color: verde (más de 15 s), amarillo
   (de 15 a 5 s) y rojo (menos de 5 s o vencido). Si el AGV ya salió dice "AGV 1 en camino"; si hay más pedidos que carritos, "Pedido en
   cola". Sobre la base de cada AGV libre con pedido sale "Pedido · 12 s" (reemplaza al número que solo subía).
5. **Radar:** al pasar el mouse dice "M6 = foto actual de las fichas. Verde: seguro. Amarillo: si despachas otro AGV ahora, te trabas.
   Rojo: trabado." (con el nombre del marcado actual) y debajo de los cuadritos dice "últimos estados".
6. **AGV detenido:** junto a él dice "Espera el robot" o "Espera la mesa" (según las fichas que le faltan a t1b o t2b).

**B. Controles de juego (dos capas en el panel de cada máquina)**
1. **Pestaña «Acciones»** (la que abre): un botón grande con el ícono de esa máquina y un verbo de juego.
   - CNC Libre: **Cargar bloque**. Encadena `m` (tr_ir), `l` (lo dispara el reloj a los 2 s), `a`, `c`, `e` y la vuelta `m` (tr_volver),
     con 0,5 s de simulación entre uno y otro. Cada evento se pide a la Celda con `evaluar` y `solicitar`: pasa por δ, el supervisor y
     la red. Nunca insiste contra el supervisor (no genera intentos bloqueados) y espera si la red no habilita tr_ir.
   - CNC Cargado: **Fresar** (`i`). CNC Fresando: barra de progreso, sin botones. CNC Terminado: **Sacar pieza** (`m`, `l`, `a`, `d` y
     la vuelta). CNC Falla: la consola H C T C R.
   - En el panel de una CNC no hay botones del brazo. Si el brazo atiende a la otra CNC (o un AGV tiene el robot) el botón dice
     **Brazo ocupado**, en gris.
   - AGV: **Despachar AGV i** (`v`); si no puede, dice qué hace ("En camino…", "Espera el robot", "Descargando…"). Brazo: solo informa.
   - Debajo va el historial con los eventos reales (también los del brazo mientras atendía a esa CNC).
2. **Pestaña «Autómata»:** el grafo con los botones de evento verde, gris y rojo, tal como estaba (lo exige la guía). Las CNC conservan
   la pestaña «Composición».
3. **Atajos:** 1 y 2 eligen la CNC 1 y la CNC 2; Espacio hace la acción principal de la máquina elegida; Q y W despachan el AGV 1 y el
   AGV 2; Tab cambia entre «Acciones» y «Autómata». Se muestran en el botón «?». **La velocidad pasa a la tecla V** (x1 → x2 → x4 → x1),
   porque 1 y 2 ahora eligen la CNC; los botones x1, x2 y x4 siguen igual.
4. **Cursor de mano y borde amarillo** al pasar el mouse por cualquier botón o pestaña.

**C. Inmersión**
1. **Sonido** con Web Audio, sin archivos: zumbido mientras alguna CNC fresa, clic de botón, "ding" al terminar una pieza
   (`fin_fresado`), alarma en la falla, tono grave en el deadlock, fanfarria al ganar el turno y dos tonos al perderlo. Botón del
   altavoz arriba y tecla M.
2. **Texto flotante** en el sitio del evento: "+100", "+40", "−20 pedido vencido", "−15 intento bloqueado…". Solo muestra los puntos
   que ya sumó o restó la Celda.
3. **Barra de objetivo:** "Piezas 2/5" con una barra de progreso (una división por pieza) y "quedan N s". En los últimos 30 s el reloj
   se pone rojo y parpadea.
4. **Animación:** el brazo se extiende hacia la CNC que atiende durante los 2 s de `m` y el carrito avanza por su ruta los 4 s del
   viaje (ya estaba; se comprobó con las secuencias nuevas).
5. **Frase del jefe de planta** al terminar el turno: "¡Turno cumplido!", "Faltaron 2 piezas, ojo con los pedidos vencidos." y, tras
   un interbloqueo, "¡La fábrica se trabó!".

**D. Tutorial:** pasa de 17 a 12 pasos y usa los botones nuevos: abrir la CNC 1, «Cargar bloque», ver la pestaña «Autómata»,
«Fresar», «Sacar pieza», despachar el AGV 1 y provocar el interbloqueo con Q y W. Sigue avanzando con el estado real del modelo.

### 18.20 Controles paso a paso, entregas de metal y dificultad
Objetivo: un juego de **coordinación y velocidad** para adultos que juegan videojuegos: el jugador opera el brazo entre las 2 CNC paso
a paso, fresa, repara y atiende los AGV sin trabar la celda. **No cambian** los autómatas, la red de Petri, los JSON de `src/sed/modelos/`,
δ, el supervisor, los valores de puntaje (sección 8), el radar, el inspector ni las zonas del HUD de la sección 14.

**1. Se quitan las macros.** «Cargar bloque» y «Sacar pieza» ya no encadenan eventos (se borró `src/sed/acciones.js`). Cada botón y cada
tecla dispara **un solo evento** del autómata (`src/sed/controles.js`: `describir` dice si está verde, gris o rojo y por qué; `ejecutar`
lo pide a la Celda con `solicitar`). El historial del panel muestra cada evento que hizo el jugador. `l · llegar` y `fin_fresado` los
dispara el reloj (no son controlables); la vuelta del brazo tras `e` o `d` es la automática de la decisión 4 de la sección 17.

**2. Panel de máquina (guía, p. 20).** Se abre en la pestaña **«Autómata»** (grafo, estado iluminado, botones de Γ(q) verde, gris o rojo con
la razón formal y los últimos 10 eventos). La pestaña **«Acciones»** tiene los mismos eventos de *esa* máquina como botones grandes con ícono
y verbo (CNC: Meter bloque, Fresar, Sacar pieza; brazo: sus 7 eventos; AGV: Atender). En el panel de una CNC no hay botones del brazo y
viceversa; los eventos compartidos `c` y `d` sí aparecen en la CNC. **Tab** cambia de pestaña. La CNC conserva «Composición». En Falla, la consola
H C T C R sale en «Acciones» (en «Autómata», el botón `r · reset` lleva a ella). El panel mide 340 px de alto (y 56–396) para no tapar la barra.

**3. Barra de control fija** (y 400–446; el brazo a la izquierda, las CNC a la derecha, los AGV y el Controlador en el hueco de abajo entre las
fichas y las alertas):

| Botón | Tecla | Evento |
|---|---|---|
| Ir a CNC 1 · Ir a CNC 2 | Z · X | `m` mover (tr_ir) |
| Abrir pinza | A | `a` abrir_mandril |
| Meter bloque | C | `c` cargar (compartido CNC y brazo) |
| Sacar pieza | D | `d` descargar (compartido) |
| Cerrar pinza | E | `e` cerrar_mandril (el brazo vuelve solo) |
| Volver | V | `m` mover (tr_volver, a mano) |
| CNC 1 · Fresar | F | `i` iniciar_fresado |
| CNC 2 · Fresar | G | `i` iniciar_fresado |
| Atender AGV 1 · Atender AGV 2 | Q · W | `v` reservar (t1a o t2a) |
| Controlador de celda | — | compra de −150 (no es un evento del autómata) |

Cada botón de CNC tiene una luz con el color del estado y la barra de progreso del fresado; en Falla dice **«Reparar»** y abre su panel con la
consola (no dispara ningún evento). Colores: verde = se puede; gris = ahora no o no controlable (el tooltip da la razón formal); rojo = lo
bloquea el supervisor (tooltip con la razón; intentarlo resta 15 como siempre). La tecla va en una esquinita del botón y todos miden 46 px de
alto o más. **Teclas:** 1, 2 y 4 quedan solo para la velocidad; P pausa, I inspector, Esc cierra, M silencia. Para dejar libres las letras
del juego, la pantalla completa pasó a **L**, el modo demostración a **F2** y forzar una falla (solo en desarrollo) a **F3**. Con la
consola abierta, C, T, H, R y Enter son de la consola (la C no es «Meter bloque»). Mantener una tecla pulsada no repite el evento.

**4. AGV = entregas de metal (sin cambiar la red).** Los "pedidos" son **entregas de metal**; ningún texto usa "pedido" ni "cliente" (una
prueba lo revisa). Tarjeta "AGV 1 trae metal · 12 s" con cuenta regresiva (verde más de la mitad del plazo, amarillo hasta un sexto y rojo
después; "AGV 2 en camino" si ya salió; "Metal en cola" si hay más entregas que AGV). Al vencer, el texto flotante dice "−20 entrega perdida".
El AGV lleva una **caja de metal**; al descargar (con la mesa y el robot), el brazo se ve girado hacia la mesa, la caja baja a ella y al
terminar desaparece con un destello; luego el AGV vuelve. Texto del AGV: "AGV i: trae metal. Para descargarlo necesita la MESA y el ROBOT al
mismo tiempo." Esperando: "Espera el robot", "Espera la mesa" o ambas. (El brazo girado es solo visual: el autómata del brazo sigue en Reposo
porque la ficha Robot_libre la tiene el AGV.)

**5. Sensación de videojuego.**
- **Inicio de turno:** tarjeta animada "TURNO 1 · Meta N piezas · 180 s" con la dificultad y la cuenta 3, 2, 1, ¡Ya!. El reloj de simulación
  espera a la cuenta (durante ella los controles, la pausa, el inspector y la ayuda no responden).
- **Objetivo:** "Piezas 2/N" con barra de progreso (una división por pieza) y "quedan N s". En los últimos 30 s el reloj se pone rojo,
  parpadea y suena un tic por segundo.
- **Feedback:** el botón se hunde al pulsarlo y suena un clic; la pinza se abre y se cierra, la **puerta de la CNC se cierra al fresar**,
  hay chispas mientras fresa y humo en Falla; la máquina que cambió de estado destella.
- **Movimiento:** el brazo gira y se extiende hacia la CNC elegida y los AGV recorren su ruta (nunca aparecen de golpe).
- **Textos flotantes** donde ocurre: "+100 pieza", "+40 metal", "+50 reparada", "−15 bloqueado", "−20 entrega perdida", "−30 palabra inválida".
- **Racha** (solo visual, no cambia el puntaje): "Racha ×3" con piezas seguidas sin errores; se reinicia con un intento bloqueado, una palabra
  inválida, una entrega perdida o un interbloqueo (`src/sed/racha.js`).
- **Sonido** con Web Audio, sin archivos: zumbido de fábrica de fondo muy suave, fresado, clic, ding de pieza, alarma de Falla, tono grave
  de deadlock, fanfarria al ganar, tic del reloj. Botón del altavoz arriba y tecla M.
- **Pantalla final** con 1 a 3 estrellas (3 si se cumplió la meta, 2 con la mitad o más de las piezas, 1 con menos) y la frase del jefe de
  planta ("¡Turno cumplido!", "Faltaron 2 piezas: atiende el metal a tiempo.").

**6. Ayuda.** Intro «Cómo jugar» (6 líneas, con las teclas) antes del turno 1 y en el botón «?»; etiquetas fijas en el mapa (CNC 1, CNC 2, Brazo,
Mesa, AGV 1, AGV 2); tooltip del radar ("M6 = foto actual de las fichas…") y "últimos estados" bajo los cuadritos. Las **pistas del siguiente paso
solo existen en el tutorial**; en los turnos no hay. El tutorial se rehízo con los botones nuevos: **16 pasos, un botón por paso** y frases de 100
caracteres como máximo (Z, A, C, E, F, clic en la CNC, Z, A, D, Q, Q, W).

**7. Dificultad.** Los valores de turnos son decisiones del equipo (no de la guía). Se calibraron con `scripts/balance.mjs`: jugadores
simulados que operan paso a paso (el piloto, un evento por decisión, sin errores) a 0,8 s (experto), 1,2 s (bueno) y 2 s (lento), 20 semillas
(2026 a 2045). «Piezas en 180 s» es cuántas haría el jugador si el turno no terminara al llegar a la meta; el margen es la mediana menos la meta.

| Turno | Jugador | Victorias | Piezas en 180 s (mín–mediana–máx) | Margen | Tiempo medio al ganar (s) | Puntaje medio | Entregas perdidas (media) |
|---|---|---|---|---|---|---|---|
| 1 | experto (0.8 s) | 20 de 20 | 10–12–13 (meta 6) | +6 | 90.6 | 824 | 0 |
| 1 | bueno (1.2 s) | 20 de 20 | 8–10–11 (meta 6) | +4 | 98.1 | 839 | 0 |
| 1 | lento (2 s) | 20 de 20 | 6–8–8 (meta 6) | +2 | 144.2 | 956 | 0 |
| 2 | experto (0.8 s) | 20 de 20 | 9–12–13 (meta 8) | +4 | 116.2 | 1152 | 0 |
| 2 | bueno (1.2 s) | 19 de 20 | 7–10–10 (meta 8) | +2 | 144.3 | 1246 | 0 |
| 2 | lento (2 s) | 0 de 20 | 5–7–7 (meta 8) | -1 | — | 1175 | 0 |
| 3 | experto (0.8 s) | 20 de 20 | 8–9–11 (meta 8) | +1 | 147.7 | 1342 | 0.15 |
| 3 | bueno (1.2 s) | 13 de 20 | 6–8–9 (meta 8) | +0 | 155.4 | 1352 | 0.8 |
| 3 | lento (2 s) | 0 de 20 | 4–6–6 (meta 8) | -2 | — | 1179 | 0.9 |

Lectura (cumple lo pedido): el **experto** gana los 3 turnos y el turno 3 con poco margen (+1); el **bueno** gana el turno 1 y casi siempre el 2
(19 de 20) y pierde a menudo el 3 (13 de 20); el **lento** gana el turno 1 justo (termina hacia los 144 s) y pierde el 2 y el 3. Las palancas
fueron: más entregas (25 → 20 → 18 s), plazo de 20 s y parejas de entregas en el turno 3 (para tentar el deadlock: dos AGV libres a la vez
con el radar en amarillo), más fallas (10, 15 y 20 %) y metas de 6, 8 y 8 piezas. Límite de la medición: el piloto no comete errores ni
paraleliza las dos CNC como un humano, así que es una cota para quien juega sin errores a ese ritmo.


### 18.21 Pulido final: tooltips, inspector, logros y puntajes
Último pulido. **No cambian** los autómatas, la red de Petri, los JSON de `src/sed/modelos/`, δ, el supervisor, los puntajes de la sección 8,
el radar, las zonas del HUD de la sección 14 ni los controles paso a paso (un botón o una tecla = un evento).

**1. Razón de los botones bloqueados (guía p. 20, punto 3).** Con el **mouse** encima de un botón rojo o gris (barra de control y panel de
máquina, pestañas «Autómata» y «Acciones») sale un tooltip de 2 líneas: primero en palabras simples y debajo la razón formal. Ejemplos:

| Caso | Línea 1 (simple) | Línea 2 (formal) |
|---|---|---|
| Rojo: fresar con la pinza dentro | No puedes fresar: la pinza está abierta dentro de la CNC 1. | ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto) · estado (Cargado, Mandril_Abierto) |
| Gris: abrir la pinza en reposo | No puedes abrir la pinza: primero lleva el brazo a una CNC. | δ_Brazo(Reposo, a) no está definida. |
| Gris: AGV 2 sin robot | No puedes atender este AGV: el robot está ocupado. | Red de Petri: M < Pre en Robot_libre (la transición no está habilitada). |
| Gris: Controlador activo | No puedes atender este AGV: el otro AGV está en la celda y el Controlador deja pasar a uno solo. | Pre pide 1 ficha en Celda_libre (p10) y M(p10) = 0. |

Las 2 líneas salen de `razones()` en `src/sed/controles.js` (sin Phaser, con pruebas). Con **tecla** no sale ningún tooltip ni ventana: solo
el temblor, el sonido y el −15 si es rojo (no se frena el ritmo). En **táctil**, mantener presionado 0,5 s muestra el tooltip y al soltar no
se pulsa el botón; un toque corto pulsa como siempre.

**2. Inspector ordenado (tecla I).** Ocupa toda la pantalla (fondo opaco, encima de todo) y al abrirse oculta la barra de control, las fichas,
las tarjetas, la caja del tutorial y su flecha; todo vuelve al cerrar. Pestaña «Matrices» en 2 zonas sin solapes (`ZONAS_INSPECTOR` en
`src/disposicion.js`, comprobadas por `test/disposicion.test.js`): arriba Pre, Post y A = Post − Pre (celdas de 24 × 17 px, números de 12 px,
nombres de lugar de 10 px; caben con 10 lugares); abajo a la izquierda la ecuación de estado con números y abajo a la derecha «Probar
disparo» con su resultado. Cabe todo a 960 × 540, así que no hizo falta una pestaña «Ecuación» aparte: quedan «Matrices», «Árbol» y «Logros».
Si hay tutorial, su paso va como una línea pequeña arriba («Tutorial · …») que no tapa nada.

**3. Logros que se pueden tocar.** En el botón «Logros» del título (tecla L), en la pestaña «Logros» del Inspector y en la pantalla de
resultados cada logro es clicable y abre su ficha: nombre, qué significa, cómo se gana (la condición de la sección 12 en palabras simples, por
ejemplo «Doble husillo: ten las 2 CNC fresando al mismo tiempo durante 30 s en total (en un mismo turno)») y si está **ganado (con la fecha)**
o **bloqueado** (con el progreso del turno si se abre durante la partida). Los textos están en `LOGROS` (`src/sed/logros.js`, campos
`significa` y `comoSeGana`); las condiciones no cambiaron.

**4. Jugadores y mejores puntajes (local, sin servidor; `src/guardado.js`).**
- Al entrar por primera vez el título pide el nombre en una ventana del juego con un campo de texto real (sale el teclado del celular):
  de 1 a 16 caracteres, sin vacío. Recuerda el último y el título muestra «Jugador: Ana · Cambiar jugador».
- Los logros se guardan **por jugador** y con la fecha en que se ganaron, en el momento de ganarlos.
- Tabla «Mejores puntajes» (top 10) a la derecha del título: nombre, puntaje, turno alcanzado y fecha. Se guarda al terminar la partida o
  un turno (victoria, derrota o game over). Cada partida ocupa **una** fila: reintentar un turno o seguir jugando la actualiza (no duplica).
- `localStorage` siempre dentro de `try/catch`: si falla (incógnito, ZIP en el aula virtual con bloqueo) el juego funciona igual, lo de la
  sesión queda en memoria y no se muestra ningún error. El guardado de la versión anterior (sin jugadores) pasa al jugador «Jugador».
- «Borrar puntajes» (botón pequeño bajo la tabla) pide confirmación en una ventana del juego (no se usan `alert` ni `confirm`). Borra la
  tabla y los mejores puntajes; los logros se conservan.

**5. Revisión final de solapes** (`scripts/solapes-navegador.mjs`). Recorre Título (con la ventana del nombre, los logros, una ficha, la
confirmación de borrar y los controles), Planta, tooltips gris y rojo, panel de máquina (Autómata, Acciones, Composición y el del brazo),
Inspector (Matrices, Árbol y Logros), Pausa, Ayuda (2 páginas), Game over y Resultados (y su ficha), con y sin el tutorial, a 960 × 540 y en
celular (844 × 390 horizontal y 360 × 640 vertical). En cada pantalla mide los textos visibles: ninguno debe salirse ni encimarse con otro.
Capturas en `docs/capturas/final_*.png` y el resultado en `docs/capturas/final_revision.txt`. Lo que se encontró y se corrigió:

| Hallazgo | Arreglo |
|---|---|
| La caja del tutorial tapaba el título y las pestañas del Inspector; la barra y las fichas tapaban la ecuación y «Probar disparo» | Inspector a pantalla completa, encima de todo, que oculta lo de abajo (punto 2) |
| En el grafo del brazo, «d · descargar» quedaba encima de «Mandril_Cerrado»; en el de la CNC, «x · falla_husillo» encima de «Fresando» | Paso final que corre cada etiqueta de flecha al hueco libre más cercano dentro del grafo |
| El panel de máquina era 92 % opaco: la planta (rótulos y fichas) se veía a través del grafo | Panel 100 % opaco |
| El aviso «Logro desbloqueado» esperaba fuera de la pantalla (y = −80) aunque no hubiera logro | Oculto hasta que se gana un logro |
| El tooltip de la barra tapaba la etiqueta «BRAZO» | El tooltip termina en y = 386, sobre la etiqueta |
| El tooltip del botón de pantalla completa decía «(G)» | Dice «(L)», la tecla real desde 18.20 |
| `test/modelos.test.js` fallaba en Windows porque Git deja los JSON con CRLF | La prueba compara el contenido sin importar el tipo de salto de línea (los JSON no se tocaron) |

En 360 × 640 (vertical) se muestra el aviso «Gira el teléfono» (18.15); en 844 × 390 todo se ve igual que a 960 × 540, escalado.
