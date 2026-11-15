// Brazo: base cilíndrica y dos segmentos articulados con una pinza. 56 px de alto en reposo.
// La pinza se abre o se cierra según el estado del autómata, y el brazo se extiende hacia la CNC atendida.
// Los movimientos se calculan con el reloj de simulación: duran lo mismo a x1, x2 y x4, y se frenan en pausa.

import { COLORES, POSICIONES, ALTOS, TIEMPOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar, dibujarCilindro } from '../iso/formas.js';
import { Entidad, valorAnimado, suave } from './Entidad.js';

const ALTO_BASE = 14; // px: la base cilíndrica
const ALCANCE_CELDAS = 0.9; // el brazo llega hasta nueve décimos del camino a la CNC
const ALTURA_ALCANCE = 48; // px sobre el suelo con el brazo extendido (la pinza queda sobre la CNC)
const VUELTA = 0.5; // s de simulación que dura la animación de regreso (tr_volver dura 0 s en el modelo)
const PINZA = 0.3; // s de simulación que tarda la pinza en abrirse o cerrarse

export class EntidadBrazo extends Entidad {
  constructor(escena, celda, id = 'BRAZO') {
    super(escena, celda, id, 'BRAZO');
    this.pos = POSICIONES.BRAZO;
    this.alcance = { desde: 0, hasta: 0, t0: 0, dur: 0 }; // 0 = en reposo, 1 = extendido
    this.pinza = { desde: 0, hasta: 0, t0: 0, dur: 0 }; // 0 = cerrada, 1 = abierta
    this.objetivo = null; // última CNC atendida
    this.fijarProfundidad(this.pos.x + this.pos.y + 0.5);
    this.silueta = this._silueta();
  }

  alCambiarEstado(e) {
    super.alCambiarEstado(e);
    const ahora = e.t;
    if (e.evento === 'mover') {
      const desde = valorAnimado(this.alcance, ahora);
      if (e.de === 'Reposo') this.alcance = { desde, hasta: 1, t0: ahora, dur: TIEMPOS.brazoLlegar };
      else this.alcance = { desde, hasta: 0, t0: ahora, dur: VUELTA };
    }
    if (e.a === 'Mandril_Abierto' || e.de === 'Mandril_Abierto') {
      const desde = valorAnimado(this.pinza, ahora);
      this.pinza = { desde, hasta: e.a === 'Mandril_Abierto' ? 1 : 0, t0: ahora, dur: PINZA };
    }
  }

  alRestaurar() {
    super.alRestaurar();
    const t = this.celda.reloj.ahora;
    const q = this.automata.estado;
    if (this.celda.atendida) this.objetivo = this.celda.atendida;
    if (q === 'Reposo') this.alcance = { desde: 0, hasta: 0, t0: t, dur: 0 };
    else if (q === 'Moviendo') this.alcance = { desde: 0, hasta: 1, t0: t, dur: TIEMPOS.brazoLlegar };
    else this.alcance = { desde: 1, hasta: 1, t0: t, dur: 0 };
    const abierta = q === 'Mandril_Abierto' ? 1 : 0;
    this.pinza = { desde: abierta, hasta: abierta, t0: t, dur: 0 };
  }

  /** Geometría del brazo en pantalla para el instante t: hombro, codo y muñeca. */
  _geometria(t) {
    if (this.celda.atendida) this.objetivo = this.celda.atendida;
    const r = suave(valorAnimado(this.alcance, t));
    const centro = { x: this.pos.x + 0.5, y: this.pos.y + 0.5 };
    const hombro = aPantalla(centro.x, centro.y, ALTO_BASE);
    const reposo = aPantalla(centro.x, centro.y, ALTOS.BRAZO);
    let muneca = reposo;
    if (this.objetivo) {
      const o = POSICIONES[this.objetivo];
      const fin = aPantalla(
        centro.x + (o.x + 0.5 - centro.x) * ALCANCE_CELDAS,
        centro.y + (o.y + 0.5 - centro.y) * ALCANCE_CELDAS,
        ALTURA_ALCANCE,
      );
      muneca = { x: reposo.x + (fin.x - reposo.x) * r, y: reposo.y + (fin.y - reposo.y) * r };
    }
    const codo = {
      x: (hombro.x + muneca.x) / 2,
      y: (hombro.y + muneca.y) / 2 - 12 * Math.sin(Math.PI * r),
    };
    return { hombro, codo, muneca };
  }

  actualizar(t) {
    const g = this.cuerpo;
    const { hombro, codo, muneca } = this._geometria(t);
    g.clear();
    const centro = { x: this.pos.x + 0.5, y: this.pos.y + 0.5 };
    dibujarCilindro(g, centro.x, centro.y, 0.3, ALTO_BASE, oscurecer(COLORES.maquina, 0.1));

    const color = this.hover ? aclarar(COLORES.maquina, 0.25) : COLORES.maquina;
    // Segmentos: una sombra más oscura debajo para dar volumen.
    g.lineStyle(8, oscurecer(color, 0.35), 1);
    g.lineBetween(hombro.x, hombro.y + 1.5, codo.x, codo.y + 1.5);
    g.lineBetween(codo.x, codo.y + 1.5, muneca.x, muneca.y + 1.5);
    g.lineStyle(6, color, 1);
    g.lineBetween(hombro.x, hombro.y, codo.x, codo.y);
    g.lineBetween(codo.x, codo.y, muneca.x, muneca.y);
    // Articulaciones.
    g.fillStyle(COLORES.robot, 1);
    for (const j of [hombro, codo, muneca]) g.fillCircle(j.x, j.y, 4);

    // Pinza: dos dedos que se separan al abrir.
    const apertura = 2 + 5 * suave(valorAnimado(this.pinza, t));
    g.lineStyle(3, oscurecer(color, 0.2), 1);
    g.lineBetween(muneca.x - apertura, muneca.y + 1, muneca.x - apertura, muneca.y + 9);
    g.lineBetween(muneca.x + apertura, muneca.y + 1, muneca.x + apertura, muneca.y + 9);

    this._muneca = muneca;
    this._estadoDibujado = this.automata.estado;
    this.sucia = false;
    this.redibujarIcono(t);
  }

  /** El ícono queda fijo a un lado de la base, así nunca se encima con el de la CNC que el brazo atiende. */
  puntoIcono() {
    const base = aPantalla(this.pos.x + 0.5, this.pos.y + 0.5, ALTOS.BRAZO);
    return { x: base.x + 26, y: base.y - 4 };
  }

  /** Silueta fija para detectar clics: hexágono alrededor de la base y el brazo en reposo. */
  _silueta() {
    const c = { x: this.pos.x + 0.5, y: this.pos.y + 0.5 };
    return [
      aPantalla(c.x - 0.35, c.y - 0.35, ALTOS.BRAZO + 6),
      aPantalla(c.x + 0.35, c.y - 0.35, ALTOS.BRAZO + 6),
      aPantalla(c.x + 0.35, c.y + 0.35, 0),
      aPantalla(c.x - 0.35, c.y + 0.35, 0),
    ];
  }
}
