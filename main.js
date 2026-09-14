/* =====================================================================
   デモページ側の処理（シーン・カメラ・UI）。
   振り付けそのものは dance.js、キャラの見た目は character.js に分けてある。
   ===================================================================== */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const errBox = $('err');
  function showErr(msg) {
    errBox.textContent = msg; errBox.style.display = 'block';
    setTimeout(function () { errBox.style.display = 'none'; }, 8000);
  }
  window.addEventListener('error', function (e) { showErr('エラー: ' + e.message); });

  if (typeof THREE === 'undefined') { showErr('three.js を読み込めませんでした'); return; }

  /* ---------------- URL パラメータ（検証用のフック） ----------------
     ?beat=12.5 その拍で止めて表示 / ?pose=openL そのポーズで静止
     ?char=1 キャラ指定 / ?cam=side カメラ / ?panel=0 パネルを畳む      */
  const Q = new URLSearchParams(location.search);

  /* ---------------- シーン ---------------- */
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11151f);
  scene.fog = new THREE.Fog(0x11151f, 14, 34);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0x98b4e0, 0x2a2620, 0.72));
  const key = new THREE.DirectionalLight(0xfff0dc, 0.95);
  key.position.set(4.5, 8.5, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1; key.shadow.camera.far = 26;
  key.shadow.bias = -0.0012;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa6ff, 0.5);
  rim.position.set(-5, 4, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffc98a, 0.25);
  fill.position.set(2, 2, -5); scene.add(fill);

  /* 床 */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(13, 48),
    new THREE.MeshPhongMaterial({ color: 0x1b2230, shininess: 8, specular: 0x222a3a }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const grid = new THREE.GridHelper(24, 24, 0x3d4f70, 0x222c3e);
  grid.position.y = 0.005; scene.add(grid);

  /* 舞台の縁取り */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 4.55, 64),
    new THREE.MeshBasicMaterial({ color: 0x3f5ea0, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; scene.add(ring);

  /* ---------------- キャラクター ---------------- */
  const CHARS = [
    {
      name: 'キャップ', opt: {
        uniform: 0x1d2029, hair: 0x14100e, accent: 0xdc5a35, male: true, tall: true,
        hairStyle: 'cap', pants: 0x1d2029, shoe: 0xf0ece0
      }
    },
    {
      name: '男子生徒', opt: {
        uniform: 0x22262e, hair: 0x1d1713, accent: 0xd8b24a, male: true, tall: true,
        hairStyle: 'short', pants: 0x2a2f3a, shoe: 0xe8e4d8
      }
    },
    {
      name: '女子生徒', opt: {
        uniform: 0x2f3a56, hair: 0x3a2a20, accent: 0xb8464a, skirt: true,
        hairStyle: 'long', shoe: 0x2a2e33
      }
    },
    {
      name: 'ツインテ', opt: {
        uniform: 0x3d2a4e, hair: 0xc9a33f, accent: 0x63c4b8, skirt: true,
        hairStyle: 'twin', shoe: 0x33383f
      }
    }
  ];

  const dancers = [];
  function buildDancers(idx, multi) {
    dancers.forEach(function (d) { scene.remove(d.rig.group); });
    dancers.length = 0;
    const list = multi
      ? [{ i: idx, x: 0, z: 0, lag: 0 },
      { i: (idx + 1) % CHARS.length, x: -3.2, z: 0, lag: 0 },
      { i: (idx + 2) % CHARS.length, x: 3.2, z: 0, lag: 0 }]
      : [{ i: idx, x: 0, z: 0, lag: 0 }];
    list.forEach(function (e) {
      const rig = makeDancer(CHARS[e.i].opt);
      rig.group.position.set(e.x, 0, e.z);
      scene.add(rig.group);
      dancers.push({ rig: rig, offX: e.x, offZ: e.z, lag: e.lag });
    });
    rebuildTrail();
  }

  /* ---------------- 手の軌跡 ---------------- */
  const TRAIL_N = 90;
  let trailObj = null, trailBuf = null, trailHead = 0, trailOn = false;
  function rebuildTrail() {
    if (trailObj) { scene.remove(trailObj); trailObj.geometry.dispose(); trailObj = null; }
    const geo = new THREE.BufferGeometry();
    trailBuf = new Float32Array(TRAIL_N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
    trailObj = new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0.55 }));
    trailObj.frustumCulled = false;
    trailObj.visible = trailOn;
    scene.add(trailObj);
    trailHead = 0;
  }
  const tv = new THREE.Vector3();
  function pushTrail() {
    if (!trailOn || !dancers.length) return;
    const j = dancers[0].rig.joints;
    [j.elbowL, j.elbowR].forEach(function (o, n) {
      if (!o) return;
      o.getWorldPosition(tv);
      const base = ((trailHead + n) % TRAIL_N) * 3;
      trailBuf[base] = tv.x; trailBuf[base + 1] = tv.y; trailBuf[base + 2] = tv.z;
    });
    trailHead = (trailHead + 2) % (TRAIL_N * 2);
    trailObj.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------------- カメラ操作 ---------------- */
  const cam = { yaw: 0, pitch: 0.14, dist: 7.6, tgt: new THREE.Vector3(0, 1.25, 0) };
  const CAM_PRESET = {
    front: { yaw: 0, pitch: 0.08, dist: 7.1, y: 1.3 },
    diag: { yaw: 0.6, pitch: 0.15, dist: 7.3, y: 1.3 },
    side: { yaw: Math.PI / 2, pitch: 0.06, dist: 7.1, y: 1.3 },
    back: { yaw: Math.PI, pitch: 0.1, dist: 7.3, y: 1.3 },
    high: { yaw: 0.4, pitch: 0.68, dist: 9.2, y: 1.1 },
    low: { yaw: 0.2, pitch: -0.1, dist: 7.2, y: 1.3 }
  };
  function applyCam(name) {
    const p = CAM_PRESET[name]; if (!p) return;
    cam.yaw = p.yaw; cam.pitch = p.pitch; cam.dist = p.dist; cam.tgt.set(0, p.y, 0);
  }
  function updCam() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(
      cam.tgt.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.tgt.y + Math.sin(cam.pitch) * cam.dist,
      cam.tgt.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.tgt);
  }

  let drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    cam.yaw -= (e.clientX - drag.x) * 0.006;
    cam.pitch = Math.max(-0.45, Math.min(1.35, cam.pitch + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', function () { drag = null; });
  canvas.addEventListener('pointercancel', function () { drag = null; });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.dist = Math.max(3, Math.min(18, cam.dist + e.deltaY * 0.006));
  }, { passive: false });

  /* ---------------- 再生の状態 ---------------- */
  danceCompile(DANCE);
  const LEN = DANCE.lengthBeats;
  const SPB = 60 / DANCE.bpm;              /* 1拍の秒数 */
  const st = { beat: 0, playing: true, speed: 1, groove: true, frozen: null };

  const elSeek = $('seek'), elSeekV = $('seekV'), elSpeed = $('speed'), elSpeedV = $('speedV');
  elSeek.max = String(LEN);
  $('danceName').textContent = DANCE.name + '  ' + DANCE.bpm + 'BPM / ' + LEN + '拍';

  function setPlaying(p) {
    st.playing = p;
    $('btnPlay').textContent = p ? '⏸ 一時停止' : '▶ 再生';
    if (p) st.frozen = null;
  }
  function seekTo(b) {
    st.beat = ((b % LEN) + LEN) % LEN;
    st.frozen = null;
  }

  /* ---------------- リズム音（動きの拍が合っているか耳で確かめる用） ----------------
     音源ファイルは使わず WebAudio で作る。踊りの拍(st.beat)を直接見て鳴らすので、
     速度を落として再生してもちゃんとその速さで鳴る。                               */
  let actx = null, lastTick = -1, beatOn = false;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function kick(t, gain) {
    const a = audio(), o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.2);
  }
  let noiseBuf = null;
  function noise(t, dur, freq, q, gain) {
    const a = audio();
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  function beatSound(halfBeat) {
    const a = audio(), t = a.currentTime + 0.01;
    const b = halfBeat % 8;
    if (b % 2 === 0) kick(t, b % 4 === 0 ? 0.5 : 0.34);      /* 表拍にキック */
    if (b === 2 || b === 6) noise(t, 0.09, 1500, 1.2, 0.24);  /* 2拍4拍にクラップ */
    noise(t, 0.028, 8000, 0.8, b % 2 ? 0.09 : 0.13);          /* 8分のハイハット */
  }

  $('btnPlay').onclick = function () { setPlaying(!st.playing); };
  $('btnBack').onclick = function () { setPlaying(false); seekTo(st.beat - 0.25); };
  $('btnFwd').onclick = function () { setPlaying(false); seekTo(st.beat + 0.25); };
  $('btnTop').onclick = function () { seekTo(0); };
  elSeek.oninput = function () { setPlaying(false); seekTo(parseFloat(elSeek.value)); };
  elSpeed.oninput = function () {
    st.speed = parseFloat(elSpeed.value);
    elSpeedV.textContent = st.speed.toFixed(2) + 'x';
  };
  document.querySelectorAll('[data-sp]').forEach(function (b) {
    b.onclick = function () {
      st.speed = parseFloat(b.dataset.sp);
      elSpeed.value = String(st.speed); elSpeed.oninput();
    };
  });
  document.querySelectorAll('[data-cam]').forEach(function (b) {
    b.onclick = function () {
      applyCam(b.dataset.cam);
      document.querySelectorAll('[data-cam]').forEach(function (o) { o.classList.remove('on'); });
      b.classList.add('on');
    };
  });
  $('uiToggle').onclick = function () { $('panel').classList.toggle('hide'); };
  $('grid').onchange = function () { grid.visible = ring.visible = this.checked; };
  $('shadow').onchange = function () { renderer.shadowMap.enabled = this.checked; scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); };
  $('trail').onchange = function () { trailOn = this.checked; if (trailObj) trailObj.visible = trailOn; rebuildTrail(); trailObj.visible = trailOn; };
  $('groove').onchange = function () { st.groove = this.checked; };
  $('beat').onchange = function () { beatOn = this.checked; if (beatOn) audio(); };

  /* キーボード：スペースで再生/停止、←→で1/4拍ずつ、Shift+←→で1拍ずつ */
  addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const step = e.shiftKey ? 1 : 0.25;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!st.playing); }
    else if (e.code === 'ArrowLeft') { setPlaying(false); seekTo(st.beat - step); }
    else if (e.code === 'ArrowRight') { setPlaying(false); seekTo(st.beat + step); }
    else if (e.code === 'Home') { seekTo(0); }
  });

  /* キャラ選択ボタン */
  let charIdx = Math.min(CHARS.length - 1, Math.max(0, parseInt(Q.get('char') || '0', 10) || 0));
  let multi = false;
  const charBtns = $('charBtns');
  CHARS.forEach(function (c, i) {
    const b = document.createElement('button');
    b.textContent = c.name;
    b.onclick = function () {
      charIdx = i;
      [].forEach.call(charBtns.children, function (o) { o.classList.remove('on'); });
      b.classList.add('on');
      buildDancers(charIdx, multi);
    };
    charBtns.appendChild(b);
  });
  $('multi').onchange = function () {
    multi = this.checked; buildDancers(charIdx, multi);
    /* 3人だと横に広がるのでカメラを引く */
    cam.dist = multi ? Math.max(cam.dist, 11.5) : Math.min(cam.dist, 8.0);
  };

  /* ポーズ確認ボタン */
  const poseBtns = $('poseBtns');
  Object.keys(DANCE.poses).forEach(function (name) {
    if (name === 'base') return;
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = function () {
      setPlaying(false);
      st.frozen = name;
      [].forEach.call(poseBtns.children, function (o) { o.classList.remove('on'); });
      b.classList.add('on');
    };
    poseBtns.appendChild(b);
  });

  /* ---------------- 初期設定 ---------------- */
  buildDancers(charIdx, false);
  charBtns.children[charIdx].classList.add('on');
  applyCam(Q.get('cam') || 'diag');
  const camBtn = document.querySelector('[data-cam="' + (Q.get('cam') || 'diag') + '"]');
  if (camBtn) camBtn.classList.add('on');
  if (Q.get('panel') === '0') $('panel').classList.add('hide');
  if (Q.has('beat')) { seekTo(parseFloat(Q.get('beat'))); setPlaying(false); }
  if (Q.has('pose')) { st.frozen = Q.get('pose'); setPlaying(false); }
  if (Q.has('speed')) { st.speed = parseFloat(Q.get('speed')); elSpeed.value = String(st.speed); elSpeed.oninput(); }
  if (Q.get('orbit') === '1') { $('orbit').checked = true; }

  /* ---------------- メインループ ---------------- */
  let prev = performance.now();
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  /* 静止ポーズ表示用：ポーズ名から直接サンプルを作る */
  function frozenSample(name) {
    const base = DANCE.poses.base, src = DANCE.poses[name] || base;
    const s = { j: {}, label: name, from: name, to: name, t: 1 };
    ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR',
      'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR'].forEach(function (n) {
        s.j[n] = (src[n] || base[n] || [0, 0, 0]).slice();
      });
    const r = src.root || base.root;
    s.rootP = ((r && r.p) || base.root.p).slice();
    s.rootR = ((r && r.r) || base.root.r).slice();
    return s;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;

    if ($('orbit').checked) cam.yaw += dt * 0.22;
    updCam();

    if (st.playing) {
      const nb = (st.beat + dt * st.speed / SPB) % LEN;
      if (beatOn) {
        const h = Math.floor(nb * 2);
        if (h !== lastTick) { try { beatSound(h); } catch (e) { } lastTick = h; }
      }
      st.beat = nb;
    }

    let info = null;
    dancers.forEach(function (d, i) {
      const opt = { offsetX: d.offX, groove: st.groove, groundLock: true };
      let s;
      if (st.frozen) {
        s = frozenSample(st.frozen);
        danceApply(d.rig, s, opt);
      } else {
        s = danceUpdate(d.rig, DANCE, (st.beat - d.lag) * SPB, opt);
      }
      d.rig.group.position.z = d.offZ;
      if (i === 0) info = s;
    });
    pushTrail();

    /* 表示の更新 */
    if (info) {
      $('poseLabel').textContent = st.frozen ? ('［静止］' + st.frozen) : info.label;
      $('tinfo').textContent = (st.beat * SPB).toFixed(2) + 's';
      $('binfo').textContent = st.beat.toFixed(2) + '拍';
      $('poseDetail').textContent = st.frozen ? 'ポーズ確認モード'
        : (info.from + ' → ' + info.to + '  ' + Math.round(info.t * 100) + '%');
    }
    if (!st.frozen) {
      elSeek.value = String(st.beat);
      elSeekV.textContent = st.beat.toFixed(1) + ' / ' + LEN.toFixed(1) + ' 拍';
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  /* 検証用に外から触れるようにしておく */
  window.DEMO = {
    state: st, dance: DANCE, dancers: dancers, camera: camera,
    seek: function (b) { setPlaying(false); seekTo(b); },
    play: setPlaying,
    setCam: applyCam,
    jointAngles: function () {
      const j = dancers[0].rig.joints, o = {};
      for (const k in j) if (j[k] && j[k].rotation)
        o[k] = [+j[k].rotation.x.toFixed(4), +j[k].rotation.y.toFixed(4), +j[k].rotation.z.toFixed(4)];
      o._rootY = +dancers[0].rig.group.position.y.toFixed(4);
      return o;
    }
  };
})();
