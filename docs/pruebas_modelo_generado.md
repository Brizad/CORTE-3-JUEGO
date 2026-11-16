# Conformidad modelo–juego (generado)

Lo genera `node scripts/pruebas-modelo.mjs`. Lee los archivos de `modelos/` con un lector propio (independiente del exportador que usa el juego) y compara con el núcleo de `src/sed/`.

## Registro del modelo verificado (autómatas)

| Autómata | Códigos de eventos | uc (no controlables) | uo (no observables) | q0 | Qm | N.º de estados | ¿Determinista? | Archivo | ¿Coincide el juego? |
|---|---|---|---|---|---|---|---|---|---|
| CNC | c, d, f, i, r, x | f, x | ninguno | Libre | Libre | 5 | sí | modelos/automatas/CNC.jff | sí |
| Brazo | a, c, d, e, l, m | l | ninguno | Reposo | Reposo | 4 | sí | modelos/automatas/Brazo.jff | sí |
| AGV | g, u, v, z | g, z | ninguno | Libre | Libre | 4 | sí | modelos/automatas/AGV.jff | sí |
| Reparación (DFA mínimo) | C, H, R, T | — | ninguno | q0 | q4 | 5 | sí | modelos/automatas/Reparacion_DFA.jff | sí |

## Palabras de prueba por máquina (JFLAP contra el juego)

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

## Lenguaje de reparación ^H(CT?)+R$ (DFA de JFLAP, RegExp y juego)

| Palabra | JFLAP (DFA mínimo) | RegExp anclada | Núcleo del juego | ¿Coinciden? |
|---|---|---|---|---|
| `HCTCR` | acepta | acepta | acepta | sí |
| `HCR` | acepta | acepta | acepta | sí |
| `HCTR` | acepta | acepta | acepta | sí |
| `HCCTCR` | acepta | acepta | acepta | sí |
| `HTCR` | rechaza | rechaza | rechaza | sí |
| `HR` | rechaza | rechaza | rechaza | sí |
| `HCT` | rechaza | rechaza | rechaza | sí |
| `CR` | rechaza | rechaza | rechaza | sí |
| `HCTTR` | rechaza | rechaza | rechaza | sí |
| `HCRR` | rechaza | rechaza | rechaza | sí |

## Composición CNC ‖ Brazo y supervisor

| Dato | Software académico (cálculo independiente sobre los .jff) | Juego | ¿Coincide? |
|---|---|---|---|
| N.º de estados de CNC ‖ Brazo | 20 | 20 | sí |
| N.º de transiciones de CNC ‖ Brazo | 43 | 43 | sí |
| N.º de estados del sistema supervisado | 19 | 19 | sí |
| N.º de transiciones del sistema supervisado | 38 | 38 | sí |
| Eventos controlables que deshabilita | a en (Fresando, Mandril_Cerrado); i en (Cargado, Mandril_Abierto) | 2 (iniciar_fresado y abrir_mandril) | sí |

## Red de Petri (cálculo independiente sobre robocell.pnml contra el juego)

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

## Secuencias de eventos o de disparos

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
