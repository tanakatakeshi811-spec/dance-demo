/* =====================================================================
   踊るキャラクターのモデル
   ---------------------------------------------------------------------
   「放課後の居残り」の person() と同じ方針（プリミティブの組み合わせだけで
   作る低ポリキャラ）で、寸法も person() とぴったり同じに合わせてある。
   違いは踊り用に関節を増やしてあること:
     person()  : legL / legR / armL / armR / head だけ（腕も脚も一本の棒）
     こちら    : 上に加えて hips / spine / chest / neck と
                 肘(elbowL/R) / 膝(kneeL/R) / 足首(ankleL/R)
   左右の呼び方は person() をそのまま踏襲していて
     L = -X 側（カメラから見て画面の左）, R = +X 側（画面の右）
   キャラの正面は +Z（＝カメラ側）。
   ===================================================================== */

function LM(c) { return new THREE.MeshLambertMaterial({ color: c }); }
function PM(c, sh, sp) {
  return new THREE.MeshPhongMaterial({ color: c, shininess: sh || 18, specular: sp || 0x2a2a2a });
}
function bx(parent, mat, w, h, d, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  m.castShadow = true; parent.add(m); return m;
}
function sph(parent, mat, r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

/* 関節グループにぶら下げる「骨」1本ぶんの見た目。
   person() の limb() と同じく 円柱＋両端の球 で、原点から -Y 方向に伸びる。 */
function bone(parent, mat, w, d, h, capTop, capBottom) {
  const r = Math.max(w, d) * 0.5;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.94, h, 12), mat);
  m.position.y = -h / 2; m.castShadow = true; parent.add(m);
  if (capTop !== false) sph(parent, mat, r * 0.94, 0, 0, 0);
  if (capBottom !== false) sph(parent, mat, r * 0.9, 0, -h, 0);
  return m;
}

function joint(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

/* ---------------------------------------------------------------------
   makeDancer(opt) -> { group, joints, scale }
   opt: uniform / hair / skin / accent / pants / shoe / hairStyle /
        tall / male / skirt
   --------------------------------------------------------------------- */
function makeDancer(opt) {
  opt = opt || {};
  const S = opt.tall ? 1.14 : 1.0;
  const uni = PM(opt.uniform !== undefined ? opt.uniform : 0x2b3a5a, 16, 0x3a3a3a);
  const hairM = LM(opt.hair !== undefined ? opt.hair : 0x2b2118);
  const skin = PM(opt.skin !== undefined ? opt.skin : 0xf0d3b4, 22, 0x3a2c22);
  const acc = LM(opt.accent !== undefined ? opt.accent : 0xc94f4f);
  const white = LM(0xf4f2ea);
  const pants = LM(opt.pants !== undefined ? opt.pants : 0x2c3038);
  const shoeM = LM(opt.shoe !== undefined ? opt.shoe : 0x25292b);
  const eyeM = LM(0x24272b);

  /* person() と同じ基準寸法 */
  const hipY = 1.05 * S;      /* 腰の高さ */
  const chestOff = 0.57 * S;  /* 腰→胸 */
  const shoulderY = 0.44 * S; /* 胸→肩 */
  const shoulderX = 0.56 * S;
  const upperArm = 0.44 * S, foreArm = 0.44 * S;
  const thigh = 0.52 * S, shin = 0.53 * S;

  const root = new THREE.Group();
  const hips = joint(root, 0, hipY, 0);

  /* ---------------- 脚 ---------------- */
  const legs = {};
  [['L', -1], ['R', 1]].forEach(function (p) {
    const tag = p[0], sx = p[1];
    const hip = joint(hips, sx * 0.24 * S, 0, 0);
    bone(hip, pants, 0.32 * S, 0.32 * S, thigh);
    const knee = joint(hip, 0, -thigh, 0);
    bone(knee, pants, 0.29 * S, 0.29 * S, shin);
    const ankle = joint(knee, 0, -shin, 0);
    /* 靴 */
    bx(ankle, shoeM, 0.3 * S, 0.16 * S, 0.42 * S, 0, -0.05 * S, 0.06 * S);
    bx(ankle, LM(0x9a968c), 0.32 * S, 0.05 * S, 0.45 * S, 0, -0.14 * S, 0.06 * S);
    const toe = sph(ankle, shoeM, 0.14 * S, 0, -0.05 * S, 0.24 * S);
    toe.scale.set(1, 0.62, 1);
    legs['leg' + tag] = hip; legs['knee' + tag] = knee; legs['ankle' + tag] = ankle;
  });

  /* ---------------- 腰まわり ---------------- */
  const spine = joint(hips, 0, 0, 0);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * S, 0.34 * S, 0.26 * S, 12), uni);
  waist.position.y = 0.01 * S; waist.castShadow = true; spine.add(waist);

  if (opt.skirt) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.44 * S, 0.62 * S, 0.5 * S, 14), acc);
    sk.position.y = 0.1 * S; sk.castShadow = true; spine.add(sk);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      bx(spine, LM(0xc8c4b8), 0.07 * S, 0.48 * S, 0.07 * S,
        Math.cos(a) * 0.57 * S, 0.1 * S, Math.sin(a) * 0.57 * S);
    }
  } else {
    bx(spine, pants, 0.8 * S, 0.5 * S, 0.46 * S, 0, 0.16 * S, 0);
  }

  /* ---------------- 胴 ---------------- */
  const chest = joint(spine, 0, chestOff, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86 * S, 1.0 * S, 0.5 * S), uni);
  torso.castShadow = true; chest.add(torso);
  if (opt.male) torso.scale.x = 1.1;
  /* 肩：腕を体の前で横切らせると球がぽつんと浮いて見えるので、
     胴体寄りに置いた横長の楕円体にして胴とつながって見えるようにする */
  [-1, 1].forEach(function (sx) {
    const s2 = sph(chest, uni, 0.2 * S, sx * 0.4 * S, shoulderY - 0.05 * S, 0);
    s2.scale.set(1.3, 1.0, 0.95);
  });
  /* 襟・ベルト・ボタン・ネクタイ（person() と同じ小物） */
  bx(chest, white, 0.9 * S, 0.16 * S, 0.56 * S, 0, 0.52 * S, 0);
  [-1, 1].forEach(function (sx) {
    const cl = bx(chest, white, 0.26 * S, 0.3 * S, 0.08 * S, sx * 0.2 * S, 0.36 * S, 0.27 * S);
    cl.rotation.z = sx * 0.3;
  });
  bx(chest, LM(0x2a2620), 0.9 * S, 0.14 * S, 0.54 * S, 0, -0.5 * S, 0);
  bx(chest, LM(0xc9a24a), 0.18 * S, 0.16 * S, 0.1 * S, 0, -0.5 * S, 0.29 * S);
  for (let i = 0; i < 3; i++) sph(chest, LM(0xd8d2c0), 0.045 * S, 0, (0.24 - i * 0.28) * S, 0.27 * S);
  bx(chest, acc, 0.2 * S, (opt.tall ? 0.55 : 0.24) * S, 0.1 * S, 0, 0.3 * S, 0.28 * S);

  /* ---------------- 腕 ---------------- */
  const arms = {};
  [['L', -1], ['R', 1]].forEach(function (p) {
    const tag = p[0], sx = p[1];
    const sh = joint(chest, sx * shoulderX, shoulderY, 0);
    bone(sh, uni, 0.24 * S, 0.28 * S, upperArm);
    const el = joint(sh, 0, -upperArm, 0);
    bone(el, uni, 0.22 * S, 0.26 * S, foreArm, false);
    /* 袖口 */
    const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * S, 0.125 * S, 0.08 * S, 10), white);
    cf.position.y = -foreArm + 0.04 * S; el.add(cf);
    /* 手：手のひら＋指4本＋親指 */
    const hand = joint(el, 0, -foreArm, 0);
    bx(hand, skin, 0.2 * S, 0.18 * S, 0.22 * S, 0, -0.09 * S, 0);
    for (let f = 0; f < 4; f++)
      bx(hand, skin, 0.042 * S, 0.15 * S, 0.055 * S, (-0.066 + f * 0.044) * S, -0.24 * S, 0.02 * S);
    bx(hand, skin, 0.055 * S, 0.1 * S, 0.055 * S, sx * -0.11 * S, -0.13 * S, 0.07 * S);
    arms['arm' + tag] = sh; arms['elbow' + tag] = el; arms['hand' + tag] = hand;
  });

  /* ---------------- 首・頭 ---------------- */
  const neck = joint(chest, 0, 0.52 * S, 0);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * S, 0.2 * S, 0.3 * S, 10), skin);
  nk.position.y = 0.06 * S; nk.castShadow = true; neck.add(nk);

  const head = joint(neck, 0, 0.28 * S, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4 * S, 18, 14), skin);
  skull.castShadow = true; head.add(skull);
  const jaw = sph(head, skin, 0.255 * S, 0, -0.17 * S, 0.05 * S); jaw.scale.set(1.05, 0.8, 1.05);
  [-1, 1].forEach(function (sx) {
    const ear = sph(head, skin, 0.1 * S, sx * 0.37 * S, -0.02 * S, 0);
    ear.scale.set(0.6, 1, 0.8);
  });
  bx(head, eyeM, 0.065 * S, 0.085 * S, 0.05 * S, -0.135 * S, 0.01 * S, 0.36 * S);
  bx(head, eyeM, 0.065 * S, 0.085 * S, 0.05 * S, 0.135 * S, 0.01 * S, 0.36 * S);
  bx(head, LM(0xb4635e), 0.11 * S, 0.035 * S, 0.04 * S, 0, -0.17 * S, 0.34 * S);

  /* 髪。前髪で顔が隠れないよう、てっぺんは浅いお椀・後頭部だけ深く覆う */
  const hs = opt.hairStyle || (opt.tall ? 'short' : 'long');
  if (hs !== 'none') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.425 * S, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), hairM);
    cap.position.y = 0.02 * S; cap.castShadow = true; head.add(cap);
    const back = new THREE.Mesh(
      new THREE.SphereGeometry(0.425 * S, 16, 12, Math.PI, Math.PI, 0, Math.PI * 0.76), hairM);
    back.position.y = 0.02 * S; back.castShadow = true; head.add(back);
    /* 前髪 */
    bx(head, hairM, 0.7 * S, 0.13 * S, 0.18 * S, 0, 0.24 * S, 0.3 * S);
  }
  if (hs === 'long') {
    bx(head, hairM, 0.16 * S, 0.75 * S, 0.3 * S, -0.36 * S, -0.12 * S, 0.02 * S);
    bx(head, hairM, 0.16 * S, 0.75 * S, 0.3 * S, 0.36 * S, -0.12 * S, 0.02 * S);
  } else if (hs === 'twin') {
    bx(head, hairM, 0.26 * S, 0.9 * S, 0.26 * S, -0.5 * S, -0.2 * S, -0.1 * S);
    bx(head, hairM, 0.26 * S, 0.9 * S, 0.26 * S, 0.5 * S, -0.2 * S, -0.1 * S);
  } else if (hs === 'wild') {
    for (let i = 0; i < 5; i++)
      bx(head, hairM, 0.18 * S, 0.3 * S, 0.18 * S,
        (-0.3 + i * 0.15) * S, 0.4 * S, (-0.1 + (i % 2) * 0.12) * S);
  } else if (hs === 'cap') {
    const capM = LM(opt.cap !== undefined ? opt.cap : 0x2a2f3a);
    const cp = new THREE.Mesh(
      new THREE.SphereGeometry(0.45 * S, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), capM);
    cp.position.y = 0.03 * S; cp.castShadow = true; head.add(cp);
    /* つばは前へ。目にかからないよう高め・浅めに */
    const brim = bx(head, capM, 0.5 * S, 0.06 * S, 0.26 * S, 0, 0.28 * S, 0.34 * S);
    brim.rotation.x = -0.12;
    bx(head, acc, 0.12 * S, 0.1 * S, 0.04 * S, 0, 0.3 * S, 0.21 * S);
  }

  const joints = Object.assign({
    root: root, hips: hips, spine: spine, chest: chest, neck: neck, head: head
  }, arms, legs);

  return { group: root, joints: joints, scale: S };
}
