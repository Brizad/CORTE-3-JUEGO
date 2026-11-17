// CNC: prisma de 1 x 1 celda y 40 px de alto, con ventana en la cara frontal y husillo arriba.
// El color del estado se ve en la ventana; el ícono del estado flota sobre la máquina.
// Al empezar a fresar la puerta se cierra sobre la ventana (y se abre al terminar o fallar): solo muestra el estado del autómata.

import { COLORES, POSICIONES, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar, puntosPrisma, dibujarPrisma, siluetaPrisma } from '../iso/formas.js';
import { Entidad, valorAnimado, suave } from './Entidad.js';

const PUERTA = 0.4; // s de simulación que tarda la puerta en cerrarse o abrirse

export class EntidadCNC extends Entidad {
  constructor(escena, celda, id) {
    super(escena, celda, id, 'CNC');
    this.pos = POSICIONES[id];
    this.pr = puntosPrisma(this.pos.x, this.pos.y, 1, 1, ALTOS.CNC);
    this.silueta = siluetaPrisma(this.pr);
    this.fijarProfundidad(this.pos.x + this.pos.y);
    this.puerta = { desde: 0, hasta: 0, t0: 0, dur: 0 }; // 0 = abierta, 1 = cerrada
  }

  alCambiarEstado(e) {
    super.alCambiarEstado(e);
    if (e.a === 'Fresando' || e.de === 'Fresando') {
      this.puerta = { desde: valorAnimado(this.puerta, e.t), hasta: e.a === 'Fresando' ? 1 : 0, t0: e.t, dur: PUERTA };
    }
  }

  alRestaurar() {
    super.alRestaurar();
    const k = this.automata.estado === 'Fresando' ? 1 : 0;
    this.puerta = { desde: k, hasta: k, t0: this.celda.reloj.ahora, dur: 0 };
  }

  actualizar(t) {
    if (t < this.puerta.t0 + this.puerta.dur + 0.05) this.sucia = true; // la puerta se está moviendo
    super.actualizar(t);
  }

  dibujarCuerpo(t = 0) {
    const g = this.cuerpo;
    const pr = this.pr;
    g.clear();
    dibujarPrisma(g, pr, this.hover ? aclarar(COLORES.maquina, 0.2) : COLORES.maquina);

    // Ventana en la cara izquierda (interpolación entre D, C, Dt y Ct).
    const punto = (u, v) => ({
      x: pr.D.x + (pr.C.x - pr.D.x) * u + (pr.Dt.x - pr.D.x) * v,
      y: pr.D.y + (pr.C.y - pr.D.y) * u + (pr.Dt.y - pr.D.y) * v,
    });
    const ventana = [punto(0.2, 0.3), punto(0.8, 0.3), punto(0.8, 0.75), punto(0.2, 0.75)];
    g.fillStyle(oscurecer(COLORES.maquina, 0.6), 1);
    g.fillPoints(ventana, true);
    // Interior de la ventana con el color del estado.
    const interior = [punto(0.26, 0.36), punto(0.74, 0.36), punto(0.74, 0.69), punto(0.26, 0.69)];
    g.fillStyle(this.aspecto.color, 0.9);
    g.fillPoints(interior, true);
    // Puerta corrediza: cubre la ventana de izquierda a derecha y deja una mirilla con el color del estado.
    const k = suave(valorAnimado(this.puerta, t));
    if (k > 0.02) {
      const u1 = 0.2 + 0.6 * k;
      g.fillStyle(aclarar(COLORES.maquina, 0.12), 1);
      g.fillPoints([punto(0.2, 0.3), punto(u1, 0.3), punto(u1, 0.75), punto(0.2, 0.75)], true);
      g.lineStyle(1.5, oscurecer(COLORES.maquina, 0.5), 1);
      g.strokePoints([punto(0.2, 0.3), punto(u1, 0.3), punto(u1, 0.75), punto(0.2, 0.75)], true);
      if (k > 0.6) {
        g.fillStyle(this.aspecto.color, 1);
        g.fillPoints([punto(0.38, 0.44), punto(0.62, 0.44), punto(0.62, 0.62), punto(0.38, 0.62)], true);
      }
    }

    // Husillo: prisma pequeño sobre la cara superior.
    const h = puntosPrisma(this.pos.x + 0.375, this.pos.y + 0.375, 0.25, 0.25, 14);
    const arriba = Object.fromEntries(Object.entries(h).map(([k, p]) => [k, { x: p.x, y: p.y - ALTOS.CNC }]));
    dibujarPrisma(g, arriba, oscurecer(COLORES.maquina, 0.3));

    if (this.hover) {
      g.lineStyle(2, COLORES.espera, 0.9);
      g.strokePoints(this.silueta, true);
    }
  }

  puntoIcono() {
    // El ícono mide 16 px y queda centrado 8 px sobre la máquina (docs/arte.md, sección 5).
    const c = aPantalla(this.pos.x + 0.5, this.pos.y + 0.5);
    return { x: c.x, y: c.y - ALTOS.CNC - 8 - 14 - 8 };
  }
}
