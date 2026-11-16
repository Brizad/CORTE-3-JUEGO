// Cámara lógica: dibuja las coordenadas de 960x540 sobre el canvas de alta resolución (zoom RES, origen arriba a la izquierda).

import { RES } from '../config.js';

export function camaraLogica(escena) {
  const c = escena.cameras.main;
  c.setOrigin(0, 0);
  c.setZoom(RES);
  c.setScroll(0, 0);
  return c;
}
