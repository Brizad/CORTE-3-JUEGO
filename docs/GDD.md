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

### 6.1 Pedidos por turno

Los pedidos llegan en t = n × intervalo, para n ≥ 1 y t < 180 s.

| Turno | Intervalo | Pedidos en el turno |
|---|---|---|
| 1 | 25 s | 7 (25, 50, …, 175 s) |
| 2 | 18 s | 9 (18, 36, …, 162 s) |
| 3 | 12 s | 14 (12, 24, …, 168 s) |

## 7. Turnos y dificultad

| Turno | Duración | Meta | Prob. de falla por fresado | Intervalo de pedidos |
|---|---|---|---|---|
| 1 | 180 s | 3 piezas | 10 % | 25 s |
| 2 | 180 s | 5 piezas | 20 % | 18 s |
| 3 | 180 s | 7 piezas | 30 % | 12 s |

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

- Cuesta **−150 puntos**. Se puede comprar antes de empezar el turno o durante él.
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
| Disparar un evento controlable | Clic en su botón | — | Toque en su botón |
| Mandar el brazo (tr_ir) o despachar AGV (t1a, t2a) | Clic en el botón del HUD | — | Toque en el botón |
| Pausa | Botón de pausa | **P** | Botón de pausa |
| Inspector | Botón del inspector | **I** | Botón del inspector |
| Velocidad x1, x2, x4 | Botones de velocidad | **1**, **2**, **4** | Botones de velocidad |
| Cerrar el HUD o un panel | Botón X | **Esc** | Botón X |
| Consola de reparación: símbolos | Botones H, C, T, R | **H**, **C**, **T**, **R** | Botones H, C, T, R |
| Consola de reparación: enviar | Botón Enviar | **Enter** | Botón Enviar |
| Contador de fps | — | **F1** | Botón en el inspector |
| Mover la cámara | Arrastrar con el botón izquierdo | — | Arrastrar con un dedo |
| Acercar y alejar | Rueda del mouse | — | Pellizco con dos dedos |

Los botones táctiles miden al menos 44 × 44 px de área de toque.

## 14. HUD por zonas

El juego es 960 × 540 px con escala FIT.

| Zona | Contenido |
|---|---|
| **Arriba izquierda** | Reloj del turno (s restantes de 180 s), número de turno, velocidad actual |
| **Arriba centro** | Puntaje y piezas / meta (por ejemplo 2 / 5) |
| **Arriba derecha** | Radar del Árbol de Cobertura (verde, amarillo parpadeante o rojo) |
| **Abajo izquierda** | Fichas por lugar: p1..p9, y p10 si el Controlador está activo. Cada ficha con su forma y color |
| **Abajo derecha** | Alertas: pedido por vencer, falla de husillo, intento bloqueado, deadlock, logro |
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
- Para la CNC en Falla: la consola de reparación (14.2) reemplaza a los botones y a la lista de eventos.
- Para el brazo: "m → CNC1" y "m → CNC2" desde Reposo (tr_ir) y "volver" desde Mandril_Cerrado. Para los AGV: "Despachar AGV1"
  o "Despachar AGV2" según el HUD abierto.
- Mientras un HUD está abierto, el modo demostración no toca esa máquina.
- El panel mide 340 × 392 px y se coloca junto a la máquina (a la derecha, o a la izquierda si la máquina está en la mitad
  derecha de la pantalla). Un HUD abierto tapa lo que queda debajo del panel: se cierra con Esc o con la X.
- Lista de los últimos 10 eventos de la máquina (su palabra observada), con el tiempo de cada uno.

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

**Ninguna estrategia gana siempre.** Carga del brazo estimada por turno (180 s disponibles):

| Turno | Fresados esperados (meta / (1 − p)) | Brazo en piezas | Brazo en AGV (pedidos × 5 s) | Total | Uso del brazo |
|---|---|---|---|---|---|
| 1 | 3,3 | 3,3 × 5 s + 3 × 4 s = 29 s | 7 × 5 s = 35 s | 64 s | 36 % |
| 2 | 6,3 | 6,3 × 5 s + 5 × 4 s = 51 s | 9 × 5 s = 45 s | 96 s | 53 % |
| 3 | 10 | 10 × 5 s + 7 × 4 s = 78 s | 14 × 5 s = 70 s | 148 s | 82 % |

- En el turno 3 el brazo está casi saturado. El jugador no puede atender todo: debe elegir entre
  los pedidos (+40 cada uno, −20 si vencen) y las piezas (+100 y necesarias para ganar).
- Ignorar todos los pedidos cuesta 14 × 20 = 280 puntos en el turno 3.
- Priorizar solo los AGV no cumple la meta de piezas.
- Comprar el Controlador evita el deadlock pero baja el rendimiento de los AGV.
- Los valores de 5 s y 4 s por operación del brazo asumen 1 s de reacción por clic. Se deben medir en pruebas.

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
| CA-13 | La probabilidad de falla es 10 %, 20 % y 30 % en los turnos 1, 2 y 3 | Simular 1000 fresados por turno en una prueba automática y comparar |
| CA-14 | Los pedidos llegan cada 25 s, 18 s y 12 s según el turno, y un pedido sin atender se vence a los 30 s con −20 | Dejar un pedido pendiente y observar |
| CA-15 | Las metas son 3, 5 y 7 piezas. Cumplir la meta termina el turno como victoria | Jugar cada turno |
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
