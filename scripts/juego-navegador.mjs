// Revisión funcional y visual de los controles paso a paso (docs/GDD.md, sección 18.20) con Edge sin ventana (CDP):
// intro y cuenta 3, 2, 1, barra de control (teclas, un evento por pulsación), colores verde/gris/rojo, panel con pestañas,
// Reparar y consola, entregas de metal, resultados con estrellas y tutorial.
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
const VK = { Digit1: 49, Digit2: 50, Digit4: 52, Space: 32, KeyQ: 81, KeyW: 87, KeyZ: 90, KeyX: 88, KeyA: 65, KeyD: 68, KeyE: 69, KeyF: 70, KeyG: 71, KeyV: 86, KeyL: 76, Tab: 9, KeyM: 77, Escape: 27, KeyH: 72, KeyC: 67, KeyT: 84, KeyR: 82, Enter: 13, F1: 112, Slash: 191 };
// Edge sin GPU dibuja a pocos cuadros por segundo: en vez de esperar un tiempo fijo, se esperan cuadros del juego.
const cuadros = async (k = 3) => { const f0 = (await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1; for (let i = 0; i < 100; i++) { await sl(100); if (((await ev('window.juego ? window.juego.loop.frame : -1')) ?? -1) >= f0 + k) return; } };
const tecla = async (key, code) => { for (const tp of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: tp, key, code, windowsVirtualKeyCode: VK[code], text: tp === 'keyDown' && key.length === 1 ? key : undefined }); await cuadros(3); };
fs.mkdirSync('tmp-capturas', { recursive: true });
const foto = async (nombre) => { for (let i = 0; i < 3; i++) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.data) { fs.writeFileSync(`tmp-capturas/j_${nombre}.png`, Buffer.from(s.data, 'base64')); return; } await send('Page.bringToFront'); } console.log('  sin captura:', nombre); };
const J = "window.juego.scene.getScene";
const filas = []; const ok = (nombre, cond, dato = '') => { filas.push(`${cond ? 'ok   ' : 'FALLA'} ${nombre} ${dato}`); console.log(filas.at(-1)); };
const correr = async (s) => { await ev(`(()=>{const P=${J}('Planta');const c=P.celda;if(c.deadlock||c.terminado)return;P.reloj.reanudar();for(let i=0;i<${Math.round(s * 10) + 1}&&!c.deadlock&&!c.terminado;i++){P.reloj.avanzar(0.1);}if(!c.deadlock&&!c.terminado)P.reloj.pausar();})()`); await cuadros(3); };
const abrir = async (url) => { await send('Page.navigate', { url: `http://localhost:${web}/${url}` }); for (let i = 0; i < 40; i++) { await sl(1000); if (await ev(`!!(window.juego&&${J}('Titulo').scene.isActive())`)) break; } await sl(800); };
const color = (id) => ev(`${J}('HUDGeneral').controles['${id}'].rect.fillColor`);
const VERDE = 0x2e9e5b, GRIS = 0x566170, ROJO = 0xd64545;
const cnt = (m) => ev(`${J}('Planta').celda.bitacora.filter(e=>e.tipo==='automata'${m ? `&&e.maquina==='${m}'` : ''}).length`);
const bit = () => ev(`JSON.stringify(${J}('Planta').celda.bitacora.filter(e=>e.tipo==='automata').map(e=>e.maquina+'.'+e.evento))`);
const estado = (m) => ev(`${J}('Planta').celda.estado('${m}')`);

// ---- 1. Intro «Cómo jugar» y cuenta 3, 2, 1, ¡Ya! ----
await abrir('?efectos=0');
await ev(`${J}('Titulo')._iniciar(false)`); for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('Ayuda').scene.isActive()`)) break; } await sl(1500);
ok('la intro sale antes del turno 1 y pausa el reloj', await ev(`${J}('Ayuda').scene.isActive() && ${J}('Planta').reloj.enPausa`));
ok('la intro tiene las líneas con las teclas', await ev(`${J}('Ayuda').paginas.juego.list.filter(o=>o.text&&(o.text.includes('(Z, X)')||o.text.includes('(Q, W)')||o.text.includes('H C T C R'))).length >= 3`));
await foto('01_intro');
await ev(`${J}('Ayuda')._mostrar('controles')`); await cuadros(3); await foto('02_controles');
await tecla('Escape', 'Escape'); await cuadros(3);
ok('Esc cierra la intro; la cuenta 3, 2, 1 mantiene el reloj detenido', await ev(`!${J}('Ayuda').scene.isActive() && ${J}('HUDGeneral').enCuenta && ${J}('Planta').reloj.enPausa`));
await foto('03_cuenta');
await tecla('z', 'KeyZ'); await cuadros(2);
ok('durante la cuenta las teclas no disparan eventos', (await cnt()) === 0);
for (let i = 0; i < 40; i++) { await sl(500); if (!(await ev(`${J}('HUDGeneral').enCuenta`))) break; }
ok('al terminar la cuenta el reloj corre', await ev(`!${J}('HUDGeneral').enCuenta && !${J}('Planta').reloj.enPausa`));
await ev(`${J}('Planta').reloj.pausar()`); // desde aquí el reloj lo mueve la prueba, para que sea repetible
await foto('04_planta');

// ---- 2. Barra de control: colores y rótulos ----
ok('en el reposo: «Ir a CNC» y «Atender AGV» en verde; el resto en gris', (await Promise.all(['ir1', 'ir2', 'agv1', 'agv2'].map(color))).every((c) => c === VERDE) && (await Promise.all(['abrir', 'meter', 'sacar', 'cerrar', 'volver', 'fresar1', 'fresar2'].map(color))).every((c) => c === GRIS));
ok('cada botón muestra su tecla en una esquinita', (await ev(`Object.values(${J}('HUDGeneral').controles).map(b=>b.tecla.text).join('')`)) === 'ZXACDEVFGQW');

// ---- 3. Un botón = un evento ----
await tecla('z', 'KeyZ'); await cuadros(3);
ok('Z dispara UN evento: m · mover (el brazo sale)', (await bit()) === '["BRAZO.mover"]', await bit());
await foto('05_brazo_en_camino');
await correr(2); await cuadros(2);
ok('l · llegar lo dispara el reloj (no hay macros)', (await bit()) === '["BRAZO.mover","BRAZO.llegar"]');
await tecla('a', 'KeyA'); await cuadros(2);
await tecla('c', 'KeyC'); await cuadros(2);
ok('A y C: abrir pinza y meter bloque (c compartido)', (await bit()) === '["BRAZO.mover","BRAZO.llegar","BRAZO.abrir_mandril","CNC1.cargar","BRAZO.cargar"]', await bit());
ok('con la pinza abierta, «Fresar» de la CNC 1 está en ROJO', (await color('fresar1')) === ROJO);
await foto('06_fresar_rojo');
const p0 = await ev(`${J}('Planta').celda.puntaje`);
await tecla('f', 'KeyF'); await cuadros(2);
ok('intentar el rojo resta 15 y no cambia el estado', (await ev(`${J}('Planta').celda.puntaje`)) === p0 - 15 && (await estado('CNC1')) === 'Cargado');
await tecla('e', 'KeyE'); await cuadros(2);
await tecla('f', 'KeyF'); await cuadros(3);
ok('E cierra (y el brazo vuelve solo) y F fresa', (await estado('CNC1')) === 'Fresando' && (await estado('BRAZO')) === 'Reposo');
await correr(3); await cuadros(2);
await foto('07_fresando');
ok('«Fresar» de la CNC 1 queda gris con «Fresando»', (await color('fresar1')) === GRIS && (await ev(`${J}('HUDGeneral').controles.fresar1.texto.text`)).includes('Fresando'));

// ---- 4. Panel de máquina: pestañas ----
await ev(`${J}('HUDMaquina').abrir('CNC1','CNC 1')`); await cuadros(3);
ok('el panel abre en la pestaña «Autómata» con el grafo y sus botones', await ev(`(()=>{const h=${J}('HUDMaquina');return h.abierto&&h._pestana==='automata'&&h.botones.length>=1})()`));
ok('el panel de la CNC no tiene botones del brazo', await ev(`${J}('HUDMaquina').botones.every(b=>!/mover|abrir|cerrar|volver/.test(b.d.etiqueta))`), await ev(`JSON.stringify(${J}('HUDMaquina').botones.map(b=>b.d.etiqueta))`));
await foto('08_panel_automata');
await tecla('Tab', 'Tab'); await cuadros(3);
ok('Tab pasa a «Acciones» con 3 botones: Meter bloque, Fresar y Sacar pieza', (await ev(`(()=>{const h=${J}('HUDMaquina');return h._pestana==='acciones'&&h.botonesAcc.map(b=>b.d.verbo).join()})()`)) === 'Meter bloque,Fresar,Sacar pieza');
await foto('09_panel_acciones');
await tecla('Tab', 'Tab'); await cuadros(2);
ok('Tab otra vez vuelve a «Autómata»', (await ev(`${J}('HUDMaquina')._pestana`)) === 'automata');
await ev(`${J}('HUDMaquina').cerrar()`);

// ---- 5. Pieza, falla y consola ----
await correr(8); await cuadros(2);
ok('la CNC 1 terminó de fresar', (await estado('CNC1')) === 'Terminado');
for (const [k, c] of [['z', 'KeyZ'], ['a', 'KeyA'], ['d', 'KeyD']]) { await tecla(k, c); if (k === 'z') await correr(2); await cuadros(2); }
ok('Z, A, D: sacar la pieza (d compartido) suma una pieza', (await estado('CNC1')) === 'Libre' && (await ev(`${J}('Planta').celda.estadisticas.piezas`)) === 1, await bit());
await foto('10_pieza');
await tecla('x', 'KeyX'); await correr(2); await tecla('a', 'KeyA'); await tecla('c', 'KeyC'); await tecla('e', 'KeyE'); await tecla('g', 'KeyG'); await cuadros(3);
ok('X A C E G: la CNC 2 fresa', (await estado('CNC2')) === 'Fresando');
await ev(`${J}('Planta').celda.forzarFalla()`); await cuadros(4);
ok('en Falla el botón dice «Reparar»', (await ev(`${J}('HUDGeneral').controles.fresar2.texto.text`)).includes('Reparar'));
await foto('11_reparar');
const n0 = await cnt();
await tecla('g', 'KeyG'); await cuadros(4);
ok('«Reparar» (G) abre el panel con la consola y no dispara ningún evento', (await ev(`(()=>{const h=${J}('HUDMaquina');return h.abierto&&h.maquinaId==='CNC2'&&h.consolaAbierta})()`)) && (await cnt()) === n0);
for (const [k, c] of [['h', 'KeyH'], ['c', 'KeyC'], ['t', 'KeyT'], ['c', 'KeyC'], ['r', 'KeyR']]) await tecla(k, c);
ok('con la consola abierta, la C es un símbolo (no «Meter bloque») y la R no abre la red', (await ev(`${J}('HUDMaquina').consola.palabra`)) === 'HCTCR' && !(await ev(`${J}('Planta').vistaRed.activa`)));
await foto('12_consola');
await tecla('Enter', 'Enter'); await cuadros(3);
ok('H C T C R + Enter repara la CNC 2', (await estado('CNC2')) === 'Libre');
await ev(`${J}('HUDMaquina').cerrar()`);

// ---- 6. Entregas de metal ----
await correr(30); await cuadros(3);
const tarjeta = await ev(`${J}('HUDGeneral').tarjetas[0].titulo.text`);
ok('la tarjeta dice «AGV 1 trae metal · N s» (sin la palabra pedido)', /^AGV 1 trae metal · \d+ s$/.test(tarjeta), tarjeta);
await foto('13_entrega');
await tecla('q', 'KeyQ'); await cuadros(3);
ok('Q atiende el AGV 1 (v · reservar)', (await estado('AGV1')) === 'Viajando');
await correr(2); await cuadros(2);
await foto('14_agv_con_caja');
await correr(2.2); await cuadros(2);
ok('al llegar, el AGV espera o descarga con la mesa y el robot', ['Esperando', 'Descargando'].includes(await estado('AGV1')));
await correr(2); await cuadros(2);
await foto('15_descarga_caja_en_mesa');
await correr(6); await cuadros(2);

// ---- 7. Velocidad, silencio y fin del turno ----
await tecla('4', 'Digit4'); await cuadros(2);
ok('las teclas 1, 2 y 4 son solo velocidad (4 = x4)', (await ev(`${J}('Planta').reloj.velocidad`)) === 4);
await tecla('1', 'Digit1');
await tecla('m', 'KeyM'); await cuadros(2);
ok('M silencia', await ev(`${J}('Planta').sonidos.silenciado`));
await tecla('m', 'KeyM');
await correr(85); await cuadros(3);
await foto('16_ultimos_30s');
await correr(60); await cuadros(4);
for (let i = 0; i < 30 && !(await ev(`${J}('Resultados').scene.isActive()`)); i++) await sl(500);
ok('al acabarse el tiempo salen los resultados con estrellas y la frase del jefe', await ev(`${J}('Resultados').scene.isActive()`));
await sl(1800);
await foto('17_resultados');

// ---- 8. Tutorial: un botón por paso ----
await abrir('?efectos=0');
await ev(`${J}('Titulo')._iniciar(true)`); for (let i = 0; i < 40; i++) { await sl(500); if (await ev(`${J}('Planta').scene.isActive() && ${J}('Tutorial').scene.isActive()`)) break; } await sl(1500);
await ev(`${J}('Planta').reloj.pausar()`);
const paso = () => ev(`${J}('Tutorial').guia.paso.id`);
const llegar = async (id, accion) => { for (let i = 0; i < 14; i++) { if ((await paso()) === id) return true; if (accion && i % 4 === 0) await accion(); await sl(700); } return (await paso()) === id; };
ok('tutorial: sin intro ni cuenta, primer paso «ir»', (await paso()) === 'ir' && !(await ev(`${J}('Ayuda').scene.isActive()`)));
await foto('18_tutorial_ir');
const pulsa = (k, c, seg = 0) => async () => { await tecla(k, c); if (seg) await correr(seg); await cuadros(2); };
ok('tutorial: Z → llegar', await llegar('llegar', pulsa('z', 'KeyZ')));
await correr(2);
ok('tutorial: A → meter', await llegar('meter', pulsa('a', 'KeyA')));
ok('tutorial: C → cerrar', await llegar('cerrar', pulsa('c', 'KeyC')));
ok('tutorial: E → fresar', await llegar('fresar', pulsa('e', 'KeyE')));
ok('tutorial: F → panel', await llegar('panel', pulsa('f', 'KeyF')));
await foto('19_tutorial_panel');
ok('tutorial: abrir el panel → esperar', await llegar('esperar', async () => { await ev(`${J}('HUDMaquina').abrir('CNC1','CNC 1')`); await cuadros(2); }));
await ev(`${J}('HUDMaquina').cerrar()`);
ok('tutorial: tras fresar, «ir» otra vez', await llegar('ir2', async () => { await correr(10.5); }));
ok('tutorial: Z → abrir2', await llegar('abrir2', pulsa('z', 'KeyZ', 2)));
ok('tutorial: A → sacar', await llegar('sacar', pulsa('a', 'KeyA')));
ok('tutorial: D → agv', await llegar('agv', pulsa('d', 'KeyD')));
ok('tutorial: Q → ciclo', await llegar('ciclo', pulsa('q', 'KeyQ')));
ok('tutorial: tras el ciclo → deadlock1', await llegar('deadlock1', async () => { await correr(9.5); }));
ok('tutorial: Q → deadlock2', await llegar('deadlock2', pulsa('q', 'KeyQ')));
ok('tutorial: W traba la celda y llega al final', (await llegar('fin', pulsa('w', 'KeyW'))) && (await ev(`${J}('Planta').celda.deadlock`)));
await foto('20_tutorial_fin');

console.log('rechazos:', await ev("sessionStorage.getItem('rej')"));
console.log('errores de página:', errs.length); errs.slice(0, 4).forEach((e) => console.log(e));
edge.kill(); process.exit(filas.some((f) => f.startsWith('FALLA')) || errs.length ? 1 : 0);
