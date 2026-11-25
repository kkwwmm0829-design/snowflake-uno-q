// ============================================================
//  내 교구 — 화면과 규칙 (이 파일 하나만 바꿔서 교구를 만듭니다)
//
//  쓸 수 있는 것
//    onKey(key)  : 버튼·조이스틱이 눌릴 때마다 불림
//                  key = "A" "B" "C" "D" "UP" "DOWN" "LEFT" "RIGHT"
//    print({...}): 영수증 인쇄
//                  { title: "제목", image: "그림(data URL)", lines: ["줄1","줄2"], big: "크게", qr: "QR 내용" }
//                  모두 선택. 결과는 onPrinted(ok, 이유) 로 돌아옴
//    beep(종류)  : "move" "ok" "no" "win"
//
//  키보드 시험: 방향키 = 조이스틱, 1 2 3 4 = 버튼 A B C D
// ============================================================

// ★★★ 여기부터 내 교구 ★★★  (나만의 눈송이 공방)
// 조작: ↑ 가지 늘이기 · ← 짧은 곁가지 · → 긴 곁가지 · ↓ 되돌리기
//       A 다음 · B 프랙탈 마법 · C 처음부터 · D 완성·인쇄
// 단계: 시작 → 1 원리 → 2 가지 만들기 → 3 프랙탈 마법 → 4 완성(영수증)

// ===== 선생님이 고치는 곳 =====
const MAX_LEN = 6;            // 가지 최대 칸 수
const MAX_FRACTAL = 2;        // 프랙탈 마법 최대 단계
const SHORT_LEN = 1;          // ← 짧은 곁가지 길이(칸)
const LONG_LEN = 2;           // → 긴 곁가지 길이(칸)
const FRACTAL_SCALE = 0.42;   // 프랙탈로 자라는 작은 가지 크기 (원래 가지의 몇 배)

const IDEAS = [
  { t: "눈송이는 왜 6갈래일까?", pic: "hex",
    b: "물 분자가 얼음이 될 때 육각형 모양으로 손을 잡아요. 그래서 눈송이 가지는 언제나 6개예요!" },
  { t: "60° × 6 = 360°", pic: "rot",
    b: "가지 하나를 60°씩 돌리며 6번 복사하면 딱 한 바퀴! 우리는 가지 하나만 만들면 돼요." },
  { t: "프랙탈이란?", pic: "frac",
    b: "작은 부분이 전체를 꼭 닮은 모양이에요. 가지 끝에서 작은 가지가 또 자라고, 또 자라요." }
];

const RECEIPT_TITLE = "★ 나만의 눈송이 ★";    // 제목은 11자 이내
const RECEIPT_BIG = "Merry X-mas";
const RECEIPT_LINES = [
  "세상에 하나뿐인 눈송이예요!",
  "60° × 6 = 360°  ·  여섯 갈래 대칭",
  "가지 끝에 또 가지  ·  프랙탈",
  "따뜻한 크리스마스 보내세요!"
];

// ===== 여기부터는 동작 (보통 안 고쳐도 돼요) =====
const TABS = ["원리", "가지 만들기", "프랙탈 마법", "완성"];
const DEG60 = Math.PI / 3;
const DEMO = { len: 5, br: [{ at: 2, L: 2 }, { at: 4, L: 1 }], lvl: 1 };
const DEMO_ROT = { len: 5, br: [{ at: 2, L: 2 }, { at: 4, L: 1 }], lvl: 0 };
const DEMO_FRAC = { len: 4, br: [{ at: 2, L: 1 }], lvl: 0 };

let st, dirty = true;
function resetAll() {
  st = { stage: 0, ideaI: 0, f: { len: 0, br: [], lvl: 0 }, hist: [], msg: "",
         printing: false, printed: false, printMsg: "", no: 0 };
  dirty = true;
}
resetAll();

function el(id) { return document.getElementById(id); }
function nextNo() {
  let n = 1;
  try { n = (parseInt(localStorage.getItem("snowNo") || "0", 10) || 0) + 1; localStorage.setItem("snowNo", n); } catch (e) {}
  return n;
}
function no3() { return String(st.no).padStart(3, "0"); }
function snap() { st.hist.push(JSON.stringify(st.f)); }

// ---- 눈송이 계산 ----
// 가지 하나 = 위로 뻗은 줄기 + 곁가지(양쪽 60°). 프랙탈 단계마다 모든 가지 끝에 '작게 줄인 내 가지'가 또 자람
function buildSegs(f, cx, cy, u, angles) {
  const segs = [[], [], []];
  function arm(ox, oy, ang, uu, d) {
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const tx = ox + dx * f.len * uu, ty = oy + dy * f.len * uu;
    segs[d].push([ox, oy, tx, ty]);
    if (d < f.lvl) sprout(tx, ty, ang, uu, d + 1);
    f.br.forEach(b => {
      const bx = ox + dx * b.at * uu, by = oy + dy * b.at * uu;
      [-1, 1].forEach(s => {
        const a2 = ang + s * DEG60;
        const ex = bx + Math.sin(a2) * b.L * uu, ey = by - Math.cos(a2) * b.L * uu;
        segs[d].push([bx, by, ex, ey]);
        if (d < f.lvl) sprout(ex, ey, a2, uu, d + 1);
      });
    });
  }
  function sprout(x, y, ang, uu, d) { arm(x, y, ang, uu * FRACTAL_SCALE, d); }
  if (f.len > 0) angles.forEach(a => arm(cx, cy, a, u, 0));
  return segs;
}
function unitFor(f, R) {
  const q = FRACTAL_SCALE;
  const ext = (Math.max(f.len, 1) + 1) * (1 + (f.lvl >= 1 ? q : 0) + (f.lvl >= 2 ? q * q : 0));
  return R / Math.max(MAX_LEN + 0.8, ext);
}
function segCount(f) {
  if (f.len === 0) return 0;
  const s0 = 1 + 2 * f.br.length, t = 1 + 2 * f.br.length;
  let sum = 0;
  for (let i = 0; i <= f.lvl; i++) sum += Math.pow(t, i);
  return 6 * s0 * sum;
}
function strokeSegs(ctx, list, w, color) {
  if (!list.length) return;
  ctx.beginPath();
  list.forEach(s => { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
}
function paintFlake(ctx, f, cx, cy, R, o) {
  o = o || {};
  const u = unitFor(f, R), rot = o.rot || 0, copies = o.copies == null ? 6 : o.copies;
  const widths = o.widths || [14, 8, 5];
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const others = [], first = [];
  for (let k = 0; k < copies; k++) (k === 0 && o.highlight ? first : others).push(k * DEG60 + rot);
  [buildSegs(f, cx, cy, u, others), buildSegs(f, cx, cy, u, first)].forEach((S, i) => S.forEach((list, d) => {
    if (o.glow && d === 0) strokeSegs(ctx, list, widths[d] * 2.8, i ? "rgba(127,211,255,.30)" : "rgba(191,233,255,.16)");
    strokeSegs(ctx, list, widths[d], o.color || (i ? "#7FD3FF" : "#F4FBFF"));
  }));
  return u;
}

// ---- 큰 화면 그리기 ----
function guide(ctx, a) {
  ctx.save(); ctx.setLineDash([10, 14]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(191,233,255," + a + ")";
  for (let k = 0; k < 6; k++) {
    const ang = k * DEG60;
    ctx.beginPath(); ctx.moveTo(480, 480); ctx.lineTo(480 + Math.sin(ang) * 450, 480 - Math.cos(ang) * 450); ctx.stroke();
  }
  ctx.restore();
}
function label(ctx, text, x, y, size, color) {
  ctx.font = size + 'px Jua, "Malgun Gothic", sans-serif'; ctx.fillStyle = color || "#F6D277";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y);
}
function drawHex(ctx, t) {
  const r = 260, rot = t / 6000;
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = rot + k * DEG60; pts.push([480 + Math.sin(a) * r, 480 - Math.cos(a) * r]); }
  ctx.lineWidth = 10; ctx.strokeStyle = "rgba(191,233,255,.55)";
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
  pts.forEach(p => {
    ctx.fillStyle = "#E8545E"; ctx.beginPath(); ctx.arc(p[0], p[1], 46, 0, 7); ctx.fill();
    ctx.fillStyle = "#F4FBFF";
    [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(p[0] + s * 38, p[1] - 30, 22, 0, 7); ctx.fill(); });
  });
  label(ctx, "물 분자 6개가 손을 잡아요", 480, 480, 46, "#F4FBFF");
}

function drawScene(t) {
  const c = el("cv"); if (!c) return;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 960, 960);
  const s = st.stage;
  if (s === 0) {
    paintFlake(ctx, DEMO, 480, 480, 430, { rot: t / 9000, glow: true });
  } else if (s === 1) {
    const pic = IDEAS[st.ideaI].pic;
    if (pic === "hex") drawHex(ctx, t);
    if (pic === "rot") {
      const n = 1 + Math.floor(t / 800) % 7;
      guide(ctx, .25);
      paintFlake(ctx, DEMO_ROT, 480, 480, 430, { copies: Math.min(n, 6), highlight: true, glow: true });
      label(ctx, Math.min(n, 6) * 60 + "°", 480, 900, 64);
    }
    if (pic === "frac") {
      const f = Object.assign({}, DEMO_FRAC, { lvl: Math.floor(t / 1400) % 3 });
      paintFlake(ctx, f, 480, 480, 430, { glow: true });
      label(ctx, f.lvl + "단계", 480, 920, 60);
    }
  } else {
    if (s === 2) guide(ctx, .22);
    paintFlake(ctx, st.f, 480, 480, 430, { highlight: s === 2, glow: true });
    if (s === 2) {
      const u = unitFor(st.f, 430);
      ctx.fillStyle = "#E8545E"; ctx.shadowColor = "#E8545E"; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(480, 480 - st.f.len * u, 16, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (st.f.len === 0) label(ctx, "↑ 를 눌러 시작!", 480, 380, 60, "#F6D277");
    }
  }
}

// ---- 겨울 배경 눈 내리기 ----
const SNOW = [];
function snowInit() {
  const c = document.createElement("canvas"); c.id = "snow"; document.body.prepend(c);
  for (let i = 0; i < 110; i++) SNOW.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3.2, v: .0006 + Math.random() * .0016, w: Math.random() * 6.28 });
}
function snowDraw(t) {
  const c = el("snow"); if (!c) return;
  if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
  const x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height); x.fillStyle = "rgba(255,255,255,.85)";
  SNOW.forEach(p => {
    p.y += p.v; if (p.y > 1.02) { p.y = -0.02; p.x = Math.random(); }
    const px = (p.x + Math.sin(t / 1800 + p.w) * .01) * c.width;
    x.globalAlpha = .35 + p.r / 6; x.beginPath(); x.arc(px, p.y * c.height, p.r, 0, 7); x.fill();
  });
  x.globalAlpha = 1;
}
function loop(t) {
  snowDraw(t);
  if (st.stage <= 1 || dirty) { drawScene(t); dirty = false; }
  requestAnimationFrame(loop);
}

// ---- 조작판 ----
function activeKeys() {
  const s = st.stage;
  if (s === 0) return ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "C", "D"];
  if (s === 1) return ["UP", "DOWN", "A", "C"];
  if (s === 2) return ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "C", "D"];
  if (s === 3) return ["DOWN", "A", "B", "C", "D"];
  if (st.printed) return ["C"];
  return st.printing ? [] : ["A", "DOWN", "C"];
}
function renderPad() {
  const on = activeKeys();
  ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "C", "D"].forEach(k => { const e = el("pk-" + k); if (e) e.classList.toggle("act", on.includes(k)); });
}
function flash(key) { const e = el("pk-" + key); if (!e) return; e.classList.add("hit"); setTimeout(() => e.classList.remove("hit"), 160); }

// ---- 오른쪽 글 ----
function stats() {
  return '<span class="stat">가지 ' + st.f.len + " / " + MAX_LEN + '칸</span><span class="stat">곁가지 ' + st.f.br.length +
         '쌍</span><span class="stat">선 ' + segCount(st.f).toLocaleString() + "개</span>";
}
function render() {
  const s = st.stage;
  el("tabs").innerHTML = s === 0 ? "" : TABS.map((t, i) =>
    '<span class="tab' + (i + 1 === s ? " on" : "") + (i + 1 < s ? " past" : "") + '">' + (i + 1) + ". " + t + "</span>").join("");
  let h = "", help = "";
  const msg = st.msg ? '<div class="msg">' + st.msg + "</div>" : '<div class="msg"></div>';
  if (s === 0) {
    h = '<div class="eyebrow">겨울 수학 공방 · 대칭과 프랙탈</div><h2>세상에 하나뿐인<br>눈송이를 만들어요!</h2>' +
        "<p>똑같은 눈송이는 하나도 없대요. 조이스틱과 버튼으로 나만의 눈송이를 만들고 영수증으로 가져가요!</p>";
    help = "아무 버튼이나 눌러 시작!";
  } else if (s === 1) {
    const d = IDEAS[st.ideaI];
    h = '<div class="eyebrow">원리 ' + (st.ideaI + 1) + " / " + IDEAS.length + "</div><h2>" + d.t + "</h2><p>" + d.b + "</p>";
    help = st.ideaI < IDEAS.length - 1 ? "A 다음 · ↑↓ 넘기기" : "A 눈송이 만들러 가기!";
  } else if (s === 2) {
    h = '<div class="eyebrow">2. 가지 만들기</div><h2>파란 가지 하나만 만들면<br>6개로 복사돼요!</h2>' +
        '<div class="keys"><div class="key"><b>↑</b>가지 늘이기</div><div class="key"><b>↓</b>되돌리기</div>' +
        '<div class="key"><b>←</b>짧은 곁가지</div><div class="key"><b>→</b>긴 곁가지</div></div>' + stats() + msg;
    help = "다 만들었으면 A — 프랙탈 마법으로!";
  } else if (s === 3) {
    h = '<div class="eyebrow">3. 프랙탈 마법</div><h2>B를 누르면 가지 끝마다<br>작은 가지가 또 자라요!</h2>' +
        '<div class="stars">' + "★".repeat(st.f.lvl) + "☆".repeat(MAX_FRACTAL - st.f.lvl) + "</div>" +
        "<p>작은 부분이 전체를 닮았죠? 이것이 프랙탈!</p>" + stats() + msg;
    help = "B 마법 · ↓ 되돌리기 · D 완성하고 인쇄!";
  } else {
    if (st.printed) {
      h = '<div class="eyebrow">4. 완성</div><h2 class="good">눈송이 No.' + no3() + " 완성!</h2>" +
          "<p>" + st.printMsg + "</p><p>메리 크리스마스! 다음 친구에게 차례를 넘겨 주세요.</p>";
      help = "C 다음 친구 시작";
    } else if (st.printing) {
      h = '<div class="eyebrow">4. 완성</div><h2>영수증 인쇄 중…</h2><p>눈송이가 종이 위로 내려오고 있어요.</p>';
      help = "잠깐만 기다려 주세요";
    } else {
      h = '<div class="eyebrow">4. 완성</div><h2 class="bad">인쇄가 안 됐어요</h2><p>' + st.printMsg + "</p>";
      help = "A 다시 인쇄 · ↓ 돌아가기 · C 처음부터";
    }
  }
  el("view").innerHTML = h;
  el("help").textContent = help;
  renderPad();
  dirty = true;
}

// ---- 영수증 ----
function flakeImage() {
  const c = document.createElement("canvas"); c.width = c.height = 640;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 640, 640);
  paintFlake(x, st.f, 320, 320, 305, { color: "#000", widths: [12, 6, 3.5] });
  return c.toDataURL("image/png");
}
function finish() {
  if (st.f.len < 2) { st.msg = "↑ 로 가지를 2칸 이상 키워 주세요"; beep("no"); return; }
  st.stage = 4; st.msg = "";
  if (!st.no) st.no = nextNo();
  doPrint();
}
function doPrint() {
  st.printing = true; st.printMsg = "";
  print({
    title: RECEIPT_TITLE,
    image: flakeImage(),
    lines: ["눈송이 No." + no3() + "   ·   " + "6갈래",
            "가지 " + st.f.len + "칸 · 곁가지 " + st.f.br.length + "쌍 · 프랙탈 " + st.f.lvl + "단계",
            "선 개수  " + segCount(st.f).toLocaleString() + "개",
            ""].concat(RECEIPT_LINES),
    big: RECEIPT_BIG
  });
  clearTimeout(st._pt);
  st._pt = setTimeout(() => { if (st.printing) onPrinted(false, "15초 동안 응답 없음"); }, 15000);
}
function onPrinted(ok, why) {
  if (!st.printing) return;
  st.printing = false; clearTimeout(st._pt);
  if (ok) { st.printed = true; st.printMsg = "영수증을 가져가세요!"; beep("win"); }
  else { st.printMsg = "인쇄 실패 — " + why; beep("no"); }
  render();
}

// ---- 버튼·조이스틱 ----
function onKey(key) {
  flash(key);
  if (st.printing) return;
  const s = st.stage, f = st.f;
  st.msg = "";
  if (key === "C") { resetAll(); beep("move"); render(); return; }

  if (s === 0) { st.stage = 1; beep("ok"); }
  else if (s === 1) {
    if (key === "UP" && st.ideaI > 0) { st.ideaI--; beep("move"); }
    if (key === "DOWN" && st.ideaI < IDEAS.length - 1) { st.ideaI++; beep("move"); }
    if (key === "A") {
      if (st.ideaI < IDEAS.length - 1) { st.ideaI++; beep("move"); } else { st.stage = 2; beep("ok"); }
    }
  } else if (s === 2) {
    if (key === "UP") {
      if (f.len < MAX_LEN) { snap(); f.len++; beep("move"); } else { st.msg = "가지는 " + MAX_LEN + "칸까지! ← → 로 곁가지를 붙여요"; beep("no"); }
    } else if (key === "LEFT" || key === "RIGHT") {
      const L = key === "LEFT" ? SHORT_LEN : LONG_LEN;
      const ex = f.br.find(b => b.at === f.len);
      if (f.len === 0) { st.msg = "먼저 ↑ 로 가지를 키워요"; beep("no"); }
      else if (ex && ex.L === L) { st.msg = "여기엔 벌써 곁가지가 있어요. ↑ 로 더 키워 봐요"; beep("no"); }
      else { snap(); if (ex) ex.L = L; else f.br.push({ at: f.len, L: L }); beep("ok"); }
    } else if (key === "DOWN") {
      if (st.hist.length) { st.f = JSON.parse(st.hist.pop()); beep("move"); } else { st.msg = "되돌릴 것이 없어요"; beep("no"); }
    } else if (key === "A" || key === "B") {
      if (f.len < 2) { st.msg = "↑ 로 가지를 2칸 이상 키워 주세요"; beep("no"); }
      else { st.stage = 3; beep("ok"); if (key === "B") { snap(); f.lvl = 1; beep("win"); } }
    } else if (key === "D") finish();
  } else if (s === 3) {
    if (key === "B") {
      if (f.lvl < MAX_FRACTAL) { snap(); f.lvl++; beep("win"); } else { st.msg = "마법은 " + MAX_FRACTAL + "번까지! D 로 완성해요"; beep("no"); }
    } else if (key === "DOWN") {
      if (f.lvl > 0) { f.lvl--; beep("move"); } else { st.stage = 2; beep("move"); }
    } else if (key === "A" || key === "D") finish();
    else { st.msg = "가지를 고치려면 ↓ 로 돌아가요"; }
  } else if (s === 4 && !st.printed) {
    if (key === "A") doPrint();
    if (key === "DOWN") { st.stage = 3; beep("move"); }
  }
  render();
}

snowInit();
render();
requestAnimationFrame(loop);
// ★★★ 여기까지 내 교구 ★★★


// ---------- 아래는 고치지 않아도 됨 ----------
let print = () => onPrinted(false, '보드 없음');
(function () {
  try {
    const ui = new WebUI();
    ui.on_connect(() => (document.getElementById('conn').textContent = '● 보드 연결됨'));
    ui.on_disconnect(() => (document.getElementById('conn').textContent = '○ 보드 끊김'));
    ui.on_message('input', (d) => onKey(d.key));
    ui.on_message('print_response', (r) => onPrinted(!!(r && r.ok), r && r.via));
    print = (data) => ui.send_message('print', data);
  } catch (e) {
    document.getElementById('conn').textContent = '보드 없음 — 키보드 시험 모드';
  }
  const KB = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
  document.addEventListener('keydown', (e) => { if (KB[e.key]) { e.preventDefault(); onKey(KB[e.key]); } });
})();

let _ac = null;
function beep(kind) {
  const F = { move: [[660, 0.04]], ok: [[660, 0.1], [880, 0.1], [1320, 0.1]], no: [[220, 0.15], [180, 0.15]],
              win: [[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.2]] }[kind] || [[660, 0.05]];
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    let t = _ac.currentTime;
    F.forEach(([f, len]) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.value = 0.06;
      o.connect(g); g.connect(_ac.destination); o.start(t); o.stop(t + len * 0.9); t += len;
    });
  } catch (e) {}
}
