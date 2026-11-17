// Revisión final de solapes (docs/GDD.md, sección 18.21, punto 5) con Edge sin ventana (CDP).
// Recorre TODAS las escenas (Título, nombre, Logros, ficha, Planta, panel de máquina, Inspector y sus pestañas, Resultados, Pausa,
// Ayuda y Game over) con y sin el tutorial, a 960 x 540 y en celular (360 x 640 vertical y 844 x 390 horizontal).
// En cada pantalla mide los textos visibles: ninguno debe salirse de 960 x 540 ni encimarse con otro de la misma escena.
// Las capturas quedan en docs/capturas/final_*.png. Uso: node scripts/solapes-navegador.mjs [puerto web=5199]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const web = process.argv[2] ?? '5199';
const P = 9700 + Math.floor(Math.random() * 250);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${P}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=960,540', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'sol-'))}`, 'about:blank'], { stdio: 'ignore' });
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
await sl(3000);
setTimeout(() => { console.log('TIEMPO AGOTADO'); edge.kill(); process.exit(2); }, 600000);
const t = (await (await fetch(`http://127.0.0.1:${P}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0; const pend = {}; const errs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend[m.id]) pend[m.id](m.result ?? m.error);
  if (m.method === 'Runtime.exceptionThrown' && !JSON.stringify(m.params).includes('extension')) errs.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text) + ' ' + JSON.stringify(m.params.exceptionDetails.stackTrace?.callFrames?.slice(0, 4).map((f) => `${f.functionName}@${f.url.split('/').pop()}:${f.lineNumber}`) ?? []));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('consola: ' + JSON.stringify(m.params.args).slice(0, 300));
};
const send = (method, params = {}) => Promise.race([new Promise((r) => { pend[++n] = r; ws.send(JSON.stringify({ id: n, method, params })); }), sl(20000).then(() => ({}))]);
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.log('  excepción:', x.slice(0, 90), r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const cuadros = async (k = 3) => { const f0 = (await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1; for (let i = 0; i < 100; i++) { await sl(100); if (((await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1) >= f0 + k) return; } };
const J = 'window.juego.scene.getScene';
fs.mkdirSync('docs/capturas', { recursive: true });
const foto = async (nombre) => { await cuadros(3); const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.data) fs.writeFileSync(`docs/capturas/final_${nombre}.png`, Buffer.from(s.data, 'base64')); else console.log('  sin captura:', nombre); };
const filas = []; const ok = (nombre, cond, dato = '') => { filas.push(`${cond ? 'ok   ' : 'FALLA'} ${nombre} ${dato}`); console.log(filas.at(-1)); };
const tamano = async (ancho, alto, movil = false) => {
  await send('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil, screenOrientation: { type: alto > ancho ? 'portraitPrimary' : 'landscapePrimary', angle: alto > ancho ? 0 : 90 } });
  await send('Emulation.setTouchEmulationEnabled', { enabled: movil, maxTouchPoints: movil ? 5 : 0 });
  await sl(600); await cuadros(4);
};
const abrir = async (url) => { await send('Page.navigate', { url: `http://localhost:${web}/${url}` }); for (let i = 0; i < 40; i++) { await sl(800); if (await ev(`!!(window.juego&&${J}('Titulo')?.scene.isActive())`)) break; } await sl(800); };
const correr = async (s) => { await ev(`(()=>{const P=${J}('Planta');const c=P.celda;if(c.deadlock||c.terminado)return;P.reloj.reanudar();for(let i=0;i<${Math.round(s * 10) + 1}&&!c.deadlock&&!c.terminado;i++){P.reloj.avanzar(0.1);}if(!c.deadlock&&!c.terminado)P.reloj.pausar();})()`); await cuadros(3); };

// Medición: textos visibles de las escenas activas (en píxeles lógicos). Fuera = se sale de 960 x 540.
// Encimados = dos textos visibles de la MISMA escena cuyos rectángulos se cruzan más de 3 px (el de abajo queda tapado).
// Se ignoran los textos de una escena que otra tapa a propósito con un velo (Resultados, Game over, Pausa, Ayuda, Inspector).
const MEDIR = `(() => {
  const juego = window.juego;
  const activas = juego.scene.getScenes(true).filter((s) => s.sys.settings.visible);
  const tapan = ['Ayuda', 'MenuPausa', 'Resultados', 'GameOver', 'Inspector'];
  const orden = juego.scene.scenes;
  const arriba = activas.filter((s) => tapan.includes(s.sys.settings.key) && (s.sys.settings.key !== 'Inspector' || s.abierto));
  const tope = arriba.length ? Math.max(...arriba.map((s) => orden.indexOf(s))) : -1;
  const visibleEn = (o) => { for (let p = o; p; p = p.parentContainer) if (!p.visible || p.alpha === 0) return false; return true; };
  const fuera = []; const encima = [];
  for (const s of activas) {
    if (orden.indexOf(s) < tope) continue; // tapada por un velo a propósito
    // Ventana dentro de la escena (contenedor con un velo de pantalla completa): solo cuenta lo de la ventana de más arriba.
    const ventanas = s.children.list.filter((c) => c.list && c.visible && c.depth >= 10 && c.list.some((o) => o.type === 'Rectangle' && o.width >= 960 && o.height >= 540));
    const raiz = ventanas.length ? [ventanas.sort((a, b) => b.depth - a.depth)[0]] : s.children.list;
    const textos = [];
    const recorrer = (lista) => lista.forEach((o) => { if (o.list) recorrer(o.list); else if (o.type === 'Text' && o.text && o.text.trim() && visibleEn(o)) textos.push(o); });
    recorrer(raiz);
    const cajas = textos.map((o) => { const b = o.getBounds(); return { t: o.text.slice(0, 40).replace(/\\n/g, ' / '), x: b.x, y: b.y, w: b.width, h: b.height, a: o.angle, d: o.depth }; });
    for (const c of cajas) if (c.x < -1 || c.y < -1 || c.x + c.w > 961 || c.y + c.h > 541) fuera.push(s.sys.settings.key + ': «' + c.t + '» ' + [c.x, c.y, c.w, c.h].map(Math.round).join(','));
    for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 3 && iy > 3) encima.push(s.sys.settings.key + ': «' + a.t + '» con «' + b.t + '»');
    }
  }
  return { fuera, encima, escenas: activas.map((s) => s.sys.settings.key) };
})()`;
const revisar = async (nombre) => {
  await cuadros(3);
  const r = await ev(MEDIR);
  if (!r) return ok(`${nombre}: medición`, false);
  ok(`${nombre}: ningún texto se sale de la pantalla`, r.fuera.length === 0, r.fuera.slice(0, 3).join(' | '));
  ok(`${nombre}: ningún texto se encima con otro`, r.encima.length === 0, r.encima.slice(0, 4).join(' | '));
  await foto(nombre);
};

// ================= 960 x 540 =================
await tamano(960, 540);
await abrir('?efectos=0&intro=0');
await revisar('titulo_nombre'); // primera vez: pide el nombre
ok('la primera vez el título pide el nombre', !!(await ev(`!!document.getElementById('campo-nombre')`)));
await ev(`(()=>{const c=document.getElementById('campo-nombre');c.value='Ana';c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
await cuadros(4);
// Unos puntajes para ver la tabla llena.
await ev(`(()=>{const k='robocell-tycoon-2.5d';const g=JSON.parse(localStorage.getItem(k));const n=['Ana','Luis','Bea','Carlos','Dani','Eva','Fer','Gabi','Hugo','Inés','Juan'];g.puntajes=n.map((x,i)=>({id:'d'+i,nombre:x,puntaje:2400-i*170,turno:1+(i%3),fecha:new Date(2026,10,1+i).toISOString()}));localStorage.setItem(k,JSON.stringify(g));})()`);
await abrir('?efectos=0&intro=0');
await revisar('titulo');
ok('el título muestra «Jugador: Ana · Cambiar jugador»', (await ev(`${J}('Titulo').txtJugador.text`)) === 'Jugador: Ana' && (await ev(`${J}('Titulo').botonCambiar.text`)) === 'Cambiar jugador');
await ev(`${J}('Titulo')._verLogros(true)`); await revisar('titulo_logros');
await ev(`import('/src/sed/logros.js').then(m=>${J}('Titulo')._abrirFicha(m.LOGROS[5]))`); await revisar('ficha_logro');
await ev(`${J}('Titulo')._modal?.cerrar()`); await ev(`${J}('Titulo')._verLogros(false)`);
await ev(`${J}('Titulo').botonBorrar.emit('pointerup')`); await revisar('borrar_puntajes');
await ev(`${J}('Titulo')._modal?.cerrar()`);
await ev(`${J}('Titulo')._controles(true)`); await revisar('titulo_controles');
await ev(`${J}('Titulo')._controles(false)`);

// Planta (sin tutorial).
await ev(`${J}('Titulo')._iniciar(false)`);
for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('HUDGeneral').scene.isActive()`)) break; }
await sl(3500); await ev(`${J}('Planta').reloj.pausar()`);
await revisar('planta');
// Tooltip de 2 líneas sobre un botón gris (con el mouse).
await ev(`${J}('HUDGeneral').controles.abrir.rect.emit('pointerover', {wasTouch:false})`); await revisar('tooltip_gris');
await ev(`${J}('HUDGeneral').controles.abrir.rect.emit('pointerout')`);
// Panel de máquina en sus 3 pestañas.
await ev(`${J}('HUDMaquina').abrir('CNC1','CNC 1')`); await revisar('panel_automata');
await ev(`${J}('HUDMaquina').alternarPestana()`); await revisar('panel_acciones');
await ev(`${J}('HUDMaquina')._cambiarPestana('composicion')`); await revisar('panel_composicion');
await ev(`${J}('HUDMaquina').cerrar()`);
await ev(`${J}('HUDMaquina').abrir('BRAZO','Brazo')`); await revisar('panel_brazo');
await ev(`${J}('HUDMaquina').cerrar()`);
// Rojo: pinza abierta dentro de la CNC 1 con un bloque.
await ev(`(()=>{const P=${J}('Planta');P.pulsarControl('ir1');})()`); await correr(2.2);
await ev(`(()=>{const P=${J}('Planta');P.pulsarControl('abrir');P.pulsarControl('meter');})()`); await cuadros(3);
await ev(`${J}('HUDGeneral').controles.fresar1.rect.emit('pointerover', {wasTouch:false})`); await revisar('tooltip_rojo');
ok('tooltip rojo: 2 líneas (simple y formal)', /^No puedes fresar: la pinza está abierta dentro de la CNC 1\.\n¬\(CNC = Fresando ∧ Brazo = Mandril_Abierto\)/.test(await ev(`${J}('HUDGeneral').tip.text`)));
await ev(`${J}('HUDGeneral').controles.fresar1.rect.emit('pointerout')`);
// Inspector: 3 pestañas, con Probar disparo de una transición no habilitada.
await ev(`${J}('Inspector').abrir()`); await ev(`(()=>{const i=${J}('Inspector');i.seleccion='t2b';i.probar=true;i._reconstruir();})()`);
await revisar('inspector');
ok('con el Inspector abierto la barra, las fichas y el HUD no se ven', !(await ev(`${J}('HUDGeneral').sys.settings.visible`)));
await ev(`${J}('Inspector')._cambiarPestana('arbol')`); await revisar('inspector_arbol');
await ev(`${J}('Inspector')._cambiarPestana('logros')`); await revisar('inspector_logros');
await ev(`${J}('Inspector')._cambiarPestana('matrices')`); await ev(`${J}('Inspector').cerrar()`);
ok('al cerrar el Inspector vuelve el HUD', await ev(`${J}('HUDGeneral').sys.settings.visible`));
// Pausa y ayuda.
await ev(`${J}('Planta').scene.launch('MenuPausa')`); await sl(600); await revisar('pausa');
await ev(`${J}('MenuPausa').cerrar()`); await cuadros(2);
await ev(`${J}('Planta').scene.launch('Ayuda', {})`); await sl(600); await revisar('ayuda');
await ev(`${J}('Ayuda')._mostrar('controles')`); await revisar('ayuda_controles');
await ev(`${J}('Ayuda').cerrar()`); await cuadros(2);
// Game over: los dos AGV a la vez (interbloqueo).
await ev(`(()=>{const P=${J}('Planta');P.pulsarControl('cerrar');})()`); await correr(1);
await ev(`(()=>{const P=${J}('Planta');P.pulsarControl('agv1');P.pulsarControl('agv2');})()`); await correr(6);
for (let i = 0; i < 20 && !(await ev(`${J}('GameOver').scene.isActive()`)); i++) await sl(400);
await sl(800); await revisar('game_over');
await ev(`${J}('GameOver')._reintentar(false)`); await cuadros(3);
// Resultados (se acaba el tiempo).
await correr(200);
for (let i = 0; i < 30 && !(await ev(`${J}('Resultados').scene.isActive()`)); i++) await sl(400);
await sl(1800); await revisar('resultados');
await ev(`(()=>{const r=${J}('Resultados');const z=r.children.list.find(o=>o.type==='Rectangle'&&o.input&&o.width===286);z.emit('pointerup');})()`); await revisar('resultados_ficha');

// Con el tutorial.
await abrir('?efectos=0&intro=0');
await ev(`${J}('Titulo')._iniciar(true)`);
for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('Tutorial').scene.isActive()`)) break; }
await sl(3200); await ev(`${J}('Planta').reloj.pausar()`);
await revisar('tutorial_planta');
await ev(`${J}('HUDMaquina').abrir('CNC1','CNC 1')`); await revisar('tutorial_panel');
await ev(`${J}('HUDMaquina').cerrar()`);
await ev(`${J}('Inspector').abrir()`); await revisar('tutorial_inspector');
ok('con el tutorial, el Inspector oculta la caja y la flecha', !(await ev(`${J}('Tutorial').sys.settings.visible`)) && (await ev(`${J}('Inspector').lineaTutorial.visible`)));
await ev(`${J}('Inspector').cerrar()`);
ok('al cerrar el Inspector vuelve la caja del tutorial', await ev(`${J}('Tutorial').sys.settings.visible`));
await ev(`${J}('Planta').scene.launch('MenuPausa')`); await sl(600); await revisar('tutorial_pausa');
await ev(`${J}('MenuPausa').cerrar()`);

// ================= Celular =================
await tamano(844, 390, true);
await abrir('?efectos=0&intro=0');
await revisar('movil_844x390_titulo');
await ev(`${J}('Titulo')._iniciar(false)`);
for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('HUDGeneral').scene.isActive()`)) break; }
await sl(3500); await ev(`${J}('Planta').reloj.pausar()`);
await revisar('movil_844x390_planta');
// Mantener presionado 0,5 s un botón gris muestra su tooltip.
await ev(`${J}('HUDGeneral').controles.abrir.rect.emit('pointerdown', {wasTouch:true})`);
for (let i = 0; i < 40 && !(await ev(`${J}('HUDGeneral').tip.visible`)); i++) await sl(250); // el reloj de la escena va a pocos cuadros por segundo
ok('táctil: mantener 0,5 s muestra el tooltip de 2 líneas', ((await ev(`${J}('HUDGeneral').tip.visible && ${J}('HUDGeneral').tip.text`)) || '').split('\n').length === 2);
await revisar('movil_844x390_tooltip');
const n0 = await ev(`${J}('Planta').celda.bitacora.length`);
await ev(`${J}('HUDGeneral').controles.abrir.rect.emit('pointerup', {wasTouch:true})`); await cuadros(2);
ok('táctil: al soltar tras mantener no se pulsa el botón', (await ev(`${J}('Planta').celda.bitacora.length`)) === n0);
await ev(`${J}('HUDMaquina').abrir('CNC2','CNC 2')`); await revisar('movil_844x390_panel');
await ev(`${J}('HUDMaquina').cerrar()`);
await ev(`${J}('Inspector').abrir()`); await revisar('movil_844x390_inspector');
await ev(`${J}('Inspector').cerrar()`);
await tamano(360, 640, true);
await abrir('?efectos=0&intro=0');
ok('360 x 640 (vertical): se pide girar el teléfono', await ev(`getComputedStyle(document.getElementById('girar')).display !== 'none'`));
await foto('movil_360x640_girar');

console.log('errores de página:', errs.length); errs.slice(0, 5).forEach((e) => console.log('  ', e));
fs.writeFileSync('docs/capturas/final_revision.txt', filas.join('\n') + `\nerrores de página: ${errs.length}\n`);
edge.kill();
process.exit(filas.some((f) => f.startsWith('FALLA')) || errs.length ? 1 : 0);
