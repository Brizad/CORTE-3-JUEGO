# Modelo formal: red de Petri de RoboCell Tycoon

Fuente: `modelos/petri/` (`robocell.pnml`, `robocell_corregida.pnml` y los dos `.pn` de VisObjNet).
Los valores se copiaron de los `.pnml` y se recalcularon con un script (matrices, alcanzabilidad,
árbol, invariantes). Nada se cambió. Los `.pn` son binarios y no se leyeron en detalle.

## 1. Notación

- Red N = (P, T, Pre, Post, M0) con capacidad k por lugar.
- Pre y Post tienen tamaño |T| × |P| (una fila por transición). Matriz de incidencia A = Post − Pre.
- Ecuación de estado: M_k = M_{k−1} + Aᵀ · u_k, donde u_k es el vector de disparos (|T| × 1).
  PIPE2 muestra la traspuesta de A.
- Todos los pesos de arco son 1. **Todas las capacidades son k = 1** (estricta): una transición
  no se habilita si dejaría más de 1 token en un lugar de salida.

## 2. Lugares y marcado inicial

| N.º | Lugar | M0 | k | Significado |
|---|---|---|---|---|
| p1 | Mesa_libre | 1 | 1 | La mesa de descarga está libre |
| p2 | Robot_libre | 1 | 1 | El brazo está libre |
| p3 | AGV1_listo | 1 | 1 | El AGV1 está disponible |
| p4 | AGV2_listo | 1 | 1 | El AGV2 está disponible |
| p5 | AGV1_con_mesa | 0 | 1 | El AGV1 tiene la mesa y espera el brazo |
| p6 | AGV2_con_robot | 0 | 1 | El AGV2 tiene el brazo y espera la mesa |
| p7 | AGV1_trabajando | 0 | 1 | El AGV1 descarga (tiene mesa y brazo) |
| p8 | AGV2_trabajando | 0 | 1 | El AGV2 descarga (tiene mesa y brazo) |
| p9 | Robot_en_CNC | 0 | 1 | El brazo atiende una CNC |
| p10 | Celda_libre | 1 | 1 | Solo en la red corregida: monitor de prevención |

> **p9 es una extensión del equipo**: el brazo que usan los AGV es el mismo que atiende las CNC.

M0 (red original) = [1, 1, 1, 1, 0, 0, 0, 0, 0].
M0 (red corregida) = [1, 1, 1, 1, 0, 0, 0, 0, 0, 1].

## 3. Transiciones

| Transición | Entradas (Pre) | Salidas (Post) | Evento del autómata |
|---|---|---|---|
| t1a | AGV1_listo + Mesa_libre | AGV1_con_mesa | `v` reservar (AGV1) |
| t1b | AGV1_con_mesa + Robot_libre | AGV1_trabajando | `u` iniciar_descarga (AGV1) |
| t1c | AGV1_trabajando | AGV1_listo + Mesa_libre + Robot_libre | `z` fin_descarga (AGV1) |
| t2a | AGV2_listo + Robot_libre | AGV2_con_robot | `v` reservar (AGV2) |
| t2b | AGV2_con_robot + Mesa_libre | AGV2_trabajando | `u` iniciar_descarga (AGV2) |
| t2c | AGV2_trabajando | AGV2_listo + Mesa_libre + Robot_libre | `z` fin_descarga (AGV2) |
| tr_ir | Robot_libre | Robot_en_CNC | `m` mover del Brazo desde Reposo |
| tr_volver | Robot_en_CNC | Robot_libre | `m` mover del Brazo desde Mandril_Cerrado |

**Sincronización con los autómatas:**
t1a/t2a = reservar, t1b/t2b = iniciar_descarga, t1c/t2c = fin_descarga.
`llegar_estacion` (`g`) no tiene transición en la red: es un paso interno del AGV (Viajando → Esperando).
Lo hacen igual en las dos instancias del AGV.
tr_ir y tr_volver son los dos usos de `mover` del Brazo.

La red original (`robocell.pnml`) tiene los lugares p1 a p9. La corregida (`robocell_corregida.pnml`)
añade p10 y estos arcos: Celda_libre → t1a, Celda_libre → t2a, t1c → Celda_libre y t2c → Celda_libre.

## 4. Matrices Pre, Post y A = Post − Pre (red original)

Columnas p1..p9 en este orden:
Mesa_libre, Robot_libre, AGV1_listo, AGV2_listo, AGV1_con_mesa, AGV2_con_robot,
AGV1_trabajando, AGV2_trabajando, Robot_en_CNC.

**Pre (8 × 9)**

| | p1 | p2 | p3 | p4 | p5 | p6 | p7 | p8 | p9 |
|---|---|---|---|---|---|---|---|---|---|
| t1a | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| t1b | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| t1c | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| t2a | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| t2b | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| t2c | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| tr_ir | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tr_volver | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

**Post (8 × 9)**

| | p1 | p2 | p3 | p4 | p5 | p6 | p7 | p8 | p9 |
|---|---|---|---|---|---|---|---|---|---|
| t1a | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| t1b | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| t1c | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| t2a | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| t2b | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| t2c | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| tr_ir | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| tr_volver | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**A = Post − Pre (8 × 9)**

| | p1 | p2 | p3 | p4 | p5 | p6 | p7 | p8 | p9 |
|---|---|---|---|---|---|---|---|---|---|
| t1a | −1 | 0 | −1 | 0 | 1 | 0 | 0 | 0 | 0 |
| t1b | 0 | −1 | 0 | 0 | −1 | 0 | 1 | 0 | 0 |
| t1c | 1 | 1 | 1 | 0 | 0 | 0 | −1 | 0 | 0 |
| t2a | 0 | −1 | 0 | −1 | 0 | 1 | 0 | 0 | 0 |
| t2b | −1 | 0 | 0 | 0 | 0 | −1 | 0 | 1 | 0 |
| t2c | 1 | 1 | 0 | 1 | 0 | 0 | 0 | −1 | 0 |
| tr_ir | 0 | −1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| tr_volver | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | −1 |

## 5. Matrices de la red corregida (con p10 Celda_libre)

Mismas filas y columnas p1..p9 que la sección 4, con la columna p10 añadida. Solo cambia p10:

| Transición | Pre p10 | Post p10 | A p10 |
|---|---|---|---|
| t1a | 1 | 0 | −1 |
| t1b | 0 | 0 | 0 |
| t1c | 0 | 1 | +1 |
| t2a | 1 | 0 | −1 |
| t2b | 0 | 0 | 0 |
| t2c | 0 | 1 | +1 |
| tr_ir | 0 | 0 | 0 |
| tr_volver | 0 | 0 | 0 |

Las columnas p1..p9 de Pre, Post y A son idénticas a las de la red original.

## 6. Comportamiento de la red original

### 6.1 Propiedades (resumen)

| Propiedad | Resultado | Evidencia |
|---|---|---|
| N.º de lugares y de transiciones | 9 lugares, 8 transiciones | `robocell.pnml` |
| Marcado inicial M0 | [1,1,1,1,0,0,0,0,0] | sección 2 |
| ¿Acotada? Valor de k por lugar | Sí. k = 1 en los 9 lugares | `capacity` = 1 en el `.pnml`; 8 marcados alcanzables, todos con 0 o 1 token por lugar |
| ¿Segura (1-acotada)? | Sí | Misma evidencia |
| Marcados alcanzables | 8, de los cuales 1 es muerto | sección 6.2 |
| Deadlock | M = [0,0,0,0,1,1,0,0,0] con la secuencia `t1a t2a` | sección 6.3 |
| Árbol de cobertura desde M0 | 14 nodos, 8 marcados distintos, 1 muerto | sección 6.4 |
| Invariantes P | 4 (los dos recursos y los dos AGV) | sección 7 |

### 6.2 Marcados alcanzables

| Marcado | [p1..p9] | Cómo se llega | ¿Muerto? |
|---|---|---|---|
| M0 | [1,1,1,1,0,0,0,0,0] | inicial | No |
| M1 | [0,1,0,1,1,0,0,0,0] | M0 –t1a→ | No |
| M2 | [1,0,1,0,0,1,0,0,0] | M0 –t2a→ | No |
| M3 | [1,0,1,1,0,0,0,0,1] | M0 –tr_ir→ | No |
| M4 | [0,0,0,1,0,0,1,0,0] | M1 –t1b→ | No |
| M5 | [0,0,0,0,1,1,0,0,0] | M1 –t2a→ o M2 –t1a→ | **Sí** |
| M6 | [0,0,0,1,1,0,0,0,1] | M1 –tr_ir→ o M3 –t1a→ | No |
| M7 | [0,0,1,0,0,0,0,1,0] | M2 –t2b→ | No |

### 6.3 Deadlock y ecuación de estado

Secuencia que lleva al marcado muerto: `t1a` y luego `t2a` (o al revés). Es la secuencia más corta.

- Disparos: t1a una vez y t2a una vez. Vector u = [t1a: 1, t1b: 0, t1c: 0, t2a: 1, t2b: 0, t2c: 0, tr_ir: 0, tr_volver: 0]ᵀ.
- Ecuación de estado:
  M = M0 + Aᵀ · u = M0 + A(t1a) + A(t2a)

| | p1 | p2 | p3 | p4 | p5 | p6 | p7 | p8 | p9 |
|---|---|---|---|---|---|---|---|---|---|
| M0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| + A(t1a) | −1 | 0 | −1 | 0 | 1 | 0 | 0 | 0 | 0 |
| + A(t2a) | 0 | −1 | 0 | −1 | 0 | 1 | 0 | 0 | 0 |
| **= M** | **0** | **0** | **0** | **0** | **1** | **1** | **0** | **0** | **0** |

- Por qué es muerto: AGV1 tiene la mesa (p5) y espera el brazo; AGV2 tiene el brazo (p6) y espera la mesa.
  t1b necesita p2 (Robot_libre) y t2b necesita p1 (Mesa_libre). Ambos están en 0. tr_ir también necesita p2.
  Ninguna transición queda habilitada. Es una espera circular por dos recursos.

### 6.4 Árbol de cobertura desde M0

Convención de conteo: se expanden todas las transiciones habilitadas. Un nodo cuyo marcado ya apareció
antes (en orden de anchura) se cuenta como nodo, pero no se expande ("dup"). No aparece ω porque la red es acotada.

| Nodo origen | Transición | Nodo destino |
|---|---|---|
| M0 | t1a | M1 |
| M0 | t2a | M2 |
| M0 | tr_ir | M3 |
| M1 | t1b | M4 |
| M1 | t2a | M5 (muerto) |
| M1 | tr_ir | M6 |
| M2 | t1a | M5 (dup) |
| M2 | t2b | M7 |
| M3 | t1a | M6 (dup) |
| M3 | tr_volver | M0 (dup) |
| M4 | t1c | M0 (dup) |
| M6 | tr_volver | M1 (dup) |
| M7 | t2c | M0 (dup) |

Resultado: **14 nodos** (1 raíz + 13 hijos), **8 marcados distintos**, **1 muerto** (M5).

## 7. Invariantes

### 7.1 Invariantes P (y · A = 0 y suma constante)

| N.º | Invariante | Suma |
|---|---|---|
| IP1 | Mesa_libre + AGV1_con_mesa + AGV1_trabajando + AGV2_trabajando | = 1 |
| IP2 | Robot_libre + AGV2_con_robot + AGV1_trabajando + AGV2_trabajando + Robot_en_CNC | = 1 |
| IP3 | AGV1_listo + AGV1_con_mesa + AGV1_trabajando | = 1 |
| IP4 | AGV2_listo + AGV2_con_robot + AGV2_trabajando | = 1 |

Comprobados dos veces: yA = 0 en las 8 filas y suma = 1 en los 8 marcados alcanzables.
IP1 dice que la mesa es de uno solo. IP2 dice lo mismo del brazo. IP3 e IP4 dicen que cada AGV está en un solo estado.

### 7.2 Invariantes T (calculados a partir de A, no venían en la ficha)

| N.º | Vector de disparos | Ciclo que reproduce el marcado |
|---|---|---|
| IT1 | t1a + t1b + t1c | Ciclo completo del AGV1 |
| IT2 | t2a + t2b + t2c | Ciclo completo del AGV2 |
| IT3 | tr_ir + tr_volver | Viaje del brazo a la CNC y vuelta |

## 8. Prevención del deadlock: red corregida

Regla: lugar monitor **Celda_libre** (p10, M0 = 1, k = 1). Lo toman t1a y t2a, y lo devuelven t1c y t2c.
Así solo un AGV puede estar dentro del ciclo de reserva a la vez. Archivo: `robocell_corregida.pnml`.

### 8.1 Propiedades

| Propiedad | Resultado | Evidencia |
|---|---|---|
| N.º de lugares y de transiciones | 10 lugares, 8 transiciones | `robocell_corregida.pnml` |
| Marcado inicial M0 | [1,1,1,1,0,0,0,0,0,1] | sección 2 |
| ¿Acotada? Valor de k | Sí. k = 1 en los 10 lugares | `capacity` = 1 en el `.pnml` |
| ¿Segura? | Sí | 7 marcados alcanzables, todos 0 o 1 |
| Deadlock | Ninguno | 0 marcados muertos |
| Árbol de cobertura desde M0 | 12 nodos, 7 marcados distintos, 0 muertos | sección 8.3 |

### 8.2 Marcados alcanzables

| Marcado | [p1..p10] | Cómo se llega |
|---|---|---|
| M0 | [1,1,1,1,0,0,0,0,0,1] | inicial |
| M1 | [0,1,0,1,1,0,0,0,0,0] | M0 –t1a→ |
| M2 | [1,0,1,0,0,1,0,0,0,0] | M0 –t2a→ |
| M3 | [1,0,1,1,0,0,0,0,1,1] | M0 –tr_ir→ |
| M4 | [0,0,0,1,0,0,1,0,0,0] | M1 –t1b→ |
| M5 | [0,0,0,1,1,0,0,0,1,0] | M1 –tr_ir→ o M3 –t1a→ |
| M6 | [0,0,1,0,0,0,0,1,0,0] | M2 –t2b→ |

El marcado muerto de la red original ya no es alcanzable: con p10 en 0 después de t1a,
t2a queda deshabilitada. Con t2a primero, t1a queda deshabilitada.

### 8.3 Árbol de cobertura (misma convención que 6.4)

| Nodo origen | Transición | Nodo destino |
|---|---|---|
| M0 | t1a | M1 |
| M0 | t2a | M2 |
| M0 | tr_ir | M3 |
| M1 | t1b | M4 |
| M1 | tr_ir | M5 |
| M2 | t2b | M6 |
| M3 | t1a | M5 (dup) |
| M3 | tr_volver | M0 (dup) |
| M4 | t1c | M0 (dup) |
| M5 | tr_volver | M1 (dup) |
| M6 | t2c | M0 (dup) |

Resultado: **12 nodos** (1 raíz + 11 hijos), **7 marcados distintos**, **0 muertos**.

### 8.4 Invariantes de la red corregida

Se conservan IP1..IP4 e IT1..IT3 (las columnas p1..p9 no cambian y las filas de t1a, t1c, t2a y t2c
suman 0 en p10 junto con las demás). Se añade un invariante P:

| N.º | Invariante | Suma |
|---|---|---|
| IP5 | Celda_libre + AGV1_con_mesa + AGV1_trabajando + AGV2_con_robot + AGV2_trabajando | = 1 |

## 9. Registro del modelo verificado (tabla 5.2 d de la guía)

| Propiedad de la red de Petri | Resultado (red original) | Resultado (red corregida) | Evidencia |
|---|---|---|---|
| N.º de lugares y de transiciones | 9 y 8 | 10 y 8 | `robocell.pnml`, `robocell_corregida.pnml` |
| Marcado inicial M0 | [1,1,1,1,0,0,0,0,0] | [1,1,1,1,0,0,0,0,0,1] | Sección 2 |
| ¿Acotada? Valor de k por lugar | Sí. k = 1 en todos | Sí. k = 1 en todos | Capacidad 1 en el `.pnml` |
| ¿Segura (1-acotada)? | Sí | Sí | 8 y 7 marcados con 0 o 1 token por lugar |
| Deadlock: marcado muerto y secuencia que lo produce | [0,0,0,0,1,1,0,0,0] por `t1a t2a` | No tiene | Secciones 6.3 y 8.2 |
| Regla de prevención y verificación de que lo elimina | — | Monitor Celda_libre (M0 = 1) en t1a/t2a y devuelto en t1c/t2c. 0 marcados muertos | Sección 8 |
| Invariantes P encontrados | 4 (IP1..IP4) | 5 (IP1..IP5) | Secciones 7 y 8.4 |
| N.º de nodos del árbol de cobertura desde M0 | 14 nodos, 8 marcados, 1 muerto | 12 nodos, 7 marcados, 0 muertos | Secciones 6.4 y 8.3 |
