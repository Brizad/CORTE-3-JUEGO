// Modelos formales para el navegador. Vite incluye los JSON de src/sed/modelos/ en el paquete.
// Los genera scripts/exportar-modelos.mjs (npm run modelos) a partir de modelos/.

import cnc from './sed/modelos/cnc.json';
import brazo from './sed/modelos/brazo.json';
import agv from './sed/modelos/agv.json';
import red from './sed/modelos/red_agv.json';
import redCorregida from './sed/modelos/red_agv_corregida.json';
import supervisor from './sed/modelos/supervisor.json';
import reparacion from './sed/modelos/reparacion_dfa.json';

/** Modelos de la red original (la que usa el juego sin el Controlador de celda). */
export const MODELOS = { cnc, brazo, agv, red, redCorregida, supervisor, reparacion };

/** Misma celda con la red corregida (Celda_libre), para cuando se compre el Controlador de celda. */
export const MODELOS_CORREGIDOS = { ...MODELOS, red: redCorregida };
