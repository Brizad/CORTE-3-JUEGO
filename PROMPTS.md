# PROMPTS.md

Prompts usados con el agente (Claude Code) durante el proyecto, en orden. Para cada uno se indica si **funcionó** o si **hubo que corregirlo**.
Se extrajeron del historial de la conversación. Los textos son los que escribió el equipo (algunos se pegaron desde la guía del laboratorio).

Resumen: prompts 1 a 8 de la guía = preparar carpeta, tres habilidades, modelo formal, GDD y arte, base común y núcleo formal; prompts 9 a 15 = planta, HUD, consola, supervisor, red de Petri, inspector y radar, HUD de partida; después, mejoras de jugabilidad y cierre del proyecto (pulido, pruebas y entrega, prompts 16 y 17 de la guía).

| N.º | Resultado | Qué pasó |
|---|---|---|
| 1 | Funcionó | Saludo inicial: el agente listó la carpeta y los archivos. |
| 2 | Funcionó | Repetido tras iniciar sesión. |
| 3 | Funcionó | Contexto del proyecto: proyecto 2 de la guía, que sigue los prompts 1 a 8. |
| 4 | Funcionó | Primera habilidad (disenador-simuladores-sed) con el contenido exacto de la guía. |
| 5 | Funcionó | Respuesta a una pregunta del agente: `docs/modelo/` se crea más adelante. |
| 6 | Funcionó | Habilidad director-arte-isometrico. |
| 7 | Funcionó | Lectura de las tres habilidades y creación de las carpetas `docs/`, `docs/modelo/` y `referencias/`. |
| 8 | Funcionó | Modelo formal en Markdown (`automatas.md` y `petri.md`) verificado con un script contra `modelos/`. |
| 9 | Funcionó | Se confirmaron los invariantes T. GDD v1.0 y guía de arte. |
| 10 | Se corrigió | El GDD cambió una decisión: el bloqueo por Celda_libre NO cuenta como "intento bloqueado" (aviso sin puntos). |
| 11 | Funcionó | Núcleo formal en `src/sed/` con 58 pruebas. Más tarde se encontró un error de transcripción en `petri.md` (M7) y se corrigió. |
| 12 | Funcionó | Planta isométrica y entidades; demostración a x4 durante 2 minutos sin errores. |
| 13 | Se corrigió | HUD de máquina. Hizo falta ampliar el panel y corregir el glow (una línea verde atravesaba la pantalla: el filtro no tenía margen). |
| 14 | Funcionó | Mejoras del HUD pedidas tras la prueba del equipo: sección "Brazo en esta CNC", explicaciones en gris y "Brazo en camino…". |
| 15 | Se corrigió | Incluye el prompt 11 (consola de reparación). Más tarde se detectó que teclear rápido repetía símbolos y se corrigió en el cierre. |
| 16 | Funcionó | Supervisor por CNC, penalización de −15, temblor de cámara y pestaña "Composición". |
| 17 | Funcionó | Red de Petri conectada con la planta: fichas por la estación, AND-join, conflictos y barra de despacho. |
| 18 | Funcionó | Incluye el prompt 14 (Inspector y radar). Reintento desde el último verde y Controlador de celda. |
| 19 | Funcionó | Incluye el prompt 15: HUD de partida, 3 turnos, 6 logros, controles táctiles y sonidos. |
| 20 | Se interrumpió | Mejoras de jugabilidad: la sección 18 del GDD se escribió primero. La ejecución se interrumpió una vez (el usuario rechazó una herramienta). |
| 21 | Funcionó | Continuación del anterior: textos, grafo, alertas, vista de red con R y tutorial Turno 0. |
| 22 | En curso al escribir esto | Cierre del proyecto (fases C2, D, E y F: sensación de juego, pulido, pruebas y entrega). |

## Prompt 1 · Funcionó

*Saludo inicial: el agente listó la carpeta y los archivos.*

Fecha: 2026-11-15 14:55

```text
Hola, dime en qué carpeta estamos y qué archivos hay
```

## Prompt 2 · Funcionó

*Repetido tras iniciar sesión.*

Fecha: 2026-11-15 14:57

```text
Hola, dime en qué carpeta estamos y qué archivos hay
```

## Prompt 3 · Funcionó

*Contexto del proyecto: proyecto 2 de la guía, que sigue los prompts 1 a 8.*

Fecha: 2026-11-15 15:04

```text
Esta carpeta es mi proyecto RoboCell Tycoon (Proyecto 2 de la guía Guia_Laboratorio1_SED_Phaser_Automatas_Petri.pdf). Ya copié la carpeta modelos con los archivos de JFLAP, Supremica y PIPE2. Revisa que el repositorio git esté listo, crea el archivo .gitignore con las líneas node_modules y dist, y haz un commit "Modelos formales". Todavía no escribas código: primero vamos a crear las habilidades del equipo.
```

## Prompt 4 · Funcionó

*Primera habilidad (disenador-simuladores-sed) con el contenido exacto de la guía.*

Fecha: 2026-11-15 15:08

```text
Crea la habilidad de proyecto .agents/skills/disenador-simuladores-sed/SKILL.md
con exactamente este contenido:
---
name: disenador-simuladores-sed
description: Diseña o revisa simuladores-juego de sistemas de eventos discretos
  para el navegador (ciclo de juego, reglas, puntaje, niveles, logros, HUD y
  documento de diseño GDD). Úsala al escribir o revisar docs/GDD.md o al
  ajustar el balance o la dificultad del simulador.
---
# Diseñador de simuladores de eventos discretos
Eres un diseñador de videojuegos de gestión y simulación (estilo Factorio,
Overcooked o Two Point Hospital). Ayudas a estudiantes de Ingeniería de
Sistemas a convertir el modelo formal de un sistema de eventos discretos en
un juego isométrico 2.5D en Phaser 4.
CONTEXTO FIJO
- Navegador, Phaser 4.2.1 por CDN, Vite y JavaScript. Mouse, teclado y táctil.
- El modelo formal (docs/modelo/) manda: los autómatas gobiernan las máquinas
  y la red de Petri gobierna los recursos. El juego no inventa reglas que no
  estén en el modelo.
- Alcance pequeño: el alcance mínimo de la ficha del proyecto.
CÓMO TRABAJAS
1. Escribe el GDD en Markdown con: concepto; pilares; MDA; ciclo de juego
   corto (atender una máquina), medio (completar un lote o pedido) y largo
   (terminar el turno); victoria y derrota (incluido el game over por
   deadlock); puntaje con valores; controles en tabla (mouse, teclado,
   táctil); tiempos en segundos de simulación; turnos con dificultad
   creciente; 6 logros con condición verificable; HUD por zonas; criterios
   de aceptación que se comprueban jugando.
2. Cada mecánica del GDD cita el elemento formal que la produce: estado,
   evento, lugar, transición, capacidad k o regla del supervisor.
3. Cada número lleva unidad (s, tokens, puntos, %). Nada de "rápido".
4. Respeta los valores del modelo; si falta un dato, pregunta.
5. Revisa el balance: el deadlock debe poder evitarse con una buena decisión
   y provocarse con una mala; ninguna estrategia gana siempre.
RESTRICCIONES
- No copies personajes, nombres, mapas ni música de juegos comerciales.
- Escribe en español, con frases cortas y términos técnicos correctos.
```

## Prompt 5 · Funcionó

*Respuesta a una pregunta del agente: `docs/modelo/` se crea más adelante.*

Fecha: 2026-11-15 15:11

```text
Respuesta a tu pregunta: no muevas nada; docs/modelo/ se crea más adelante (prompt 6) a partir de modelos/. Antes revisa la línea 3 de "CÓMO TRABAJAS" en la skill del diseñador: debe decir exactamente: 3. Cada número lleva unidad (s, tokens, puntos, %). Nada de "rápido".

Ahora crea la habilidad de proyecto .agents/skills/ingeniero-sed/SKILL.md
con exactamente este contenido:
---
name: ingeniero-sed
description: Escribe, traduce y verifica los modelos formales del simulador:
  autómatas de estado finito, expresiones regulares, composición síncrona,
  observadores y redes de Petri (Pre, Post, M0, incidencia y árbol de
  cobertura). Úsala al escribir docs/modelo/, los JSON de src/sed/modelos/,
  el núcleo src/sed/ o sus pruebas.
---
# Ingeniero de sistemas de eventos discretos
Eres ingeniero de control con dominio de Cassandras y Lafortune. Traduces los
modelos verificados en JFLAP, Supremica y PIPE2 a documentos y código sin
cambiar su significado.
NOTACIÓN FIJA
- Autómata G = (Q, Σ, δ, q0, Qm); Σ = Σc ∪ Σuc y Σ = Σo ∪ Σuo.
- Red de Petri N = (P, T, Pre, Post, M0) con capacidad k por lugar.
- Pre y Post de tamaño |T| x |P| (fila por transición); A = Post − Pre;
  M_k = M_{k−1} + A^T · u_k. PIPE2 muestra la traspuesta de A.
- Árbol de cobertura de Karp y Miller con ω.
CÓMO TRABAJAS
1. Lee modelos/ (.jff, .wmod, .pnml) y escribe docs/modelo/automatas.md y
   docs/modelo/petri.md con tablas: δ completa, eventos con código,
   controlabilidad y observabilidad; lugares, transiciones, Pre, Post, A,
   M0, k, invariantes y el deadlock documentado con su secuencia.
2. Exporta cada modelo a JSON en src/sed/modelos/ con el formato del proyecto.
3. Todo cambio de estado del juego pasa por δ o por el disparo de una
   transición. Si alguien pide un atajo con if, lo rechazas y explicas por qué.
4. Escribe pruebas con node --test que reproduzcan las palabras aceptadas y
   rechazadas de JFLAP y los marcados y el deadlock de PIPE2.
5. Si el modelo y el GDD se contradicen, avisa y propone corregir el GDD,
   no el modelo.
RESTRICCIONES
- No cambies estados, eventos, pesos, capacidades ni M0 sin autorización.
- Escribe en español; nombres de estados y eventos tal como en la ficha.
```

## Prompt 6 · Funcionó

*Habilidad director-arte-isometrico.*

Fecha: 2026-11-15 15:51

```text
Crea la habilidad de proyecto .agents/skills/director-arte-isometrico/SKILL.md
con exactamente este contenido:
---
name: director-arte-isometrico
description: Define y revisa el estilo visual de simuladores isométricos 2.5D
  en Phaser (paleta, rejilla, máquinas, tokens, HUD de máquina, radar y
  efectos). Úsala al escribir docs/arte.md, al dibujar sprites o al revisar
  capturas del simulador.
---
# Director de arte isométrico
Eres director de arte de juegos de gestión isométricos. A partir del GDD y
del modelo defines cómo se ve el simulador y revisas que el juego lo cumpla.
GUÍA DE ESTILO (se define una vez y se respeta)
- Juego a 960x540, escala FIT; rejilla isométrica 2:1 con celdas de 64x32 px;
  orden de profundidad por (x + y).
- Paleta de 10 a 14 colores en hexadecimal: suelo, muros, máquinas, tuberías
  o bandas, un color por tipo de token y 4 colores de estado: operación
  #2e9e5b, espera #e0b21b, fallo #d64545, mantenimiento #3b7dd8.
- Cada estado del autómata tiene color e ícono sobre la máquina; cada tipo de
  token tiene forma y color propios (caja, gota, persona, rayo).
REGLAS PARA PHASER
- Máquinas y tokens dibujados en código, o imágenes con fondo magenta #FF00FF;
  misma escala y misma luz (desde arriba a la izquierda).
- HUD de máquina como escena superpuesta: nodos circulares, flechas con el
  código del evento, estado actual iluminado, eventos deshabilitados en rojo.
- Radar del árbol de cobertura en una esquina fija: verde, amarillo
  parpadeante o rojo.
- Efectos de Phaser 4 con propósito: glow en la máquina seleccionada, bloom
  en eventos críticos, partículas en los flujos, temblor de cámara al fallar.
CÓMO TRABAJAS
1. Escribe docs/arte.md con la guía de estilo.
2. Al revisar una captura, compárala con la guía y lista diferencias
   concretas (posición, color, tamaño).
RESTRICCIONES
- No imites personajes, logotipos ni mapas de juegos comerciales.
```

## Prompt 7 · Funcionó

*Lectura de las tres habilidades y creación de las carpetas `docs/`, `docs/modelo/` y `referencias/`.*

Fecha: 2026-11-15 15:52

```text
Lee las skills disenador-simuladores-sed, ingeniero-sed y director-arte-isometrico.
Resume en seis líneas qué reglas de diseño, de modelo formal y de arte vas a seguir.
Crea las carpetas docs/, docs/modelo/ y referencias/ (pon un archivo .gitkeep vacío en referencias/ para que git la guarde).
Regla para todo el proyecto: lo que digan modelos/ y el GDD no se cambia; si algo no está
definido, pregúntame antes de inventarlo.
Al final haz un commit "Habilidades del equipo" con las tres skills y las carpetas, y súbelo a GitHub con git push.
```

## Prompt 8 · Funcionó

*Modelo formal en Markdown (`automatas.md` y `petri.md`) verificado con un script contra `modelos/`.*

Fecha: 2026-11-15 16:07

```text
Usa la skill ingeniero-sed. Lee los archivos de modelos/ (.jff, .wmod y .pnml) y escribe docs/modelo/automatas.md y docs/modelo/petri.md con tablas. No cambies ningún valor; si algo de modelos/ no coincide con esto, avísame.

AUTÓMATAS (Σuo = ∅, todos observables):
- CNC (×2): estados Libre, Cargado, Fresando, Terminado, Falla. q0 = Qm = Libre.
  Eventos: cargar c (controlable, compartido con el Brazo), iniciar_fresado i (c), fin_fresado f (no controlable), descargar d (c, compartido), falla_husillo x (uc), reset r (c).
  δ: Libre-cargar->Cargado, Cargado-iniciar_fresado->Fresando, Fresando-fin_fresado->Terminado, Terminado-descargar->Libre, Fresando-falla_husillo->Falla, Falla-reset->Libre.
- Brazo: Reposo, Moviendo, Mandril_Cerrado, Mandril_Abierto. q0 = Qm = Reposo.
  Eventos: mover m (c), llegar l (uc), abrir_mandril a (c), cerrar_mandril e (c), cargar c (c), descargar d (c).
  δ: Reposo-mover->Moviendo, Moviendo-llegar->Mandril_Cerrado, Mandril_Cerrado-abrir_mandril->Mandril_Abierto, Mandril_Abierto-cargar->Mandril_Abierto, Mandril_Abierto-descargar->Mandril_Cerrado, Mandril_Abierto-cerrar_mandril->Mandril_Cerrado, Mandril_Cerrado-mover->Reposo.
- AGV (×2): Libre, Viajando, Esperando, Descargando. q0 = Qm = Libre.
  Eventos: reservar v (c), llegar_estacion g (uc), iniciar_descarga u (c), fin_descarga z (uc).
  δ: Libre-reservar->Viajando, Viajando-llegar_estacion->Esperando, Esperando-iniciar_descarga->Descargando, Descargando-fin_descarga->Libre.
- Supervisor CNC ‖ Brazo: estado prohibido (Fresando, Mandril_Abierto). La composición tiene 20 estados y 43 transiciones; el sistema supervisado tiene 19. Deshabilita iniciar_fresado en (Cargado, Mandril_Abierto) y abrir_mandril en (Fresando, Mandril_Cerrado). Razón: ¬(CNC = Fresando ∧ Brazo = Mandril_Abierto).
- Reparación: ^H(CT?)+R$ (H home, C chequeo, T cambio de herramienta, R reset). En JFLAP: H(C(T+!))(C(T+!))*R. DFA mínimo de 5 estados. Válidas: HCTCR, HCR, HCTR, HCCTCR. Inválidas: HTCR, HR, CR, HCTTR, HCT.
- Incluye para cada autómata 8 palabras de prueba (4 aceptadas y 4 rechazadas) y la tabla de registro de la sección 5.2 d de la guía.

RED DE PETRI (todas las capacidades k = 1, estricta):
- Lugares y M0: p1 Mesa_libre 1, p2 Robot_libre 1, p3 AGV1_listo 1, p4 AGV2_listo 1, p5 AGV1_con_mesa 0, p6 AGV2_con_robot 0, p7 AGV1_trabajando 0, p8 AGV2_trabajando 0, p9 Robot_en_CNC 0.
  p9 es una extensión del equipo: el brazo que usan los AGV es el mismo que atiende las CNC.
- Transiciones: t1a AGV1_listo+Mesa_libre -> AGV1_con_mesa; t1b AGV1_con_mesa+Robot_libre -> AGV1_trabajando; t1c AGV1_trabajando -> AGV1_listo+Mesa_libre+Robot_libre; t2a AGV2_listo+Robot_libre -> AGV2_con_robot; t2b AGV2_con_robot+Mesa_libre -> AGV2_trabajando; t2c AGV2_trabajando -> AGV2_listo+Mesa_libre+Robot_libre; tr_ir Robot_libre -> Robot_en_CNC; tr_volver Robot_en_CNC -> Robot_libre.
- Pre, Post y A = Post − Pre de tamaño |T| x |P| (fila por transición).
- Deadlock: t1a y luego t2a -> marcado muerto [0,0,0,0,1,1,0,0,0]. Muéstralo también con la ecuación de estado.
- Árbol de cobertura desde M0: 14 nodos, 8 marcados distintos, 1 muerto.
- Invariantes P: Mesa_libre+AGV1_con_mesa+AGV1_trabajando+AGV2_trabajando = 1; Robot_libre+AGV2_con_robot+AGV1_trabajando+AGV2_trabajando+Robot_en_CNC = 1; AGV1_listo+AGV1_con_mesa+AGV1_trabajando = 1; AGV2_listo+AGV2_con_robot+AGV2_trabajando = 1.
- Prevención: lugar monitor Celda_libre (M0 = 1) que toman t1a y t2a y devuelven t1c y t2c (red robocell_corregida.pnml). Árbol corregido: 12 nodos, 7 marcados, sin muertos.
- Sincronización con el AGV: t1a/t2a = reservar, t1b/t2b = iniciar_descarga, t1c/t2c = fin_descarga. tr_ir = mover del brazo desde Reposo; tr_volver = mover desde Mandril_Cerrado.
- Incluye la tabla de registro de la red de la sección 5.2 d.

Cuando termines, haz un commit "Modelo formal en Markdown" y muéstrame un resumen corto.
```

## Prompt 9 · Funcionó

*Se confirmaron los invariantes T. GDD v1.0 y guía de arte.*

Fecha: 2026-11-15 16:27

```text
Deja los invariantes T, están bien. Ahora usa la skill disenador-simuladores-sed para escribir docs/GDD.md de «RoboCell Tycoon 2.5D» y director-arte-isometrico para escribir docs/arte.md. Respeta docs/modelo/ sin cambiar nada. Usa estos valores decididos por el equipo:

- Concepto: el jugador es el jefe de turno de una celda con 2 CNC, 1 brazo y 2 AGV que comparten 1 mesa y el brazo. Gana si cumple la meta de piezas; pierde si la celda queda en deadlock.
- El jugador dispara: eventos controlables desde el HUD de cada máquina, t1a ("Despachar AGV1"), t2a ("Despachar AGV2") y tr_ir (mandar el brazo). t1b, t1c, t2b, t2c y tr_volver son automáticas.
- Tiempos (s de simulación): mover→llegar 2 s; fresado 10 s; falla_husillo al azar entre 2 y 8 s del fresado; reservar→llegar_estacion 4 s; iniciar_descarga→fin_descarga 5 s; pedido de AGV (llegada externa del reloj) cada 25 s / 18 s / 12 s según el turno; pedido vencido a los 30 s. Velocidades x1, x2, x4. Semilla 2026.
- Turnos: 3 turnos de 180 s. Metas: 3, 5 y 7 piezas. Probabilidad de falla por fresado: 10 %, 20 % y 30 %.
- Puntaje: pieza descargada +100; ciclo de AGV (t1c o t2c) +40; reparación válida +50; palabra inválida −30; pedir ayuda (ver la expresión regular) −20; intento bloqueado por el supervisor −15; pedido vencido −20; radar de amarillo a verde +25; comprar "Controlador de celda" (activa el lugar monitor Celda_libre, red corregida) −150; deadlock = game over del turno y −200.
- Logros: Primera pieza (1 descargar); Mecánico fino (3 reparaciones válidas seguidas); Manos seguras (turno con 0 intentos bloqueados); Ojo de radar (3 veces de amarillo a verde en un turno); Sin red de seguridad (pasar el turno 3 sin Celda_libre ni deadlock); Doble husillo (las 2 CNC fresando a la vez 30 s acumulados).
- Controles: clic en una máquina abre su HUD; P pausa; I inspector; 1, 2 y 4 velocidad; Esc cierra; H, C, T, R y Enter en la consola; F1 fps; arrastre y rueda para la cámara; equivalentes táctiles.
- HUD: reloj y turno arriba izquierda, puntaje y piezas/meta arriba centro, Radar del Árbol de Cobertura arriba derecha, fichas por lugar abajo izquierda, alertas abajo derecha.
- Phaser 4 de la ficha: trayectorias (Path) de los AGV y glow en el botón bloqueado.
- Arte: planta de 12x10 celdas; luz desde arriba a la izquierda; fichas: Mesa_libre tablero café #b07a3c, Robot engranaje naranja #f08a24, AGV rombo azul #3fa7d6, Celda_libre llave dorada #d4af37; estados con los 4 colores fijos y un ícono por estado (por ejemplo, CNC Falla en rojo con rayo y humo, Fresando en verde con chispas).

Incluye MDA, los tres ciclos de juego, una tabla que relacione cada mecánica con su elemento formal, victoria y derrota, y criterios de aceptación verificables (entre ellos: HCTCR repara y HTCR no; el estado prohibido nunca se alcanza; t1a y luego t2a sin la mejora da game over con [0,0,0,0,1,1,0,0,0]; con Celda_libre la misma jugada no bloquea; el árbol desde M0 tiene 14 nodos). Si falta un dato, pregúntame.
Al terminar haz un commit "GDD y arte" y git push.
```

## Prompt 10 · Se corrigió

*El GDD cambió una decisión: el bloqueo por Celda_libre NO cuenta como "intento bloqueado" (aviso sin puntos).*

Fecha: 2026-11-15 17:00

```text
Confirmo las decisiones de la sección 17 del GDD, con un cambio: el bloqueo por Celda_libre NO es un intento bloqueado; solo muestra un aviso "Controlador de celda activo" sin restar puntos. Actualiza el GDD y haz commit.

Ahora el PROMPT 7 de la guía (proyecto base). Primero ejecuta en la terminal:
npm init -y
npm install -D vite
npm pkg set type="module"
npm pkg set scripts.dev="vite" scripts.build="vite build" scripts.preview="vite preview" scripts.test="node --test"
Crea index.html y vite.config.js exactamente como la sección 5.5.1 de la guía (título "RoboCell Tycoon 2.5D", Phaser 4.2.1 por CDN de jsDelivr, #game-container 960x540, base: './', phaser como external con global Phaser).

Actúa como desarrollador senior de videojuegos web y de simulación de eventos discretos. Construye la BASE de «RoboCell Tycoon 2.5D» siguiendo docs/GDD.md, docs/modelo/ y docs/arte.md. Todavía NO programes el modelo formal; solo la base.
STACK OBLIGATORIO
- JavaScript con módulos ES (sin TypeScript). Phaser 4.2.1 por CDN: usa el objeto global Phaser; NO instales phaser por npm ni escribas import Phaser from 'phaser'. Solo API de Phaser 4. WebGL, #game-container, 960x540, escala FIT. Entrada: src/main.js. Rutas relativas.
ARQUITECTURA EN CAPAS
1. src/config.js: TILE_W=64, TILE_H=32, planta 12x10, velocidades 1, 2 y 4, SEMILLA=2026.
2. src/sed/ sin Phaser ni DOM: aleatorio.js (mulberry32 con semilla) y reloj.js (calendario de eventos futuros con cola de prioridad: programar(t, evento), avanzar(dt), pausar, cambiar velocidad). src/sed/modelos/ vacío por ahora.
3. src/iso/proyeccion.js: aPantalla(x, y, z), aCelda(px, py), profundidad(x, y).
4. src/entrada/gestorEntrada.js: mouse, teclado y táctil emiten las mismas acciones (seleccionar, solicitarEvento, pausa P, inspector I, velocidad 1-2-4, cerrar Esc).
5. src/escenas/: Arranque, Titulo, Planta (rejilla 12x10 con suelo y vallas según docs/arte.md y una CNC de prueba que se ilumina al pasar el mouse), HUDMaquina e Inspector (superpuestas, vacías) y Resultados (vacía).
6. El update de Planta solo llama reloj.avanzar(delta * velocidad) y dibuja.
7. F1 muestra fps y tiempo de simulación.
Escribe test/reloj.test.js con node --test: tres eventos en desorden se disparan en orden de tiempo y la misma semilla da la misma secuencia. Comenta el código en español.
Al final ejecuta npm test, dime cómo abrirlo con npm run dev, y haz commit "Base comun" y git push.
```

## Prompt 11 · Funcionó

*Núcleo formal en `src/sed/` con 58 pruebas. Más tarde se encontró un error de transcripción en `petri.md` (M7) y se corrigió.*

Fecha: 2026-11-15 17:19

```text
Usa la skill ingeniero-sed. PROMPT 8: implementa el NÚCLEO FORMAL en src/sed/, sin Phaser ni DOM, a partir de docs/modelo/ y modelos/. No cambies ningún valor del modelo.
1. Exporta a JSON en src/sed/modelos/ con el formato de la guía (sección 5.7.1): cnc.json, brazo.json, agv.json, reparacion_dfa.json (con la expresión ^H(CT?)+R$), supervisor.json (prohibido [Fresando, Mandril_Abierto]), red_agv.json y red_agv_corregida.json (pre y post de |T| x |P|, k = 1, capacidad "estricta"; disparo "jugador" en t1a, t2a y tr_ir y "automatica" en las demás).
2. automata.js: clase Automata(json) con estado, eventosActivos() (Γ(q)), puede(σ), ejecutar(σ) que usa SOLO la tabla δ y lanza error si δ(q,σ) no está definida, esMarcado() e historial. Una instancia por máquina.
3. composicion.js: componer(G1, G2) por producto síncrono y supervisor(composicion, prohibidos) que calcula los estados malos (prohibidos y los que llegan a ellos por eventos no controlables) y devuelve, por estado, los eventos controlables deshabilitados y la razón "¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)". En el juego habrá una instancia del supervisor por CNC (la CNC que atiende el brazo), como dice el GDD.
4. lenguaje.js: validador de ^H(CT?)+R$ con una RegExp anclada Y con el DFA de reparacion_dfa.json; avanzar(simbolo) para mostrar el progreso paso a paso.
5. redPetri.js: clase RedPetri(json) con marcado M, A = Post − Pre, habilitada(t) (M >= Pre(t) y capacidad estricta), habilitadas(), disparar(t) con M' = M + Aᵀ·u (u one-hot), conflictos() y esMuerto().
6. cobertura.js: arbolCobertura(red, M0, maxNodos=2000) de Karp y Miller con ω (Infinity), que devuelve nodos, aristas y marcados muertos; y explorar(red, M, profundidad) para el radar (el GDD usa profundidad 1).
7. Pruebas en test/ con node --test:
   - las 8 palabras de cada autómata de docs/modelo/automatas.md dan el mismo resultado que JFLAP;
   - la RegExp y el DFA coinciden en 20 palabras (HCTCR, HCR, HCTR, HCCTCR aceptadas; HTCR, HR, CR, HCTTR, HCT rechazadas, y otras);
   - CNC ‖ Brazo tiene 20 estados y 43 transiciones; el supervisado tiene 19 estados y 38 transiciones; se deshabilita iniciar_fresado en (Cargado, Mandril_Abierto) y abrir_mandril en (Fresando, Mandril_Cerrado);
   - en red_agv.json, t1a y luego t2a llevan al marcado muerto [0,0,0,0,1,1,0,0,0];
   - el árbol desde M0 tiene 14 nodos y 8 marcados distintos; el de red_agv_corregida.json tiene 12 nodos, 7 marcados y ningún muerto;
   - los 4 invariantes P de petri.md se conservan en 1000 disparos aleatorios con la semilla 2026;
   - una prueba recorre 10 000 eventos aleatorios del sistema supervisado sin entrar al estado prohibido.
Criterio: npm test pasa completo. Muéstrame la tabla de resultados, haz commit "Nucleo formal SED" y git push.
```

## Prompt 12 · Funcionó

*Planta isométrica y entidades; demostración a x4 durante 2 minutos sin errores.*

Fecha: 2026-11-15 18:29

```text
PROMPT 9: sobre la base, construye la planta del GDD en la escena Planta.
1. Rejilla 12x10 con las posiciones del GDD: CNC1, CNC2, el brazo, la mesa compartida, las bases y rutas (Path) de AGV1 y AGV2, con las funciones de src/arte/ o src/iso/formas.js y orden de profundidad por (x + y). Colores e íconos por estado según docs/arte.md.
2. Cada máquina es una Entidad con su propia instancia de Automata (2 CNC, 1 brazo, 2 AGV). Su sprite cambia de color e ícono según el estado del autómata y escucha los cambios del núcleo; nunca cambia de estado por su cuenta.
3. Las fichas de red_agv.json se dibujan como objetos (Mesa_libre tablero café, Robot engranaje naranja, AGV rombo azul) con contador m/k, y se animan con tweens cuando una transición las mueve.
4. Los eventos no controlables (llegar, fin_fresado, falla_husillo, llegar_estacion, fin_descarga) y los pedidos de los AGV se programan en el reloj con el generador con semilla y los tiempos del GDD.
5. Mientras no exista el HUD de eventos, agrega un modo demostración (tecla D) que juega solo: carga y fresa las CNC y despacha los AGV en orden seguro, siempre por δ y por disparos de transiciones.
Criterio: con velocidad x4 y en modo demostración, la planta funciona 2 minutos de simulación sin errores en la consola. Toma una captura, haz commit "Planta isometrica y entidades" y git push.
```

## Prompt 13 · Se corrigió

*HUD de máquina. Hizo falta ampliar el panel y corregir el glow (una línea verde atravesaba la pantalla: el filtro no tenía margen).*

Fecha: 2026-11-15 19:01

```text
PROMPT 10: implementa la escena superpuesta HUDMaquina (se lanza en paralelo a Planta con scene.launch y no pausa la simulación).
1. Al hacer clic sobre una máquina (CNC1, CNC2, brazo, AGV1, AGV2), dibuja con Graphics el grafo de SU autómata: un nodo circular por estado con su nombre, flechas con el código del evento, el estado inicial con flecha de entrada y los marcados con doble círculo. Usa la misma distribución que el .jff de modelos/automatas/ (coordenadas x, y del archivo).
2. El nodo del estado actual se ilumina en vivo (filtro glow de Phaser 4) y la última transición recorrida parpadea 0,5 s.
3. Debajo del grafo, un botón por cada evento de Γ(q): verde si es controlable y está habilitado, gris si es no controlable (solo informativo) y rojo si el supervisor de la CNC atendida lo deshabilita, con la razón formal al pasar el mouse. Al hacer clic en un botón verde se ejecuta el evento por δ (los compartidos cargar y descargar solo si la CNC y el brazo lo permiten).
4. Lista de los últimos 10 eventos de la máquina (su palabra observada).
5. Mientras el HUD está abierto, el modo demostración no toca esa máquina.
6. Arregla de paso que el ícono de estado de la CNC y el del brazo no queden encimados (súbelos o sepáralos).
Criterio: abre el HUD de una CNC, del brazo y de un AGV, dispara un evento desde el HUD y toma capturas en las que el estado iluminado coincida con el sprite. npm test debe seguir pasando. Haz commit "HUD de maquina" y git push.
```

## Prompt 14 · Funcionó

*Mejoras del HUD pedidas tras la prueba del equipo: sección "Brazo en esta CNC", explicaciones en gris y "Brazo en camino…".*

Fecha: 2026-11-15 19:30

```text
Probé el HUD y funciona según δ, pero hay que mejorar la jugabilidad:
1. En el HUD de cada CNC agrega una sección "Brazo en esta CNC" con los botones del brazo que sirven para esa CNC (mover, abrir_mandril, cerrar_mandril y volver), con los mismos colores verde/gris/rojo y ejecutándose por δ del autómata del brazo. Así el jugador no tiene que cambiar de HUD para cargar o descargar.
2. Cuando un botón compartido (cargar o descargar) esté en gris, al pasar el mouse explica qué falta, por ejemplo: "El brazo debe estar en Mandril_Abierto frente a esta CNC".
3. Mientras el brazo está en Moviendo, muestra en el HUD "Brazo en camino…".
4. Hay una línea verde horizontal que atraviesa toda la pantalla a la altura del HUD; búscala y quítala.
Después revisa las decisiones que me dejaste "por confirmar" en el prompt 10 y muéstramelas otra vez en una lista corta. npm test debe seguir pasando. Commit "Mejoras HUD" y git push.
```

## Prompt 15 · Se corrigió

*Incluye el prompt 11 (consola de reparación). Más tarde se detectó que teclear rápido repetía símbolos y se corrigió en el cierre.*

Fecha: 2026-11-15 19:36

```text
Confirmo las 4 decisiones del prompt 10. Actualiza docs/GDD.md y docs/arte.md con los cambios del HUD (tamaño del panel, sección "Brazo en esta CNC", botón volver y las explicaciones en gris).

PROMPT 11: implementa la consola de reparación dentro del HUD de la CNC.
1. Cuando una CNC entra en Falla (falla_husillo), aparece una alerta abajo a la derecha y su HUD muestra la consola: un campo con la palabra escrita y botones con los comandos del alfabeto de reparación: H (home de ejes), C (chequeo de herramienta), T (cambio de herramienta), R (reset). También se puede escribir con el teclado H, C, T, R, Retroceso y Enter.
2. Cada comando avanza el DFA de reparacion_dfa.json y se muestra en qué estado va (q0…q4). Si el símbolo no tiene transición, la consola lo marca en rojo y explica qué se esperaba (por ejemplo: "Después de H se espera C").
3. Al enviar, la palabra w se valida con lenguaje.js (RegExp anclada y DFA). Si w ∈ L, se ejecuta reset por δ (Falla → Libre) y suma +50 puntos. Si w ∉ L, la CNC sigue en Falla y resta −30 puntos.
4. Botón "Pedir ayuda": muestra la expresión ^H(CT?)+R$ durante 5 s y resta −20 puntos.
5. Para poder probarlo, en el modo demostración y con la tecla F (solo en desarrollo) se puede forzar una falla_husillo en la CNC que esté fresando.
Criterio: prueba 2 palabras válidas (HCTCR y HCR) y 3 inválidas (HTCR, HR y HCT); toma capturas de la consola. npm test debe seguir pasando. Commit "Consola de reparacion" y git push.
```

## Prompt 16 · Funcionó

*Supervisor por CNC, penalización de −15, temblor de cámara y pestaña "Composición".*

Fecha: 2026-11-15 19:52

```text
PROMPT 12: completa el supervisor de la ficha con composicion.js.
1. Plantas CNC y Brazo, una instancia del supervisor por cada CNC (la CNC que atiende el brazo). Estado prohibido: (Fresando, Mandril_Abierto).
2. En cada paso, el supervisor calcula los eventos controlables deshabilitados del estado compuesto actual. El HUD los pinta en rojo con glow y la razón formal "¬(CNC = Fresando ∧ Brazo = Mandril_Abierto)" al pasar el mouse.
3. Si el jugador insiste en un evento deshabilitado (clic en un botón rojo), no se ejecuta, la cámara tiembla, se registra el intento en las alertas y se restan −15 puntos. El bloqueo por Celda_libre NO cuenta aquí.
4. Agrega al HUD de la CNC una pestaña "Composición" con el número de estados de CNC ‖ Brazo (20), del sistema supervisado (19) y el estado compuesto actual, por ejemplo (Cargado, Mandril_Abierto).
Criterio: intenta 3 veces llegar al estado prohibido (abrir el mandril mientras la CNC fresa, e iniciar el fresado con el mandril abierto) y comprueba que nunca se alcanza; una prueba automática recorre 10 000 eventos aleatorios sin entrar al estado prohibido. npm test debe seguir pasando. Commit "Supervisor" y git push.
```

## Prompt 17 · Funcionó

*Red de Petri conectada con la planta: fichas por la estación, AND-join, conflictos y barra de despacho.*

Fecha: 2026-11-15 20:08

```text
PROMPT 13: conecta por completo la red de Petri del núcleo (red_agv.json) con la planta.
1. Cada lugar es un objeto del mapa (mesa, brazo/robot, base, zona de espera y zona de trabajo de cada AGV) con sus fichas y un contador m/k.
2. t1a ("Despachar AGV1"), t2a ("Despachar AGV2") y tr_ir son de disparo jugador: agrega los botones "Despachar AGV1" y "Despachar AGV2" en el HUD de cada AGV y en una barra fija abajo de la pantalla. t1b, t1c, t2b, t2c y tr_volver son automáticas: se disparan en el reloj cuando están habilitadas y su autómata lo permite. Ninguna se dispara si M < Pre(t): la estación muestra qué ficha falta (AND-join), por ejemplo "AGV1 espera: falta Robot_libre".
3. Al disparar, las fichas viajan con tweens desde los lugares de entrada hasta la estación y luego a los de salida, en el orden de Pre y Post.
4. Conflictos: cuando dos transiciones habilitadas compiten por la misma ficha (t1a–t2b por Mesa_libre; t2a–t1b–tr_ir por Robot_libre), se resaltan en naranja.
5. Sincronización red–autómatas: t1a/t2a ↔ reservar, t1b/t2b ↔ iniciar_descarga, t1c/t2c ↔ fin_descarga del AGV; tr_ir ↔ mover del brazo desde Reposo y tr_volver ↔ volver desde Mandril_Cerrado.
6. Los pedidos de AGV llegan por el reloj (cada 25 s en el turno 1) y se muestran como un número sobre la base del AGV; si pasan 30 s sin despachar, vencen y restan −20.
7. El modo demostración debe seguir funcionando y despachar en orden seguro.
Criterio: demuestra un AND-join (AGV1 con la mesa esperando el robot) y un conflicto resaltado en naranja; toma capturas. Comprueba también que despachar AGV1 y luego AGV2 lleva al marcado [0,0,0,0,1,1,0,0,0] y que ya nada se mueve (todavía sin radar ni game over, eso es el prompt 14). npm test debe seguir pasando. Commit "Tokens y red de Petri" y git push.
```

## Prompt 18 · Funcionó

*Incluye el prompt 14 (Inspector y radar). Reintento desde el último verde y Controlador de celda.*

Fecha: 2026-11-15 20:17

```text
Tus decisiones del prompt 13 están bien; los puntos los hacemos en el prompt 15.

PROMPT 14: implementa la escena superpuesta Inspector (tecla I, pausa la simulación) y el radar.
1. Inspector: muestra Pre, Post y A = Post − Pre como tablas con los nombres de lugares y transiciones, el marcado actual M_k, el vector u_k del último disparo y la cuenta M_k = M_{k−1} + Aᵀ·u_k con números. Las transiciones habilitadas se resaltan.
2. Botón "Probar disparo": el jugador elige una transición y ve el marcado que resultaría sin aplicarlo; si no está habilitada, la tabla señala el lugar que no alcanza.
3. Pestaña "Árbol": dibuja el árbol de cobertura desde M0 (debe dar 14 nodos, 8 marcados) y desde el marcado actual con profundidad 4, con los marcados muertos en rojo. Muestra el número de nodos.
4. Radar del Árbol de Cobertura en la esquina superior derecha, recalculado tras cada disparo con explorar(red, M, 1) como dice el GDD: verde si ningún disparo habilitado lleva a un marcado muerto, amarillo parpadeante si alguno sí, rojo si el marcado actual está muerto. Dentro, el mini-grafo de los últimos marcados. Al volver de amarillo a verde suma +25 (enfriamiento de 20 s).
5. Si el marcado actual está muerto: la simulación se detiene, sale "Game over por interbloqueo" con el marcado [0,0,0,0,1,1,0,0,0], la secuencia de disparos que llevó a él y la regla de prevención (lugar monitor Celda_libre). Resta −200 y el jugador puede "Reintentar desde el último marcado verde".
6. Botón "Controlador de celda" (−150 puntos, dura solo el turno actual): cambia a red_agv_corregida.json conservando el marcado y agregando Celda_libre según corresponda. Con él activo, si el jugador pulsa Despachar AGV2 después de AGV1, sale el aviso "Controlador de celda activo" y no resta puntos.
Criterio: provoca el deadlock (Despachar AGV1 y luego AGV2) y luego evítalo comprando el Controlador; toma capturas del radar en verde, amarillo y rojo. npm test debe seguir pasando. Commit "Ecuacion de estado y radar" y git push.
```

## Prompt 19 · Funcionó

*Incluye el prompt 15: HUD de partida, 3 turnos, 6 logros, controles táctiles y sonidos.*

Fecha: 2026-11-15 20:50

```text
Tus decisiones del prompt 14 están bien.

PROMPT 15: agrega el HUD de partida exactamente como dice el GDD: reloj de simulación y turno arriba a la izquierda, puntaje y piezas/meta arriba al centro, Radar del Árbol de Cobertura arriba a la derecha, fichas por lugar abajo a la izquierda y alertas (fallas, intentos bloqueados, pedidos vencidos) abajo a la derecha. Sin textos de ayuda fijos durante la partida.
1. Puntaje completo del GDD: pieza descargada +100, ciclo de AGV (t1c o t2c) +40, reparación válida +50, palabra inválida −30, ayuda −20, intento bloqueado −15, pedido vencido −20, radar a verde +25, Controlador −150, deadlock −200.
2. Turnos del GDD: 3 turnos de 180 s con metas de 3, 5 y 7 piezas, falla por fresado de 10 %, 20 % y 30 % y pedidos cada 25 s, 18 s y 12 s. Al terminar un turno se llama desactivarControlador() y se pasa a la pantalla de Resultados (piezas, fallas reparadas, intentos bloqueados, pedidos vencidos, deadlocks evitados, puntaje) con botones "Siguiente turno" o "Reintentar". Al pasar los 3 turnos, pantalla de victoria.
3. Los 6 logros del GDD (Primera pieza, Mecánico fino, Manos seguras, Ojo de radar, Sin red de seguridad, Doble husillo) con un aviso animado (tween) cuando se ganan.
4. Controles táctiles: tocar = clic, botones en pantalla de pausa, inspector y velocidad (x1, x2, x4).
5. Sonidos cortos con Web Audio: disparo de transición, falla, reparación, botón bloqueado, logro y deadlock.
Criterio: juega un turno completo y toma una captura del HUD; compárala con la sección de HUD del GDD. npm test debe seguir pasando. Commit "HUD, logros y celular" y git push.
```

## Prompt 20 · Se interrumpió

*Mejoras de jugabilidad: la sección 18 del GDD se escribió primero. La ejecución se interrumpió una vez (el usuario rechazó una herramienta).*

Fecha: 2026-11-16 01:20

```text
Antes de programar, agrega estas mejoras a docs/GDD.md en una sección "Mejoras de jugabilidad" (agregadas por el equipo después del playtest interno) y solo después impleméntalas. No cambies docs/modelo/ ni las reglas: todo cambio de estado pasa por δ o por el disparo de una transición.
1. Textos encimados: en la planta, los rótulos de lugares ("Robot", "Espera AGV2", "Base AGV2", "Mesa", "S1", "S2") y las leyendas de conflicto (t2a ↔ tr_ir) no deben chocar; muévelos, ponles fondo oscuro semitransparente o muéstralos solo al pasar el mouse. En el historial del HUD, alinea las columnas (tiempo, evento, origen → destino) para que no se monten.
2. Grafo del HUD más claro: nodos más grandes y separados, flechas curvas que no se monten (en el brazo, las de abrir_mandril, cerrar_mandril, cargar y descargar entre Mandril_Cerrado y Mandril_Abierto), etiqueta "código · nombre" (por ejemplo "c · cargar"), no controlables con línea punteada y el estado actual con glow. Puede crecer el panel si hace falta.
3. Alertas: que la zona de alertas abajo a la derecha no quede tapada por el HUD (muévelas encima del HUD o al lado).
4. Vista "Red de Petri" con la tecla R y un botón en la barra: dibuja la red sobre la planta. Cada lugar es un círculo sobre su objeto con sus fichas, cada transición una barra negra en su estación con su nombre (t1a, t1b, t1c, t2a, t2b, t2c, tr_ir, tr_volver), y arcos con flecha lugar→transición y transición→lugar. Habilitadas en verde, conflicto en naranja y, en deadlock, las barras bloqueadas en rojo. Las fichas viajan siguiendo las flechas.
5. Tutorial "Turno 0" opcional desde el título: flechas y mensajes cortos guían paso a paso: mandar el brazo a la CNC1, abrir la pinza, cargar, cerrar, volver, iniciar fresado, esperar, descargar; despachar el AGV1; y al final provocar el deadlock a propósito (Despachar AGV1 y luego AGV2) para verlo en el radar y en la vista de red. En el tutorial los pedidos no vencen.
Criterio: capturas de la vista de red, del HUD del brazo con el grafo nuevo y de dos pasos del tutorial. npm test debe seguir pasando. Commit "Mejoras de jugabilidad" y git push.
```

## Prompt 21 · Funcionó

*Continuación del anterior: textos, grafo, alertas, vista de red con R y tutorial Turno 0.*

Fecha: 2026-11-16 01:26

```text
Continúa con el prompt de mejoras de jugabilidad desde donde quedaste (GDD, textos, grafo, alertas, vista de red con R y tutorial). Trabaja sin detenerte a preguntar y al final haz el commit "Mejoras de jugabilidad" y git push.
```

## Prompt 22 · Funcionó

*Cierre del proyecto (fases C2, D, E y F: sensación de juego, pulido, pruebas y entrega).*

Fecha: 2026-11-16 01:41

```text
Vas a terminar RoboCell Tycoon 2.5D hasta dejarlo listo para entregar. Trabaja de forma autónoma por fases durante el tiempo que haga falta, sin detenerte a preguntar. Usa las skills ingeniero-sed, disenador-simuladores-sed y director-arte-isometrico, y la guía Guia_Laboratorio1_SED_Phaser_Automatas_Petri.pdf (secciones 5.8 a 5.13) como lista de requisitos.

REGLAS QUE NO SE ROMPEN
- No cambies modelos/, docs/modelo/ ni los valores del GDD (estados, eventos, δ, lugares, Pre, Post, M0, k, tiempos, puntajes). Todo cambio de estado pasa por δ y todo recurso se mueve solo por el disparo de una transición.
- src/sed/ sin Phaser ni DOM. Phaser 4.2.1 solo por CDN, nada de import Phaser. base './'. Rutas relativas.
- Toda mejora nueva se escribe primero en la sección 18 del GDD y después se programa.
- Si algo no está definido, elige la opción más simple coherente con el GDD y la guía, anótala en docs/decisiones_por_confirmar.md y sigue.
- Al terminar cada fase: npm test y npm run build deben pasar, revisa el juego en el navegador sin ventana (sin errores en consola), commit con el nombre de la fase y git push.
- Antes de empezar escribe docs/PLAN_FINAL.md con estas fases como casillas y ve marcándolas. Si te interrumpen, al volver lee ese archivo y sigue desde la primera sin marcar.

FASE C2 · Sensación de juego
1. Piezas visibles: bloques en bruto en una zona "Entrada" junto al brazo; al cargar, el brazo lleva el bloque a la CNC; al terminar sale como pieza brillante; al descargar se apila en "Piezas terminadas" con contador.
2. Pedidos como tarjetas arriba al centro con barra de tiempo restante.
3. Pantalla de título con el nombre del juego, integrantes (Brian Acevedo, Brayan Amado, Manuel Carvajal), y botones Jugar, Tutorial y Controles.

FASE D · Pulido con Phaser 4 (prompt 16 de la guía)
4. Capacidad de la ficha: trayectorias (Path) de los AGV y glow en el botón bloqueado. Glow en la máquina seleccionada y en el estado del HUD, bloom en falla y deadlock, partículas de chispas al fresar y humo en Falla, temblor de cámara al bloquear o fallar, destello en los logros, transiciones entre Título, Planta y Resultados, tweens en fichas y radar. Cámara con arrastre, rueda y pellizco.
5. Rendimiento: unos 60 fps con todo en pantalla; si baja de 50, reduce efectos o calcula el radar cada 0,5 s.

FASE E · Pruebas y conformidad (sección 5.9)
6. docs/pruebas.md con las tablas de la sección 5.9 llenas con resultados reales: criterios del GDD (a); conformidad modelo–juego (b) con estados de la composición (20 y 19), nodos del árbol (14) y marcado muerto [0,0,0,0,1,1,0,0,0]; consola de reparación (c) con 2 palabras válidas y 3 inválidas; deadlock provocado y prevenido (d); supervisor (e); controles mouse/teclado/táctil (f); fps (g). Capturas en docs/capturas/.
7. Juega los 3 turnos completos a x4 en el navegador sin ventana y corrige lo que falle.

FASE F · Entrega (secciones 5.10 y 5.12)
8. npm test, npm run build y npm run preview sin errores 404. dist/ con index.html y assets/, menos de 25 MB, sin import Phaser ni phaser en package.json.
9. GrupoN_RoboCell.zip con el contenido de dist/ (index.html en la raíz) en una carpeta entrega/ incluida en .gitignore.
10. netlify.toml con el comando "npm run build" y la carpeta "dist" (no publiques).
11. README.md con descripción, integrantes, cómo ejecutar (dev, test, build, preview), controles y estructura.
12. Actualiza PROMPTS.md con todos los prompts de esta conversación en orden, indicando cuáles funcionaron y cuáles se corrigieron.
13. docs/informe.md con las tablas de las secciones 5.2 y 5.9 y un borrador del postmortem (las 5 preguntas de la sección 5.13 b), en primera persona del equipo y con frases sencillas.

AL FINAL
Resumen corto: fases completadas, número de pruebas, tamaño del ZIP, lista de capturas y el contenido de docs/decisiones_por_confirmar.md.
```

## Prompt 23 · Funcionó

*Pantalla completa y escalado (el juego se veía pequeño).*

Fecha: 2026-11-16

```text
El juego se ve muy pequeño en pantalla. Haz que ocupe toda la ventana del navegador manteniendo la proporción 16:9, sin cambiar la resolución interna del juego (960x540) ni el modelo:
1. En index.html cambia solo el CSS de #game-container para que use width: 100vw y height: 100vh (sin max de 960x540), y conserva todo lo demás de la sección 5.5.1 de la guía.
2. En la configuración de Phaser usa Scale.FIT con autoCenter CENTER_BOTH.
3. Agrega un botón de pantalla completa (ícono ⛶) en la barra superior y la tecla F11 o F para entrar y salir de pantalla completa. Si la tecla F ya se usa para forzar fallas en modo desarrollo, usa la tecla G.
4. Revisa que los textos se vean nítidos al agrandar y que los clics y toques sigan cayendo en el lugar correcto después de escalar.
5. Pruébalo en 1366x768, 1920x1080 y en celular horizontal. Anota el cambio en la sección 18 del GDD.
npm test y npm run build deben pasar. Commit "Pantalla completa y escalado" y git push.
```

## Prompt 24 · Funcionó

*Alta resolución: el canvas se dibujaba a 960x540 y el navegador lo estiraba.*

Fecha: 2026-11-16

```text
La calidad se ve borrosa al agrandar la pantalla porque el canvas se dibuja a 960x540 y el navegador lo estira. Arréglalo sin cambiar el modelo, las reglas ni las coordenadas lógicas del juego: canvas de 1920x1080 con zoom 2 en las cámaras de todas las escenas, antialias, líneas de Graphics con el mismo grosor visual, fps y tiempo de simulación solo con F1, capturas a 1920x1080 y nota en la sección 18 del GDD y en arte.md. Si baja de 50 fps, reducir a 1600x900. Commit "Alta resolucion" y git push.
```

Resultado: se hizo con `RES = 2` y `camaraLogica(this)` en cada escena. El usuario midió 53 fps con efectos en su equipo, así que la resolución se quedó como está.

## Prompt 25 · Funcionó (con un ajuste)

*Detalles visuales encontrados jugando a 1920x1080.*

Fecha: 2026-11-16

```text
Revisé el juego en mi pantalla (1920x1080) y quedan estos detalles visuales; arréglalos sin cambiar el modelo ni las reglas: 1. el texto de F1 queda debajo del panel del turno; 2. "Piezas terminadas" y su contador tapan la Mesa; 3. el indicador de pedidos choca con D1 y D2; 4. las fichas vacías (0/1) se ven como figuras oscuras encimadas: círculo punteado tenue con "0/1" pequeño; 5. la zona de alertas vacía es un recuadro grande: "Sin alertas"; 6. el mini-grafo del radar es muy pequeño. Capturas en tmp-capturas/ (en .gitignore). Commit "Ajustes visuales" y git push.
```

Se corrigió después: el contador "0" de Piezas terminadas seguía flotando lejos de su zona y se pegó a ella.

## Prompt 26 · Funcionó

*Última ronda de mejoras antes de entregar (revisión de errores, claridad, balance, pausa y guardado, celular, textos).*

Fecha: 2026-11-16

```text
Última ronda de mejoras de RoboCell Tycoon 2.5D antes de entregar. Trabaja de forma autónoma sin preguntar. Las mismas reglas de siempre: no cambies modelos/, docs/modelo/ ni los valores del GDD; todo cambio de estado pasa por δ o por el disparo de una transición; src/sed/ sin Phaser; Phaser por CDN. Cada mejora se anota primero en la sección 18 del GDD. Si algo no está definido, elige lo más simple, anótalo en docs/decisiones_por_confirmar.md y sigue. Guarda las capturas temporales dentro del proyecto en tmp-capturas/.
1. Revisión de errores: juega en el navegador sin ventana el tutorial completo y los 3 turnos a x1 y a x4, con clics y teclas al azar (incluido abrir y cerrar HUD, inspector, vista de red, pausa y reintento después del deadlock). Busca bloqueos de la interfaz, errores en consola, botones que no hacen nada y textos cortados o encimados. Corrige todo y agrega una prueba por cada error real.
2. Claridad: frase corta al pasar el mouse en cada botón y máquina; tecla ? y botón "?" con ayuda de controles y leyenda de colores; aviso de 3 s al inicio de cada turno con la meta y la dificultad; alerta corta cuando el radar pasa a amarillo diciendo por qué.
3. Balance: el turno 1 se debe poder ganar sin el Controlador y el turno 3 debe ser difícil pero posible. NO cambies los valores del GDD: anota los números medidos en decisiones_por_confirmar.md.
4. Menú de pausa (Continuar, Reiniciar turno, Ayuda, Silenciar sonido, Volver al título) y guardado del mejor puntaje y los logros en localStorage con try/catch, visibles en el título.
5. Celular: todo cabe y se puede tocar en 360x640 y en horizontal, botones de al menos 44 px, pellizco con zoom y sin scroll de la página.
6. Textos en español, sin faltas ni tildes perdidas, con los mismos nombres de estados y eventos del modelo.
7. Al final: npm test y npm run build pasan, npm run preview sin errores ni 404, regenerar el ZIP en entrega/, actualizar docs/pruebas.md, docs/informe.md, README.md y PROMPTS.md. Commit "Mejoras finales" y git push.
```

Resultado: ver `docs/informe.md` (postmortem, "mejoras tras el playtest") y `docs/decisiones_por_confirmar.md`.

## Prompt 27 · Funcionó

*Decisión del equipo sobre el balance del turno 3.*

Fecha: 2026-11-16

```text
Decisión del equipo sobre el balance: cambia la meta del turno 3 de 7 a 6 piezas (las fallas siguen en 30 % y los pedidos cada 12 s). Actualiza el GDD (sección de turnos y decisiones confirmadas, explicando que se ajustó por la medición de balance), src/config.js, las pruebas, docs/pruebas.md y el postmortem de docs/informe.md. Vuelve a correr scripts/balance.mjs y dime cuántas de 30 se ganan ahora en el turno 3 con 1 decisión cada 2 s. Las demás decisiones de decisiones_por_confirmar.md quedan aceptadas como están. Regenera el ZIP, commit "Balance turno 3" y git push.
```

Resultado: 0 de 30 con una decisión cada 2 s (27 de 30 con una por segundo). Ver `docs/decisiones_por_confirmar.md`.

## Prompt 28 · Funcionó

*Correcciones tras jugarlo: lentitud al abrir una CNC, estado actual sin iluminar, botones rojos y tarjetas encimadas.*

Fecha: 2026-11-16

```text
Probé el juego y hay estos problemas:
1. Al hacer clic en una CNC el juego se pone lento, como en cámara lenta. Revisa qué lo causa (filtros glow, bloom, redibujos del HUD en cada cuadro u otra cosa) y corrígelo para que vaya fluido.
2. En el grafo del HUD el estado actual NO se ve iluminado. Haz que el nodo del estado actual se rellene de un color fuerte (verde, o el color de su estado según arte.md) y tenga un borde grueso, sin depender del filtro glow, para que se vea claro en cualquier navegador.
3. Los botones deshabilitados por el supervisor (por ejemplo i · iniciar_fresado con el mandril abierto) se ven solo como texto. Deben verse como botón ROJO relleno con la razón al pasar el mouse.
4. Las tarjetas de pedidos de arriba tapan el título del HUD (CNC 1, Autómata, Composición). Muévelas para que no choquen.
Pruébalo en el navegador, npm test y npm run build deben pasar. Commit "Correcciones de jugabilidad" y git push.
```

Resultado: la causa eran los filtros glow; se quitaron (GDD 18.17).

## Prompt 29 · Funcionó

*Parpadeo de la última transición (guía 5.7.3, punto 2) sin filtros.*

Fecha: 2026-11-16

```text
La guía (sección 5.7.3, punto 2) pide que la última transición recorrida parpadee en el grafo del HUD, y ahora no se ve. Arréglalo sin filtros glow (para no volver a poner lento el juego), solo con dibujo plano y tweens:
1. Cuando ocurre un evento en una máquina, en su grafo la flecha recorrida y su etiqueta se pintan de AMARILLO grueso y parpadean durante 3 segundos (unos 6 parpadeos), y el nodo de destino hace un pulso de tamaño. Después del parpadeo, el estado actual queda relleno fijo. Si mientras parpadea ocurre otro evento, el parpadeo nuevo reemplaza al anterior.
2. El botón que el jugador presionó destella en amarillo un momento al hacer clic.
3. En la planta, la máquina que cambió de estado muestra un destello amarillo breve en su contorno.
4. Funciona igual en el HUD de la CNC, del brazo y del AGV, y también con los eventos no controlables que pasan solos (llegar, fin_fresado, falla_husillo).
Anota en la sección 18 del GDD que el equipo decidió 3 s en lugar de los 0,5 s de la guía para que se note mejor al jugar y en la sustentación.
Pruébalo en el navegador, npm test y npm run build deben pasar. Commit "Parpadeo de transiciones" y git push.
```

Resultado: GDD 18.18.

## Prompt 30 · Reemplazado por el 31

*Una primera versión del pedido «que se sienta como un juego» (acciones con macros, atajos 1, 2 y Espacio). El equipo la cambió en el prompt 31:
las macros contradicen la guía (cada botón dispara un evento). Qué se hizo y qué se deshizo: GDD 18.19 (parcial) y 18.20.*

## Prompt 31 · Funcionó (con decisiones anotadas)

*Juego de coordinación y velocidad: controles paso a paso, entregas de metal y dificultad.*

Fecha: 2026-11-17

```text
El juego es de COORDINACIÓN Y VELOCIDAD: el jugador opera el brazo entre 2 CNC paso a paso, fresa, repara y atiende los AGV sin trabar la celda.
Quiero que se sienta como un videojuego y que sea DIFÍCIL: el público son adultos que juegan videojuegos.
REGLAS QUE NO SE TOCAN: autómatas, red de Petri, JSON de src/sed/, δ, supervisor, valores de puntaje del GDD §9, radar, inspector y posiciones del HUD del GDD §12. Cada botón y cada tecla dispara UN solo evento del autómata.
1. Quitar macros. 2. Panel de máquina en «Autómata» con segunda pestaña «Acciones»; Tab cambia. 3. Barra de control fija abajo al centro (brazo Z X A C D E V; CNC F y G con luz y progreso, «Reparar» en Falla; AGV Q y W y Controlador); 1, 2 y 4 solo velocidad.
4. AGV = entregas de metal sin cambiar la red (tarjeta "AGV 1 trae metal · 12 s", caja que baja a la mesa, textos nuevos; nada de «cliente» ni «pedido»).
5. Sensación de videojuego (cuenta 3, 2, 1, objetivo, feedback, textos flotantes, racha visual, sonido, estrellas y frase del jefe). 6. Ayuda justa (intro de 6 líneas, etiquetas, pistas solo en el tutorial, tooltip del radar). 7. Dificultad calibrada con scripts/balance.mjs: experto 0,8 s gana los 3 turnos con poco margen, bueno 1,2 s gana el 1 y el 2, lento 2 s gana el 1 justo y pierde el 2; 20 semillas; tabla en el GDD. 8. Cierre: npm test, build, recorrido del navegador, nada superpuesto. Commit "Controles paso a paso, entregas de metal y dificultad" y push.
```

Resultado: GDD 18.20, `docs/decisiones_por_confirmar.md` (filas 24 a 30) y `docs/pruebas.md`, literal j. Decisiones que el pedido no definía: las teclas
de pantalla completa (L), demostración (F2) y forzar falla (F3); a qué AGV se atribuye cada entrega; las estrellas.
