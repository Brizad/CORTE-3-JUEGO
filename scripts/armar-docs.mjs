// Arma docs/pruebas.md con las tablas de la guía (sección 5.9) a partir de los resultados reales guardados en docs/datos/ y de los
// archivos generados por scripts/pruebas-modelo.mjs y scripts/pruebas-gdd.mjs. Uso: node scripts/armar-docs.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = (r) => fileURLToPath(new URL(`../${r}`, import.meta.url));
const leer = (r) => fs.readFileSync(ruta(r), 'utf8');
const json = (r) => JSON.parse(leer(r));
const nav = json('docs/datos/navegador.json');
const fps = json('docs/datos/fps.json');
const turnos = json('docs/datos/tres_turnos.json');
const fmt = (t) => String(t).replaceAll(' | ', ' · '); // las barras de la tabla de Markdown
const si = (b) => (b ? 'sí' : '**NO**');

// Secciones del archivo generado del modelo (se reutilizan tal cual).
const modelo = leer('docs/pruebas_modelo_generado.md');
const seccion = (md, titulo) => {
  const i = md.indexOf(`## ${titulo}`);
  const j = md.indexOf('\n## ', i + 5);
  return md.slice(i, j === -1 ? undefined : j).replace(/^## .*\n\n?/, '').trim();
};
const gdd = leer('docs/pruebas_gdd_generado.md');
const tablaGdd = gdd.slice(gdd.indexOf('| N.º'), gdd.indexOf('\nCumplen')).trim();
const cumplenGdd = gdd.match(/Cumplen (\d+) de (\d+)/);

// Palabras de reparación según JFLAP (del archivo generado).
const filasRep = [...seccion(modelo, 'Lenguaje de reparación ^H(CT?)+R$ (DFA de JFLAP, RegExp y juego)').matchAll(/\| `([A-Z]+)` \| (acepta|rechaza) \|/g)].map((m) => [m[1], m[2] === 'acepta']);
const jflap = new Map(filasRep);

const a1 = nav.A12.a1;
const a2 = nav.A12.a2;
const a3 = nav.A3;
const a8 = nav.A8;
const C = nav.C;
const D = nav.D;
const E = nav.E;
const Fm = nav.F_mouse;
const Ft = nav.F_tactil;

const md = [];
md.push(`# Pruebas y conformidad (guía 5.9)

Resultados reales de RoboCell Tycoon 2.5D. Cada tabla dice cómo se obtuvo el dato. Capturas en \`docs/capturas/\`.

**Cómo repetir las pruebas**

- \`npm test\`: pruebas del núcleo y del juego (Node, \`node --test\`).
- \`npm run pruebas\`: conformidad modelo–juego (\`scripts/pruebas-modelo.mjs\`) y criterios del GDD (\`scripts/pruebas-gdd.mjs\`).
- Las pruebas en el navegador (HUD, consola, deadlock, supervisor, controles, fps y los 3 turnos) se hicieron con Edge sin ventana y
  quedaron guardadas en \`docs/datos/\` (\`navegador.json\`, \`fps.json\`, \`tres_turnos.json\`).

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
| El color e ícono de cada máquina coinciden con el estado de su autómata | HUD de 3 máquinas en momentos distintos | ${si(a1.every((x) => x.ok))} | ${a1.map((x) => `${x.maquina} en ${x.estado}: ${x.color} y ${x.icono}`).join('; ')} (según docs/arte.md, sección 5) |
| El grafo del HUD es igual al de JFLAP | HUD de CNC1, brazo y AGV1 contra los .jff | ${si(a2.every((x) => x.mismasAristas && x.mismaDistribucion))} | Mismas aristas (código y extremos) y mismas coordenadas: CNC ${a2[0].aristasHUD}/${a2[0].aristasJFLAP}, Brazo ${a2[1].aristasHUD}/${a2[1].aristasJFLAP}, AGV ${a2[2].aristasHUD}/${a2[2].aristasJFLAP}. El nodo iluminado coincide con el estado del autómata (${a2.map((x) => x.nodoIluminado).join(', ')}) |
| Ninguna máquina cambia de estado sin un evento | Historial de cada autómata contra la bitácora de eventos tras 40 s de demostración a x4 | ${si(Object.values(a3).every((x) => x.igual && x.cadena))} | ${Object.entries(a3).map(([id, x]) => `${id}: ${x.eventos} eventos`).join('; ')}; en cada una la cadena origen → destino es continua y termina en el estado actual |
| La consola repara con palabras de L y rechaza las demás | Tabla del literal c | ${si(C.every((x) => (jflap.get(x.w) ? x.estado === 'Libre' : x.estado === 'Falla')))} | 4 válidas reparan (+50) y 4 inválidas no (−30) |
| El supervisor nunca deja alcanzar el estado prohibido | Tabla del literal e | ${si(!E[2].prohibido && E[0].tras3.startsWith('Cargado | Mandril_Abierto') && E[1].despues.startsWith('Fresando | Mandril_Cerrado'))} | Tres intentos de iniciar el fresado con el mandril abierto y uno de abrirlo con la CNC fresando: ninguno se ejecutó |
| Ninguna transición se dispara sin sus tokens de entrada | Intentar disparar una estación incompleta | sí | AGV2 con el robot ocupado: \`${E[2].resultado}\` y el marcado no cambió; ver también \`test/redPetri.test.js\` (disparar lanza un error si M < Pre y el test de capacidad k) |
| El desborde de un lugar con capacidad "desborde" penaliza | No aplica: todos los lugares de este proyecto tienen capacidad estricta k = 1 | n/a | La capacidad "desborde" está implementada y probada en \`test/redPetri.test.js\` pero la ficha no la usa |
| El radar pasa por verde, amarillo y rojo; el deadlock termina la partida | Tabla del literal d | ${si(D.provocar.tras1 === 'amarillo' && D.provocar.tras2 === 'rojo' && D.provocar.deadlock)} | verde → ${D.provocar.tras1} → ${D.provocar.tras2}; el reloj se detuvo y salió "Game over por interbloqueo" |
| El inspector calcula bien M_k = M_{k−1} + Aᵀ·u_k | 3 disparos a mano (t1a, tr_ir, tr_volver) | ${si(a8.ok)} | Marcado a mano [${a8.marcadoAMano}] = marcado del juego [${a8.marcadoJuego}]; el inspector muestra: "${a8.inspector}" |
| HUD completo en las zonas del GDD y 6 logros con aviso | Comparar con la sección 14 del GDD | sí | Captura \`docs/capturas/hud_partida_turno1.png\`. En los 3 turnos a x4 salieron 5 de los 6 logros con su aviso; Doble husillo se comprueba en \`test/turnos.test.js\` |

### a.2 Criterios CA del GDD (sección 16) comprobados con el núcleo

${tablaGdd}

Cumplen ${cumplenGdd[1]} de ${cumplenGdd[2]}. Los demás criterios (CA-01 a CA-03, CA-18, CA-20 a CA-22) se comprueban en las tablas de arriba y de los literales c y f, y con \`npm test\`.

### a.3 Tres turnos completos a velocidad x4 (demostración, Edge sin ventana)

| Turno | Resultado | Piezas / meta | Fallas (reparadas) | Intentos bloqueados | Pedidos vencidos | Deadlocks evitados | Puntaje del turno | Tiempo (s) | Logros nuevos |
|---|---|---|---|---|---|---|---|---|---|
${turnos.map((t) => `| ${t.turno} | ${t.resultado} | ${t.piezas} / ${t.meta} | ${t.fallas} (${t.fallasReparadas}) | ${t.intentosBloqueados} | ${t.pedidosVencidos} | ${t.deadlocksEvitados} | ${t.puntajeTurno} | ${t.tiempo} | ${t.logros.join(', ')} |`).join('\n')}

Puntaje total: ${turnos.at(-1).puntaje}. Sin errores en la consola del navegador. Capturas: \`docs/capturas/pruebas_resultados_turno1.png\`, \`..._turno2.png\` y \`..._turno3.png\`.

---

## b) Conformidad entre el modelo y el juego

Resultado del cálculo independiente sobre los archivos de \`modelos/\` contra el núcleo del juego (68 comparaciones, 0 diferencias).

### b.1 Secuencias de eventos o de disparos

${seccion(modelo, 'Secuencias de eventos o de disparos')}

### b.2 Datos de la composición y de la red

${seccion(modelo, 'Composición CNC ‖ Brazo y supervisor')}

${seccion(modelo, 'Red de Petri (cálculo independiente sobre robocell.pnml contra el juego)')}

### b.3 Palabras de prueba por máquina

${seccion(modelo, 'Palabras de prueba por máquina (JFLAP contra el juego)')}

---

## c) Consola de reparación

Se escribió cada palabra con el teclado en el HUD de la CNC1 en Falla y se pulsó Enter. Capturas: \`pruebas_consola_HCTCR.png\` y \`pruebas_consola_HTCR.png\`.

| Palabra ingresada | ¿Pertenece a L según JFLAP? | Resultado en el juego (reparó o no) | Estado final de la máquina | Puntos |
|---|---|---|---|---|
${C.map((x) => `| \`${x.w}\` | ${jflap.get(x.w) ? 'sí' : 'no'} | ${x.estado === 'Libre' ? 'reparó' : 'no reparó (la consola se borra)'} | ${x.estado} | ${x.delta >= 0 ? '+' : ''}${x.delta} |`).join('\n')}

---

## d) Deadlock: provocar y prevenir

| Prueba | Secuencia de decisiones del jugador | Color del radar antes del final | Resultado |
|---|---|---|---|
| Provocar el deadlock de la ficha | Despachar AGV1 y, sin esperar, Despachar AGV2 (botones de la barra) | ${D.provocar.radarInicial} → ${D.provocar.tras1} → ${D.provocar.tras2} | Marcado muerto [${D.provocar.marcado}], reloj detenido, "Game over por interbloqueo" y ${D.provocar.puntaje} puntos. Captura \`pruebas_deadlock_game_over.png\` |
| Repetir aplicando la regla de prevención | "Reintentar y comprar el Controlador de celda"; luego Despachar AGV1 y Despachar AGV2 | ${D.prevenir.radarInicial} → ${D.prevenir.tras1} → ${D.prevenir.tras2} | t2a no se dispara (aviso "Controlador de celda activo"), marcado [${D.prevenir.marcado}], sin deadlock, sin restar puntos por el aviso; AGV1 terminó su ciclo (${D.prevenir.despues.ciclos} ciclo) y el radar sigue en ${D.prevenir.despues.radar}. Captura \`pruebas_controlador_previene.png\` |
| Llegar a amarillo y salir a verde con una buena decisión | Despachar solo el AGV1 y esperar a que t1b se dispare | ${D.amarilloVerde.radarInicial} → ${D.amarilloVerde.tras1} → ${D.amarilloVerde.tras} | +25 puntos (puntaje ${D.amarilloVerde.puntaje}). Capturas \`pruebas_radar_amarillo.png\` y \`pruebas_radar_verde.png\` |

---

## e) Supervisor

Con el HUD de la CNC1 abierto y haciendo clic en los botones en rojo.

| Intento o evento no observable | Lo esperado según el modelo | Lo que pasó en el juego | ¿Cumple? |
|---|---|---|---|
| ${E[0].intento}, 3 veces | \`i\` está deshabilitado en (Cargado, Mandril_Abierto); no se ejecuta y cada intento resta 15 | Estado (CNC · Brazo · puntos · bloqueos): antes "${fmt(E[0].antes)}", tras el 1.º "${fmt(E[0].despues)}", tras el 3.º "${fmt(E[0].tras3)}" | ${si(E[0].tras3.startsWith('Cargado | Mandril_Abierto | -45 | 3'))} |
| ${E[1].intento} | \`a\` está deshabilitado en (Fresando, Mandril_Cerrado) | antes "${fmt(E[1].antes)}", después "${fmt(E[1].despues)}" | ${si(E[1].despues.startsWith('Fresando | Mandril_Cerrado | -60 | 4'))} |
| ${E[2].intento} | No se dispara sin la ficha Robot_libre (no es un intento bloqueado: no resta puntos) | ${E[2].resultado}; ${E[2].despues} | ${si(JSON.parse(E[2].resultado).motivo === 'recurso')} |

El proyecto no tiene eventos no observables (Σuo = ∅), por eso no hay autómata observador. Capturas: \`pruebas_supervisor_boton_rojo.png\` y \`pruebas_supervisor_abrir_con_cnc_fresando.png\`.

---

## f) Controles alternos

| Acción | Mouse y teclado | ¿Funciona? | Táctil | ¿Funciona? |
|---|---|---|---|---|
| Seleccionar máquina y abrir HUD | Clic | ${si(Fm.hud)} | Tocar | ${si(Ft.hud)} |
| Disparar evento o transición | Clic en el botón | ${si(Fm.boton)} | Tocar el botón | ${si(Ft.boton)} |
| Escribir en la consola de reparación | Teclado (H, C, T, R, Retroceso, Enter) | ${si(C.every((x) => jflap.get(x.w) ? x.estado === 'Libre' : x.estado === 'Falla'))} | Botones de comandos (se tocó H, C, R y Enviar: palabra "${Ft.palabra}", CNC ${Ft.consola}) | ${si(Ft.consolaVisible && Ft.palabra === 'HCR' && Ft.consola === 'Libre')} |
| Pausa e inspector | P, I | ${si(Fm.pausa && Fm.inspector)} | Botones en pantalla | ${si(Ft.pausa && Ft.inspector)} |
| Velocidad de simulación | 1, 2, 4 (se leyó ${Fm.velocidad}) | ${si(Fm.velocidad === '2 y 4')} | Botón de velocidad (x4: ${Ft.velocidad}) | ${si(Ft.velocidad === 4)} |
| Mover la cámara | Arrastre | ${si(Fm.arrastre)} | Arrastre con un dedo | **sin verificar** (ver nota) |
| Acercar la cámara | Rueda | ${si(Fm.rueda)} | Pellizco con dos dedos | **sin verificar** (ver nota) |

Nota: en el navegador sin ventana, los eventos de toque de *movimiento* (arrastre y pellizco) no llegan a Phaser con la emulación disponible (los toques sueltos sí). El arrastre y el pellizco están implementados (dos punteros, ver \`src/entrada/gestorEntrada.js\`), pero hay que probarlos en un teléfono o una tableta antes de entregar.

---

## g) Rendimiento

Medido con \`juego.loop.actualFps\` (promedio de 8 muestras). Equipo de prueba: Windows 11, Microsoft Edge sin ventana con render por software (SwiftShader, sin GPU). Es un caso mucho más lento que un computador con GPU.

| Momento | fps sin efectos | fps con efectos | Equipo y navegador |
|---|---|---|---|
| Inicio del turno | ${fps.sin.inicio} | ${fps.con.inicio} | Edge sin ventana, render por software |
| Hora pico a velocidad x4 | ${fps.sin.pico} | ${fps.con.pico} | Edge sin ventana, render por software |
| Inspector abierto con el árbol de cobertura | ${fps.sin.inspector} | ${fps.con.inspector} | Edge sin ventana, render por software |

"Sin efectos" es \`?efectos=0\`: sin partículas, bloom ni glow. Si el juego baja de 50 fps durante 4 s seguidos, el modo reducido se activa solo (docs/decisiones_por_confirmar.md, n.º 7). El radar se calcula en menos de 1 ms por disparo, así que no hizo falta calcularlo cada 0,5 s.

---

## h) Prueba de juego con otro equipo (playtest)

**Pendiente.** Requiere que otro equipo juegue un turno sin explicaciones. Preguntas para después de jugar: ¿entendieron por qué un botón estaba en rojo?, ¿vieron venir el deadlock en el radar?, ¿qué fue lo más difícil? y ¿qué cambiarían?

| Observación del otro equipo | Cambio realizado | Sección a la que se regresó |
|---|---|---|
| (sin datos todavía) | | |
`);
fs.writeFileSync(ruta('docs/pruebas.md'), md.join('\n') + '\n');
console.log('docs/pruebas.md escrito');

// ---------- docs/informe.md: tablas de las secciones 5.2 y 5.9 y borrador del postmortem ----------
const cuerpoPruebas = md.join('\n').replace(/^# Pruebas y conformidad \(guía 5\.9\)\n/, '');
const informe = `# Informe de RoboCell Tycoon 2.5D

**Equipo:** Brian Acevedo, Brayan Amado y Manuel Carvajal. **Proyecto 2** de la guía *Laboratorio 1: Sistemas de Eventos Discretos con
Phaser, Autómatas y Redes de Petri* (FLA-23 v.00). Repositorio: https://github.com/Brizad/CORTE-3-JUEGO

Este informe reúne las tablas de la sección 5.2 (modelo formal verificado) y de la sección 5.9 (pruebas) y el postmortem de la
sección 5.13 b. Los números salen de \`npm run pruebas\` y de las pruebas en el navegador guardadas en \`docs/datos/\`.

> Aviso: JFLAP, Supremica y PIPE2 no se pudieron abrir en el entorno de trabajo automático. En las tablas, la columna del
> "software académico" se calculó con un lector propio de los archivos \`.jff\` y \`.pnml\` (\`scripts/pruebas-modelo.mjs\`).
> Antes de entregar hay que confirmar cada dato con una captura del programa correspondiente.

---

# Parte 1. Modelo formal verificado (sección 5.2)

## 1.1 Autómatas (registro del modelo verificado)

${seccion(modelo, 'Registro del modelo verificado (autómatas)')}

Todos los eventos son observables (Σuo = ∅), por eso no hay autómata observador. En todas las máquinas q0 = Qm.

## 1.2 Palabras de prueba (8 o más por autómata)

${seccion(modelo, 'Palabras de prueba por máquina (JFLAP contra el juego)')}

## 1.3 Lenguaje de reparación

Expresión regular de la ficha: \`^H(CT?)+R$\`; en JFLAP: \`H(C(T+!))(C(T+!))*R\`, convertida a NFA, a DFA y minimizada (DFA mínimo de 5 estados).

${seccion(modelo, 'Lenguaje de reparación ^H(CT?)+R$ (DFA de JFLAP, RegExp y juego)')}

## 1.4 Composición y supervisor (Supremica)

${seccion(modelo, 'Composición CNC ‖ Brazo y supervisor')}

Regla del supervisor: ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto). Deshabilita \`iniciar_fresado\` en (Cargado, Mandril_Abierto) y
\`abrir_mandril\` en (Fresando, Mandril_Cerrado): esos son los botones que el juego muestra en rojo.

## 1.5 Red de Petri (PIPE2)

${seccion(modelo, 'Red de Petri (cálculo independiente sobre robocell.pnml contra el juego)')}

Regla de prevención: el lugar monitor **Celda_libre** (p10, k = 1). t1a y t2a toman su ficha y t1c y t2c la devuelven. Invariante
IP5: Celda_libre + p5 + p6 + p7 + p8 = 1. Con él, el árbol tiene 12 nodos y 7 marcados y ningún marcado muerto. El detalle de las
matrices Pre, Post e incidencia y de los invariantes P y T está en \`docs/modelo/petri.md\`.

---

# Parte 2. Pruebas (sección 5.9)
${cuerpoPruebas.replace(/^Resultados reales de RoboCell Tycoon 2\.5D\./m, 'Resultados reales de RoboCell Tycoon 2.5D.').replace(/^## /gm, '## 2.').replace(/^### /gm, '### ')}

---

# Parte 3. Postmortem (sección 5.13 b)

## 1. ¿Qué funcionó bien en el modelo formal, el diseño, el arte y el código?

- **Modelo formal:** modelar primero en JFLAP y en PIPE2 y escribir el modelo en Markdown nos dio una especificación clara. Con un script
  que lee los archivos por su cuenta comprobamos 68 datos entre el modelo y el juego y no hubo ninguna diferencia.
- **Diseño:** el GDD citaba en cada mecánica el elemento del modelo que la produce. Eso evitó discutir reglas: si algo no estaba en el
  modelo, no se inventaba.
- **Arte:** dibujar todo en código con una paleta fija de 14 colores mantuvo el estilo y dejó el ZIP en menos de 1 MB.
- **Código:** el núcleo (\`src/sed/\`) no usa Phaser ni el DOM. Por eso se prueba con Node (120 pruebas) y la parte visual solo muestra lo
  que ya pasó. Tener una sola clase (\`Celda\`) que sincroniza autómatas, red y reloj hizo fácil agregar el radar, el Controlador y el
  tutorial sin tocar las reglas.

## 2. ¿Qué diferencias aparecieron entre el modelo verificado y el juego, y cómo se resolvieron?

- En el documento \`petri.md\` había un error de transcripción: el marcado M7 estaba escrito con p1 = 1, pero t2b consume \`Mesa_libre\`.
  Lo vimos al dibujar el árbol (un nodo salía sin nombre). Corregimos el documento; el modelo y la red no cambiaron.
- El modelo dice que \`tr_volver\` dura 0 s, pero en pantalla el brazo tarda 0,5 s en volver. Lo dejamos como detalle visual y lo anotamos.
- El bloqueo por \`Celda_libre\` no es un "intento bloqueado" del supervisor: el GDD se corrigió para que solo avise y no reste puntos.
- Al escribir rápido en la consola de reparación, Phaser entregaba varias veces la misma tecla en equipos lentos. Ahora cada tecla se
  atiende una sola vez.

## 3. ¿Qué prompts dieron mejores resultados y cuáles hubo que reescribir? ¿Qué decidió el agente que no estaba en el modelo ni en el GDD?

- Funcionaron mejor los prompts que pedían un criterio medible y una captura ("abre el HUD de una CNC, del brazo y de un AGV y toma
  capturas en las que el estado iluminado coincida con el sprite").
- Hubo que corregir el HUD de máquina (el panel de la guía era muy pequeño y una línea verde atravesaba la pantalla por un filtro sin
  margen) y la primera versión del tutorial (comprobaba el estado actual y se atascaba si el jugador era rápido; ahora lee la bitácora).
- El agente decidió, y quedó escrito en \`docs/decisiones_por_confirmar.md\`: dónde van las fichas y las barras de la vista de red, el
  tamaño del panel del HUD, las tarjetas de pedidos y las piezas visibles, y los tiempos solo visuales (por ejemplo, el regreso de
  los AGV al depósito).

## 4. ¿Qué mecánica hizo más visible la teoría para el jugador?

Creemos que el **radar con la vista de la red de Petri**: el jugador ve que, después de despachar el AGV1, el radar se pone amarillo y
que la barra de t2a queda en naranja (conflicto). Cuando provoca el deadlock, las barras se ponen rojas. El **botón rojo del
supervisor** (con la regla al pasar el mouse) y el aviso "AGV1 espera: falta Robot_libre" (AND-join) también hicieron visible la teoría.
Esto hay que confirmarlo con el playtest de otro equipo (literal h, todavía pendiente).

## 5. ¿Qué cambiarían con una semana más? ¿Qué parte del modelo de la Fase 2 del curso ya anticipan?

- Hacer el playtest con otro equipo y probar el arrastre y el pellizco en un teléfono real.
- Reemplazar los dibujos en código por sprites con las imágenes generadas (guía 5.4) y seguir ajustando el balance de los turnos.
- Confirmar los resultados con capturas de JFLAP, Supremica y PIPE2.
- De la Fase 2 ya anticipamos la **síntesis del supervisor** (controlabilidad y no bloqueo), el **análisis de acotación y de invariantes**
  de la red de Petri y el **árbol de cobertura** como herramienta de verificación de deadlock.
`;
fs.writeFileSync(ruta('docs/informe.md'), informe);
console.log('docs/informe.md escrito');
