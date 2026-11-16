# Decisiones por confirmar

Cosas que el GDD, el modelo y la guía no definen y que se resolvieron con la opción más simple y coherente. El equipo puede cambiarlas.
Cada una dice dónde se aplicó.

| N.º | Decisión | Dónde |
|---|---|---|
| 1 | Las piezas (bloques en bruto, pieza brillante, pila de terminadas) son solo una capa visual. No tienen estado propio: salen de los estados de las CNC y de los eventos `cargar` y `descargar`. La "Entrada" se rellena sola (los bloques en bruto no se acaban) | `src/entidades/Piezas.js`, GDD 18.6 |
| 2 | "Entrada" está en la celda (6, 5) y "Piezas terminadas" en la celda (6, 3) | `src/entidades/Piezas.js` |
| 3 | Las tarjetas de pedidos muestran hasta 3 pedidos (los más antiguos) y un "+n" si hay más | `src/escenas/HUDGeneral.js`, GDD 18.7 |
| 4 | En la pantalla de título solo "Jugar" (o Enter) inicia la partida; antes bastaba un clic en cualquier lugar | `src/escenas/Titulo.js`, GDD 18.8 |
| 5 | Phaser 4.2.1 no trae un filtro "Bloom" suelto: se arma con la acción `Phaser.Actions.AddEffectBloom` sobre la cámara y solo existe durante el pulso (0,7 s en una falla, 0,9 s en un deadlock) | `src/entidades/Efectos.js` |
| 6 | Los filtros de Phaser (glow, bloom) se crean solo cuando se necesitan: un filtro encendido en cada cuadro costaba unos 25 fps en el equipo de prueba | `src/entidades/Efectos.js`, `src/entidades/Piezas.js` |
| 7 | Modo reducido automático: si el juego baja de 50 fps durante 4 s seguidos, se apagan partículas, bloom y glow de las piezas. `?efectos=0` lo activa desde el inicio y `?auto=0` desactiva la vigilancia (para medir) | `src/escenas/Planta.js` |
| 8 | El radar se sigue calculando tras cada disparo (cuesta menos de 1 ms), no cada 0,5 s | `src/sed/celda.js` |
| 9 | Se agregó `<link rel="icon" href="data:,">` a `index.html` para que el navegador no pida `favicon.ico` (daba un 404 en la consola) | `index.html` |
