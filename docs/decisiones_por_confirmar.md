# Decisiones por confirmar

Cosas que el GDD, el modelo y la guía no definen y que se resolvieron con la opción más simple y coherente. El equipo puede cambiarlas.
Cada una dice dónde se aplicó.

| N.º | Decisión | Dónde |
|---|---|---|
| 1 | Las piezas (bloques en bruto, pieza brillante, pila de terminadas) son solo una capa visual. No tienen estado propio: salen de los estados de las CNC y de los eventos `cargar` y `descargar`. La "Entrada" se rellena sola (los bloques en bruto no se acaban) | `src/entidades/Piezas.js`, GDD 18.6 |
| 2 | "Entrada" está en la celda (6, 5) y "Piezas terminadas" en la celda (6, 3) | `src/entidades/Piezas.js` |
| 3 | Las tarjetas de pedidos muestran hasta 3 pedidos (los más antiguos) y un "+n" si hay más | `src/escenas/HUDGeneral.js`, GDD 18.7 |
| 4 | En la pantalla de título solo "Jugar" (o Enter) inicia la partida; antes bastaba un clic en cualquier lugar | `src/escenas/Titulo.js`, GDD 18.8 |
