// Costo de JS por cuadro (update de todas las escenas, sin el dibujado): node scripts/costo-cuadro.mjs <puerto web>
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const web = process.argv[2]; const P = 9300 + Math.floor(Math.random() * 400);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${P}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1280,720', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'co-'))}`, 'about:blank'], { stdio: 'ignore' });
const sl = (ms) => new Promise((r) => setTimeout(r, ms)); await sl(3000);
const t = (await (await fetch(`http://127.0.0.1:${P}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let n = 0; const pend = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result ?? m.error); };
const send = (method, params = {}) => new Promise((r) => { pend[++n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: `http://localhost:${web}/?intro=0&auto=0` });
for (let i = 0; i < 40; i++) { await sl(1000); if (await ev("!!(window.juego&&window.juego.scene.getScene('Titulo').scene.isActive())")) break; }
await ev("window.juego.scene.getScene('Titulo')._iniciar(false)");
for (let i = 0; i < 40; i++) { await sl(500); if (await ev("window.juego.scene.getScene('HUDGeneral').scene.isActive()")) break; }
await sl(1500);
const medir = (nombre) => ev(`(()=>{const J=window.juego;const claves=['Planta','HUDMaquina','HUDGeneral'];const es=claves.map(k=>J.scene.getScene(k));const N=600;const t0=performance.now();for(let i=0;i<N;i++){for(const e of es)e.update(performance.now(),16.7);}const ms=(performance.now()-t0)/N;return '${nombre}: '+ms.toFixed(3)+' ms de JS por cuadro (update de Planta + HUD de máquina + HUD general)';})()`);
console.log(await medir('planta sin HUD abierto'));
await ev("(()=>{const P=window.juego.scene.getScene('Planta');window.juego.scene.getScene('HUDMaquina').abrir('CNC1','CNC 1');P.acciones.ejecutar('CNC1');P.acciones.despachar('AGV1');})()");
console.log(await medir('HUD de CNC 1 en Acciones, brazo en secuencia y AGV en camino (x1, 10 s de simulación)'));
await ev("(()=>{const P=window.juego.scene.getScene('Planta');P.acciones.ejecutar('CNC1');window.juego.scene.getScene('HUDMaquina').alternarPestana();})()");
console.log(await medir('HUD de CNC 1 en Autómata, fresando'));
console.log('fps que informa Phaser en este Edge sin GPU (no es el del jugador):', await ev('Math.round(window.juego.loop.actualFps)'));
edge.kill(); process.exit(0);
