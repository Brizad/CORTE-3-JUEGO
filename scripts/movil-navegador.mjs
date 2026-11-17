// Prueba en tamaños de celular con Edge sin ventana (CDP): sin desplazamiento de la página, aviso de girar en vertical,
// tamaño real en pantalla de los botones, toques y pellizco. Uso: node scripts/movil-navegador.mjs [puerto web=5199]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const web = process.argv[2] ?? '5199';
const PUERTO = 9800 + Math.floor(Math.random() * 150);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PUERTO}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'movil-'))}`, 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.log('TIEMPO AGOTADO'); edge.kill(); process.exit(2); }, 400000);
await dormir(3000);
const pestanas = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
const ws = new WebSocket(pestanas.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0;
const pend = {};
const errores = [];
const contextosAjenos = new Set(); // contextos de extensiones del navegador (no son del juego)
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.executionContextCreated') {
    const c = m.params.context;
    if (String(c.origin).startsWith('chrome-extension') || c.auxData?.type === 'isolated') contextosAjenos.add(c.id);
  }
  if (m.id && pend[m.id]) pend[m.id](m.result ?? m.error);
  if (m.method === 'Runtime.exceptionThrown' && !contextosAjenos.has(m.params.exceptionDetails.executionContextId) && !JSON.stringify(m.params.exceptionDetails).includes('chrome-extension')) { const d = m.params.exceptionDetails; errores.push((d.exception?.description ?? d.text) + ' | pila: ' + (d.stackTrace?.callFrames ?? []).map((f) => `${f.functionName || '?'}@${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`).join(' < ')); }
};
const enviar = (method, params = {}) => Promise.race([new Promise((r) => { pend[++n] = r; ws.send(JSON.stringify({ id: n, method, params })); }), dormir(20000).then(() => ({}))]);
const ev = async (x) => {
  const r = await enviar('Runtime.evaluate', { expression: x, returnByValue: true });
  if (r.exceptionDetails) console.log('  excepción al evaluar:', r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
await enviar('Runtime.enable');
await enviar('Page.enable');
await enviar('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__err=[];addEventListener("error",function(e){window.__err.push(e.message+" @"+e.filename+":"+e.lineno+":"+e.colno+" "+(e.error&&e.error.stack))});' });
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
const filas = [];
const comprobar = (nombre, ok, dato = '') => { filas.push(`${ok ? 'ok   ' : 'FALLA'} ${nombre} ${dato}`); };

async function tamano(ancho, alto) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: ancho > alto ? 'landscapePrimary' : 'portraitPrimary', angle: 0 } });
  await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await enviar('Page.navigate', { url: `http://localhost:${web}/?efectos=0&intro=0` });
  for (let i = 0; i < 40; i++) { await dormir(1000); if ((await ev("!!(window.juego && window.juego.scene.getScene('Titulo')?.scene.isActive())")) === true) break; }
  await dormir(1500);
}
const toque = async (tipo, puntos) => enviar('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y], id) => ({ x, y, id })) });

// La primera vez el título pide el nombre (GDD 18.21): se deja un jugador guardado para ir directo al título.
await tamano(960, 540);
await ev(`localStorage.setItem('robocell-tycoon-2.5d', JSON.stringify({ version: 2, ultimo: 'Movil', jugadores: { Movil: { mejorPuntaje: 0, logros: {} } }, puntajes: [] }))`);

for (const [ancho, alto] of [[360, 640], [640, 360], [800, 360], [844, 390], [960, 540]]) {
  await tamano(ancho, alto);
  const info = JSON.parse(await ev(`JSON.stringify({
    aviso: getComputedStyle(document.getElementById('girar')).display,
    textoAviso: document.getElementById('girar').textContent,
    scrollV: document.documentElement.scrollHeight - innerHeight, scrollH: document.documentElement.scrollWidth - innerWidth,
    pos: getComputedStyle(document.body).position,
    canvas: (() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)]; })(),
  })`));
  const escala = Math.min(ancho / 960, alto / 540);
  const previos = await ev('JSON.stringify(window.__err||[])');
  if (previos && previos !== '[]') console.log('  errores de ventana antes de', ancho, previos);
  console.log(`--- ${ancho} x ${alto}: aviso=${info.aviso} canvas=${info.canvas} escala=${escala.toFixed(3)} → botón de 44 px lógicos = ${(44 * escala).toFixed(1)} px`);
  comprobar(`${ancho}x${alto} sin desplazamiento de la página`, info.scrollV <= 0 && info.scrollH <= 0, `(vertical ${info.scrollV}, horizontal ${info.scrollH})`);
  comprobar(`${ancho}x${alto} cuerpo fijo`, info.pos === 'fixed');
  if (alto > ancho) { comprobar(`${ancho}x${alto} muestra el aviso «Gira el celular»`, info.aviso === 'flex' && info.textoAviso.includes('Gira el celular')); continue; }
  comprobar(`${ancho}x${alto} no muestra el aviso en horizontal`, info.aviso === 'none');
  comprobar(`${ancho}x${alto} el juego cabe en la pantalla`, info.canvas[0] <= ancho && info.canvas[1] <= alto, `(${info.canvas[0]}x${info.canvas[1]})`);
  comprobar(`${ancho}x${alto} nada del juego queda fuera (HUD arriba y fichas abajo)`, info.canvas[2] >= 0 && info.canvas[3] >= 0 && info.canvas[2] + info.canvas[0] <= ancho + 1 && info.canvas[3] + info.canvas[1] <= alto + 1, `(x ${info.canvas[2]}, y ${info.canvas[3]})`);
  // Toque en "Jugar" (140, 272 lógicos; disposición del título de 18.21) y en la CNC1.
  const aPantalla = (x, y) => [info.canvas[2] + (x / 960) * info.canvas[0], info.canvas[3] + (y / 540) * info.canvas[1]];
  const [jx, jy] = aPantalla(140, 272);
  // Hasta 3 intentos: en Edge sin GPU a veces el primer toque cae mientras el título todavía se acomoda.
  for (let intento = 0; intento < 3 && !(await ev("window.juego.scene.getScene('Planta').scene.isActive()")); intento++) {
    await toque('touchStart', [[jx, jy]]); await toque('touchEnd', []); await dormir(5000);
  }
  comprobar(`${ancho}x${alto} un toque en Jugar abre la planta`, await ev("window.juego.scene.getScene('Planta').scene.isActive()"));
  if (!(await ev("window.juego.scene.getScene('Planta').scene.isActive()"))) { comprobar(`${ancho}x${alto} (se sigue sin la planta)`, false); await ev("window.juego.scene.start('Titulo')"); continue; }
  const pos = JSON.parse(await ev(`(()=>{const p=window.juego.scene.getScene('Planta');const e=p.entidades.find(q=>q.id==='CNC1');const s=e.silueta;const cx=s.reduce((a,q)=>a+q.x,0)/s.length, cy=s.reduce((a,q)=>a+q.y,0)/s.length;const l=p.aPantallaLogica(cx,cy);return JSON.stringify([l.x,l.y])})()`));
  const [cx, cy] = aPantalla(pos[0], pos[1]);
  await toque('touchStart', [[cx, cy]]); await toque('touchEnd', []); await dormir(1500);
  comprobar(`${ancho}x${alto} un toque en la CNC 1 abre su HUD`, (await ev("window.juego.scene.getScene('HUDMaquina').maquinaId")) === 'CNC1');
  await ev("window.juego.scene.getScene('HUDMaquina').cerrar()");
  await dormir(500);
  // Pellizco: dos dedos que se separan acercan la planta.
  const z0 = await ev("window.juego.scene.getScene('Planta').vista.zoom");
  const [mx, my] = aPantalla(480, 300);
  const sep = (info.canvas[0] / 960) * 30;
  await toque('touchStart', [[mx - sep, my], [mx + sep, my]]);
  for (let i = 1; i <= 8; i++) { await toque('touchMove', [[mx - sep - i * 8, my], [mx + sep + i * 8, my]]); await dormir(120); }
  await toque('touchEnd', []); await dormir(500);
  const z1 = await ev("window.juego.scene.getScene('Planta').vista.zoom");
  comprobar(`${ancho}x${alto} el pellizco acerca la planta`, z1 > z0, `(zoom ${Number(z0).toFixed(2)} → ${Number(z1).toFixed(2)})`);
  // Arrastre con un dedo: la vista de la planta se desplaza.
  const v0 = JSON.parse(await ev("JSON.stringify(window.juego.scene.getScene('Planta').vista)"));
  await toque('touchStart', [[mx, my]]);
  for (let i = 1; i <= 8; i++) { await toque('touchMove', [[mx - i * 6, my - i * 3]]); await dormir(100); }
  await toque('touchEnd', []); await dormir(500);
  const v1 = JSON.parse(await ev("JSON.stringify(window.juego.scene.getScene('Planta').vista)"));
  comprobar(`${ancho}x${alto} el arrastre con un dedo mueve la planta`, v1.sx !== v0.sx || v1.sy !== v0.sy, `(sx ${v0.sx.toFixed(1)} → ${v1.sx.toFixed(1)}, sy ${v0.sy.toFixed(1)} → ${v1.sy.toFixed(1)})`);
  // Tamaño de los botones del HUD en pantalla.
  const botones = JSON.parse(await ev(`JSON.stringify((()=>{const h=window.juego.scene.getScene('HUDGeneral');return ['botonPantalla','botonAyuda','botonPausa','botonInspector','botonRed'].map(k=>[k,h[k].rect.width,h[k].rect.height]);})())`));
  for (const [k, w, h] of botones) comprobar(`${ancho}x${alto} ${k}: ${w}x${h} px lógicos = ${(w * escala).toFixed(0)}x${(h * escala).toFixed(0)} px en pantalla`, true);
}
console.log(filas.join('\n'));
console.log('errores de ventana:', await ev('JSON.stringify(window.__err)'));
console.log('errores de página:', errores.length);
errores.slice(0, 2).forEach((e) => console.log(e));
edge.kill();
process.exit(filas.some((f) => f.startsWith('FALLA')) || errores.length ? 1 : 0);
