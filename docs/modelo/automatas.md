# Modelo formal: autómatas de RoboCell Tycoon

Fuente: `modelos/automatas/` (`CNC.jff`, `Brazo.jff`, `AGV.jff`, `Reparacion_DFA.jff`,
`Reparacion_ER.jff`, `CNC_Brazo_supervisor.wmod`). Los valores de este documento
se copiaron de esos archivos y se recalcularon con un script (determinismo,
composición, supervisor, DFA mínimo y palabras de prueba). Nada se cambió.

## 1. Notación

- Autómata G = (Q, Σ, δ, q0, Qm), con δ parcial.
- Σ = Σc ∪ Σuc (controlables y no controlables).
- Σ = Σo ∪ Σuo. En este proyecto **Σuo = ∅**: todos los eventos son observables.
  Por eso no hace falta autómata observador.
- En todas las máquinas q0 = Qm = {estado de reposo}: un ciclo completo vuelve al inicio.
- Un símbolo `—` en una tabla δ significa "evento no definido": el evento no puede ocurrir.

## 2. Tabla de eventos con código

| Evento | Código | Tipo | Autómata(s) |
|---|---|---|---|
| cargar | c | controlable (c) | CNC y Brazo (compartido) |
| iniciar_fresado | i | controlable (c) | CNC |
| fin_fresado | f | no controlable (uc) | CNC |
| descargar | d | controlable (c) | CNC y Brazo (compartido) |
| falla_husillo | x | no controlable (uc) | CNC |
| reset | r | controlable (c) | CNC |
| mover | m | controlable (c) | Brazo |
| llegar | l | no controlable (uc) | Brazo |
| abrir_mandril | a | controlable (c) | Brazo |
| cerrar_mandril | e | controlable (c) | Brazo |
| reservar | v | controlable (c) | AGV |
| llegar_estacion | g | no controlable (uc) | AGV |
| iniciar_descarga | u | controlable (c) | AGV |
| fin_descarga | z | no controlable (uc) | AGV |

Σc = {c, i, d, r, m, a, e, v, u}. Σuc = {f, x, l, g, z}. Σuo = ∅.

Los símbolos del lenguaje de reparación (`H`, `C`, `T`, `R`) son mayúsculas y
pertenecen a otro alfabeto. JFLAP distingue mayúsculas de minúsculas, así que `C` (chequeo)
no choca con `c` (cargar) ni `R` con `r`.

## 3. CNC (×2 instancias)

Archivo: `CNC.jff`. Estados: Libre, Cargado, Fresando, Terminado, Falla.
q0 = Libre. Qm = {Libre}. Determinista.

| Estado \ Evento | c cargar | i iniciar_fresado | f fin_fresado | d descargar | x falla_husillo | r reset |
|---|---|---|---|---|---|---|
| **Libre** (q0, Qm) | Cargado | — | — | — | — | — |
| **Cargado** | — | Fresando | — | — | — | — |
| **Fresando** | — | — | Terminado | — | Falla | — |
| **Terminado** | — | — | — | Libre | — | — |
| **Falla** | — | — | — | — | — | Libre |

6 transiciones. Ciclo normal: `c i f d`. Ciclo con falla: `c i x r`.

## 4. Brazo

Archivo: `Brazo.jff`. Estados: Reposo, Moviendo, Mandril_Cerrado, Mandril_Abierto.
q0 = Reposo. Qm = {Reposo}. Determinista.

| Estado \ Evento | m mover | l llegar | a abrir_mandril | e cerrar_mandril | c cargar | d descargar |
|---|---|---|---|---|---|---|
| **Reposo** (q0, Qm) | Moviendo | — | — | — | — | — |
| **Moviendo** | — | Mandril_Cerrado | — | — | — | — |
| **Mandril_Cerrado** | Reposo | — | Mandril_Abierto | — | — | — |
| **Mandril_Abierto** | — | — | — | Mandril_Cerrado | Mandril_Abierto | Mandril_Cerrado |

7 transiciones. `cargar` en Mandril_Abierto es un bucle (el brazo entrega la pieza y sigue abierto).

## 5. AGV (×2 instancias)

Archivo: `AGV.jff`. Estados: Libre, Viajando, Esperando, Descargando.
q0 = Libre. Qm = {Libre}. Determinista.

| Estado \ Evento | v reservar | g llegar_estacion | u iniciar_descarga | z fin_descarga |
|---|---|---|---|---|
| **Libre** (q0, Qm) | Viajando | — | — | — |
| **Viajando** | — | Esperando | — | — |
| **Esperando** | — | — | Descargando | — |
| **Descargando** | — | — | — | Libre |

4 transiciones. Ciclo: `v g u z`.

## 6. Composición CNC ‖ Brazo y supervisor

Archivo: `CNC_Brazo_supervisor.wmod` (módulo `RoboCell_CNC_Brazo`).
Contiene la planta CNC, la planta Brazo y la especificación
`Spec_NoFresarConMandrilAbierto`. El archivo no guarda el supervisor sintetizado; sus
cifras se obtuvieron sincronizando los `.jff` y aplicando la síntesis a mano (ver 6.3).

### 6.1 Especificación

- Estado prohibido: **(Fresando, Mandril_Abierto)**.
- Razón: ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto).
- Eventos compartidos (se sincronizan): `c` (cargar) y `d` (descargar). El resto es asíncrono.
- En el `.wmod` la especificación tiene 3 nodos: Seguro (inicial), CNC_Fresando y Mandril_Abierto.

### 6.2 Composición (Synchronize)

| Medida | Valor |
|---|---|
| Estados de CNC ‖ Brazo | **20** (5 × 4, todos alcanzables) |
| Transiciones | **43** |

Transiciones por tipo de evento: 16 de eventos solo del CNC (`i`, `f`, `x`, `r`: 4 cada uno),
25 de eventos solo del Brazo (`m`: 10, `l`: 5, `a`: 5, `e`: 5) y 2 compartidas
(`c` en (Libre, Mandril_Abierto) y `d` en (Terminado, Mandril_Abierto)). 16 + 25 + 2 = 43.

### 6.3 Sistema supervisado (Synthesize)

| Medida | Valor |
|---|---|
| Estados del sistema supervisado | **19** (se elimina (Fresando, Mandril_Abierto)) |
| Transiciones | 38 (43 − 5 incidentes al estado eliminado) |
| Controlable | Sí: ningún evento no controlable entra al estado prohibido |
| No bloqueante | Sí: los 19 estados llegan a (Libre, Reposo) |

**Eventos que el supervisor deshabilita** (son los botones que el juego muestra en rojo):

| Estado (CNC, Brazo) | Evento deshabilitado | Habría llevado a |
|---|---|---|
| (Cargado, Mandril_Abierto) | `i` iniciar_fresado | (Fresando, Mandril_Abierto) |
| (Fresando, Mandril_Cerrado) | `a` abrir_mandril | (Fresando, Mandril_Abierto) |

Estos dos eventos son controlables, así que la síntesis es posible sin tocar eventos no controlables.

### 6.4 Pruebas del supervisor

Palabras sobre el alfabeto de la composición. "Acepta" significa que el supervisor permite
toda la palabra y termina en (Libre, Reposo).

| Palabra | Qué representa | ¿Debe aceptarse? | Resultado |
|---|---|---|---|
| `mlm` | El brazo va y vuelve sin tocar la CNC | Sí | Acepta |
| `mlaceifadm` | Ciclo completo: carga, cierra, fresa, abre, descarga | Sí | Acepta |
| `mlaceixrm` | Ciclo con falla de husillo y reset | Sí | Acepta |
| `mlaceifadmmlm` | Ciclo completo y movimiento extra | Sí | Acepta |
| `mlaci` | Iniciar fresado con el mandril abierto | No | Rechaza: `i` deshabilitado |
| `mlaceia` | Abrir el mandril mientras la CNC fresa | No | Rechaza: `a` deshabilitado |
| `mlac` | Se detiene con la pieza cargada y el mandril abierto | No | Rechaza: no termina en estado marcado |
| `mlaceif` | Se detiene con la pieza terminada | No | Rechaza: no termina en estado marcado |

## 7. Lenguaje de reparación

- Expresión regular: `^H(CT?)+R$`.
  H = home, C = chequeo, T = cambio de herramienta, R = reset.
- Archivo `Reparacion_ER.jff`, en notación JFLAP (unión `+`, vacía `!`): `H(C(T+!))(C(T+!))*R`.
- Archivo `Reparacion_DFA.jff`: DFA mínimo de **5 estados** (q0..q4). q0 = estado inicial. Qm = {q4}.
  Es determinista y parcial (la trampa de rechazo es implícita). El script confirmó que las
  5 clases de equivalencia son distintas, así que no se puede reducir más.

| Estado \ Símbolo | H | C | T | R |
|---|---|---|---|---|
| **q0** (inicial) | q1 | — | — | — |
| **q1** (tras H) | — | q2 | — | — |
| **q2** (tras C) | — | q2 | q3 | q4 |
| **q3** (tras T) | — | q2 | — | q4 |
| **q4** (Qm, tras R) | — | — | — | — |

Palabras de prueba (la ER y el DFA dan el mismo resultado en las 9):

| Palabra | Qué representa | ¿Debe aceptarse? | Resultado en JFLAP |
|---|---|---|---|
| `HCTCR` | Home, chequeo, cambio, chequeo, reset | Sí | Acepta |
| `HCR` | Home, chequeo, reset | Sí | Acepta |
| `HCTR` | Home, chequeo, cambio, reset | Sí | Acepta |
| `HCCTCR` | Dos chequeos seguidos y luego cambio | Sí | Acepta |
| `HTCR` | Cambio sin chequeo previo | No | Rechaza |
| `HR` | Reset sin chequeo | No | Rechaza |
| `CR` | Sin home | No | Rechaza |
| `HCTTR` | Dos cambios seguidos | No | Rechaza |
| `HCT` | No termina con reset | No | Rechaza |

## 8. Palabras de prueba por máquina (4 aceptadas y 4 rechazadas)

Todas comprobadas contra las tablas δ de las secciones 3 a 5.
`ε` es la palabra vacía (q0 es estado marcado, así que se acepta).

### CNC

| Palabra | Qué representa | ¿Debe aceptarse? | Resultado |
|---|---|---|---|
| `cifd` | Ciclo normal | Sí | Acepta |
| `cixr` | Ciclo con falla y reset | Sí | Acepta |
| `cifdcixr` | Ciclo normal y luego ciclo con falla | Sí | Acepta |
| `cifdcifd` | Dos ciclos normales | Sí | Acepta |
| `ci` | Se queda fresando | No | Rechaza (termina en Fresando) |
| `cif` | Pieza terminada sin descargar | No | Rechaza (termina en Terminado) |
| `cid` | Descargar mientras fresa | No | Rechaza (d no definido en Fresando) |
| `cx` | Falla sin haber iniciado el fresado | No | Rechaza (x no definido en Cargado) |

### Brazo

| Palabra | Qué representa | ¿Debe aceptarse? | Resultado |
|---|---|---|---|
| `mlm` | Ir y volver sin abrir | Sí | Acepta |
| `mlacdm` | Abrir, cargar, descargar, volver | Sí | Acepta |
| `mlaem` | Abrir, cerrar y volver | Sí | Acepta |
| `mlaccdm` | Dos cargas seguidas (bucle) y volver | Sí | Acepta |
| `mla` | Se queda con el mandril abierto | No | Rechaza (termina en Mandril_Abierto) |
| `ml` | Llega y no vuelve | No | Rechaza (termina en Mandril_Cerrado) |
| `mlad` | Descarga y no vuelve a reposo | No | Rechaza (termina en Mandril_Cerrado) |
| `am` | Abrir sin haberse movido | No | Rechaza (a no definido en Reposo) |

### AGV

| Palabra | Qué representa | ¿Debe aceptarse? | Resultado |
|---|---|---|---|
| `vguz` | Un viaje completo | Sí | Acepta |
| `vguzvguz` | Dos viajes | Sí | Acepta |
| `vguzvguzvguz` | Tres viajes | Sí | Acepta |
| `ε` | No hace nada | Sí | Acepta (q0 es Qm) |
| `v` | Reserva y no llega | No | Rechaza (termina en Viajando) |
| `vgu` | Empieza a descargar y no termina | No | Rechaza (termina en Descargando) |
| `uvgz` | Descarga sin reserva | No | Rechaza (u no definido en Libre) |
| `vguzu` | Descarga extra después del ciclo | No | Rechaza (u no definido en Libre) |

## 9. Registro del modelo verificado (tabla 5.2 d de la guía)

### 9.1 Autómatas

| Autómata | Códigos de eventos | uc (no controlables) | uo (no observables) | q0 | Qm | N.º de estados | ¿Determinista? | Archivo |
|---|---|---|---|---|---|---|---|---|
| CNC (×2) | c, i, f, d, x, r | f, x | ∅ | Libre | {Libre} | 5 | Sí | `CNC.jff` |
| Brazo | m, l, a, e, c, d | l | ∅ | Reposo | {Reposo} | 4 | Sí | `Brazo.jff` |
| AGV (×2) | v, g, u, z | g, z | ∅ | Libre | {Libre} | 4 | Sí | `AGV.jff` |
| Reparación (DFA mínimo) | H, C, T, R | — (ninguno) | ∅ | q0 | {q4} | 5 | Sí | `Reparacion_DFA.jff` |
| Reparación (ER) | H, C, T, R | — | ∅ | — | — | — (expresión) | — | `Reparacion_ER.jff` |
| CNC ‖ Brazo | c, i, f, d, x, r, m, l, a, e | f, x, l | ∅ | (Libre, Reposo) | {(Libre, Reposo)} | 20 | Sí | `CNC_Brazo_supervisor.wmod` |
| Sistema supervisado | igual que la composición | f, x, l | ∅ | (Libre, Reposo) | {(Libre, Reposo)} | 19 | Sí | `CNC_Brazo_supervisor.wmod` (síntesis) |

Las palabras de prueba de cada autómata están en las secciones 6.4 (supervisor), 7 (reparación) y 8 (máquinas).
Los dos autómatas de reparación no tienen eventos controlables ni no controlables
definidos: modelan una secuencia de pasos de un procedimiento.
