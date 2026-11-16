// Prueba de azar en el navegador sin ventana (Edge + protocolo CDP): clics y teclas al azar durante la partida.
// Uso: node scripts/azar-navegador.mjs <modo: juego|tutorial> <segundos> <velocidad: 1|2|4> [ancho] [alto] [puerto web]
// Informa de errores de consola, excepciones, interfaz sin respuesta y escenas atascadas.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [modo = 'juego', segundos = '60', velocidad = '4', ancho = '1280', alto = '720', web = '5199'] = process.argv.slice(2);
const PUERTO = 9400 + Math.floor(Math.random() * 400);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'azar-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--window-size=${ancho},${alto}`, '--enable-unsafe-swiftshader', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--use-angle=swiftshader', `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
const fin = (codigo) => {
  try { ws?.close(); } catch { /* nada */ }
  edge.kill();
  process.exit(codigo);
};
setTimeout(() => { console.log('TIEMPO AGOTADO'); fin(2); }, (Number(segundos) + 420) * 1000);

await dormir(3000);
const pestanas = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
ws = new WebSocket(pestanas.find((t) => t.type === 'page').webSocketDebuggerUrl);
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
  if (m.method === 'Runtime.exceptionThrown' && !contextosAjenos.has(m.params.exceptionDetails.executionContextId) && !JSON.stringify(m.params.exceptionDetails).includes('chrome-extension')) { const d = m.params.exceptionDetails; errores.push('EXCEPCION: ' + (d.exception?.description ?? d.text) + ' | pila: ' + (d.stackTrace?.callFrames ?? []).map((f) => `${f.functionName || '?'}@${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`).join(' < ')); }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(m.params.type)) errores.push('CONSOLA: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !m.params.entry.text.includes('runtime.lastError')) errores.push('LOG: ' + m.params.entry.text + ' ' + (m.params.entry.url ?? ''));
};
let ultimaAccion = 'ninguna';
const historia = [];
let sinConfirmar = 0; // eventos de entrada cuya confirmación no llegó (en Edge sin GPU puede perderse; no es un fallo del juego)
const crudo = (method, params, ms) =>
  Promise.race([
    new Promise((r) => { pend[++n] = r; ws.send(JSON.stringify({ id: n, method, params })); }),
    new Promise((r) => setTimeout(() => r('__TIEMPO__'), ms)),
  ]);
const enviar = async (method, params = {}) => {
  const entrada = method.startsWith('Input.');
  const r = await crudo(method, params, entrada ? 6000 : 30000);
  if (r !== '__TIEMPO__') return r;
  if (entrada) {
    // ¿La página sigue viva? Si responde a una evaluación, solo se perdió la confirmación del evento.
    const v = await crudo('Runtime.evaluate', { expression: 'performance.now()', returnByValue: true }, 20000);
    if (v !== '__TIEMPO__') { sinConfirmar++; return {}; }
  }
  console.log(`PÁGINA SIN RESPUESTA (${method}) tras: ${ultimaAccion}`);
  console.log('últimas acciones:', historia.slice(-12).join(' ; '));
  console.log('errores hasta ahora', errores.length, [...new Set(errores)].slice(0, 20).join(' | ').slice(0, 3000));
  fin(3);
  return {};
};
const ev = async (x) => (await enviar('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;
await enviar('Runtime.enable');
await enviar('Log.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: Number(ancho), height: Number(alto), deviceScaleFactor: 1, mobile: false });
await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await enviar('Page.bringToFront');
await enviar('Page.navigate', { url: `http://localhost:${web}/${process.env.AZAR_EFECTOS === '1' ? '' : '?efectos=0'}` });
await dormir(10000);

const escala = Math.min(Number(ancho) / 960, Number(alto) / 540);
const ox = (Number(ancho) - 960 * escala) / 2;
const oy = (Number(alto) - 540 * escala) / 2;
const aPantalla = (x, y) => [ox + x * escala, oy + y * escala];
const clic = async (x, y) => {
  const [px, py] = aPantalla(x, y);
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await enviar('Input.dispatchMouseEvent', { type: t, x: px, y: py, button: 'left', clickCount: 1 });
};
const VK = (code) => (/^Key[A-Z]$/.test(code) ? code.charCodeAt(3) : /^Digit\d$/.test(code) ? 48 + Number(code[5]) : { Escape: 27, Enter: 13, Backspace: 8, F1: 112, Slash: 191 }[code] ?? 0);
const tecla = async (k, code) => {
  for (const t of ['keyDown', 'keyUp']) await enviar('Input.dispatchKeyEvent', { type: t, key: k, code, windowsVirtualKeyCode: VK(code), text: t === 'keyDown' && k.length === 1 ? k : undefined });
};
const TECLAS = [['p', 'KeyP'], ['Escape', 'Escape'], ['Escape', 'Escape'], ['i', 'KeyI'], ['r', 'KeyR'], ['m', 'KeyM'], ['1', 'Digit1'], ['2', 'Digit2'], ['4', 'Digit4'], ['Escape', 'Escape'], ['h', 'KeyH'], ['c', 'KeyC'], ['t', 'KeyT'], ['Enter', 'Enter'], ['Backspace', 'Backspace'], ['F1', 'F1'], ['?', 'Slash'], ['f', 'KeyF']];
const SIN_PAUSA = process.env.AZAR_SIN_PAUSA === '1';
let semilla = 12345;
const azar = () => ((semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296);

const estado = () =>
  ev(`(()=>{const j=window.juego;const P=j.scene.getScene('Planta');const c=P&&P.celda;return JSON.stringify({escenas:j.scene.scenes.filter(s=>s.scene.isActive()).map(s=>s.scene.key),t:c?c.reloj.ahora:null,pausa:c?c.reloj.enPausa:null,dl:c?c.deadlock:null,fin:c?c.terminado:null,turno:P&&P.partida?P.partida.turno:null,puntaje:c?c.puntaje:null,vel:c?c.reloj.velocidad:null,tutorial:P&&P.partida?P.partida.tutorial:null})})()`).then((s) => JSON.parse(s));

if (modo === 'tutorial') await clic(480, 400);
else await clic(284, 400);
await dormir(5000);
console.log('inicio', JSON.stringify(await estado()));
await tecla(velocidad, 'Digit' + velocidad);
// Modo tutorial: primero se recorren los pasos guiados con la API del núcleo (los mismos eventos que dispararían los botones).
const atascosGuion = [];
let tutorialCompleto = null;
if (modo === 'tutorial') {
  const P = "window.juego.scene.getScene('Planta')";
  const sol = (m, e, o) => ev(`JSON.stringify(${P}.celda.solicitar('${m}','${e}',${JSON.stringify(o ?? {})}))`);
  const esperar = async (segSim) => { const t = await ev(`${P}.reloj.ahora`); await ev(`${P}.reloj.cambiarVelocidad(4)`); let esp = 0; while ((await ev(`${P}.reloj.ahora`)) < t + segSim) { await dormir(200); if (++esp === 40) console.log('  ESPERA LARGA', await ev(`JSON.stringify({pausa:${P}.reloj.enPausa,vel:${P}.reloj.velocidad,ahora:${P}.reloj.ahora,fps:window.juego.loop.actualFps,oculto:document.hidden,vis:document.visibilityState,escenas:window.juego.scene.scenes.filter(s=>s.scene.isActive()).map(s=>s.scene.key)})`)); } };
  const paso = async () => ev(`${P}.scene.get('Tutorial').guia.paso.id`);
  await ev(`${P}.reloj.cambiarVelocidad(4)`);
  await clic(480, 220); await dormir(800); // el primer paso: abrir el HUD de la CNC 1
  const pasos = [];
  for (const [m, e, o, espera] of [['BRAZO', 'mover', { objetivo: 'CNC1' }, 3], ['BRAZO', 'abrir_mandril', {}, 0], ['CNC1', 'cargar', {}, 0], ['BRAZO', 'cerrar_mandril', {}, 5], ['CNC1', 'iniciar_fresado', {}, 11],
    ['BRAZO', 'mover', { objetivo: 'CNC1' }, 3], ['BRAZO', 'abrir_mandril', {}, 0], ['CNC1', 'descargar', {}, 0], ['AGV1', 'reservar', {}, 11], ['AGV1', 'reservar', {}, 0], ['AGV2', 'reservar', {}, 0]]) {
    const r = await sol(m, e, o);
    pasos.push(`${m}.${e}:${JSON.parse(r).ok}`);
    console.log('  paso', m, e, r.slice(0, 80), 't =', await ev(`${P}.reloj.ahora`));
    await dormir(400);
    if (espera) await esperar(espera);
    await dormir(300);
  }
  for (let i = 0; i < 40 && (await paso()) !== 'fin'; i++) await dormir(500); // con pocos fps la guía tarda en leer la bitácora
  tutorialCompleto = { pasos: pasos.join(' '), pasoFinal: await paso(), deadlock: await ev(`${P}.celda.deadlock`), vistaRed: await ev(`${P}.vistaRed.activa`) };
  console.log('tutorial guiado:', JSON.stringify(tutorialCompleto));
  if (tutorialCompleto.pasoFinal !== 'fin') atascosGuion.push(`El tutorial no llegó al último paso: ${tutorialCompleto.pasoFinal}`);
}

// Modo flujos: recorre a mano, con clics y teclas reales, el game over, el menú de pausa, la ayuda y el regreso al título.
if (modo === 'flujos') {
  const P = "window.juego.scene.getScene('Planta')";
  const activa = (k) => ev(`window.juego.scene.getScene('${k}').scene.isActive()`);
  const fallos = [];
  const comprobar = (nombre, ok, dato = '') => { console.log(`  ${ok ? 'ok ' : 'FALLA'} ${nombre} ${dato}`); if (!ok) fallos.push(nombre); };
  const deadlock = async () => {
    await ev(`${P}.celda.solicitar('AGV1','reservar')`);
    await ev(`${P}.celda.solicitar('AGV2','reservar')`);
    await dormir(1500);
  };
  await ev(`${P}.reloj.cambiarVelocidad(1)`);
  // 1) Game over y reintento desde el último verde.
  await deadlock();
  comprobar('el deadlock abre GameOver', await activa('GameOver'));
  await clic(341, 390); await dormir(1200);
  comprobar('reintentar desde el verde cierra GameOver y reanuda', !(await activa('GameOver')) && !(await ev(`${P}.celda.deadlock`)) && !(await ev(`${P}.reloj.enPausa`)));
  // 2) Game over y compra del Controlador.
  await deadlock();
  comprobar('segundo deadlock abre GameOver', await activa('GameOver'));
  await clic(611, 390); await dormir(1200);
  comprobar('reintentar y comprar el Controlador', !(await activa('GameOver')) && !(await ev(`${P}.celda.deadlock`)) && (await ev(`!!${P}.celda.controlador`)));
  // 3) Menú de pausa.
  await tecla('p', 'KeyP'); await dormir(900);
  comprobar('P abre el menú y pausa', (await activa('MenuPausa')) && (await ev(`${P}.reloj.enPausa`)));
  await clic(480, 157); await dormir(900);
  comprobar('Continuar cierra el menú y reanuda', !(await activa('MenuPausa')) && !(await ev(`${P}.reloj.enPausa`)));
  await tecla('p', 'KeyP'); await dormir(700); await tecla('p', 'KeyP'); await dormir(700);
  comprobar('P dos veces abre y cierra el menú', !(await activa('MenuPausa')) && !(await ev(`${P}.reloj.enPausa`)));
  // 4) Ayuda desde el menú.
  await tecla('p', 'KeyP'); await dormir(700);
  await clic(480, 265); await dormir(900);
  comprobar('Ayuda se abre desde el menú', (await activa('Ayuda')) && (await activa('MenuPausa')));
  await tecla('Escape', 'Escape'); await dormir(700);
  comprobar('Esc cierra solo la ayuda y el reloj sigue en pausa', !(await activa('Ayuda')) && (await activa('MenuPausa')) && (await ev(`${P}.reloj.enPausa`)));
  // 5) Sonido.
  const antes = await ev(`${P}.sonidos.silenciado`);
  await clic(480, 319); await dormir(500);
  comprobar('Silenciar sonido alterna', (await ev(`${P}.sonidos.silenciado`)) !== antes);
  await clic(480, 319); await dormir(300);
  // 6) Reiniciar turno.
  await ev(`${P}.celda.reloj.avanzar(5)`);
  await clic(480, 211); await dormir(3000);
  comprobar('Reiniciar turno empieza de nuevo (reloj casi en 0, sin menú)', (await ev(`${P}.celda.reloj.ahora`)) < 10 && !(await activa('MenuPausa')) && (await activa('Planta')));
  // 7) Ayuda con ? durante la partida.
  await tecla('?', 'Slash'); await dormir(800);
  comprobar('? abre la ayuda y pausa', (await activa('Ayuda')) && (await ev(`${P}.reloj.enPausa`)));
  await tecla('?', 'Slash'); await dormir(800);
  comprobar('? otra vez la cierra y reanuda', !(await activa('Ayuda')) && !(await ev(`${P}.reloj.enPausa`)));
  // 8) F1.
  await tecla('F1', 'F1'); await dormir(400);
  const vis1 = await ev("window.juego.scene.getScene('HUDGeneral').txtFps.visible");
  await tecla('F1', 'F1'); await dormir(400);
  const vis2 = await ev("window.juego.scene.getScene('HUDGeneral').txtFps.visible");
  comprobar('F1 muestra y oculta los fps', vis1 === true && vis2 === false);
  // 9) Volver al título y empezar otra vez.
  await tecla('p', 'KeyP'); await dormir(700);
  await clic(480, 373);
  for (let i = 0; i < 30 && !(await activa('Titulo')); i++) await dormir(500);
  await dormir(2500);
  comprobar('Volver al título', (await activa('Titulo')) && !(await activa('Planta')) && !(await activa('HUDGeneral')));
  await clic(284, 400); await dormir(5000);
  comprobar('Jugar otra vez desde el título', (await activa('Planta')) && (await activa('HUDGeneral')) && !(await activa('MenuPausa')), await ev("window.juego.scene.scenes.filter(s=>s.scene.isActive()).map(s=>s.scene.key).join()"));
  // 10) Guardado.
  const g = await ev("localStorage.getItem('robocell-tycoon-2.5d')");
  console.log('  guardado actual:', g);
  tutorialCompleto = { fallos };
  if (fallos.length) atascosGuion.push(`Flujos con fallos: ${fallos.join('; ')}`);
}

// Modo galería: capturas de todas las pantallas para revisar a ojo textos cortados o encimados (tmp-capturas/g_*.png).
if (modo === 'galeria') {
  const P = "window.juego.scene.getScene('Planta')";
  const foto = async (n) => { const r = await enviar('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`tmp-capturas/g_${n}.png`, Buffer.from(r.data, 'base64')); };
  await ev("localStorage.setItem('robocell-tycoon-2.5d', JSON.stringify({ mejorPuntaje: 1315, logros: ['primera_pieza', 'manos_seguras'] }))");
  await ev("window.juego.scene.start('Titulo')"); await dormir(2500);
  await foto('titulo');
  await tecla('c', 'KeyC'); await dormir(900); await foto('titulo_controles'); await tecla('Escape', 'Escape'); await dormir(400);
  await clic(284, 400); await dormir(5000);
  await foto('planta_inicio');
  await dormir(3000);
  await tecla('?', 'Slash'); await dormir(900); await foto('ayuda'); await tecla('Escape', 'Escape'); await dormir(500);
  await tecla('p', 'KeyP'); await dormir(900); await foto('menu_pausa'); await tecla('p', 'KeyP'); await dormir(500);
  for (const [id, nombre] of [['CNC1', 'CNC 1'], ['BRAZO', 'Brazo'], ['AGV1', 'AGV 1']]) {
    await ev(`window.juego.scene.getScene('HUDMaquina').abrir('${id}','${nombre}')`); await dormir(1200); await foto('hud_' + id);
    await ev("window.juego.scene.getScene('HUDMaquina').cerrar()"); await dormir(300);
  }
  await tecla('i', 'KeyI'); await dormir(1500); await foto('inspector'); await tecla('i', 'KeyI'); await dormir(500);
  await tecla('r', 'KeyR'); await dormir(1500); await foto('vista_red'); await tecla('r', 'KeyR'); await dormir(500);
  await ev(`${P}.celda.solicitar('AGV1','reservar')`); await dormir(500); await foto('radar_amarillo_alerta');
  await ev(`${P}.celda.solicitar('AGV2','reservar')`); await dormir(1800); await foto('game_over');
  await clic(341, 390); await dormir(1200);
  await ev(`${P}.celda._terminarTurno('victoria')`); await dormir(1800); await foto('resultados');
  atascosGuion.push(...[]);
}
const t0 = Date.now();
let ultimo = await estado();
let ultimoCambio = Date.now();
const atascos = atascosGuion;
let acciones = 0;
const turnosVistos = new Set();
const log = [];
while (modo !== 'flujos' && modo !== 'galeria' && Date.now() - t0 < Number(segundos) * 1000) {
  let r = azar();
  if (process.env.AZAR_SOLO === 'rueda') r = 0.92;
  if (process.env.AZAR_SOLO === 'teclas') r = 0.7;
  ultimaAccion = `acción ${acciones} (r=${r.toFixed(2)})`;
  if (r < 0.62) { const x = azar() * 960, y = azar() * 540; historia.push(`clic(${Math.round(x)},${Math.round(y)})`); await clic(x, y); }
  else if (r < 0.9) {
    let [k, c] = TECLAS[Math.floor(azar() * TECLAS.length)];
    if (SIN_PAUSA && k === 'p') [k, c] = ['i', 'KeyI'];
    ultimaAccion += ` tecla ${k}`;
    historia.push(`tecla ${k}`);
    await tecla(k, c);
  } else if (r < 0.95) {
    const [px, py] = aPantalla(azar() * 960, azar() * 540);
    historia.push(`rueda(${Math.round(px)},${Math.round(py)})`);
    await enviar('Input.dispatchMouseEvent', { type: 'mouseWheel', x: px, y: py, deltaX: 0, deltaY: azar() < 0.5 ? -100 : 100 });
  } else {
    // Botones de las pantallas de resultados, game over y menú de pausa (coordenadas lógicas).
    const OBJETIVOS = [[325, 462], [600, 462], [340, 390], [610, 390], [480, 200], [480, 250], [480, 300], [480, 350], [480, 400]];
    const [x, y] = OBJETIVOS[Math.floor(azar() * OBJETIVOS.length)];
    historia.push(`clic objetivo(${x},${y})`);
    await clic(x, y);
  }
  acciones++;
  // Sin GPU el navegador dibuja ~1 fps: se adelanta el reloj de simulación a mano (la misma función que llama Planta.update).
  if (process.env.AZAR_ACELERAR === '1' && acciones % 3 === 0) await ev("(()=>{const P=window.juego.scene.getScene('Planta');const c=P&&P.celda;if(c&&!c.reloj.enPausa&&!c.deadlock&&!c.terminado)c.reloj.avanzar(3);})()");
  await dormir(120);
  if (acciones % 25 === 0) {
    const e = await estado();
    if (modo !== 'tutorial' && !e.dl && !e.fin) await ev("(()=>{const P=window.juego.scene.getScene('Planta');if(P&&P.piloto&&!P.piloto.activo&&!P.celda.deadlock)P.piloto.activar();})()");
    if (acciones % 100 === 0) console.log('progreso', acciones, JSON.stringify(e));
    turnosVistos.add(`${e.turno}:${e.escenas.join(',')}`);
    const sinAvance = e.t === ultimo.t && !e.pausa && !e.dl && !e.fin;
    if (sinAvance && Date.now() - ultimoCambio > 15000) {
      atascos.push(`SIN AVANCE: ${JSON.stringify(e)}`);
      ultimoCambio = Date.now();
    }
    if (e.t !== ultimo.t) ultimoCambio = Date.now();
    if ((e.pausa || e.dl || e.fin) && Date.now() - ultimoCambio > 40000) {
      atascos.push(`QUIETO (pausa/deadlock/fin): ${JSON.stringify(e)}`);
      ultimoCambio = Date.now();
    }
    ultimo = e;
    log.push(e);
  }
}
const finalEstado = await estado();
console.log('fin', JSON.stringify(finalEstado), 'acciones', acciones);
console.log('escenas/turnos vistos', [...turnosVistos].join(' | '));
console.log('eventos de entrada sin confirmar (entorno):', sinConfirmar);
console.log('atascos', atascos.length);
atascos.forEach((a) => console.log(' ', a));
console.log('errores', errores.length);
[...new Set(errores)].slice(0, 20).forEach((e) => console.log(' ', e.slice(0, 400)));
console.log('fps', await ev('window.juego.loop.actualFps'));
fs.mkdirSync('tmp-capturas', { recursive: true });
fs.writeFileSync(`tmp-capturas/azar-${modo}-${velocidad}.json`, JSON.stringify({ finalEstado, atascos, errores, log }, null, 1));
fin(errores.length || atascos.length ? 1 : 0);
