// CNC: prisma de 1 x 1 celda y 40 px de alto, con ventana en la cara frontal y husillo arriba.
// El color del estado se ve en la ventana; el ícono del estado flota sobre la máquina.

import { COLORES, POSICIONES, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { oscurecer, aclarar, puntosPrisma, dibujarPrisma, siluetaPrisma } from '../iso/formas.js';
import { Entidad } from './Entidad.js';

export class EntidadCNC extends Entidad {
  constructor(escena, celda, id) {
    super(escena, celda, id, 'CNC');
    this.pos = POSICIONES[id];
    this.pr = puntosPrisma(this.pos.x, this.pos.y, 1, 1, ALTOS.CNC);
    this.silueta = siluetaPrisma(this.pr);
    this.fijarProfundidad(this.pos.x + this.pos.y);
  }

  dibujarCuerpo() {
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
