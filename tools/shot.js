/* headless Chrome を CDP 直叩きして、指定した拍でスクリーンショットを撮る検証用スクリプト。
   使い方: node tools/shot.js <出力先フォルダ> <URLのクエリ> <拍1,拍2,...> [幅x高さ]
   例    : node tools/shot.js out "cam=front&char=1" 4.5,5.5,6.5 720x900          */
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT = process.argv[2] || 'out';
const QUERY = process.argv[3] || '';
/* 数値なら「その拍」、文字列ならポーズ名で静止させて撮る */
const BEATS = (process.argv[4] || '0').split(',');
const SIZE = (process.argv[5] || '760x900').split('x').map(Number);
const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.SITE || 'http://127.0.0.1:8123/index.html';

function get(url) {
  return new Promise(function (res, rej) {
    http.get(url, function (r) {
      let d = ''; r.on('data', function (c) { d += c; }); r.on('end', function () { res(d); });
    }).on('error', rej);
  });
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  let list;
  for (let i = 0; i < 40; i++) {
    try { list = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list')); break; }
    catch (e) { await sleep(400); }
  }
  if (!list) throw new Error('Chrome の CDP に接続できません');
  const page = list.find(function (t) { return t.type === 'page'; });
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const waiters = new Map();
  const logs = [];
  ws.onmessage = function (ev) {
    const m = JSON.parse(ev.data);
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown')
      logs.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails.text) + ' ' +
        (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      logs.push(m.params.type.toUpperCase() + ': ' +
        m.params.args.map(function (a) { return a.value !== undefined ? a.value : a.description; }).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      logs.push('LOG: ' + m.params.entry.text);
  };
  const send = function (method, params) {
    return new Promise(function (res) {
      const n = ++id; waiters.set(n, res);
      ws.send(JSON.stringify({ id: n, method: method, params: params || {} }));
    });
  };
  await new Promise(function (r) { ws.onopen = r; });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride',
    { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });

  const url = BASE + '?panel=0&cb=' + Date.now() + '&' + QUERY;
  await send('Page.navigate', { url: url });
  await sleep(2600);

  const results = [];
  let n = 0;
  for (const b of BEATS) {
    const isNum = b !== '' && !isNaN(Number(b));
    const expr = isNum
      ? 'DEMO.state.frozen=null; DEMO.seek(' + Number(b) + '); "ok"'
      : 'DEMO.play(false); DEMO.state.frozen=' + JSON.stringify(b) + '; "ok"';
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) logs.push('EVAL: ' + JSON.stringify(r.result.exceptionDetails));
    await sleep(320);
    const ang = await send('Runtime.evaluate', {
      expression: 'JSON.stringify(DEMO.jointAngles())', returnByValue: true
    });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = path.join(OUT, String(n++).padStart(2, '0') + '_' + String(b).replace('.', '_') + '.png');
    fs.writeFileSync(name, Buffer.from(shot.result.data, 'base64'));
    results.push({ beat: b, file: name, angles: ang.result && ang.result.value });
  }
  fs.writeFileSync(path.join(OUT, 'angles.json'), JSON.stringify(results.map(function (r) {
    return { beat: r.beat, angles: r.angles ? JSON.parse(r.angles) : null };
  }), null, 1));
  console.log('SHOTS:', results.map(function (r) { return r.file; }).join(' '));
  console.log('LOGS(' + logs.length + '):');
  logs.forEach(function (l) { console.log('  ' + l); });
  ws.close();
  process.exit(0);
})().catch(function (e) { console.error('FAILED', e); process.exit(1); });
