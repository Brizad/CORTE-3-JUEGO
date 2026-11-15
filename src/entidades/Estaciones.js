// Estaciones de los AGV: muestran qué ficha falta cuando un AGV espera una transición (AND-join),
// y los pedidos pendientes como un número sobre la base de cada AGV (docs/GDD.md, secciones 5 y 6).

import { COLORES, TEXTO_HEX } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';

const PROFUNDIDAD = 410;
const AGVS = {
  // estación (celda), transición b que espera (iniciar descarga) y base donde se muestra el pedido
  AGV1: { estacion: [8.5, 3.5], transicion: 't1b', base: [10.5, 0.5] },
  AGV2: { estacion: [8.5, 5.5], transicion: 't2b', base: [10.5, 9.5] },
};

export class Estaciones {
  /**
   * @param {Phaser.Scene} escena
   * @param {import('../sed/celda.js').Celda} celda
   */
  constructor(escena, celda) {
    this.escena = escena;
    this.celda = celda;
    this.items = {};
    for (const [agv, cfg] of Object.entries(AGVS)) {
      const e = aPantalla(cfg.estacion[0], cfg.estacion[1], 62);
      const b = aPantalla(cfg.base[0], cfg.base[1], 12);
      this.items[agv] = {
        cfg,
        aviso: escena.add
          .text(e.x, e.y, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera, stroke: '#161b22', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(PROFUNDIDAD),
        insignia: escena.add.graphics().setDepth(PROFUNDIDAD),
        numero: escena.add
          .text(b.x, b.y, '0', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#161b22' })
          .setOrigin(0.5)
          .setDepth(PROFUNDIDAD + 1),
        rotulo: escena.add
          .text(b.x, b.y + 12, 'pedidos', { fontFamily: 'Arial', fontSize: '8px', color: TEXTO_HEX.texto, stroke: '#161b22', strokeThickness: 2 })
          .setOrigin(0.5, 0)
          .setDepth(PROFUNDIDAD),
        b,
        clave: '',
      };
    }
  }

  actualizar() {
    const c = this.celda;
    const pedidos = c.pedidos.length;
    const vencido = c.pedidos.some((p) => p.vencido);
    for (const [agv, it] of Object.entries(this.items)) {
      // AND-join: el AGV espera en la estación y la transición no está habilitada.
      let aviso = '';
      if (c.estado(agv) === 'Esperando') {
        const falta = c.faltantes(it.cfg.transicion);
        if (falta.length > 0) aviso = `${agv} espera: falta ${falta.join(', ')}`;
      }
      it.aviso.setText(aviso);

      const clave = `${pedidos}|${vencido}`;
      if (clave !== it.clave) {
        it.clave = clave;
        const color = vencido ? COLORES.fallo : COLORES.espera;
        it.insignia.clear();
        it.insignia.fillStyle(color, pedidos > 0 ? 1 : 0.35);
        it.insignia.fillCircle(it.b.x, it.b.y, 10);
        it.insignia.lineStyle(1.5, COLORES.texto, pedidos > 0 ? 0.9 : 0.3);
        it.insignia.strokeCircle(it.b.x, it.b.y, 10);
        it.numero.setText(String(pedidos));
      }
    }
  }

  destruir() {
    for (const it of Object.values(this.items)) {
      it.aviso.destroy();
      it.insignia.destroy();
      it.numero.destroy();
      it.rotulo.destroy();
    }
  }
}
