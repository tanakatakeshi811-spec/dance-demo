/* =====================================================================
   ダンスの振り付けデータ（ポータブル）
   ---------------------------------------------------------------------
   このファイルだけ持っていけば、別のプロジェクトでも同じ踊りが再現できる。
   three.js にも DOM にも依存していない（適用処理 danceApply だけ THREE を使う）。

   ■ データの形
     DANCE.poses  … 「ポーズ集」。関節名 -> [X回転, Y回転, Z回転]（単位は度）
                     root だけ特別で { p:[x,y,z]（移動）, r:[x,y,z]（回転） }
     DANCE.keys   … 「何拍目にどのポーズへ行くか」の並び。ease は補間の効き方
     DANCE.groove … ポーズとは別にうっすら乗せる縦ノリ・左右の揺れ

   ■ 角度の向き（キャラは +Z＝カメラ側 を向いて立っている）
     L = -X 側（画面の左）, R = +X 側（画面の右）※「放課後の居残り」の呼び方に合わせた
     肩/肘/股/膝: Z+ で手足の先が +X（画面右）へ、X+ で先が -Z（後ろ）へ
     背骨/首/頭  : Z+ で上体が -X（画面左）へ傾く、X+ で前に倒れる、Y+ で右を向く

   ■ 関節名（無い関節は自動で無視されるので、簡易な骨格にも流用できる）
     root hips spine chest neck head
     armL elbowL armR elbowR
     legL kneeL ankleL legR kneeR ankleR
   ===================================================================== */

/* 左右反転。Y/Z 回転の符号を反転して L と R を入れ替える */
function danceMirror(pose) {
  const out = {};
  for (const k in pose) {
    if (k === 'root') {
      const r = pose.root;
      out.root = {
        p: r.p ? [-r.p[0], r.p[1], r.p[2]] : undefined,
        r: r.r ? [r.r[0], -r.r[1], -r.r[2]] : undefined
      };
      continue;
    }
    const v = pose[k];
    const nk = /L$/.test(k) ? k.replace(/L$/, 'R') : (/R$/.test(k) ? k.replace(/R$/, 'L') : k);
    out[nk] = [v[0], -v[1], -v[2]];
  }
  return out;
}

const DANCE_POSES = {};

/* ---------- 基準になる直立ポーズ（他のポーズで書かれなかった関節はこれが使われる） ---------- */
DANCE_POSES.base = {
  root: { p: [0, 0, 0], r: [0, 0, 0] },
  hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  armL: [0, 0, -7], elbowL: [-10, 0, 0],
  armR: [0, 0, 7], elbowR: [-10, 0, 0],
  legL: [0, -2, -4], kneeL: [4, 0, 0], ankleL: [-2, -2, 0],
  legR: [0, 2, 4], kneeR: [4, 0, 0], ankleR: [-2, 2, 0]
};

/* ---------- A. 導入：立ち姿 → 手招き ---------- */

/* 少し前かがみで力を抜いた立ち姿 */
DANCE_POSES.standRelax = {
  spine: [5, 0, 0], chest: [3, 0, 0], neck: [7, 0, 0], head: [9, 0, 0],
  armL: [-7, 4, -9], elbowL: [-26, 0, -4],
  armR: [-7, -4, 9], elbowR: [-26, 0, 4],
  legL: [-3, -3, -5], kneeL: [8, 0, 0], ankleL: [-4, -3, 1],
  legR: [-3, 3, 5], kneeR: [8, 0, 0], ankleR: [-4, 3, -1]
};

/* 両前腕を胸の前へ上げて手のひらを上に向ける（「おいで」の構え） */
DANCE_POSES.beckonOpen = {
  root: { p: [0, 0, 0.04], r: [0, 0, 0] },
  spine: [-6, 0, 0], chest: [-4, 0, 0], neck: [5, 0, 0], head: [7, 0, 0],
  armL: [-34, 22, 24], elbowL: [-66, 0, 26],
  armR: [-34, -22, -24], elbowR: [-66, 0, -26],
  legL: [-6, -6, -9], kneeL: [13, 0, 0], ankleL: [-6, -5, 3],
  legR: [-6, 6, 9], kneeR: [13, 0, 0], ankleR: [-6, 5, -3]
};

/* 手招きの引く瞬間。前腕をぐっと手前に折りたたんで、頭も小さく頷く */
DANCE_POSES.beckonPull = {
  root: { p: [0, -0.05, -0.04], r: [0, 0, 0] },
  spine: [6, 0, 0], chest: [3, 0, 0], neck: [12, 0, 0], head: [13, 0, 0],
  armL: [-14, 12, 8], elbowL: [-148, 0, 14],
  armR: [-14, -12, -8], elbowR: [-148, 0, -14],
  legL: [-11, -6, -9], kneeL: [22, 0, 0], ankleL: [-10, -5, 3],
  legR: [-11, 6, 9], kneeR: [22, 0, 0], ankleR: [-10, 5, -3]
};

/* 腕を後ろに振り下ろして沈む（踏み出す前の溜め） */
DANCE_POSES.armsDrop = {
  root: { p: [0, -0.06, 0], r: [0, 0, 0] },
  spine: [14, 0, 0], chest: [6, 0, 0], neck: [-4, 0, 0], head: [-6, 0, 0],
  armL: [26, 0, -10], elbowL: [-14, 0, 0],
  armR: [26, 0, 10], elbowR: [-14, 0, 0],
  legL: [-14, -6, -8], kneeL: [30, 0, 0], ankleL: [-12, -6, 2],
  legR: [-14, 6, 8], kneeR: [30, 0, 0], ankleR: [-12, 6, -2]
};

/* 足を左右に大きく開いて着地。腕は低く外へ開く */
DANCE_POSES.stepWide = {
  root: { p: [0, 0, 0], r: [0, 0, 0] },
  spine: [6, 0, 0], chest: [2, 0, 0], neck: [-2, 0, 0], head: [-2, 0, 0],
  armL: [-8, 0, -38], elbowL: [-18, 0, 8],
  armR: [-8, 0, 38], elbowR: [-18, 0, -8],
  legL: [-8, -16, -30], kneeL: [20, 0, 0], ankleL: [-10, -14, 8],
  legR: [-8, 16, 30], kneeR: [20, 0, 0], ankleR: [-10, 14, -8]
};

/* ---------- B. 構え（拍と拍のあいだに必ず戻ってくる姿勢） ---------- */

/* 正面の構え。大きく開いた脚・膝を曲げて沈み、両こぶしを胸の前へ */
DANCE_POSES.guardC = {
  root: { p: [0, 0, 0], r: [0, 0, 0] },
  spine: [11, 0, 0], chest: [3, 0, 0], neck: [-5, 0, 0], head: [-5, 0, 0],
  armL: [-30, 14, 14], elbowL: [-116, 0, 16],
  armR: [-30, -14, -14], elbowR: [-116, 0, -16],
  legL: [-13, -17, -31], kneeL: [34, 0, 0], ankleL: [-15, -15, 9],
  legR: [-13, 17, 31], kneeR: [34, 0, 0], ankleR: [-15, 15, -9]
};

/* 構えたまま重心を画面左（-X）へ。右脚が伸び、左膝が深く曲がる */
DANCE_POSES.guardL = {
  root: { p: [-0.15, 0, 0], r: [0, 6, 0] },
  spine: [11, 5, 5], chest: [3, 3, 3], neck: [-5, -5, -3], head: [-5, -7, -3],
  armL: [-26, 14, 12], elbowL: [-112, 0, 16],
  armR: [-34, -14, -16], elbowR: [-120, 0, -18],
  legL: [-18, -17, -25], kneeL: [44, 0, 0], ankleL: [-18, -15, 6],
  legR: [-6, 17, 37], kneeR: [11, 0, 0], ankleR: [-7, 15, -13]
};
DANCE_POSES.guardR = danceMirror(DANCE_POSES.guardL);

/* ---------- C. 主役の動き1：オープンな斜めのポーズ ---------- */
/* 片腕を斜め上へ、逆の腕を斜め下へ思いきり伸ばし、
   上体は上げた腕のほうへ倒し、逆側の脚をまっすぐ遠くへ伸ばす。
   手先 → 体 → つま先 がひと続きの長い斜め線になるのが狙い。 */
DANCE_POSES.openL = {
  root: { p: [0.15, 0, 0], r: [0, -8, 0] },
  hips: [0, 0, 5],
  spine: [1, -8, 12], chest: [-3, -6, 10],
  neck: [0, 8, -6], head: [1, 10, -8],
  armL: [16, -8, -173], elbowL: [-6, 0, 5],
  armR: [-12, 4, 58], elbowR: [-8, 0, -5],
  legL: [-16, -12, -16], kneeL: [39, 0, 0], ankleL: [-17, -10, 4],
  legR: [-2, 14, 45], kneeR: [2, 0, 0], ankleR: [5, 12, -19]
};
DANCE_POSES.openR = danceMirror(DANCE_POSES.openL);

/* ---------- D. 主役の動き2：頭上を横切るスワイプ ---------- */
/* 体を斜めに開き、遠い側の腕を顔の前〜頭の上を通して同じ方向へ払う。
   もう一方の腕は胸の前に低く抱え込む。参考動画でいちばん印象的な瞬間。 */
DANCE_POSES.swipeL = {
  root: { p: [0.11, -0.02, 0], r: [0, -28, 0] },
  hips: [0, 0, 4],
  spine: [8, -12, 10], chest: [4, -10, 8],
  neck: [-2, 14, -6], head: [6, 17, -8],
  /* 近いほうの腕は左斜め上へ高くまっすぐ伸ばす */
  armL: [10, -12, -155], elbowL: [-8, 0, 6],
  /* 遠いほうの腕は胸の前をまっすぐ横切らせて同じ方向へ払う。
     肩を前へ送って(Y回転)胸の前を通す。頭の半径(0.40)と上腕の長さ(0.44)が
     ほぼ同じなので、肘を顔の高さに持っていくと必ず頭にめり込む */
  armR: [10, 41, -95], elbowR: [-12, 0, -10],
  legL: [-18, -13, -20], kneeL: [44, 0, 0], ankleL: [-18, -11, 6],
  legR: [-2, 15, 40], kneeR: [4, 0, 0], ankleR: [5, 13, -16]
};
DANCE_POSES.swipeR = danceMirror(DANCE_POSES.swipeL);

/* ---------- E. 差し色の動き ---------- */

/* 上体を大きく前へ倒し、両腕を前に投げ出す */
DANCE_POSES.reachFwd = {
  root: { p: [0, -0.04, 0.05], r: [0, 0, 0] },
  spine: [20, 0, 0], chest: [7, 0, 0], neck: [-15, 0, 0], head: [-13, 0, 0],
  armL: [-86, 40, 34], elbowL: [-16, 0, 16],
  armR: [-86, -40, -34], elbowR: [-16, 0, -16],
  legL: [-18, -17, -32], kneeL: [44, 0, 0], ankleL: [-18, -15, 10],
  legR: [-18, 17, 32], kneeR: [44, 0, 0], ankleR: [-18, 15, -10]
};

/* 両腕を真横に一直線。胸を張って一瞬止まる */
DANCE_POSES.armsWide = {
  root: { p: [0, 0.02, 0], r: [0, 0, 0] },
  spine: [-5, 0, 0], chest: [-5, 0, 0], neck: [3, 0, 0], head: [3, 0, 0],
  armL: [4, 0, -99], elbowL: [-8, 0, 4],
  armR: [4, 0, 99], elbowR: [-8, 0, -4],
  legL: [-8, -17, -33], kneeL: [19, 0, 0], ankleL: [-10, -15, 11],
  legR: [-8, 17, 33], kneeR: [19, 0, 0], ankleR: [-10, 15, -11]
};

/* 締めのポーズ：両腕を大きく V に開いて顔を上げる */
DANCE_POSES.finishV = {
  root: { p: [0, 0.05, 0], r: [0, 0, 0] },
  spine: [-8, 0, 0], chest: [-7, 0, 0], neck: [-12, 0, 0], head: [-14, 0, 0],
  armL: [12, 0, -152], elbowL: [-6, 0, 6],
  armR: [12, 0, 152], elbowR: [-6, 0, -6],
  legL: [-4, -17, -30], kneeL: [10, 0, 0], ankleL: [-4, -15, 10],
  legR: [-4, 17, 30], kneeR: [10, 0, 0], ankleR: [-4, 15, -10]
};

/* =====================================================================
   タイムライン（単位は「拍」）
   ease: linear / inQuad / outQuad / inOutQuad / outCubic / outBack / hold
   label: デモページの「いま何をしているか」表示用
   ===================================================================== */
const DANCE = {
  name: 'スイングステップ',
  bpm: 138,
  lengthBeats: 28,
  loop: true,
  /* ポーズとは別に薄く乗せる縦ノリ。amp=上下の幅(m)、per=周期(拍) */
  groove: {
    bob: { amp: 0.028, per: 1 },
    sway: { amp: 1.1, per: 4 },
    headBob: { amp: 2.2, per: 1 }
  },
  poses: DANCE_POSES,
  keys: [
    /* --- A 導入：立ち姿から手招き、足を開いて構える --- */
    { b: 0.00, pose: 'standRelax', ease: 'outQuad', label: '導入・立ち姿' },
    { b: 0.75, pose: 'beckonOpen', ease: 'outBack', label: '手招き' },
    { b: 1.25, pose: 'beckonPull', ease: 'outQuad', label: '手招き' },
    { b: 1.75, pose: 'beckonOpen', ease: 'outQuad', label: '手招き' },
    { b: 2.25, pose: 'beckonPull', ease: 'outQuad', label: '手招き' },
    { b: 2.75, pose: 'beckonOpen', ease: 'outQuad', label: '手招き' },
    { b: 3.20, pose: 'armsDrop', ease: 'inQuad', label: '溜め' },
    { b: 3.70, pose: 'stepWide', ease: 'outBack', label: '足を開く' },
    { b: 4.00, pose: 'guardC', ease: 'outQuad', label: '構え' },

    /* --- B1 主役の動き：左へ4連 → 右へ4連 --- */
    { b: 4.50, pose: 'openL', ease: 'outBack', label: '斜め（左）' },
    { b: 5.00, pose: 'guardR', ease: 'inOutQuad', label: '構え' },
    { b: 5.50, pose: 'swipeL', ease: 'outBack', label: '頭上スワイプ（左）' },
    { b: 6.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 6.50, pose: 'openL', ease: 'outBack', label: '斜め（左）' },
    { b: 7.00, pose: 'guardR', ease: 'inOutQuad', label: '構え' },
    { b: 7.50, pose: 'swipeL', ease: 'outBack', label: '頭上スワイプ（左）' },
    { b: 8.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 8.50, pose: 'openR', ease: 'outBack', label: '斜め（右）' },
    { b: 9.00, pose: 'guardL', ease: 'inOutQuad', label: '構え' },
    { b: 9.50, pose: 'swipeR', ease: 'outBack', label: '頭上スワイプ（右）' },
    { b: 10.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 10.50, pose: 'openR', ease: 'outBack', label: '斜め（右）' },
    { b: 11.00, pose: 'guardL', ease: 'inOutQuad', label: '構え' },
    { b: 11.50, pose: 'swipeR', ease: 'outBack', label: '頭上スワイプ（右）' },
    { b: 12.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },

    /* --- B2 差し色：前へ投げる → 真横に開く → 左右のスワイプ --- */
    { b: 12.50, pose: 'reachFwd', ease: 'outCubic', label: '前へ投げる' },
    { b: 13.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 13.50, pose: 'armsWide', ease: 'outBack', label: '真横に開く' },
    { b: 14.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 14.50, pose: 'swipeL', ease: 'outBack', label: '頭上スワイプ（左）' },
    { b: 15.00, pose: 'guardR', ease: 'inOutQuad', label: '構え' },
    { b: 15.50, pose: 'swipeR', ease: 'outBack', label: '頭上スワイプ（右）' },
    { b: 16.00, pose: 'guardL', ease: 'inOutQuad', label: '構え' },

    /* --- B3 主役の動き（2周目）：右から入って左へ --- */
    { b: 16.50, pose: 'openR', ease: 'outBack', label: '斜め（右）' },
    { b: 17.00, pose: 'guardL', ease: 'inOutQuad', label: '構え' },
    { b: 17.50, pose: 'swipeR', ease: 'outBack', label: '頭上スワイプ（右）' },
    { b: 18.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 18.50, pose: 'openL', ease: 'outBack', label: '斜め（左）' },
    { b: 19.00, pose: 'guardR', ease: 'inOutQuad', label: '構え' },
    { b: 19.50, pose: 'swipeL', ease: 'outBack', label: '頭上スワイプ（左）' },
    { b: 20.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 20.50, pose: 'openR', ease: 'outBack', label: '斜め（右）' },
    { b: 21.00, pose: 'guardL', ease: 'inOutQuad', label: '構え' },
    { b: 21.50, pose: 'swipeR', ease: 'outBack', label: '頭上スワイプ（右）' },
    { b: 22.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 22.50, pose: 'openL', ease: 'outBack', label: '斜め（左）' },
    { b: 23.00, pose: 'guardR', ease: 'inOutQuad', label: '構え' },
    { b: 23.50, pose: 'swipeL', ease: 'outBack', label: '頭上スワイプ（左）' },
    { b: 24.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },

    /* --- C 締め --- */
    { b: 24.50, pose: 'openR', ease: 'outBack', label: '締め・斜め（右）' },
    { b: 25.00, pose: 'guardC', ease: 'inOutQuad', label: '構え' },
    { b: 25.50, pose: 'openL', ease: 'outBack', label: '締め・斜め（左）' },
    { b: 26.00, pose: 'finishV', ease: 'outBack', label: '締めポーズ' },
    { b: 27.00, pose: 'stepWide', ease: 'inOutQuad', label: '収める' },
    { b: 27.60, pose: 'standRelax', ease: 'inOutQuad', label: '収める' },
    { b: 28.00, pose: 'standRelax', ease: 'linear', label: '収める' }
  ]
};

/* =====================================================================
   ここから下は「データを実際の骨格に当てはめる」ための処理。
   rig = { joints:{ 関節名: THREE.Object3D }, group: THREE.Object3D, scale: 数値 }
   ===================================================================== */

const DANCE_EASE = {
  linear: function (t) { return t; },
  inQuad: function (t) { return t * t; },
  outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
  inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
  inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  outBack: function (t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  hold: function (t) { return t >= 1 ? 1 : 0; }
};

const DANCE_JOINT_NAMES = ['hips', 'spine', 'chest', 'neck', 'head',
  'armL', 'elbowL', 'armR', 'elbowR',
  'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR'];

/* キーごとに「欠けている関節を base で埋めた完全なポーズ」を作っておく */
function danceCompile(dance) {
  const base = dance.poses.base;
  dance._frames = dance.keys.map(function (k) {
    const src = dance.poses[k.pose];
    if (!src) throw new Error('ポーズが見つかりません: ' + k.pose);
    const f = { b: k.b, ease: k.ease || 'inOutQuad', label: k.label || k.pose, pose: k.pose, j: {} };
    DANCE_JOINT_NAMES.forEach(function (n) { f.j[n] = src[n] || base[n] || [0, 0, 0]; });
    const r = src.root || base.root;
    f.rootP = (r && r.p) || (base.root && base.root.p) || [0, 0, 0];
    f.rootR = (r && r.r) || (base.root && base.root.r) || [0, 0, 0];
    return f;
  });
  dance._frames.sort(function (a, b) { return a.b - b.b; });
  return dance;
}

/* 指定した拍でのポーズを取り出す（度のまま返す） */
function danceSample(dance, beat) {
  if (!dance._frames) danceCompile(dance);
  const F = dance._frames, len = dance.lengthBeats;
  let b = dance.loop ? ((beat % len) + len) % len : Math.max(0, Math.min(len, beat));
  let i = 0;
  while (i < F.length - 1 && F[i + 1].b <= b) i++;
  const a = F[i], c = F[Math.min(i + 1, F.length - 1)];
  const span = Math.max(1e-6, c.b - a.b);
  const raw = Math.max(0, Math.min(1, (b - a.b) / span));
  const t = (DANCE_EASE[c.ease] || DANCE_EASE.inOutQuad)(raw);
  const out = { j: {}, label: raw < 0.6 ? c.label : c.label, from: a.pose, to: c.pose, t: raw };
  DANCE_JOINT_NAMES.forEach(function (n) {
    const p = a.j[n], q = c.j[n];
    out.j[n] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  });
  out.rootP = [
    a.rootP[0] + (c.rootP[0] - a.rootP[0]) * t,
    a.rootP[1] + (c.rootP[1] - a.rootP[1]) * t,
    a.rootP[2] + (c.rootP[2] - a.rootP[2]) * t];
  out.rootR = [
    a.rootR[0] + (c.rootR[0] - a.rootR[0]) * t,
    a.rootR[1] + (c.rootR[1] - a.rootR[1]) * t,
    a.rootR[2] + (c.rootR[2] - a.rootR[2]) * t];
  return out;
}

const DANCE_D2R = Math.PI / 180;

/* サンプルした角度を骨格に流し込む。
   opt.groundLock=true なら、低いほうの足が床にちょうど着くよう root の高さを補正する
   （ポーズごとに沈み込みの深さを手計算しなくて済むようにするため） */
function danceApply(rig, s, opt) {
  opt = opt || {};
  const J = rig.joints, S = rig.scale || 1;
  DANCE_JOINT_NAMES.forEach(function (n) {
    const o = J[n]; if (!o) return;
    const v = s.j[n];
    o.rotation.set(v[0] * DANCE_D2R, v[1] * DANCE_D2R, v[2] * DANCE_D2R);
  });
  const g = rig.group;
  g.position.set(s.rootP[0] * S + (opt.offsetX || 0), s.rootP[1] * S, s.rootP[2] * S);
  g.rotation.set(s.rootR[0] * DANCE_D2R,
    s.rootR[1] * DANCE_D2R + (opt.yaw || 0), s.rootR[2] * DANCE_D2R);
  if (opt.groundLock !== false && J.ankleL && J.ankleR) {
    g.updateMatrixWorld(true);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    J.ankleL.getWorldPosition(a); J.ankleR.getWorldPosition(b);
    g.position.y += (0.168 * S - Math.min(a.y, b.y));
  }
}

/* 時間（秒）から一気に更新するショートカット。戻り値は表示用の情報 */
function danceUpdate(rig, dance, timeSec, opt) {
  const beat = timeSec * dance.bpm / 60;
  const s = danceSample(dance, beat);
  const gr = dance.groove;
  if (gr && opt && opt.groove !== false) {
    const bb = gr.bob, sw = gr.sway, hb = gr.headBob;
    if (bb) s.rootP[1] -= bb.amp * (0.5 + 0.5 * Math.cos(2 * Math.PI * (beat / bb.per)));
    if (sw) s.rootR[2] += sw.amp * Math.sin(2 * Math.PI * (beat / sw.per));
    if (hb) s.j.head[0] += hb.amp * Math.cos(2 * Math.PI * (beat / hb.per));
  }
  danceApply(rig, s, opt);
  s.beat = beat;
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DANCE: DANCE, danceSample: danceSample, danceCompile: danceCompile };
}
