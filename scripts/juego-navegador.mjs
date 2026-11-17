// Revisión funcional y visual de "Juego más claro e inmersivo" (docs/GDD.md, sección 18.19) con Edge sin ventana (CDP):
// intro, atajos (1, 2, Espacio, Q, W, Tab, V, M), acciones de la CNC y del AGV, consola en Falla, resultados y tutorial.
// Las capturas quedan en tmp-capturas/. Uso: node scripts/juego-navegador.mjs <puerto web>
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const web = process.argv[2]; const P = 9300 + Math.floor(Math.random() * 400);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${P}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1280,720', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'jg-'))}`, 'about:blank'], { stdio: 'ignore' });
const sl = (ms) => new Promise((r) => setTimeout(r, ms)); await sl(3000);
setTimeout(() => { console.log('TIEMPO AGOTADO'); edge.kill(); process.exit(2); }, 420000);
const t = (await (await fetch(`http://127.0.0.1:${P}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let n = 0; const pend = {}; const errs = [];
const ajenos = new Set(); const ctxs = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.executionContextCreated') { const c = m.params.context; ctxs[c.id] = `${c.origin}|${c.name}|${c.auxData?.type}`; if (String(c.origin).startsWith('chrome-extension') || c.auxData?.type === 'isolated') ajenos.add(c.id); } if (m.id && pend[m.id]) pend[m.id](m.result ?? m.error); if (m.method === 'Runtime.exceptionThrown' && !ajenos.has(m.params.exceptionDetails.executionContextId) && !JSON.stringify(m.params).includes('extension')) errs.push((ajenos.has(m.params.exceptionDetails.executionContextId) ? 'AJENO ' : 'PROPIO ') + ctxs[m.params.exceptionDetails.executionContextId] + ' ' + '[tras: ' + ultima.slice(0, 160) + '] ' + (m.params.exceptionDetails.exception?.description ?? '') + ' | ' + JSON.stringify(m.params.exceptionDetails.stackTrace ?? {}).slice(0, 900)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('consola: ' + JSON.stringify(m.params.args).slice(0, 300)); };
const send = (method, params = {}) => Promise.race([new Promise((r) => { pend[++n] = r; ws.send(JSON.stringify({ id: n, method, params })); }), sl(20000).then(() => ({}))]);
let ultima = ''; const ev = async (x) => { ultima = x; const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.log('  excepción al evaluar:', x.slice(0, 80), r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
await send('Runtime.enable'); await send('Page.enable'); await send('Page.addScriptToEvaluateOnNewDocument', { source: `addEventListener('unhandledrejection', function (e) { try { sessionStorage.setItem('rej', (sessionStorage.getItem('rej') || '') + ' ## ' + String(e.reason && e.reason.stack || e.reason)); } catch (_) {} });` }); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const VK = { Digit1: 49, Digit2: 50, Space: 32, KeyQ: 81, KeyW: 87, Tab: 9, KeyM: 77, Escape: 27, KeyH: 72, KeyC: 67, KeyT: 84, KeyR: 82, Enter: 13, KeyV: 86, F1: 112, Slash: 191 };
// Edge sin GPU dibuja a pocos cuadros por segundo: en vez de esperar un tiempo fijo, se esperan cuadros del juego.
const cuadros = async (k = 3) => { const f0 = (await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1; for (let i = 0; i < 100; i++) { await sl(100); if (((await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1) >= f0 + k) return; } };
const tecla = async (key, code) => { for (const tp of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: tp, key, code, windowsVirtualKeyCode: VK[code], text: tp === 'keyDown' && key.length === 1 ? key : undefined }); await cuadros(3); };
fs.mkdirSync('tmp-capturas', { recursive: true });
const foto = async (nombre) => { for (let i = 0; i < 3; i++) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.data) { fs.writeFileSync(`tmp-capturas/j_${nombre}.png`, Buffer.from(s.data, 'base64')); return; } await send('Page.bringToFront'); } console.log('  sin captura:', nombre); };
const J = "window.juego.scene.getScene";
const filas = []; const ok = (nombre, cond, dato = '') => { filas.push(`${cond ? 'ok   ' : 'FALLA'} ${nombre} ${dato}`); console.log(filas.at(-1)); };
const correr = async (s) => { await ev(`(()=>{const P=${J}('Planta');const c=P.celda;if(c.deadlock||c.terminado)return;P.reloj.reanudar();for(let i=0;i<${Math.round(s * 10)}&&!c.deadlock&&!c.terminado;i++){P.reloj.avanzar(0.1);P.acciones.actualizar();}if(!c.deadlock&&!c.terminado)P.reloj.pausar();})()`); await cuadros(3); };
const abrir = async (url) => { await send('Page.navigate', { url: `http://localhost:${web}/${url}` }); for (let i = 0; i < 40; i++) { await sl(1000); if (await ev(`!!(window.juego&&${J}('Titulo').scene.isActive())`)) break; } await sl(800); };
const eventos = (m) => ev(`JSON.stringify(${J}('Planta').acciones.eventosDe('${m}',20).map(h=>h.maquina+'.'+h.evento))`);

// ---- 1. Turno 1 con la intro ----
await abrir('?efectos=0');
await ev("window.juego.scene.getScene('Titulo')._iniciar(false)"); for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('Ayuda').scene.isActive()`)) break; } await sl(1500);
ok('la intro sale antes del turno 1 y pausa el reloj', await ev(`${J}('Ayuda').scene.isActive() && ${J}('Planta').reloj.enPausa`));
await foto('01_intro');
await ev(`${J}('Ayuda')._mostrar('controles')`); await sl(500); await foto('02_controles');
await tecla('Escape', 'Escape'); await sl(600);
ok('Esc cierra la intro y el reloj corre', await ev(`!${J}('Ayuda').scene.isActive() && !${J}('Planta').reloj.enPausa`));
await ev(`${J}('Planta').reloj.pausar()`); // el reloj lo mueve la prueba, para que sea repetible
await foto('03_planta');

// ---- 2. Atajos: 1 elige la CNC 1, Espacio = Cargar bloque ----
await tecla('1', 'Digit1'); await sl(500);
ok('la tecla 1 abre la CNC 1 en la pestaña Acciones', await ev(`(()=>{const h=${J}('HUDMaquina');return h.abierto&&h.maquinaId==='CNC1'&&h._pestana==='acciones'})()`));
ok('el botón grande dice «Cargar bloque»', (await ev(`${J}('HUDMaquina')._accEtiqueta`)) === 'Cargar bloque');
ok('en Acciones no hay botones del brazo ni de eventos', (await ev(`${J}('HUDMaquina').botones.length`)) === 0);
await foto('04_acciones_libre');
await tecla(' ', 'Space'); await sl(300);
await correr(1); await sl(400);
ok('Espacio dispara m (el brazo sale) y el botón dice «El brazo trabaja…»', (await ev(`${J}('Planta').celda.estado('BRAZO')`)) === 'Moviendo' && (await ev(`${J}('HUDMaquina')._accEtiqueta`)) === 'El brazo trabaja…');
await foto('05_brazo_en_camino');
await tecla('2', 'Digit2'); await sl(500);
ok('con el brazo ocupado, la CNC 2 dice «Brazo ocupado»', (await ev(`${J}('HUDMaquina')._accEtiqueta`)) === 'Brazo ocupado');
await foto('06_brazo_ocupado');
await tecla('1', 'Digit1');
await correr(8); await sl(500);
ok('la secuencia dispara m, l, a, c, e, m en orden', (await eventos('CNC1')) === JSON.stringify(['BRAZO.mover', 'BRAZO.llegar', 'BRAZO.abrir_mandril', 'CNC1.cargar', 'BRAZO.cargar', 'BRAZO.cerrar_mandril', 'BRAZO.mover']), await eventos('CNC1'));
ok('cargada: el botón dice «Fresar»', (await ev(`${J}('HUDMaquina')._accEtiqueta`)) === 'Fresar');
await foto('07_cargado');
// ---- 3. Tab: pestaña Autómata ----
await tecla('Tab', 'Tab'); await sl(500);
ok('Tab pasa a la pestaña Autómata con sus botones de evento', await ev(`(()=>{const h=${J}('HUDMaquina');return h._pestana==='automata'&&h.botones.length>=4&&!h._accRect})()`));
await foto('08_automata');
await tecla('Tab', 'Tab'); await sl(400);
await tecla(' ', 'Space'); await sl(300);
await correr(4); await sl(500);
ok('Espacio en «Fresar» inicia el fresado y sale la barra de progreso', (await ev(`${J}('Planta').celda.estado('CNC1')`)) === 'Fresando' && (await ev(`${J}('HUDMaquina')._accRect`)) === null);
await foto('09_fresando');
await correr(6.5); await sl(500);
ok('terminada: «Sacar pieza»', (await ev(`${J}('HUDMaquina')._accEtiqueta`)) === 'Sacar pieza');
await tecla(' ', 'Space'); await correr(8); await sl(600);
ok('«Sacar pieza» descarga por δ y suma la pieza', (await ev(`${J}('Planta').celda.estadisticas.piezas`)) === 1);
await foto('10_pieza');

// ---- 4. AGV: Q y W, tarjetas y textos ----
await correr(25); await sl(400); // llega el primer pedido (25 s)
await foto('11_pedido');
ok('hay un pedido y su tarjeta dice «AGV 1 espera · … s»', /AGV 1 espera · \d+ s/.test(await ev(`${J}('HUDGeneral').tarjetas[0].titulo.text`)), await ev(`${J}('HUDGeneral').tarjetas[0].titulo.text`));
await tecla('q', 'KeyQ'); await sl(300);
ok('Q despacha el AGV 1 (v · reservar)', (await ev(`${J}('Planta').celda.estado('AGV1')`)) === 'Viajando');
await correr(2); await sl(400);
await ev(`${J}('HUDMaquina').abrir('AGV1','AGV 1')`); await sl(500);
await foto('12_agv_en_camino');
await correr(8); await sl(300);
await tecla('q', 'KeyQ'); await correr(3); await tecla('1', 'Digit1'); await tecla(' ', 'Space'); // AGV1 toma la mesa; el brazo (robot) va a la CNC 1
await correr(1.6); await sl(500);
ok('el AGV detenido dice «Espera el robot»', (await ev(`${J}('Planta').estaciones.items.AGV1.aviso.text`)) === 'Espera el robot', await ev(`${J}('Planta').estaciones.items.AGV1.aviso.text`));
await ev(`${J}('HUDMaquina').abrir('AGV1','AGV 1')`); await sl(400);
await foto('13_agv_espera');
await correr(12); await sl(300);

// ---- 5. Falla: consola en Acciones ----
await tecla('1', 'Digit1'); await tecla(' ', 'Space'); await correr(1); await sl(300);
ok('la CNC 1 fresa', (await ev(`${J}('Planta').celda.estado('CNC1')`)) === 'Fresando');
await ev(`${J}('Planta').celda.forzarFalla()`); await cuadros(4);
ok('en Falla, la pestaña Acciones muestra la consola', await ev(`(()=>{const h=${J}('HUDMaquina');return h._modoConsola&&h.capaConsola.visible&&h._pestana==='acciones'})()`));
for (const [k, c] of [['h', 'KeyH'], ['c', 'KeyC'], ['t', 'KeyT'], ['c', 'KeyC'], ['r', 'KeyR']]) await tecla(k, c);
await foto('14_falla_consola');
await tecla('Enter', 'Enter'); await cuadros(3);
ok('H C T C R + Enter repara la CNC (reset por δ)', (await ev(`${J}('Planta').celda.estado('CNC1')`)) !== 'Falla', await ev(`${J}('Planta').celda.estado('CNC1')`));
await foto('15_reparada');

// ---- 6. Silencio, radar y fin del turno ----
// Velocidad con V, resaltado al pasar el mouse y botón del altavoz con el mouse.
const lienzo = JSON.parse(await ev("JSON.stringify((()=>{const r=document.querySelector('canvas').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})())"));
const aPant = (x, y) => [lienzo[0] + (x / 960) * lienzo[2], lienzo[1] + (y / 540) * lienzo[3]];
const raton = async (tipo, x, y) => { const [px, py] = aPant(x, y); await send('Input.dispatchMouseEvent', { type: tipo, x: px, y: py, button: tipo === 'mouseMoved' ? 'none' : 'left', clickCount: tipo === 'mouseMoved' ? 0 : 1 }); await cuadros(3); };
await tecla('v', 'KeyV');
ok('V cambia la velocidad de x1 a x2', (await ev(`${J}('Planta').reloj.velocidad`)) === 2, await ev(`${J}('Planta').reloj.velocidad`));
await tecla('v', 'KeyV'); await tecla('v', 'KeyV');
ok('V dos veces más: x4 y otra vez x1', (await ev(`${J}('Planta').reloj.velocidad`)) === 1);
await raton('mouseMoved', 451, 472); await sl(400);
ok('pasar el mouse por «Despachar AGV1» lo resalta con borde amarillo y cursor de mano', (await ev(`${J}('HUDGeneral').despacho.AGV1.rect.strokeColor`)) === 0xe0b21b && (await ev("document.querySelector('canvas').style.cursor")) === 'pointer', await ev("document.querySelector('canvas').style.cursor"));
await foto('15b_resaltado');
await raton('mouseMoved', 236, 26); await raton('mousePressed', 236, 26); await raton('mouseReleased', 236, 26);
ok('clic en el botón del altavoz silencia', await ev(`${J}('Planta').sonidos.silenciado`));
await raton('mousePressed', 236, 26); await raton('mouseReleased', 236, 26);
ok('otro clic vuelve a activar el sonido', !(await ev(`${J}('Planta').sonidos.silenciado`)));
await raton('mouseMoved', 600, 300);
await tecla('m', 'KeyM'); await sl(300);
ok('M silencia (y el botón del altavoz lo muestra)', await ev(`${J}('Planta').sonidos.silenciado`));
await tecla('m', 'KeyM');
await tecla('Escape', 'Escape');
await correr(100); await sl(700);
await foto('16_ultimos_30s');
await correr(60); await sl(1500);
ok('al acabarse el tiempo salen los resultados con la frase del jefe', await ev(`${J}('Resultados').scene.isActive()`));
await foto('17_resultados');

// ---- 7. Tutorial con los botones nuevos ----
await abrir('?efectos=0');
await ev("window.juego.scene.getScene('Titulo')._iniciar(true)"); for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('Tutorial').scene.isActive()`)) break; } await sl(1500);
ok('el tutorial empieza sin la intro', await ev(`${J}('Tutorial').scene.isActive() && !${J}('Ayuda').scene.isActive()`));
await ev(`${J}('Planta').reloj.pausar()`);
const paso = () => ev(`${J}('Tutorial').guia.paso.id`);
// Las teclas a veces llegan tarde en Edge sin GPU: cada paso se reintenta y se espera hasta 12 s de reloj real.
const llegar = async (id, accion) => { for (let i = 0; i < 12; i++) { if ((await paso()) === id) return true; if (accion && i % 4 === 0) await accion(); await sl(1000); } return (await paso()) === id; };
ok('tutorial: paso «cargar» tras abrir la CNC 1 (tecla 1)', await llegar('cargar', () => tecla('1', 'Digit1')), await paso());
await foto('18_tutorial_cargar');
ok('tutorial: tras «Cargar bloque» (Espacio) pide abrir la pestaña Autómata', await llegar('automata', async () => { if ((await ev(`${J}('Planta').celda.estado('CNC1')`)) === 'Libre' && !(await ev(`!!${J}('Planta').acciones.activa`))) await tecla(' ', 'Space'); await correr(8); }), await paso());
await foto('19_tutorial_automata');
ok('tutorial: paso «fresar» tras Tab', await llegar('fresar', async () => { if ((await ev(`${J}('HUDMaquina')._pestana`)) !== 'automata') await tecla('Tab', 'Tab'); }), await paso());
await foto('20_tutorial_fresar');
ok('tutorial: paso «sacar» tras Fresar (Espacio) y 10 s', await llegar('sacar', async () => { if ((await ev(`${J}('Planta').celda.estado('CNC1')`)) === 'Cargado') await tecla(' ', 'Space'); await correr(10.5); }), await paso());
await foto('21_tutorial_sacar');
ok('tutorial: paso «agv» tras Sacar pieza (Espacio)', await llegar('agv', async () => { if ((await ev(`${J}('Planta').celda.estado('CNC1')`)) === 'Terminado' && !(await ev(`!!${J}('Planta').acciones.activa`))) await tecla(' ', 'Space'); await correr(8); }), await paso());
ok('tutorial: paso «deadlock1» tras despachar el AGV 1 (Q) y su ciclo', await llegar('deadlock1', async () => { if ((await ev(`${J}('Planta').celda.estado('AGV1')`)) === 'Libre' && (await paso()) === 'agv') await tecla('q', 'KeyQ'); await correr(9.5); }), await paso());
ok('tutorial: Q y W provocan el interbloqueo y la guía llega al final', await llegar('fin', async () => { if ((await ev(`${J}('Planta').celda.estado('AGV1')`)) === 'Libre') await tecla('q', 'KeyQ'); if ((await ev(`${J}('Planta').celda.estado('AGV2')`)) === 'Libre') await tecla('w', 'KeyW'); }) && (await ev(`${J}('Planta').celda.deadlock`)), await paso());
await foto('22_tutorial_fin');

// ---- 8. Título: panel de controles ----
await abrir('?efectos=0');
await foto('23_titulo');

console.log(filas.join('\n'));
console.log('rechazos:', await ev("sessionStorage.getItem('rej')"));
console.log('errores de página:', errs.length); errs.slice(0, 4).forEach((e) => console.log(e));
edge.kill(); process.exit(filas.some((f) => f.startsWith('FALLA')) || errs.length ? 1 : 0);
