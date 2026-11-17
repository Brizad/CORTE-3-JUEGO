// AGV: plataforma baja de 0,8 x 0,8 celdas y 14 px de alto, con luz superior y un rombo azul en el techo.
// Se mueve por un Path de Phaser entre su depósito y su estación. El progreso sale del reloj de simulación,
// así el viaje dura exactamente 4 s (v a g) a x1, x2 y x4 (docs/arte.md, sección 9.1).
// El AGV trae una ENTREGA DE METAL (docs/GDD.md, sección 18.20): lleva una caja dibujada desde que sale; al descargar, la caja pasa
// del AGV a la mesa, se queda allí y al terminar desaparece con un destello. Es solo visual: sale del estado del autómata.

import { COLORES, RUTAS_AGV, ALTOS, TIEMPOS, POSICIONES } from '../config.js';
import { aPantalla, aCelda } from '../iso/proyeccion.js';
import { aclarar, oscurecer, puntosPrisma, dibujarPrisma, siluetaPrisma } from '../iso/formas.js';
import { Entidad, valorAnimado, suave } from './Entidad.js';

const LADO = 0.8; // celdas
const VUELTA = TIEMPOS.agvViaje; // el regreso al depósito tarda lo mismo que la ida (solo visual)
const PASO_CAJA = 2.2; // s de simulación que tarda la caja en pasar del AGV a la mesa
const DESTELLO = 0.6; // s que dura el destello al terminar la descarga

export class EntidadAGV extends Entidad {
  constructor(escena, celda, id) {
    super(escena, celda, id, 'AGV');
    // Path con los waypoints del GDD: centros de las celdas, del depósito a la estación.
    const puntos = RUTAS_AGV[id].map(([x, y]) => aPantalla(x + 0.5, y + 0.5));
    this.ruta = new Phaser.Curves.Path(puntos[0].x, puntos[0].y);
    for (const p of puntos.slice(1)) this.ruta.lineTo(p.x, p.y);
    this.progreso = { desde: 0, hasta: 0, t0: 0, dur: 0 }; // 0 = depósito, 1 = estación
    this.fx = 0;
    this.fy = 0;
    this.caja = escena.add.graphics().setDepth(306); // caja de metal: por encima de las máquinas (viaja del AGV a la mesa)
    this.descarga = null; // {t0}: instante en que empezó a descargar
    this.destello = null; // {t0}: instante en que terminó (la caja desaparece con un destello)
    this._colocar(0);
  }

  alCambiarEstado(e) {
    super.alCambiarEstado(e);
    const t = e.t;
    if (e.evento === 'reservar') {
      this.progreso = { desde: valorAnimado(this.progreso, t), hasta: 1, t0: t, dur: TIEMPOS.agvViaje };
    } else if (e.evento === 'iniciar_descarga') {
      this.descarga = { t0: t };
    } else if (e.evento === 'fin_descarga') {
      this.progreso = { desde: 1, hasta: 0, t0: t, dur: VUELTA };
      this.descarga = null;
      this.destello = { t0: t };
    }
  }

  alRestaurar() {
    super.alRestaurar();
    const t = this.celda.reloj.ahora;
    const q = this.automata.estado;
    // Los viajes en curso se reprograman con su duración completa: la animación también empieza de nuevo.
    if (q === 'Viajando') this.progreso = { desde: 0, hasta: 1, t0: t, dur: TIEMPOS.agvViaje };
    else if (q === 'Libre') this.progreso = { desde: 0, hasta: 0, t0: t, dur: 0 };
    else this.progreso = { desde: 1, hasta: 1, t0: t, dur: 0 };
    this.descarga = q === 'Descargando' ? { t0: t } : null;
    this.destello = null;
  }

  /** Coloca el AGV en el punto p (0 a 1) del recorrido y actualiza la silueta y la profundidad. */
  _colocar(p) {
    const punto = this.ruta.getPoint(p);
    const c = aCelda(punto.x, punto.y);
    this.fx = c.fx;
    this.fy = c.fy;
    this.pr = puntosPrisma(this.fx - LADO / 2, this.fy - LADO / 2, LADO, LADO, ALTOS.AGV);
    this.silueta = siluetaPrisma(this.pr);
    this.fijarProfundidad(this.fx + this.fy);
  }

  actualizar(t) {
    this._colocar(valorAnimado(this.progreso, t));
    const g = this.cuerpo;
    g.clear();
    dibujarPrisma(g, this.pr, this.hover ? aclarar(COLORES.maquina, 0.2) : COLORES.maquina);

    // Rombo azul en el techo (aplanado en la proyección 2:1).
    const c = aPantalla(this.fx, this.fy, ALTOS.AGV);
    const rombo = [{ x: c.x, y: c.y - 5 }, { x: c.x + 10, y: c.y }, { x: c.x, y: c.y + 5 }, { x: c.x - 10, y: c.y }];
    g.fillStyle(COLORES.agv, 1);
    g.fillPoints(rombo, true);

    // Luz superior con el color del estado.
    const luz = aPantalla(this.fx - 0.28, this.fy - 0.28, ALTOS.AGV + 3);
    g.fillStyle(this.aspecto.color, 1);
    g.fillCircle(luz.x, luz.y, 3.5);
    g.lineStyle(1, COLORES.texto, 0.8);
    g.strokeCircle(luz.x, luz.y, 3.5);

    if (this.hover) {
      g.lineStyle(2, COLORES.espera, 0.9);
      g.strokePoints(this.silueta, true);
    }

    this._estadoDibujado = this.automata.estado;
    this.sucia = false;
    this.redibujarIcono(t);
    this._dibujarCaja(t);
  }

  /** Caja de metal: sobre el AGV mientras viaja o espera, pasando a la mesa al descargar y un destello al terminar. */
  _dibujarCaja(t) {
    const g = this.caja;
    g.clear();
    const q = this.automata.estado;
    const sobreAGV = aPantalla(this.fx, this.fy, ALTOS.AGV);
    const mesa = aPantalla(POSICIONES.MESA.x + 0.5, POSICIONES.MESA.y + 0.5, ALTOS.MESA);
    let p = null;
    if (q === 'Viajando' || q === 'Esperando') p = sobreAGV;
    else if (q === 'Descargando' && this.descarga) {
      const k = suave(Math.min(1, Math.max(0, (t - this.descarga.t0) / PASO_CAJA)));
      p = { x: sobreAGV.x + (mesa.x - sobreAGV.x) * k, y: sobreAGV.y + (mesa.y - sobreAGV.y) * k - 22 * Math.sin(Math.PI * k) };
    }
    if (p) {
      // Cubo pequeño en proyección 2:1 (18 px de ancho, 9 de alto) con los tonos del metal.
      const [w, h, alto] = [9, 4.5, 9];
      const arriba = [{ x: p.x, y: p.y - alto - h }, { x: p.x + w, y: p.y - alto }, { x: p.x, y: p.y - alto + h }, { x: p.x - w, y: p.y - alto }];
      g.fillStyle(oscurecer(COLORES.maquina, 0.2), 1);
      g.fillPoints([{ x: p.x - w, y: p.y - alto }, { x: p.x, y: p.y - alto + h }, { x: p.x, y: p.y + h }, { x: p.x - w, y: p.y }], true);
      g.fillStyle(oscurecer(COLORES.maquina, 0.4), 1);
      g.fillPoints([{ x: p.x + w, y: p.y - alto }, { x: p.x, y: p.y - alto + h }, { x: p.x, y: p.y + h }, { x: p.x + w, y: p.y }], true);
      g.fillStyle(aclarar(COLORES.maquina, 0.35), 1);
      g.fillPoints(arriba, true);
      g.lineStyle(1, COLORES.panel, 0.9);
      g.strokePoints(arriba, true);
    }
    if (this.destello) {
      const k = (t - this.destello.t0) / DESTELLO;
      if (k >= 1 || k < 0) this.destello = null;
      else {
        // Destello: una estrella de 4 puntas que crece y se apaga sobre la mesa.
        const r = 6 + 22 * k;
        const c = { x: mesa.x, y: mesa.y - 8 };
        g.fillStyle(COLORES.celda, 1 - k);
        g.fillPoints([{ x: c.x, y: c.y - r }, { x: c.x + r * 0.25, y: c.y - r * 0.25 }, { x: c.x + r, y: c.y }, { x: c.x + r * 0.25, y: c.y + r * 0.25 }, { x: c.x, y: c.y + r }, { x: c.x - r * 0.25, y: c.y + r * 0.25 }, { x: c.x - r, y: c.y }, { x: c.x - r * 0.25, y: c.y - r * 0.25 }], true);
        g.lineStyle(2, COLORES.texto, 1 - k);
        g.strokeCircle(c.x, c.y, r * 0.8);
      }
    }
  }

  destruir() {
    super.destruir();
    this.caja.destroy();
  }

  puntoIcono() {
    const c = aPantalla(this.fx, this.fy, ALTOS.AGV);
    return { x: c.x, y: c.y - 8 - 8 - 4 };
  }
}
