// Pantalla completa (docs/GDD.md, sección 18.10). Se usa la API del navegador directamente sobre #game-container:
// el método de Phaser crea un contenedor extra y lanza errores sin capturar si el navegador niega el permiso.

/** Entra o sale de pantalla completa. Nunca lanza: si el navegador no lo permite, no pasa nada. */
export function alternarPantallaCompleta() {
  try {
    const doc = globalThis.document;
    if (!doc) return;
    const quitar = (promesa) => promesa?.catch?.(() => {});
    if (doc.fullscreenElement) quitar(doc.exitFullscreen?.());
    else quitar((doc.getElementById('game-container') ?? doc.documentElement).requestFullscreen?.());
  } catch {
    /* sin pantalla completa */
  }
}
