# Plan final de RoboCell Tycoon 2.5D

Lista de fases hacia la entrega. Se marca cada casilla al terminar la fase (con `npm test`, `npm run build`, revisión en el navegador sin
ventana y sin errores en consola, commit y push). Si se interrumpe el trabajo, se continúa desde la primera casilla sin marcar.

Reglas fijas: no se cambian `modelos/`, `docs/modelo/` ni los valores del GDD; `src/sed/` sin Phaser ni DOM; Phaser 4.2.1 solo por CDN;
toda mejora nueva se escribe primero en la sección 18 del GDD; lo que no esté definido se decide de la forma más simple y se anota
en `docs/decisiones_por_confirmar.md`.

- [x] **Fase C2 · Sensación de juego:** piezas visibles (Entrada, bloque en la CNC, pieza brillante, Piezas terminadas), pedidos como
  tarjetas con barra de tiempo, pantalla de título con integrantes y botones Jugar, Tutorial y Controles.
- [ ] **Fase D · Pulido con Phaser 4:** glow en la máquina seleccionada, bloom en falla y deadlock, partículas de chispas y humo,
  temblor de cámara al bloquear o fallar, destello en los logros, transiciones entre escenas, tweens en fichas y radar, cámara con
  arrastre, rueda y pellizco; medición de fps.
- [ ] **Fase E · Pruebas y conformidad (guía 5.9):** `docs/pruebas.md` con las tablas llenas y capturas; 3 turnos completos a x4.
- [ ] **Fase F · Entrega (guía 5.10 y 5.12):** build y preview sin 404, ZIP en `entrega/`, `netlify.toml`, README, PROMPTS.md,
  `docs/informe.md` con postmortem.
