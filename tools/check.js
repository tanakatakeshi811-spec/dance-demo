/* 通しの動作確認：一定時間ふつうに再生させて、
   ・例外/コンソールエラーが出ないか
   ・関節の角度が毎フレームちゃんと変化しているか
   ・キャラ切替や3人モード、UIの各トグルを押しても壊れないか
   を見る。使い方: node tools/check.js                                    */
const http = require('http');
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.SITE || 'http://127.0.0.1:8123/index.html';
const OUT = process.argv[2] || 'checkout';

function get(u) {
  return new Promise(function (r, j) {
    http.get(u, function (s) { let d = ''; s.on('data', c => d += c); s.on('end', () => r(d)); }).on('error', j);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  const list = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list'));
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const w = new Map(); const logs = [];
  ws.onmessage = function (ev) {
    const m = JSON.parse(ev.data);
    if (m.id && w.has(m.id)) { w.get(m.id)(m); w.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown')
      logs.push('EXCEPTION ' + m.params.exceptionDetails.text + ' ' +
        (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      logs.push('LOG ' + m.params.entry.text);
  };
  const send = (method, params) => new Promise(res => {
    const n = ++id; w.set(n, res); ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) logs.push('EVAL ' + JSON.stringify(r.result.exceptionDetails.text));
    return r.result?.result?.value;
  };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 760, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
  await sleep(2800);

  /* 1) 通常再生して関節が動いているか */
  const snaps = [];
  for (let i = 0; i < 6; i++) {
    snaps.push(await ev('JSON.stringify(DEMO.jointAngles())'));
    await sleep(260);
  }
  let changed = 0;
  for (let i = 1; i < snaps.length; i++) if (snaps[i] !== snaps[i - 1]) changed++;
  console.log('関節が変化したサンプル間隔: ' + changed + '/' + (snaps.length - 1));
  const j0 = JSON.parse(snaps[0]), j5 = JSON.parse(snaps[5]);
  const diffs = Object.keys(j0).filter(k => Array.isArray(j0[k]))
    .map(k => ({ k, d: Math.max.apply(null, j0[k].map((v, n) => Math.abs(v - j5[k][n]))) }))
    .sort((a, b) => b.d - a.d);
  console.log('よく動いている関節 top6: ' + diffs.slice(0, 6).map(x => x.k + '=' + x.d.toFixed(3)).join(' '));
  console.log('まったく動かない関節: ' + (diffs.filter(x => x.d === 0).map(x => x.k).join(',') || 'なし'));

  /* 2) 再生中のスクリーンショット3枚 */
  for (let i = 0; i < 3; i++) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT + '/play' + i + '.png', Buffer.from(s.result.data, 'base64'));
    await sleep(430);
  }

  /* 3) UI 一通り */
  await ev('document.querySelectorAll("#charBtns button")[2].click()'); await sleep(500);
  await ev('document.querySelectorAll("#charBtns button")[3].click()'); await sleep(500);
  await ev('(function(){var m=document.getElementById("multi"); m.checked=true; m.onchange();})()'); await sleep(700);
  let s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT + '/multi.png', Buffer.from(s.result.data, 'base64'));
  await ev('(function(){var m=document.getElementById("multi"); m.checked=false; m.onchange();})()'); await sleep(400);
  await ev('document.querySelectorAll("#charBtns button")[0].click()'); await sleep(400);
  for (const c of ['grid', 'shadow', 'trail', 'groove', 'beat']) {
    await ev('(function(){var e=document.getElementById("' + c + '"); e.checked=!e.checked; e.onchange();})()');
    await sleep(220);
  }
  await ev('document.querySelector("[data-cam=high]").click()'); await sleep(300);
  s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT + '/high.png', Buffer.from(s.result.data, 'base64'));
  await ev('document.querySelector("[data-cam=side]").click()'); await sleep(300);
  await ev('document.querySelectorAll("#poseBtns button")[0].click()'); await sleep(300);
  await ev('document.getElementById("btnPlay").click()'); await sleep(300);
  await ev('document.getElementById("btnBack").click(); document.getElementById("btnFwd").click();');
  await sleep(400);
  s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT + '/side.png', Buffer.from(s.result.data, 'base64'));

  /* 4) 足が床から浮いたり埋まったりしていないか（groundLock の検算） */
  const feet = await ev(`(function(){
    const r=DEMO.dancers[0].rig, out=[];
    for(let b=0;b<28;b+=0.5){
      DEMO.state.frozen=null; DEMO.seek(b);
      r.group.updateMatrixWorld(true);
      const a=new THREE.Vector3(), c=new THREE.Vector3();
      r.joints.ankleL.getWorldPosition(a); r.joints.ankleR.getWorldPosition(c);
      out.push(+(Math.min(a.y,c.y)-0.168*r.scale).toFixed(4));
    }
    return JSON.stringify(out);
  })()`);
  const fa = JSON.parse(feet || '[]');
  console.log('足の接地ずれ min/max: ' + Math.min.apply(null, fa) + ' / ' + Math.max.apply(null, fa));

  console.log('--- ログ(' + logs.length + ') ---');
  logs.forEach(l => console.log('  ' + l));
  ws.close(); process.exit(0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
