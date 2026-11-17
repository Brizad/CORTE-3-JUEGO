// Estaciones de los AGV: muestran qué espera un AGV detenido en su estación ("Espera el robot" o "Espera la mesa", AND-join)
// y, sobre la base de cada AGV libre con una entrega de metal pendiente, su cuenta regresiva (docs/GDD.md, secciones 5, 6 y 18.20).

import { TEXTO_HEX, ALTOS } from '../config.js';
import { aPantalla } from '../iso/proyeccion.js';
import { textoEsperaAGV, etiquetasEntregas, cuentaEntrega } from '../textos.js';

const PROFUNDIDAD = 410;
const HEX_NIVEL = { operacion: TEXTO_HEX.operacion, espera: TEXTO_HEX.espera, fallo: TEXTO_HEX.fallo, mantenimiento: TEXTO_HEX.texto };
const AGVS = {
  // estación (celda), transición b que espera (iniciar descarga) y base donde se muestra el pedido
  AGV1: { estacion: [8.5, 3.5], transicion: 't1b', base: [11.5, 0.5] },
  AGV2: { estacion: [8.5, 5.5], transicion: 't2b', base: [9.5, 9.5] },
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
      const e0 = aPantalla(cfg.estacion[0], cfg.estacion[1], ALTOS.AGV);
      const e = { x: e0.x + 30, y: e0.y + 20 }; // justo debajo del rótulo "AGV n" (Rotulos.js)
      const b = aPantalla(cfg.base[0], cfg.base[1], 12);
      this.items[agv] = {
        cfg,
        aviso: escena.add
          .text(e.x, e.y, '', { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: TEXTO_HEX.espera, stroke: '#161b22', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(PROFUNDIDAD),
        // Cuenta regresiva de la entrega que trae este AGV ("Metal · 12 s"), sobre su base.
        pedido: escena.add
          .text(b.x, b.y, '', { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: TEXTO_HEX.texto, backgroundColor: 'rgba(22,27,34,0.8)', padding: { x: 4, y: 2 } })
          .setOrigin(0.5)
          .setDepth(PROFUNDIDAD + 1),
        b,
        clave: '',
      };
    }
  }

  actualizar() {
    const c = this.celda;
    const estados = { AGV1: c.estado('AGV1'), AGV2: c.estado('AGV2') };
    const rotulos = etiquetasEntregas(c.pedidos, estados);
    for (const [agv, it] of Object.entries(this.items)) {
      // AND-join: el AGV espera en la estación y la transición no está habilitada.
      const aviso = estados[agv] === 'Esperando' ? textoEsperaAGV(c.faltantes(it.cfg.transicion)) : '';
      // Entrega de metal que trae este AGV (libre en su base): cuenta regresiva con color.
      const i = rotulos.findIndex((r) => r.agv === agv);
      let pedido = '';
      let color = TEXTO_HEX.texto;
      if (i >= 0 && estados[agv] === 'Libre') {
        const cuenta = cuentaEntrega(c.pedidos[i], c.reloj.ahora, c.plazoEntrega, c.turno.pedidosVencen !== false);
        pedido = `Metal · ${cuenta.texto}`;
        color = HEX_NIVEL[cuenta.nivel];
      }
      const clave = `${aviso}|${pedido}|${color}`;
      if (clave === it.clave) continue;
      it.clave = clave;
      it.aviso.setText(aviso);
      it.pedido.setText(pedido).setColor(color).setVisible(pedido !== '');
    }
  }

  destruir() {
    for (const it of Object.values(this.items)) {
      it.aviso.destroy();
      it.pedido.destroy();
    }
  }
}
