// AGV: plataforma baja de 0,8 x 0,8 celdas y 14 px de alto, con luz superior y un rombo azul en el techo.
// Se mueve por un Path de Phaser entre su depósito y su estación. El progreso sale del reloj de simulación,
// así el viaje dura exactamente 4 s (v a g) a x1, x2 y x4 (docs/arte.md, sección 9.1).

import { COLORES, RUTAS_AGV, ALTOS, TIEMPOS } from '../config.js';
import { aPantalla, aCelda } from '../iso/proyeccion.js';
import { aclarar, puntosPrisma, dibujarPrisma, siluetaPrisma } from '../iso/formas.js';
import { Entidad, valorAnimado } from './Entidad.js';

const LADO = 0.8; // celdas
const VUELTA = TIEMPOS.agvViaje; // el regreso al depósito tarda lo mismo que la ida (solo visual)

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
    this._colocar(0);
  }

  alCambiarEstado(e) {
    super.alCambiarEstado(e);
    const t = e.t;
    if (e.evento === 'reservar') {
      this.progreso = { desde: valorAnimado(this.progreso, t), hasta: 1, t0: t, dur: TIEMPOS.agvViaje };
    } else if (e.evento === 'fin_descarga') {
      this.progreso = { desde: 1, hasta: 0, t0: t, dur: VUELTA };
    }
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
  }

  puntoIcono() {
    const c = aPantalla(this.fx, this.fy, ALTOS.AGV);
    return { x: c.x, y: c.y - 8 - 8 - 4 };
  }
}
