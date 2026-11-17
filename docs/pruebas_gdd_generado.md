# Criterios del GDD comprobados con el núcleo (generado)

Lo genera `node scripts/pruebas-gdd.mjs` con el núcleo de `src/sed/` (sin navegador).

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
| CA-13 | Probabilidad de falla 10 %, 15 % y 20 % por turno (GDD 18.20) | 1000 fresados por turno | turno 1: 10.6 %; turno 2: 15.2 %; turno 3: 19.3 % | sí |
| CA-14 | Entregas de metal cada 25, 20 y 18 s (turno 3 con parejas); una sin atender se pierde a los 30 s (20 s en el turno 3) con −20 | Contar entregas en 179 s y esperar un vencimiento por turno | entregas por turno: 7, 8, 11; la primera se pierde a los 55, 50, 38 s, puntaje -20 | sí |
| CA-16 | Un AGV no descarga sin la mesa y el brazo (AND-join) | AGV1 llega con el brazo fuera | AGV1 = Esperando; falta: Robot_libre; t1b habilitada = false | sí |
| CA-17 | El puntaje de cada acción coincide con la sección 8 | Ejecutar cada acción | pieza +100; ayuda -20; Controlador -150; palabra inválida -30; reparación válida +50; ciclo de AGV +40, bloqueo −15, pedido vencido −20, radar +25 y deadlock −200 (ver CA-05, CA-06, CA-10, CA-14 y tests) | sí |
| CA-19 | Las velocidades y la pausa no cambian el resultado del turno | Misma partida con pasos de reloj de 0,05 s, 0,25 s y 1 s | resultados idénticos | sí |
| CA-23 | El Controlador no se compra en el marcado muerto y se pierde al terminar el turno | Intentar comprarlo en deadlock; terminar un turno con Controlador | en deadlock: deadlock; desactivarControlador() devuelve la red original (ver tests/turnos.test.js) | sí |

Cumplen 16 de 16.
