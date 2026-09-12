(function(){
"use strict";

/* ============================= UTIL ============================= */
function rand(a,b){ return a + Math.random()*(b-a); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
function lerp(a,b,t){ return a+(b-a)*t; }

/* ============================= FIXED CHARACTER SPRITES ============================= */
const SPRITE_URLS = {
  player:'player.png', companion:'Mira.png'
};
const SPRITE_LABELS = {
  player:'Player', companion:'Mira (guide)'
};
const SPRITE_META = {
  player:{cols:4, rows:4, speed:0.11, frameCount:4},
  companion:{cols:4, rows:3, speed:0.12, frameCount:4}
};
const SPRITES = {};
for(const key of Object.keys(SPRITE_URLS)) SPRITES[key] = {img:new Image(), loaded:false, meta:{...SPRITE_META[key], cols:SPRITE_META[key].cols, rows:SPRITE_META[key].rows, frameCount:SPRITE_META[key].frameCount}};

function setSpriteMeta(key, img){
  const base = SPRITE_META[key] || {cols:1, rows:1, speed:0.12, frameCount:1};
  const w = img.naturalWidth || img.width || 32;
  const h = img.naturalHeight || img.height || 32;
  const naturalCols = Math.max(1, Math.round(w / Math.max(16, Math.round(h / Math.max(1, base.rows)))));
  const cols = base.cols || Math.max(1, naturalCols);
  const rows = base.rows || 1;
  const frameW = Math.max(1, Math.floor(w / cols));
  const frameH = Math.max(1, Math.floor(h / rows));
  const frameCount = Math.max(1, base.frameCount || Math.max(1, cols * Math.max(1, base.rows)));
  SPRITES[key].meta = { ...base, cols, rows, frameW, frameH, frameCount,
    bounds: getSpriteFrameBounds(img, cols, rows, frameW, frameH) };
}

function getSpriteFrameBounds(img, cols, rows, frameW, frameH){
  const scan = document.createElement('canvas');
  scan.width = img.naturalWidth || img.width;
  scan.height = img.naturalHeight || img.height;
  const scanCtx = scan.getContext('2d');
  if(!scanCtx || !scan.width || !scan.height) return null;
  let pixels;
  try{
    scanCtx.drawImage(img, 0, 0);
    pixels = scanCtx.getImageData(0, 0, scan.width, scan.height).data;
  }catch(error){
    return null;
  }
  const bounds = [];
  for(let row=0; row<rows; row++){
    for(let col=0; col<cols; col++){
      let minX=frameW, minY=frameH, maxX=-1, maxY=-1;
      for(let y=0; y<frameH; y++){
        for(let x=0; x<frameW; x++){
          const alpha = pixels[((row*frameH+y)*scan.width + col*frameW+x)*4+3];
          if(alpha>12){
            minX=Math.min(minX,x); minY=Math.min(minY,y);
            maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
          }
        }
      }
      bounds.push(maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
    }
  }
  return bounds;
}

function loadSpriteFromSrc(key, src){
  const img = new Image();
  img.onload = ()=>{
    setSpriteMeta(key, img);
    SPRITES[key] = {img, loaded:true, meta: SPRITES[key].meta};
  };
  img.onerror = ()=>{ SPRITES[key].loaded=false; };
  img.src = src;
}
for(const key of Object.keys(SPRITE_URLS)){
  loadSpriteFromSrc(key, SPRITE_URLS[key]);
}

function getFrameIndex(key, tick, frameRate){
  const meta = SPRITES[key] && SPRITES[key].meta ? SPRITES[key].meta : SPRITE_META[key] || {frameCount:1, speed:0.12};
  const frameCount = Math.max(1, meta.frameCount || 1);
  const speed = meta.speed || 0.12;
  return Math.floor((tick || 0) / speed) % frameCount;
}

/* draws a loaded asset sprite centered at (sx,sy); returns true if it drew something */
function trySprite(key, sx, sy, angle, w, h, tick = 0, rowOverride = null, anchorBottom = false, flipX = false){
  const spr = SPRITES[key];
  if(!spr || !spr.loaded) return false;
  const meta = spr.meta || SPRITE_META[key] || {cols:1, rows:1, frameCount:1, frameW:32, frameH:32};
  const frame = getFrameIndex(key, tick, meta.speed);
  const c = meta.cols || 1;
  const r = meta.rows || 1;
  const frameW = meta.frameW || Math.max(1, Math.floor((spr.img.naturalWidth || spr.img.width) / c));
  const frameH = meta.frameH || Math.max(1, Math.floor((spr.img.naturalHeight || spr.img.height) / r));
  const sxPos = (frame % c) * frameW;
  const row = rowOverride === null ? Math.floor(frame / c) % r : clamp(rowOverride, 0, r-1);
  const syPos = row * frameH;
  const bound = anchorBottom && meta.bounds ? meta.bounds[row*c + (frame%c)] : null;
  ctx.save();
  ctx.translate(sx,sy);
  if(flipX) ctx.scale(-1,1);
  if(angle!==undefined) ctx.rotate(angle);
  ctx.imageSmoothingEnabled = false;
  if(bound){
    const scale = w/frameW;
    ctx.drawImage(spr.img, sxPos+bound.x, syPos+bound.y, bound.w, bound.h,
      -w/2+bound.x*scale, -bound.h*scale, bound.w*scale, bound.h*scale);
  } else {
    ctx.drawImage(spr.img, sxPos, syPos, frameW, frameH, -w/2, anchorBottom ? -h : -h/2, w, h);
  }
  ctx.restore();
  return true;
}

/* ============================= CONTROL MODE ============================= */
function detectDefaultMode(){
  try{
    if(navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean'){
      if(navigator.userAgentData.mobile === true) return 'mobile';
    }
  }catch(e){}
  const ua = (navigator.userAgent || '').toLowerCase();
  const mobileUA = /(android|webos|iphone|ipod|ipad|blackberry|iemobile|opera mini|mobile|silk|fennec|kindle|bada|meego|palm|symbian|windows phone|bb10|rim tablet os|tizen|ubuntu mobile|mqqbrowser|micromessenger|ucbrowser|dolfin|polaris|sonyericsson|nokia|samsung|mot-|htc|lg-|docomo|softbank|vodafone|o2|pocket|psp|playstation)/.test(ua);
  if(mobileUA) return 'mobile';
  let coarse = false;
  try{ coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }catch(e){}
  if(coarse){
    const w = Math.max(window.innerWidth || 0, window.screen ? screen.width : 0);
    if(w < 1024) return 'mobile';
  }
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  if(touch){
    const w = Math.min(window.innerWidth || 9999, window.screen ? screen.width : 9999);
    if(w < 820) return 'mobile';
  }
  return 'desktop';
}
let controlMode = 'desktop';
const DIFFICULTIES = {
  easy:{decay:0.72, danger:0.72, dayLength:175, label:'Easy'},
  normal:{decay:1, danger:1, dayLength:150, label:'Normal'},
  hard:{decay:1.35, danger:1.35, dayLength:130, label:'Hard'}
};
let difficulty = 'normal';
function setDifficulty(level){
  if(!DIFFICULTIES[level]) return;
  difficulty = level;
  document.querySelectorAll('.difficultyBtn').forEach(button=>{
    button.classList.toggle('active', button.dataset.difficulty===level);
  });
}
document.querySelectorAll('.difficultyBtn').forEach(button=>{
  button.addEventListener('click', ()=>setDifficulty(button.dataset.difficulty));
});
setDifficulty(difficulty);
function setControlMode(m){
  controlMode = m;
  const desktopBtn = document.getElementById('modeDesktop');
  const mobileBtn  = document.getElementById('modeMobile');
  const tip        = document.getElementById('mobileTip');
  const stats      = document.getElementById('stats');
  const toggle     = document.getElementById('statsToggle');
  if(desktopBtn) desktopBtn.classList.toggle('active', m==='desktop');
  if(mobileBtn)  mobileBtn.classList.toggle('active', m==='mobile');
  if(tip)        tip.classList.toggle('hidden', m!=='mobile');
  if(stats)      stats.classList.toggle('mobile-collapse', m==='mobile');
  if(toggle){
    stats.classList.remove('show-extra');
    toggle.textContent = '+ MORE';
  }
}
function bindStatsToggle(){
  const toggle = document.getElementById('statsToggle');
  const stats  = document.getElementById('stats');
  if(!toggle || !stats) return;
  toggle.addEventListener('click', ()=>{
    if(!stats.classList.contains('mobile-collapse')) return;
    const show = stats.classList.toggle('show-extra');
    toggle.textContent = show ? '- LESS' : '+ MORE';
  });
}
function bindModeButtons(){
  controlMode = detectDefaultMode();
  const d = document.getElementById('modeDesktop');
  const m = document.getElementById('modeMobile');
  if(d) d.addEventListener('click', ()=>setControlMode('desktop'));
  if(m) m.addEventListener('click', ()=>setControlMode('mobile'));
  setControlMode(controlMode);
  bindStatsToggle();
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bindModeButtons);
}else{
  bindModeButtons();
}

/* ============================= START SCREEN ART ============================= */
const startCanvas = document.getElementById('startCanvas');
const sctx = startCanvas.getContext('2d');
let startFireflies = [];
function resizeStart(){
  startCanvas.width = window.innerWidth; startCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeStart);
resizeStart();

function initStartArt(){
  startFireflies = [];
  for(let i=0;i<26;i++){
    startFireflies.push({x:rand(0,startCanvas.width), y:rand(startCanvas.height*0.4,startCanvas.height), s:rand(1,2.4), t:rand(0,10), spd:rand(0.3,0.9)});
  }
}
initStartArt();

function drawForestLayer(w,h,baseY,amp,color,seed,alpha){
  sctx.fillStyle = color; sctx.globalAlpha = alpha;
  sctx.beginPath();
  sctx.moveTo(0,h);
  sctx.lineTo(0, baseY);
  let x=0;
  let s = seed;
  function pr(){ s = (s*9301+49297)%233280; return s/233280; }
  while(x < w+80){
    const treeW = 40+pr()*70;
    const treeH = amp*(0.5+pr()*0.9);
    sctx.lineTo(x+treeW*0.5, baseY-treeH);
    sctx.lineTo(x+treeW, baseY);
    x += treeW*0.7;
  }
  sctx.lineTo(w,h);
  sctx.closePath();
  sctx.fill();
  sctx.globalAlpha = 1;
}

let startT0 = performance.now();
function drawStart(now){
  const w = startCanvas.width, h = startCanvas.height;
  const t = (now-startT0)/1000;

  const g = sctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#0a0c14');
  g.addColorStop(0.35,'#131a1f');
  g.addColorStop(0.62,'#1c2a22');
  g.addColorStop(1,'#0c100a');
  sctx.fillStyle = g; sctx.fillRect(0,0,w,h);

  const mx = w*0.76, my = h*0.22, mr = Math.min(w,h)*0.06;
  const moonGlow = sctx.createRadialGradient(mx,my,0,mx,my,mr*6);
  moonGlow.addColorStop(0,'rgba(220,225,210,0.22)');
  moonGlow.addColorStop(1,'rgba(220,225,210,0)');
  sctx.fillStyle = moonGlow; sctx.beginPath(); sctx.arc(mx,my,mr*6,0,Math.PI*2); sctx.fill();
  sctx.fillStyle = '#e7e6d8';
  sctx.beginPath(); sctx.arc(mx,my,mr,0,Math.PI*2); sctx.fill();
  sctx.fillStyle = 'rgba(20,25,20,0.15)';
  sctx.beginPath(); sctx.arc(mx-mr*0.28,my-mr*0.15,mr*0.85,0,Math.PI*2); sctx.fill();

  for(let i=0;i<3;i++){
    const my2 = h*(0.55+i*0.13) + Math.sin(t*0.15+i)*8;
    const mg = sctx.createLinearGradient(0,my2-40,0,my2+40);
    mg.addColorStop(0,'rgba(120,140,120,0)');
    mg.addColorStop(0.5,'rgba(120,140,120,'+(0.05+i*0.02)+')');
    mg.addColorStop(1,'rgba(120,140,120,0)');
    sctx.fillStyle = mg; sctx.fillRect(0,my2-40,w,80);
  }

  drawForestLayer(w,h,h*0.62,h*0.16,'#131f16',101,0.55);
  drawForestLayer(w,h,h*0.72,h*0.22,'#0c1610',307,0.75);
  drawForestLayer(w,h,h*0.86,h*0.30,'#070c07',521,1);

  for(const f of startFireflies){
    f.t += 0.016*f.spd;
    const fx = f.x + Math.sin(f.t*1.3)*18;
    const fy = f.y + Math.cos(f.t*0.8)*12;
    const flick = (Math.sin(f.t*3)+1)/2;
    sctx.fillStyle = 'rgba(232,200,120,'+(0.15+flick*0.55)+')';
    sctx.beginPath(); sctx.arc(fx,fy,f.s+flick*1.2,0,Math.PI*2); sctx.fill();
  }

  const vg = sctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.25,w/2,h/2,Math.max(w,h)*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
  sctx.fillStyle = vg; sctx.fillRect(0,0,w,h);

  if(document.getElementById('start').style.display !== 'none'){
    requestAnimationFrame(drawStart);
  }
}
requestAnimationFrame(drawStart);

/* ============================= GAME SETUP ============================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const WORLD_W = 3200, WORLD_H = 3200;

let keys = {};
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', ()=>{
  keys = {};
  touchMove.x = 0;
  touchMove.y = 0;
  mobileSprintOn = false;
});

/* ============================= MOBILE / TOUCH CONTROLS ============================= */
let touchMove = {x:0, y:0};
let mobileSprintOn = false;

(function setupMobileControls(){
  const joyZone = document.getElementById('joystickZone');
  const joyKnob = document.getElementById('joystickKnob');
  const JOY_RADIUS = 46;
  let joyActive = false, originX=0, originY=0;

  const draggableSelectors = ['#joystickZone','#mobileActions','#btnPauseMobile','#stats','#topRight','#minimapBox','#missionBox','#action','#pausePanel'];
  let layoutDrag = null;
  const clampLayout = (value, min, max) => Math.max(min, Math.min(max, value));
  function touchCenter(touches){
    return {x:(touches[0].clientX+touches[1].clientX)/2, y:(touches[0].clientY+touches[1].clientY)/2};
  }
  function beginLayoutDrag(event, target){
    if(controlMode!=='mobile' || event.touches.length<2) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const point = touchCenter(event.touches);
    const rect = target.getBoundingClientRect();
    target.style.position = 'fixed';
    target.style.left = rect.left+'px'; target.style.top = rect.top+'px';
    target.style.right = 'auto'; target.style.bottom = 'auto';
    layoutDrag = {target, startX:point.x, startY:point.y, left:rect.left, top:rect.top};
  }
  function moveLayoutDrag(event){
    if(!layoutDrag || event.touches.length<2) return;
    event.preventDefault();
    const point = touchCenter(event.touches);
    const target = layoutDrag.target;
    const rect = target.getBoundingClientRect();
    const left = clampLayout(layoutDrag.left+point.x-layoutDrag.startX, 0, window.innerWidth-rect.width);
    const top = clampLayout(layoutDrag.top+point.y-layoutDrag.startY, 0, window.innerHeight-rect.height);
    target.style.left = left+'px'; target.style.top = top+'px';
  }
  function endLayoutDrag(){ layoutDrag=null; }
  for(const selector of draggableSelectors){
    const target = document.querySelector(selector);
    if(!target) continue;
    target.classList.add('mobile-draggable');
    target.addEventListener('touchstart', event=>beginLayoutDrag(event,target), {passive:false,capture:true});
  }
  window.addEventListener('touchmove', moveLayoutDrag, {passive:false});
  window.addEventListener('touchend', endLayoutDrag, {passive:false});
  window.addEventListener('touchcancel', endLayoutDrag, {passive:false});

  function joyStart(cx,cy){
    joyActive = true;
    const rect = joyZone.getBoundingClientRect();
    originX = rect.left+rect.width/2; originY = rect.top+rect.height/2;
    joyMove(cx,cy);
  }
  function joyMove(cx,cy){
    if(!joyActive) return;
    let dx=cx-originX, dy=cy-originY;
    const len=Math.hypot(dx,dy);
    if(len>JOY_RADIUS){ dx=dx/len*JOY_RADIUS; dy=dy/len*JOY_RADIUS; }
    joyKnob.style.transform = 'translate('+dx+'px,'+dy+'px)';
    touchMove.x = dx/JOY_RADIUS; touchMove.y = dy/JOY_RADIUS;
  }
  function joyEnd(){
    joyActive=false;
    joyKnob.style.transform = 'translate(0,0)';
    touchMove.x=0; touchMove.y=0;
  }
  joyZone.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; joyStart(t.clientX,t.clientY); }, {passive:false});
  joyZone.addEventListener('touchmove', e=>{ e.preventDefault(); const t=e.touches[0]; joyMove(t.clientX,t.clientY); }, {passive:false});
  joyZone.addEventListener('touchend', e=>{ e.preventDefault(); joyEnd(); }, {passive:false});
  joyZone.addEventListener('touchcancel', joyEnd);
  joyZone.addEventListener('mousedown', e=>{
    joyStart(e.clientX,e.clientY);
    const mm=ev=>joyMove(ev.clientX,ev.clientY);
    const mu=()=>{ joyEnd(); window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); };
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu);
  });

  function bindBtn(id, fn){
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('touchstart', e=>{ e.preventDefault(); fn(); }, {passive:false});
    el.addEventListener('click', e=>{ e.preventDefault(); fn(); });
  }
  const guard = fn => ()=>{ if(gameActive && player.alive && !paused) fn(); };
  bindBtn('btnGather', guard(()=>tryGather()));
  bindBtn('btnFire', guard(()=>buildFire()));
  bindBtn('btnTorch', guard(()=>craftTorch()));
  bindBtn('btnFight', guard(()=>fightNearest()));
  bindBtn('btnCook', guard(()=>cookMeat()));
  bindBtn('btnEat1', guard(()=>{ if(player.berries>0){ player.berries--; player.hunger=clamp(player.hunger+22,0,100); logMsg('Ate berries. +22 hunger'); } }));
  bindBtn('btnEat2', guard(()=>{ if(player.water>0){ player.water--; player.thirst=clamp(player.thirst+30,0,100); logMsg('Drank water. +30 thirst'); } }));
  bindBtn('btnEat3', guard(()=>eatRaw()));
  bindBtn('btnEat4', guard(()=>eatCooked()));
  bindBtn('btnPauseMobile', ()=>{ if(gameActive && player.alive) togglePause(); });
  bindBtn('btnSprint', ()=>{
    mobileSprintOn = !mobileSprintOn;
    document.getElementById('btnSprint').classList.toggle('active', mobileSprintOn);
  });
})();

/* ============================= SPRITE PRE-RENDERING ============================= */
function makeCanvas(w,h){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  return c;
}

function makeTreeSprite(baseR, huePhase){
  const size = baseR*5.4;
  const c = makeCanvas(size,size);
  const g = c.getContext('2d');
  const cx = size/2, cy = size*0.62;

  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.beginPath(); g.ellipse(cx, cy+baseR*0.55, baseR*1.35, baseR*0.5, 0, 0, Math.PI*2); g.fill();

  const trunkH = baseR*1.7;
  const tg = g.createLinearGradient(cx-baseR*0.22,0,cx+baseR*0.22,0);
  tg.addColorStop(0,'#1c140d'); tg.addColorStop(0.5,'#3a2a1a'); tg.addColorStop(1,'#241a10');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(cx-baseR*0.22, cy+baseR*0.4);
  g.lineTo(cx-baseR*0.13, cy-trunkH*0.7);
  g.lineTo(cx+baseR*0.13, cy-trunkH*0.7);
  g.lineTo(cx+baseR*0.22, cy+baseR*0.4);
  g.closePath(); g.fill();

  g.fillStyle = '#241a10';
  g.beginPath(); g.moveTo(cx-baseR*0.32,cy+baseR*0.45);
  g.quadraticCurveTo(cx-baseR*0.1, cy+baseR*0.2, cx-baseR*0.1, cy);
  g.lineTo(cx+baseR*0.1,cy);
  g.quadraticCurveTo(cx+baseR*0.1, cy+baseR*0.2, cx+baseR*0.32, cy+baseR*0.45);
  g.fill();

  const clusters = [
    {dx:-baseR*0.55, dy:-trunkH*0.55, r:baseR*1.15, base:'#1e2e18', hi:'#2f4225'},
    {dx: baseR*0.5,  dy:-trunkH*0.6,  r:baseR*1.05, base:'#22331b', hi:'#354a28'},
    {dx: 0,          dy:-trunkH*0.95, r:baseR*1.3,  base:'#233a1f', hi:'#3c552c'},
    {dx:-baseR*0.2,  dy:-trunkH*0.75, r:baseR*0.95, base:'#28401f', hi:'#456030'}
  ];
  for(const cl of clusters){
    const fx = cx+cl.dx, fy = cy+cl.dy;
    const grad = g.createRadialGradient(fx-cl.r*0.35,fy-cl.r*0.4,cl.r*0.15, fx,fy,cl.r);
    grad.addColorStop(0, cl.hi);
    grad.addColorStop(1, cl.base);
    g.fillStyle = grad;
    g.beginPath(); g.arc(fx,fy,cl.r,0,Math.PI*2); g.fill();
  }
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(140,160,90,0.06)';
  g.beginPath(); g.arc(cx+baseR*0.4, cy-trunkH*1.0, baseR*0.9, 0, Math.PI*2); g.fill();
  g.globalCompositeOperation = 'source-over';

  return {img:c, w:size, h:size, cx:cx, cy:cy};
}

function makeRockSprite(r, oreColor){
  const size = r*3.2;
  const c = makeCanvas(size,size);
  const g = c.getContext('2d');
  const cx=size/2, cy=size*0.62;
  g.fillStyle='rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(cx,cy+r*0.5,r*1.15,r*0.4,0,0,Math.PI*2); g.fill();

  const grad = g.createLinearGradient(cx-r,cy-r,cx+r,cy+r*0.6);
  grad.addColorStop(0,'#6b675e'); grad.addColorStop(0.55,'#514e47'); grad.addColorStop(1,'#302e29');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx-r, cy+r*0.3);
  g.lineTo(cx-r*0.7, cy-r*0.6);
  g.lineTo(cx-r*0.1, cy-r*0.85);
  g.lineTo(cx+r*0.6, cy-r*0.55);
  g.lineTo(cx+r*0.95, cy+r*0.15);
  g.lineTo(cx+r*0.5, cy+r*0.55);
  g.lineTo(cx-r*0.4, cy+r*0.55);
  g.closePath(); g.fill();

  g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(cx-r*0.3,cy-r*0.3); g.lineTo(cx+r*0.2,cy-r*0.1); g.stroke();
  g.fillStyle='rgba(255,255,255,0.06)';
  g.beginPath(); g.ellipse(cx-r*0.25,cy-r*0.4,r*0.35,r*0.18,-0.3,0,Math.PI*2); g.fill();

  if(oreColor){
    g.fillStyle = oreColor;
    for(let i=0;i<6;i++){
      const vx = cx+rand(-r*0.7,r*0.7), vy = cy+rand(-r*0.7,r*0.4);
      g.globalAlpha = rand(0.5,0.9);
      g.beginPath(); g.arc(vx,vy,rand(1,2.6),0,Math.PI*2); g.fill();
    }
    g.globalAlpha = 1;
  }
  return {img:c, w:size, h:size, cx:cx, cy:cy};
}

const TREE_VARIANTS = [];
for(let i=0;i<5;i++) TREE_VARIANTS.push(makeTreeSprite(rand(15,24), i));
const ROCK_VARIANTS = [];
for(let i=0;i<4;i++) ROCK_VARIANTS.push(makeRockSprite(rand(9,16)));
const IRON_VARIANTS = [];
for(let i=0;i<3;i++) IRON_VARIANTS.push(makeRockSprite(rand(9,15), '#a9c2cc'));
const COPPER_VARIANTS = [];
for(let i=0;i<3;i++) COPPER_VARIANTS.push(makeRockSprite(rand(9,15), '#d98a4a'));

/* ============================= WORLD GEN ============================= */
let trees=[], bushes=[], rocks=[], ores=[], ponds=[], fires=[], wolves=[], prey=[], particles=[];

function genWorld(){
  trees=[]; bushes=[]; rocks=[]; ores=[]; ponds=[];
  for(let i=0;i<4;i++){
    let x, y, attempts=0;
    do{
      x=rand(450,WORLD_W-450); y=rand(450,WORLD_H-450); attempts++;
    }while(attempts<80 && ponds.some(p=>Math.hypot(p.x-x,p.y-y)<820));
    ponds.push({x, y, r:rand(300,390), seed:rand(0,100), crossings:0, playerInWater:false, rippleTimer:0});
  }
  for(let i=0;i<260;i++){
    trees.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), r:rand(16,26), wood:rand(3,5)|0, hp:3, shake:0,
      variant: TREE_VARIANTS[(Math.random()*TREE_VARIANTS.length)|0], sway: rand(0,Math.PI*2)});
  }
  for(let i=0;i<90;i++){
    bushes.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), r:rand(10,15), berries: (Math.random()<0.7)?( (Math.random()*3|0)+1 ):0, regrow:0, sway:rand(0,Math.PI*2)});
  }
  for(let i=0;i<70;i++){
    rocks.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), r:rand(8,16), variant: ROCK_VARIANTS[(Math.random()*ROCK_VARIANTS.length)|0], cd:0});
  }
  for(let i=0;i<26;i++){
    ores.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), r:rand(9,14), type:'iron', variant: IRON_VARIANTS[(Math.random()*IRON_VARIANTS.length)|0], cd:0});
  }
  for(let i=0;i<30;i++){
    ores.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), r:rand(9,14), type:'copper', variant: COPPER_VARIANTS[(Math.random()*COPPER_VARIANTS.length)|0], cd:0});
  }
}
genWorld();

/* ============================= MINIMAP ============================= */
const MM_SIZE = 150;
const mmScale = MM_SIZE / WORLD_W;
const minimapBase = makeCanvas(MM_SIZE, MM_SIZE);
function buildMinimapBase(){
  const g = minimapBase.getContext('2d');
  g.fillStyle = '#161f10'; g.fillRect(0,0,MM_SIZE,MM_SIZE);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for(let i=0;i<220;i++){ g.fillRect(Math.random()*MM_SIZE, Math.random()*MM_SIZE, 1, 1); }
  g.fillStyle = '#2f6b82';
  for(const p of ponds){
    g.beginPath(); g.arc(p.x*mmScale, p.y*mmScale, Math.max(1.4, p.r*mmScale*0.9), 0, Math.PI*2); g.fill();
  }
  g.fillStyle = 'rgba(80,112,62,0.85)';
  for(const t of trees){ if(!isPondNoRender(t.x,t.y,24)) g.fillRect(t.x*mmScale, t.y*mmScale, 1, 1); }
  g.fillStyle = 'rgba(150,148,140,0.6)';
  for(const r of rocks){ if(!isPondNoRender(r.x,r.y,24)) g.fillRect(r.x*mmScale, r.y*mmScale, 1, 1); }
}
buildMinimapBase();

const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
function drawMinimap(){
  mmCtx.clearRect(0,0,MM_SIZE,MM_SIZE);
  mmCtx.drawImage(minimapBase,0,0);

  for(const f of fires){
    const fx=f.x*mmScale, fy=f.y*mmScale;
    mmCtx.strokeStyle = 'rgba(232,161,92,0.35)';
    mmCtx.lineWidth = 1;
    mmCtx.beginPath(); mmCtx.arc(fx,fy,fireProtectionRange(f)*mmScale,0,Math.PI*2); mmCtx.stroke();
    mmCtx.globalAlpha = 0.35+Math.sin(performance.now()/220)*0.15;
    mmCtx.fillStyle = '#e8a15c';
    mmCtx.beginPath(); mmCtx.arc(fx,fy,5,0,Math.PI*2); mmCtx.fill();
    mmCtx.globalAlpha = 1;
    mmCtx.fillStyle = '#fff2c9';
    mmCtx.beginPath(); mmCtx.arc(fx,fy,1.8,0,Math.PI*2); mmCtx.fill();
  }

  if(player.torchLife>0){
    const tx=player.x*mmScale, ty=player.y*mmScale;
    mmCtx.strokeStyle = 'rgba(255,211,106,0.45)';
    mmCtx.beginPath(); mmCtx.arc(tx,ty,torchProtectionRange()*mmScale,0,Math.PI*2); mmCtx.stroke();
    mmCtx.fillStyle = '#ffd36a';
    mmCtx.beginPath(); mmCtx.arc(tx,ty,2.8,0,Math.PI*2); mmCtx.fill();
  }

  // predators — always shown as moving red dots, brighter/faster pulse when actively hunting
  for(const w of wolves){
    const pulse = (2.2 + PREDATOR_STATS[w.kind].weight*0.3) + Math.sin(performance.now()/220 + w.legPhase)*0.9;
    mmCtx.fillStyle = w.state==='chase' ? '#ff3a2a' : '#e04a3a';
    mmCtx.globalAlpha = w.state==='chase' ? 1 : 0.85;
    mmCtx.beginPath(); mmCtx.arc(w.x*mmScale, w.y*mmScale, pulse, 0, Math.PI*2); mmCtx.fill();
    mmCtx.globalAlpha = 1;
  }
  // prey as small pale dots
  mmCtx.fillStyle = 'rgba(210,200,170,0.7)';
  for(const p of prey){ mmCtx.beginPath(); mmCtx.arc(p.x*mmScale,p.y*mmScale,1.4,0,Math.PI*2); mmCtx.fill(); }

  // companion
  mmCtx.fillStyle = '#7fd0d8';
  mmCtx.beginPath(); mmCtx.arc(companion.x*mmScale, companion.y*mmScale, 2.4, 0, Math.PI*2); mmCtx.fill();

  const viewW = canvas.width*mmScale, viewH = canvas.height*mmScale;
  mmCtx.strokeStyle = 'rgba(255,255,255,0.22)'; mmCtx.lineWidth = 1;
  mmCtx.strokeRect(camX*mmScale - viewW/2, camY*mmScale - viewH/2, viewW, viewH);

  const px = player.x*mmScale, py = player.y*mmScale;
  mmCtx.strokeStyle = 'rgba(232,161,92,0.55)'; mmCtx.lineWidth = 1;
  mmCtx.beginPath(); mmCtx.arc(px,py, 6+Math.sin(performance.now()/260)*1, 0, Math.PI*2); mmCtx.stroke();
  mmCtx.save();
  mmCtx.translate(px,py);
  mmCtx.rotate(player.dir);
  mmCtx.fillStyle = '#fff2e0';
  mmCtx.beginPath();
  mmCtx.moveTo(4.5,0); mmCtx.lineTo(-3,-3); mmCtx.lineTo(-1,0); mmCtx.lineTo(-3,3);
  mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();

  mmCtx.strokeStyle = 'rgba(205,191,154,0.35)'; mmCtx.lineWidth = 1;
  mmCtx.strokeRect(0.5,0.5,MM_SIZE-1,MM_SIZE-1);
}

/* ============================= ATMOSPHERE: wind, weather, footprints, grain ============================= */
let footprints = [];
let clouds = [];
for(let i=0;i<14;i++) clouds.push({x:rand(0,WORLD_W), y:rand(0,WORLD_H), w:rand(220,420), h:rand(90,160), spd:rand(4,10), seed:rand(0,1000)});
let birds = [];

let weather = { rain:0, rainTarget:0, nextShift: rand(30,70), fog:0.25 };
function windAt(t){
  const dir = Math.sin(t*0.02)*1.4 + Math.sin(t*0.007+2)*0.8;
  const strength = 0.35 + Math.sin(t*0.015+1)*0.25 + Math.sin(t*0.05)*0.12;
  return { dir, strength: clamp(strength,0.05,1) };
}
function sunInfo(t){
  const azimuth = (t-0.25) * Math.PI*2;
  const dayFrac = clamp(Math.sin(Math.max(0,(t-0.22))/0.56*Math.PI), 0, 1);
  const elevation = dayFrac;
  return { azimuth, elevation, lit: dayFrac>0.02 };
}
function shadowVec(baseLen){
  const sun = sunInfo(worldTime);
  const len = baseLen * (0.5 + (1-sun.elevation)*2.2);
  const dx = Math.cos(sun.azimuth), dy = Math.sin(sun.azimuth)*0.5+0.6;
  const alpha = 0.18 + sun.elevation*0.18;
  return { dx, dy, len, alpha };
}

const grainTile = makeCanvas(180,180);
(function buildGrain(){
  const g = grainTile.getContext('2d');
  const id = g.createImageData(180,180);
  for(let i=0;i<id.data.length;i+=4){
    const v = 128 + (Math.random()-0.5)*90;
    id.data[i]=v; id.data[i+1]=v; id.data[i+2]=v; id.data[i+3]=255;
  }
  g.putImageData(id,0,0);
})();

/* ============================= SKILLS & WEAPONS ============================= */
const SKILL_META = {
  woodcutting:{name:'Woodcutting', desc:'Fell trees faster and yield more wood per tree.'},
  foraging:{name:'Foraging', desc:'Bushes yield more berries and regrow faster.'},
  firecraft:{name:'Firecraft', desc:'Fires burn longer, cost less wood, give more fuel per feeding, and resist rain.'},
  combat:{name:'Combat', desc:'Deal more damage, mine extra ore, and take less from bites/claws. Unlocks weapons.'},
  torchcraft:{name:'Torchcraft', desc:'Unlocks torches at level 2; higher levels make them brighter and repel predators farther.'},
  swimming:{name:'Swimming', desc:'Level 3 lets you cross ponds safely and move through water without drowning.'}
};
const SKILL_CAP = 5;
function xpNeeded(lvl){ return lvl*40; }

const WEAPONS = {
  fists:       {name:'Fists',              dmg:1, range:55, cost:null, requires:null},
  spear:       {name:'Spear',               dmg:2, range:72, cost:{wood:6, stone:2},  requires:{skill:'combat', lvl:2}},
  copperKnife: {name:'Copper Knife',        dmg:2, range:60, cost:{wood:3, copper:3}, requires:null},
  rspear:      {name:'Reinforced Spear',    dmg:3, range:88, cost:{wood:10, stone:5}, requires:{skill:'combat', lvl:4}},
  ironSpear:   {name:'Iron Spear',          dmg:5, range:85, cost:{wood:8, iron:5},   requires:{skill:'combat', lvl:5}}
};
function haveEnough(cost){ return Object.keys(cost).every(k => (player[k]||0) >= cost[k]); }
function payCost(cost){ for(const k of Object.keys(cost)) player[k] -= cost[k]; }
function costLabel(cost){ return Object.keys(cost).map(k=>cost[k]+' '+k).join(', '); }

/* ============================= PREDATORS & PREY ============================= */
const PREDATOR_STATS = {
  wolf:  {name:'Wolf',  hpBase:3,  hpPerDay:0.5, dmg:8,  chaseSpd:95,  wanderSpd:30, sense:1.00, size:1.0, weight:5, minDay:1},
  tiger: {name:'Tiger', hpBase:6,  hpPerDay:0.8, dmg:14, chaseSpd:120, wanderSpd:35, sense:1.15, size:1.25,weight:2, minDay:2},
  bear:  {name:'Bear',  hpBase:10, hpPerDay:1.0, dmg:20, chaseSpd:80,  wanderSpd:22, sense:0.85, size:1.5, weight:1, minDay:3}
};
const PREY_STATS = {
  rabbit:{name:'Rabbit', hp:1, speed:120, meat:1},
  deer:  {name:'Deer',   hp:2, speed:100, meat:3}
};

function pickPredatorKind(){
  const options = Object.keys(PREDATOR_STATS).filter(k=>day>=PREDATOR_STATS[k].minDay);
  const total = options.reduce((s,k)=>s+PREDATOR_STATS[k].weight,0);
  let r = Math.random()*total;
  for(const k of options){ r -= PREDATOR_STATS[k].weight; if(r<=0) return k; }
  return 'wolf';
}
function spawnPredator(forceKind){
  const kind = forceKind || pickPredatorKind();
  const st = PREDATOR_STATS[kind];
  const ang = rand(0,Math.PI*2);
  const hp = st.hpBase + Math.floor((day-1)*st.hpPerDay);
  wolves.push({
    kind, hostile:true, x: player.x + Math.cos(ang)*rand(500,800), y: player.y + Math.sin(ang)*rand(500,800),
    hp, maxHp:hp, state:'wander', wx:0, wy:0, wanderT:0, hitCD:0, legPhase:rand(0,10), dir:0
  });
}
function spawnPrey(){
  const kinds = Object.keys(PREY_STATS);
  const kind = kinds[(Math.random()*kinds.length)|0];
  const st = PREY_STATS[kind];
  const ang = rand(0,Math.PI*2);
  prey.push({
    kind, hostile:false, x: player.x + Math.cos(ang)*rand(400,650), y: player.y + Math.sin(ang)*rand(400,650),
    hp:st.hp, maxHp:st.hp, wx:0, wy:0, wanderT:0, dir:0, legPhase:rand(0,10)
  });
}

/* ============================= PROCEDURAL AUDIO ============================= */
const Audio_ = {
  ctx:null, master:null, windGain:null, fireGain:null, rainGain:null,
  bg:null, muted:false, started:false
};
function initAudio(){
  if(Audio_.started) return;
  Audio_.started = true;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    Audio_.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = Audio_.muted?0:0.35; master.connect(ctx.destination);
    Audio_.master = master;

    const bufSize = ctx.sampleRate*2;
    const noiseBuf = ctx.createBuffer(1,bufSize,ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    let lastOut=0;
    for(let i=0;i<bufSize;i++){
      const white = Math.random()*2-1;
      lastOut = (lastOut + 0.02*white)/1.02;
      nd[i] = lastOut*4.5;
    }

    const rainSrc = ctx.createBufferSource(); rainSrc.buffer=noiseBuf; rainSrc.loop=true;
    const rainFilter = ctx.createBiquadFilter(); rainFilter.type='highpass'; rainFilter.frequency.value=1200;
    const rainGain = ctx.createGain(); rainGain.gain.value=0;
    rainSrc.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(master); rainSrc.start();
    Audio_.rainGain = rainGain;

    const windSrc = ctx.createBufferSource(); windSrc.buffer=noiseBuf; windSrc.loop=true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type='bandpass'; windFilter.frequency.value=500; windFilter.Q.value=0.6;
    const windGain = ctx.createGain(); windGain.gain.value=0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); windSrc.start();
    Audio_.windGain = windGain; Audio_.windFilter = windFilter;

    const fireSrc = ctx.createBufferSource(); fireSrc.buffer=noiseBuf; fireSrc.loop=true;
    const fireFilter = ctx.createBiquadFilter(); fireFilter.type='highpass'; fireFilter.frequency.value=2200;
    const fireGain = ctx.createGain(); fireGain.gain.value=0;
    fireSrc.connect(fireFilter); fireFilter.connect(fireGain); fireGain.connect(master); fireSrc.start();
    Audio_.fireGain = fireGain;

    Audio_.bg = new Audio('track.mp3');
    Audio_.bg.loop = true;
    Audio_.bg.volume = 0.45;
    Audio_.bg.muted = Audio_.muted;
    Audio_.bg.play().catch(e=>console.log('bg play failed:', e));
  }catch(e){ /* audio unavailable — fail silent */ }
}
function sfxClick(freq, dur, type, vol){
  if(!Audio_.ctx || Audio_.muted) return;
  const ctx = Audio_.ctx;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type||'sine'; o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g); g.connect(Audio_.master);
  const t0 = ctx.currentTime;
  g.gain.linearRampToValueAtTime(vol||0.25, t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  o.start(t0); o.stop(t0+dur+0.02);
}
function sfxFootstep(){
  if(!Audio_.ctx || Audio_.muted) return;
  const ctx = Audio_.ctx;
  const bufSize = Math.floor(ctx.sampleRate*0.05);
  const buf = ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<bufSize;i++) d[i] = (Math.random()*2-1)*(1-i/bufSize);
  const src = ctx.createBufferSource(); src.buffer=buf;
  const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=700;
  const g = ctx.createGain(); g.gain.value=0.18;
  src.connect(filt); filt.connect(g); g.connect(Audio_.master);
  src.start();
}
function sfxGrowl(kind){
  if(!Audio_.ctx || Audio_.muted) return;
  const ctx = Audio_.ctx;
  const base = kind==='bear'?55:(kind==='tiger'?70:90);
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type='sawtooth'; o.frequency.setValueAtTime(base, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(base*0.6, ctx.currentTime+0.5);
  const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=300;
  g.gain.value=0;
  o.connect(filt); filt.connect(g); g.connect(Audio_.master);
  const t0=ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.22, t0+0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t0+0.6);
  o.start(t0); o.stop(t0+0.65);
}
function sfxHeartbeat(){
  if(!Audio_.ctx || Audio_.muted) return;
  const ctx = Audio_.ctx;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type='sine'; o.frequency.value=55;
  g.gain.value=0;
  o.connect(g); g.connect(Audio_.master);
  const t0 = ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.3, t0+0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0+0.25);
  o.start(t0); o.stop(t0+0.3);
}

/* ============================= PLAYER & COMPANION ============================= */
const player = {
  x: WORLD_W/2, y: WORLD_H/2, r:11, dir:0,
  speed: 187.5,
  health:100, hunger:100, thirst:100, warmth:100, sanity:100, stamina:100,
  wood:2, berries:1, water:1, stone:0, iron:0, copper:0, rawMeat:0, cookedMeat:0,
  weapon:'fists',
  skills:{
    woodcutting:{xp:0, lvl:1},
    foraging:{xp:0, lvl:1},
    firecraft:{xp:0, lvl:1},
    combat:{xp:0, lvl:1},
    torchcraft:{xp:0, lvl:1},
    swimming:{xp:0, lvl:1}
  },
  mstat:{ wood:0, firesBuilt:0, cooked:0, predatorKills:0 },
  alive:true, attackCD:0, hurtFlash:0, walkCycle:0, animTime:0, moving:false, sprinting:false, inWater:false,
  cookCD:0, torchLife:0, torchCooldown:0
};
const companion = { x: player.x+46, y: player.y+18, bob:0, animTime:0, dir:0, moving:false, advice:'', adviceLife:0, name:'Mira' };

function gainSkillXP(skill, amount){
  const s = player.skills[skill];
  if(!s || s.lvl>=SKILL_CAP) return;
  s.xp += amount;
  const need = xpNeeded(s.lvl);
  if(s.xp>=need){
    s.xp -= need;
    s.lvl++;
    logMsg(SKILL_META[skill].name+' reached level '+s.lvl+'!');
    onSkillLevelUp(skill, s.lvl);
    checkMissions();
  }
}
function onSkillLevelUp(skill, lvl){
  if(skill==='combat' && lvl===2) sayMira('New recipe: Spear. Press P to craft it.');
  if(skill==='combat' && lvl===4) sayMira('New recipe: Reinforced Spear. Press P.');
  if(skill==='combat' && lvl===5) sayMira("If you've got iron, forge the Iron Spear. Best you'll carry out here.");
  if(skill==='firecraft' && lvl===3) sayMira('Fire mastery 3 — your fire will hold longer against rain now.');
  if(skill==='torchcraft' && lvl===2) sayMira('Torchcraft level 2 unlocked. Craft a torch from the pause screen.');
}

function craftWeapon(id){
  const wpn = WEAPONS[id];
  if(!wpn || !wpn.cost) return false;
  if(wpn.requires){
    const s = player.skills[wpn.requires.skill];
    if(!s || s.lvl < wpn.requires.lvl){
      logMsg('Requires '+SKILL_META[wpn.requires.skill].name+' level '+wpn.requires.lvl+'.');
      return false;
    }
  }
  if(!haveEnough(wpn.cost)){ logMsg('Not enough materials for '+wpn.name+'.'); return false; }
  payCost(wpn.cost);
  player.weapon = id;
  player.mstat.weaponsCrafted = (player.mstat.weaponsCrafted||0)+1;
  logMsg('Crafted a '+wpn.name+'!');
  checkMissions();
  return true;
}

/* ============================= MISSIONS / NARRATIVE ============================= */
const MISSIONS = [
  { text:'Gather at least 5 wood before it gets dark.',
    done:'Good — that will get a fire going.',
    check:()=> player.mstat.wood>=5 },
  { text:'Build a campfire. It keeps the cold — and the wolves — back.',
    done:"That's a start. Keep it fed; let it die and they'll come closer.",
    check:()=> player.mstat.firesBuilt>=1 },
  { text:'Hunt something and cook the meat at your fire. Raw meat will make you sick.',
    done:'Smart. A full, healthy stomach is worth more out here than a fast one.',
    check:()=> player.mstat.cooked>=1 },
  { text:"Craft a weapon. Your fists won't save you against what's out there.",
    done:"Better. You'll need every edge you can get.",
    check:()=> player.weapon!=='fists' },
  { text:'Fight off three predators and prove you can hold your ground.',
    done:"Three down. You're not just surviving anymore.",
    check:()=> player.mstat.predatorKills>=3 },
  { text:'Push your Firecraft to level 3 — a stronger fire holds through worse nights.',
    done:'Good. That fire will outlast the rain now.',
    check:()=> player.skills.firecraft.lvl>=3 },
  { text:'Hold on until the sixth dawn. Do all of this, and the signal reaches them.',
    done:'',
    check:()=> day>=6 }
];
let missionIndex = 0;
function sayMira(text){
  if(text){
    companion.advice = text;
    companion.adviceLife = 5.8;
  }
  const el = document.getElementById('log');
  const div = document.createElement('div');
  div.className='logmsg who'; div.textContent = 'MIRA: '+text;
  el.appendChild(div);
  setTimeout(()=>div.remove(), 5800);
  while(el.children.length>5) el.removeChild(el.firstChild);
}
function checkMissions(){
  if(missionIndex>=MISSIONS.length-1) return;
  const m = MISSIONS[missionIndex];
  if(m.check()){
    sayMira(m.done);
    missionIndex++;
    if(missionIndex<MISSIONS.length) sayMira(MISSIONS[missionIndex].text);
    updateMissionPanel();
  }
}
function updateMissionPanel(){
  const el = document.getElementById('missionText');
  if(!el) return;
  if(missionIndex>=MISSIONS.length-1){
    el.textContent = 'Just hold on until dawn, day 6. Almost there.';
  } else {
    el.textContent = MISSIONS[missionIndex].text;
  }
}

/* ============================= TIME ============================= */
const DAY_LENGTH = 150;
let worldTime = 0.25;
let day = 1;
let gameActive = false;
let paused = false;

function timeOfDayLabel(t){
  if(t<0.22||t>0.95) return 'deep night';
  if(t<0.30) return 'dawn';
  if(t<0.68) return 'day';
  if(t<0.80) return 'dusk';
  return 'night';
}
function isNight(t){ return t<0.24 || t>0.78; }

/* ============================= UI HELPERS ============================= */
function logMsg(text){
  const el = document.getElementById('log');
  const div = document.createElement('div');
  div.className='logmsg'; div.textContent = text;
  el.appendChild(div);
  setTimeout(()=>div.remove(), 4800);
  while(el.children.length>5) el.removeChild(el.firstChild);
}

function setBar(id, val){
  document.getElementById('bar-'+id).style.width = clamp(val,0,100)+'%';
  document.getElementById('n-'+id).textContent = Math.round(clamp(val,0,100));
}

function getFireBrightness(){
  return fires.length>0 ? clamp(fires[0].life/FIRE_MAX_LIFE*100, 0, 100) : 0;
}

let actionPrompt = '';
function updateHUD(){
  setBar('health',player.health); setBar('hunger',player.hunger);
  setBar('thirst',player.thirst); setBar('warmth',player.warmth);
  setBar('sanity',player.sanity); setBar('stamina',player.stamina);
  setBar('fireBrightness',getFireBrightness());
  setBar('torchBrightness',torchBrightness());
  document.getElementById('i-wood').textContent = player.wood;
  document.getElementById('i-berry').textContent = player.berries;
  document.getElementById('i-water').textContent = player.water;
  document.getElementById('i-stone').textContent = player.stone;
  document.getElementById('i-iron').textContent = player.iron;
  document.getElementById('i-copper').textContent = player.copper;
  document.getElementById('i-rawmeat').textContent = player.rawMeat;
  document.getElementById('i-cookedmeat').textContent = player.cookedMeat;
  document.getElementById('i-weapon').textContent = WEAPONS[player.weapon].name;
  document.getElementById('dayNum').textContent = 'Day '+day;
  document.getElementById('timeOfDay').textContent = timeOfDayLabel(worldTime);
  updateMissionPanel();

  const actionEl = document.getElementById('action');
  if(actionPrompt){ actionEl.style.display='block'; actionEl.textContent = actionPrompt; }
  else actionEl.style.display='none';
}

/* ---------- Pause panel rendering ---------- */
function renderPauseSkills(){
  const listEl = document.getElementById('skillList');
  listEl.innerHTML = '';
  for(const key of Object.keys(player.skills)){
    const s = player.skills[key];
    const meta = SKILL_META[key];
    const pct = s.lvl>=SKILL_CAP ? 100 : (s.xp/xpNeeded(s.lvl))*100;
    const row = document.createElement('div');
    row.className='skill-row';
    row.innerHTML =
      '<div class="skill-head"><span>'+meta.name+'</span><span class="lvl">Lv.'+s.lvl+(s.lvl>=SKILL_CAP?' (max)':'')+'</span></div>'+
      '<div class="bar-bg"><div class="bar-fill" style="background:var(--ember);width:'+pct+'%"></div></div>'+
      '<div class="skill-desc">'+meta.desc+'</div>';
    listEl.appendChild(row);
  }

  document.getElementById('curWeapon').textContent = WEAPONS[player.weapon].name;
  const craftEl = document.getElementById('craftList');
  craftEl.innerHTML = '';
  for(const id of ['copperKnife','spear','rspear','ironSpear']){
    const wpn = WEAPONS[id];
    const unlocked = !wpn.requires || player.skills[wpn.requires.skill].lvl >= wpn.requires.lvl;
    const owned = player.weapon===id;
    const afford = haveEnough(wpn.cost);
    const row = document.createElement('div');
    row.className = 'craft-row'+(unlocked?'':' locked');
    const label = document.createElement('span');
    label.innerHTML = wpn.name+' <span style="opacity:.6">('+costLabel(wpn.cost)+' — dmg '+wpn.dmg+')</span>';
    const btn = document.createElement('button');
    btn.textContent = owned ? 'Equipped' : (unlocked ? 'Craft' : 'Locked · Combat Lv.'+(wpn.requires?wpn.requires.lvl:'?'));
    btn.disabled = owned || !unlocked || !afford;
    btn.onclick = ()=>{ if(craftWeapon(id)) renderPauseSkills(); };
    row.appendChild(label); row.appendChild(btn);
    craftEl.appendChild(row);
  }

  const torchRow = document.createElement('div');
  torchRow.className = 'craft-row'+(player.skills.torchcraft.lvl>=2?'':' locked');
  const torchLabel = document.createElement('span');
  torchLabel.innerHTML = 'Torch <span style="opacity:.6">(3 wood — 60 seconds, one-use)</span>';
  const torchBtn = document.createElement('button');
  const torchReady = player.torchLife<=0 && player.torchCooldown<=0;
  torchBtn.textContent = player.torchLife>0 ? 'Active' : (player.skills.torchcraft.lvl>=2 ? (torchReady?'Craft':'Cooldown') : 'Locked · Torchcraft Lv.2');
  torchBtn.disabled = player.skills.torchcraft.lvl<2 || !torchReady || player.wood<3;
  torchBtn.onclick = ()=>{ if(craftTorch()) renderPauseSkills(); };
  torchRow.appendChild(torchLabel); torchRow.appendChild(torchBtn);
  craftEl.appendChild(torchRow);

  document.getElementById('missionProgress').textContent = Math.min(missionIndex,MISSIONS.length-1)+'/'+(MISSIONS.length-1);
  const mEl = document.getElementById('missionList');
  mEl.innerHTML = '';
  for(let i=0;i<MISSIONS.length-1;i++){
    const done = i<missionIndex;
    const row = document.createElement('div');
    row.className = 'mission-check'+(done?' done':'');
    row.innerHTML = '<span class="box"></span><span class="txt">'+MISSIONS[i].text+'</span>';
    mEl.appendChild(row);
  }
}

function togglePause(){
  if(!gameActive && !paused) return;
  if(!player.alive) return;
  paused = !paused;
  document.getElementById('pauseScreen').style.display = paused ? 'flex' : 'none';
  if(paused) renderPauseSkills();
}
document.getElementById('pauseResume').addEventListener('click', togglePause);

/* ============================= INTERACTION ============================= */
function nearestOf(list, maxDist){
  let best=null, bd=maxDist;
  for(const o of list){
    const d = dist(player,o);
    if(d<bd){ bd=d; best=o; }
  }
  return best;
}

function spawnParticles(x,y,type,n){
  for(let i=0;i<n;i++) particles.push({x:x+rand(-6,6),y:y+rand(-6,6),life:1,type,vx:rand(-20,20),vy:rand(-40,-10)});
}

function isPondShoreline(pond){
  const edgeDistance = pondEdgeDistance(player, pond);
  return edgeDistance >= 0 && edgeDistance <= 24;
}

function keepOutOfPonds(entity, radius, canSwim=false){
  if(canSwim) return;
  for(const pond of ponds){
    const dx = entity.x-pond.x, dy = entity.y-pond.y;
    const angle = Math.atan2(dy,dx);
    const rx = pond.r+radius, ry = pond.r*0.68+radius;
    const ellipseValue = (dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);
    if(ellipseValue<1){
      const boundary = 1/Math.sqrt((Math.cos(angle)*Math.cos(angle))/(rx*rx)+(Math.sin(angle)*Math.sin(angle))/(ry*ry));
      entity.x = pond.x+Math.cos(angle)*boundary;
      entity.y = pond.y+Math.sin(angle)*boundary;
    }
  }
}

function pondEdgeDistance(entity, pond){
  const dx = entity.x-pond.x, dy = entity.y-pond.y;
  const distance = Math.hypot(dx,dy);
  if(distance<0.001) return -pond.r*0.68;
  const angle = Math.atan2(dy,dx);
  const boundary = 1/Math.sqrt((Math.cos(angle)*Math.cos(angle))/(pond.r*pond.r)+(Math.sin(angle)*Math.sin(angle))/((pond.r*0.68)*(pond.r*0.68)));
  return distance-boundary;
}

function isPondNoRender(x, y, margin){
  return ponds.some(pond=>{
    const dx=x-pond.x, dy=y-pond.y;
    const rx=pond.r+margin, ry=pond.r*0.68+margin;
    return (dx*dx)/(rx*rx)+(dy*dy)/(ry*ry) <= 1;
  });
}

function isPointInPond(entity, pond){
  const dx=entity.x-pond.x, dy=entity.y-pond.y;
  return (dx*dx)/(pond.r*pond.r)+(dy*dy)/((pond.r*0.68)*(pond.r*0.68)) < 1;
}

function tryGather(){
  const tree = nearestOf(trees.filter(t=>t.hp>0), 46);
  const bush = nearestOf(bushes.filter(b=>b.berries>0), 40);
  const ore = nearestOf(ores.filter(o=>(o.cd||0)<=0), 42);
  const rock = nearestOf(rocks.filter(r=>(r.cd||0)<=0), 42);
  const pond = ponds.find(isPondShoreline) || nearestOf(ponds, 90);

  if(pond && isPondShoreline(pond)){
    player.water = clamp(player.water+1,0,5);
    spawnParticles(player.x,player.y,'splash',6);
    logMsg('Filled waterskin');
    gainSkillXP('swimming', 12);
    return;
  }

  if(tree){
    tree.hp--; tree.shake = 8;
    spawnParticles(tree.x,tree.y-20,'chip',5);
    gainSkillXP('woodcutting', 6);
    gainSkillXP('torchcraft', 2);
    if(tree.hp<=0){
      const bonus = player.skills.woodcutting.lvl-1;
      const got = tree.wood + bonus;
      player.wood += got; player.mstat.wood += got;
      logMsg('Felled a tree. +'+got+' wood');
      gainSkillXP('woodcutting', 10);
      gainSkillXP('torchcraft', 8);
      checkMissions();
    }
    else logMsg('Chopping... ('+tree.hp+' left)');
    spendStamina(4);
    return;
  }
  if(bush){
    const bonus = player.skills.foraging.lvl>=3 ? 1 : 0;
    const got = bush.berries + bonus;
    player.berries += got; bush.berries=0;
    bush.regrow = Math.max(20, 60 - player.skills.foraging.lvl*6);
    spawnParticles(bush.x,bush.y,'leaf',4);
    logMsg('Foraged +'+got+' berries');
    gainSkillXP('foraging', 8);
    return;
  }
  if(ore){
    const bonus = player.skills.combat.lvl>=3 ? 1 : 0;
    const got = (Math.random()<0.5?1:2) + bonus;
    if(ore.type==='iron') player.iron += got; else player.copper += got;
    ore.cd = 70;
    spawnParticles(ore.x,ore.y,'chip',4);
    logMsg('Mined +'+got+' '+ore.type);
    return;
  }
  if(rock){
    const bonus = player.skills.combat.lvl>=3 ? 1 : 0;
    const got = (Math.random()<0.5?1:2) + bonus;
    player.stone += got;
    rock.cd = 45;
    spawnParticles(rock.x,rock.y,'chip',4);
    logMsg('Mined +'+got+' stone');
    return;
  }
  if(pond) logMsg('Move close to the shoreline to drink.');
  logMsg('Nothing to gather here.');
}

const FIRE_MAX_LIFE = 420;
const TORCH_DURATION = 60;
const TORCH_COOLDOWN = 30;

function fireBrightness(f){ return clamp(f.life/FIRE_MAX_LIFE, 0, 1); }
function fireProtectionRange(f){ return f.r*(0.72+fireBrightness(f)*0.78); }
function torchBrightness(){
  if(player.torchLife<=0) return 0;
  return clamp((0.68+(player.skills.torchcraft.lvl-2)*0.16)*100, 0, 100);
}
function torchProtectionRange(){
  return 115 + Math.max(0, player.skills.torchcraft.lvl-2)*22;
}

function processWaterMovement(moving, dt){
  player.inWater = false;
  for(const pond of ponds){
    if(isPointInPond(player, pond)){
      player.inWater = true;
      if(player.skills.swimming.lvl>=3 && moving){
        pond.rippleTimer -= dt;
        if(pond.rippleTimer<=0){
          spawnParticles(player.x,player.y,'ripple',1);
          pond.rippleTimer = 0.18;
        }
      }
    }
  }
  keepOutOfPonds(player, player.r, player.skills.swimming.lvl>=3);
}

function craftTorch(){
  const torchcraft = player.skills.torchcraft;
  if(torchcraft.lvl<2){ logMsg('Requires Torchcraft level 2.'); return false; }
  if(player.torchLife>0){ logMsg('Your torch is already burning.'); return false; }
  if(player.torchCooldown>0){ logMsg('Wait '+Math.ceil(player.torchCooldown)+' seconds before making another torch.'); return false; }
  if(player.wood<3){ logMsg('Need 3 wood to make a torch.'); return false; }
  player.wood -= 3;
  player.torchLife = TORCH_DURATION;
  player.torchCooldown = TORCH_COOLDOWN;
  spendStamina(25);
  spawnParticles(player.x,player.y-10,'ember',5);
  logMsg('Torch lit. It cannot be recharged and will last 60 seconds.');
  return true;
}

function buildFire(){
  const fc = player.skills.firecraft.lvl;
  if(fires.length>0){
    const f = fires[0];
    if(dist(f,player) < f.r){
      if(player.wood<1){ logMsg('Need wood to feed the fire.'); return; }
      if(f.life >= FIRE_MAX_LIFE){ logMsg('The fire is already burning strong.'); return; }
      player.wood -= 1;
      const fuel = 45 + (fc-1)*8;
      f.life = clamp(f.life + fuel, 0, FIRE_MAX_LIFE);
      spawnParticles(f.x,f.y-10,'ember',4);
      logMsg('Fed the fire. +'+fuel+' fuel');
      gainSkillXP('firecraft', 5);
    } else {
      logMsg('Only one fire can burn at a time — return to it to add fuel.');
    }
    return;
  }
  const cost = Math.max(3, 5-Math.floor(fc/2));
  if(player.wood<cost){ logMsg('Need '+cost+' wood to build a fire.'); return; }
  player.wood -= cost;
  fires.push({x:player.x, y:player.y, life:200, r:130+(fc-1)*8});
  player.mstat.firesBuilt++;
  logMsg('Campfire built. Warmth restored.');
  gainSkillXP('firecraft', 12);
  checkMissions();
}

function cookMeat(){
  const nearFire = fires.find(f=>dist(f,player)<f.r);
  if(!nearFire){ logMsg('You need to be at a fire to cook.'); return; }
  if(player.rawMeat<=0){ logMsg('No raw meat to cook.'); return; }
  if(player.cookCD>0) return;
  player.cookCD = 1.0;
  player.rawMeat--; player.cookedMeat++;
  player.mstat.cooked++;
  spawnParticles(nearFire.x,nearFire.y-8,'ember',3);
  logMsg('Cooked a piece of meat.');
  checkMissions();
}

function fightNearest(){
  if(player.attackCD>0) return;
  const wpn = WEAPONS[player.weapon];
  const targets = wolves.concat(prey);
  const t = nearestOf(targets, wpn.range);
  player.attackCD = 0.5;
  if(!t) return;
  spendStamina(12);
  t.hp -= wpn.dmg;
  spawnParticles(t.x,t.y,'hit',8);

  if(t.hostile){
    t.hitCD = 0.3;
    screenShake = 6;
    gainSkillXP('combat', 8);
    if(t.hp<=0){
      wolves.splice(wolves.indexOf(t),1);
      logMsg('The '+PREDATOR_STATS[t.kind].name.toLowerCase()+' falls.');
      player.sanity = clamp(player.sanity+4,0,100);
      gainSkillXP('combat', 15);
      player.mstat.predatorKills++;
      checkMissions();
    } else {
      logMsg('You struck the '+PREDATOR_STATS[t.kind].name.toLowerCase()+' with your '+wpn.name.toLowerCase()+'!');
    }
  } else {
    screenShake = 3;
    if(t.hp<=0){
      prey.splice(prey.indexOf(t),1);
      const meat = PREY_STATS[t.kind].meat;
      player.rawMeat += meat;
      logMsg('Took down a '+PREY_STATS[t.kind].name.toLowerCase()+'. +'+meat+' raw meat');
    } else {
      logMsg('You wounded the '+PREY_STATS[t.kind].name.toLowerCase()+'.');
    }
  }
}

function spendStamina(n){
  player.stamina = clamp(player.stamina-n,0,100);
}

function eatRaw(){
  if(player.rawMeat<=0) return;
  player.rawMeat--;
  player.hunger = clamp(player.hunger+18,0,100);
  player.health = clamp(player.health-8,0,100);
  player.sanity = clamp(player.sanity-3,0,100);
  logMsg('Ate raw meat. +18 hunger, but it costs you — -8 health.');
}
function eatCooked(){
  if(player.cookedMeat<=0) return;
  player.cookedMeat--;
  player.hunger = clamp(player.hunger+35,0,100);
  player.health = clamp(player.health+2,0,100);
  logMsg('Ate cooked meat. +35 hunger.');
}

/* ============================= UPDATE ============================= */
let last = performance.now();
let predatorSpawnTimer = 6;
let preySpawnTimer = 8;
let screenShake = 0;
let predatorAlert = 0;
let prevWalkCycle = 0;

function update(dt){
  if(!gameActive || !player.alive || paused) return;

  worldTime += dt / DIFFICULTIES[difficulty].dayLength;
  if(worldTime>=1){
    worldTime-=1; day++;
    logMsg('Day '+day+' begins.');
    if(day>=6){
      checkMissions();
      if(missionIndex>=MISSIONS.length-1) winGame();
      else loseGame('time');
      return;
    }
  }
  const night = isNight(worldTime);

  const wind = windAt(performance.now()/1000);
  weather.nextShift -= dt;
  if(weather.nextShift<=0){
    weather.rainTarget = Math.random()<0.35 ? rand(0.4,1) : 0;
    weather.nextShift = rand(45,90);
    if(weather.rainTarget>0.3) sayMira('Rain coming. If your fire is weak, it might not survive this.');
  }
  weather.rain = lerp(weather.rain, weather.rainTarget, dt*0.3);
  if(Audio_.windGain){
    Audio_.windGain.gain.value = 0.03 + wind.strength*0.09;
    Audio_.windFilter.frequency.value = 350 + wind.strength*500;
  }
  if(Audio_.rainGain) Audio_.rainGain.gain.value = weather.rain*0.14;

  for(const c of clouds){
    c.x += Math.cos(wind.dir)*c.spd*wind.strength*dt*6;
    c.y += Math.sin(wind.dir)*c.spd*wind.strength*dt*3;
    if(c.x>WORLD_W+300) c.x=-300; if(c.x<-300) c.x=WORLD_W+300;
    if(c.y>WORLD_H+300) c.y=-300; if(c.y<-300) c.y=WORLD_H+300;
  }

  let mx=0,my=0;
  if(keys['w']||keys['arrowup']) my-=1;
  if(keys['s']||keys['arrowdown']) my+=1;
  if(keys['a']||keys['arrowleft']) mx-=1;
  if(keys['d']||keys['arrowright']) mx+=1;
  mx += touchMove.x; my += touchMove.y;
  const moving = Math.hypot(mx,my) > 0.15;
  const sprinting = moving && (keys['shift']||mobileSprintOn) && player.stamina>1;
  player.moving = moving;
  player.sprinting = sprinting;
  if(moving){
    const len = Math.hypot(mx,my); mx/=len; my/=len;
    player.dir = Math.atan2(my,mx);
    const spd = player.speed * (sprinting ? 1 : 0.5) * (player.warmth<25?0.7:1);
    player.x = clamp(player.x + mx*spd*dt, 20, WORLD_W-20);
    player.y = clamp(player.y + my*spd*dt, 20, WORLD_H-20);
    player.walkCycle += dt*(sprinting?12:8);
    player.animTime += dt*(sprinting?1.45:1.0);
    if(sprinting) spendStamina(18*dt);

    if(Math.floor(player.walkCycle/Math.PI) !== Math.floor(prevWalkCycle/Math.PI)){
      footprints.push({x:player.x-Math.sin(player.dir)*5, y:player.y+Math.cos(player.dir)*5, life:1, dir:player.dir});
      sfxFootstep();
    }
    prevWalkCycle = player.walkCycle;
  } else {
    player.animTime = 0;
  }
  processWaterMovement(moving, dt);
  if(!player.alive) return;
  if(!moving && player.stamina<100) player.stamina = clamp(player.stamina + 6*dt,0,100);
  else if(!sprinting && player.stamina<100) player.stamina = clamp(player.stamina + 2*dt,0,100);

  for(const fp of footprints){ fp.life -= dt*0.05; }
  footprints = footprints.filter(f=>f.life>0);

  if(keys['e']){ keys['e']=false; tryGather(); }
  if(keys['f']){ keys['f']=false; buildFire(); }
  if(keys[' ']){ keys[' ']=false; fightNearest(); }
  if(keys['r']){ keys['r']=false; cookMeat(); }
  if(keys['t']){ keys['t']=false; craftTorch(); }
  if(player.attackCD>0) player.attackCD -= dt;
  if(player.cookCD>0) player.cookCD -= dt;
  if(player.torchLife>0){
    player.torchLife = Math.max(0, player.torchLife-dt);
    spendStamina(10*dt);
  }
  if(player.torchCooldown>0) player.torchCooldown = Math.max(0, player.torchCooldown-dt);

  const nearFire = fires.find(f=>dist(f,player)<f.r);
  if(Audio_.fireGain) Audio_.fireGain.gain.value = nearFire ? 0.06 : 0;
  if(nearFire && Audio_.ctx && Audio_.ctx.currentTime - Audio_.lastCrackle > rand(0.4,1.1)){
    Audio_.lastCrackle = Audio_.ctx.currentTime;
    sfxClick(rand(1800,3200), 0.06, 'square', 0.03);
  }

  if((player.warmth<45 || (night && player.warmth<70)) && Math.random()<dt*2 && particles.length<90){
    const bx = player.x+Math.cos(player.dir)*14, by = player.y+Math.sin(player.dir)*14;
    particles.push({x:bx,y:by,life:1,type:'breath',vx:Math.cos(player.dir)*8,vy:Math.sin(player.dir)*8-6});
  }
  if(player.health<25 && Audio_.ctx && Audio_.ctx.currentTime - Audio_.lastHeart > 0.85){
    Audio_.lastHeart = Audio_.ctx.currentTime;
    sfxHeartbeat();
  }

  const difficultyRules = DIFFICULTIES[difficulty];
  player.hunger = clamp(player.hunger - 0.55*difficultyRules.decay*dt,0,100);
  const thirstRate = nearFire ? 0.8*1.01 : 0.8;
  player.thirst = clamp(player.thirst - thirstRate*difficultyRules.decay*dt,0,100);

  let warmthDelta = night ? -1.1 : -0.35;
  if(nearFire) warmthDelta = 2.2;
  if(weather.rain>0.3 && !nearFire) warmthDelta -= 0.45*weather.rain;
  player.warmth = clamp(player.warmth + warmthDelta*(nearFire ? 1 : difficultyRules.decay)*dt,0,100);

  let sanityDelta = 0;
  if(night && !nearFire) sanityDelta -= 1.3;
  if(night && nearFire) sanityDelta += 0.6;
  if(!night) sanityDelta += 0.25;
  if(player.warmth<20) sanityDelta -= 0.5;
  const predatorNear = wolves.some(w=>dist(w,player)<220);
  if(predatorNear && night) sanityDelta -= 1.0;
  player.sanity = clamp(player.sanity + sanityDelta*difficultyRules.decay*dt,0,100);

  let dmg = 0;
  if(player.hunger<=0) dmg += 2*difficultyRules.danger*dt;
  if(player.thirst<=0) dmg += 3*difficultyRules.danger*dt;
  if(player.warmth<=0) dmg += 2.5*difficultyRules.danger*dt;
  if(player.sanity<=0) dmg += 1*difficultyRules.danger*dt;
  if(dmg>0) player.health = clamp(player.health-dmg,0,100);
  else if(player.health<100 && player.hunger>30 && player.thirst>30) player.health = clamp(player.health+0.5*dt,0,100);

  if(player.hurtFlash>0) player.hurtFlash -= dt;
  if(screenShake>0) screenShake = Math.max(0,screenShake-dt*30);
  if(predatorAlert>0) predatorAlert = Math.max(0,predatorAlert-dt);

  // fire fuel decay — rain douses fire much faster; firecraft skill resists it
  for(const f of fires){
    let decay = dt;
    if(weather.rain>0.3){
      const resist = Math.max(0.35, 1-(player.skills.firecraft.lvl-1)*0.14);
      decay += dt*2.6*weather.rain*resist;
    }
    f.life -= decay;
  }
  fires = fires.filter(f=>f.life>0);

  for(const b of bushes){ if(b.regrow>0){ b.regrow -= dt; if(b.regrow<=0){ b.berries = (Math.random()*2|0)+1; } } }
  for(const t of trees){ if(t.shake>0) t.shake -= dt*20; }
  for(const r of rocks){ if(r.cd>0) r.cd -= dt; }
  for(const o of ores){ if(o.cd>0) o.cd -= dt; }

  // predator population: starts at 4, scales toward 20 by day 6
  predatorSpawnTimer -= dt;
  const baseMax = clamp((4 + (day-1)*3.2)*difficultyRules.danger, 4, 20);
  const maxPredators = Math.round(night ? baseMax : baseMax*0.55);
  if(predatorSpawnTimer<=0 && wolves.length<maxPredators){ spawnPredator(); predatorSpawnTimer = (night?6:12)/difficultyRules.danger; }

  preySpawnTimer -= dt;
  if(preySpawnTimer<=0 && prey.length<6){ spawnPrey(); preySpawnTimer = rand(14,24); }

  for(const w of wolves){
    const st = PREDATOR_STATS[w.kind];
    if(w.hitCD>0) w.hitCD-=dt;
    const d = dist(w,player);
    const senseRange = (night ? 380 : 200) * st.sense;
    if(d<senseRange && (night || d<90)){
      if(w.state!=='chase') predatorAlert = 0.45;
      w.state='chase';
    } else if(d>senseRange*1.4){
      w.state='wander';
    }
    if(w.state==='chase'){
      const ang = Math.atan2(player.y-w.y, player.x-w.x);
      w.dir = ang;
      w.x += Math.cos(ang)*st.chaseSpd*dt; w.y += Math.sin(ang)*st.chaseSpd*dt;
      w.legPhase += dt*14;
      if(d<26*st.size && w.hitCD<=0){
        const biteDmg = Math.max(4, st.dmg-(player.skills.combat.lvl-1)*1.5);
        player.health = clamp(player.health-biteDmg,0,100);
        player.hurtFlash = 0.3;
        player.sanity = clamp(player.sanity-6,0,100);
        w.hitCD = 1.1;
        screenShake = 10;
        logMsg('The '+st.name.toLowerCase()+' hits you! -'+Math.round(biteDmg)+' health');
      }
    } else {
      w.wanderT -= dt;
      if(w.wanderT<=0){ w.wx=rand(-1,1); w.wy=rand(-1,1); w.wanderT = rand(2,4); }
      w.x += w.wx*st.wanderSpd*dt; w.y += w.wy*st.wanderSpd*dt;
      w.dir = Math.atan2(w.wy,w.wx);
      w.legPhase += dt*6;
    }
    const nf = fires.find(f=>dist(f,w)<fireProtectionRange(f));
    const torchProtects = player.torchLife>0 && dist(w,player)<torchProtectionRange();
    if(nf || torchProtects){
      const source = nf || player;
      const ang = Math.atan2(w.y-source.y, w.x-source.x);
      const fleeSpd = w.state==='chase' ? st.chaseSpd*1.15 : st.wanderSpd*1.5;
      w.x += Math.cos(ang)*fleeSpd*dt; w.y += Math.sin(ang)*fleeSpd*dt;
      w.dir = ang;
      w.state = 'wander';
      w.wanderT = Math.max(w.wanderT, 1.8);
    }
    keepOutOfPonds(w, 18*st.size);
  }

  for(const p of prey){
    const st = PREY_STATS[p.kind];
    const d = dist(p,player);
    if(d<150){
      const ang = Math.atan2(p.y-player.y, p.x-player.x);
      p.dir = ang;
      p.x += Math.cos(ang)*st.speed*dt; p.y += Math.sin(ang)*st.speed*dt;
      p.legPhase += dt*16;
    } else {
      p.wanderT -= dt;
      if(p.wanderT<=0){ p.wx=rand(-1,1); p.wy=rand(-1,1); p.wanderT=rand(2,4); }
      p.x += p.wx*35*dt; p.y += p.wy*35*dt;
      p.dir = Math.atan2(p.wy,p.wx);
      p.legPhase += dt*5;
    }
    keepOutOfPonds(p, p.kind==='deer' ? 14 : 9);
  }
  prey = prey.filter(p=>dist(p,player)<1300);

  // rain particles
  if(weather.rain>0.05 && particles.length<160){
    const n = Math.floor(weather.rain*6);
    for(let i=0;i<n;i++){
      particles.push({x:player.x+rand(-380,380), y:player.y+rand(-300,300), life:1, type:'rain',
        vx:Math.cos(wind.dir)*140*wind.strength, vy:520});
    }
  }
  if(!night && Math.random()<dt*0.06 && birds.length<3){
    const side = Math.random()<0.5?-1:1;
    birds.push({x:player.x+side*420, y:player.y+rand(-260,-120), vx:-side*rand(50,90), vy:rand(-6,6), phase:rand(0,10)});
  }
  for(const bd of birds){ bd.x+=bd.vx*dt; bd.y+=bd.vy*dt; bd.phase+=dt*10; }
  birds = birds.filter(bd=>dist(bd,player)<900);

  const followAngle = player.dir + Math.PI;
  const followX = player.x + Math.cos(followAngle)*42 + Math.sin(player.dir)*24;
  const followY = player.y + Math.sin(followAngle)*42 - Math.cos(player.dir)*24;
  const followRate = Math.min(1, dt*5.5);
  const followDistance = Math.hypot(followX-companion.x, followY-companion.y);
  companion.moving = followDistance > 2;
  if(companion.moving) companion.dir = Math.atan2(followY-companion.y, followX-companion.x);
  companion.x += (followX-companion.x)*followRate;
  companion.y += (followY-companion.y)*followRate;
  keepOutOfPonds(companion, 11);
  companion.animTime = companion.moving ? companion.animTime + dt*(player.sprinting ? 1.7 : 1) : 0;
  companion.bob += dt;
  if(companion.adviceLife>0){
    companion.adviceLife = Math.max(0, companion.adviceLife-dt);
    if(companion.adviceLife===0) companion.advice = '';
  }

  actionPrompt='';
  const t = nearestOf(trees.filter(t=>t.hp>0), 46);
  const b = nearestOf(bushes.filter(b=>b.berries>0), 40);
  const orn = nearestOf(ores.filter(o=>(o.cd||0)<=0), 42);
  const rk = nearestOf(rocks.filter(r=>(r.cd||0)<=0), 42);
  const p = ponds.find(isPondShoreline) || nearestOf(ponds, 140);
  if(t) actionPrompt = 'E — chop tree ('+t.hp+')';
  else if(b) actionPrompt = 'E — forage berries';
  else if(orn) actionPrompt = 'E — mine '+orn.type;
  else if(rk) actionPrompt = 'E — mine stone';
  else if(p) actionPrompt = isPondShoreline(p) ? 'E — drink / fill waterskin' : 'E — move half onto shore to drink';
  else if(fires.length>0 && dist(fires[0],player)<fires[0].r && player.rawMeat>0) actionPrompt = 'R — cook meat';
  else if(fires.length>0 && dist(fires[0],player)<fires[0].r && player.wood>=1 && fires[0].life<FIRE_MAX_LIFE)
    actionPrompt = 'F — feed fire (+'+(45+(player.skills.firecraft.lvl-1)*8)+' fuel)';
  else if(fires.length===0 && player.wood>=Math.max(3,5-Math.floor(player.skills.firecraft.lvl/2))) actionPrompt = 'F — build campfire';

  if(player.health<=0){ loseGame(); }

  updateHUD();
}

window.addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(k==='1' && player.berries>0 && gameActive && !paused){
    player.berries--; player.hunger = clamp(player.hunger+22,0,100);
    logMsg('Ate berries. +22 hunger');
  }
  if(k==='2' && player.water>0 && gameActive && !paused){
    player.water--; player.thirst = clamp(player.thirst+30,0,100);
    logMsg('Drank water. +30 thirst');
  }
  if(k==='3' && gameActive && !paused) eatRaw();
  if(k==='4' && gameActive && !paused) eatCooked();
  if((k==='p' || k==='escape') && gameActive && player.alive){
    togglePause();
  }
});

/* ============================= RENDER ============================= */
let camX=player.x, camY=player.y;
function worldToScreen(x,y){
  return { x: x - camX + canvas.width/2, y: y - camY + canvas.height/2 };
}

const SKY_KEYS = [
  {t:0.00, c:[8,10,24],  a:0.55},
  {t:0.20, c:[15,18,40], a:0.45},
  {t:0.27, c:[255,150,90],a:0.22},
  {t:0.35, c:[255,210,150],a:0.06},
  {t:0.50, c:[210,235,255],a:0.03},
  {t:0.65, c:[255,220,170],a:0.04},
  {t:0.74, c:[255,140,80],a:0.20},
  {t:0.85, c:[70,40,80],  a:0.30},
  {t:1.00, c:[8,10,24],  a:0.55}
];
function getSkyTint(t){
  for(let i=0;i<SKY_KEYS.length-1;i++){
    const a=SKY_KEYS[i], b=SKY_KEYS[i+1];
    if(t>=a.t && t<=b.t){
      const f = (t-a.t)/(b.t-a.t||1);
      return {
        c:[lerp(a.c[0],b.c[0],f), lerp(a.c[1],b.c[1],f), lerp(a.c[2],b.c[2],f)],
        a: lerp(a.a,b.a,f)
      };
    }
  }
  return SKY_KEYS[0];
}

function drawGround(){
  ctx.fillStyle = '#212a1a';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const px0 = Math.floor((camX-canvas.width/2)/160)*160;
  const py0 = Math.floor((camY-canvas.height/2)/160)*160;
  for(let gx=px0; gx<camX+canvas.width/2; gx+=160){
    for(let gy=py0; gy<camY+canvas.height/2; gy+=160){
      const h = Math.abs(Math.sin(gx*12.9898+gy*78.233)*43758.5453)%1;
      if(h>0.55){
        const s = worldToScreen(gx,gy);
        ctx.fillStyle = 'rgba(60,75,45,'+(0.06+h*0.08)+')';
        ctx.beginPath(); ctx.ellipse(s.x,s.y,90,60,0.4,0,Math.PI*2); ctx.fill();
      }
    }
  }

  const gx0 = Math.floor((camX-canvas.width/2)/34)*34;
  const gy0 = Math.floor((camY-canvas.height/2)/34)*34;
  ctx.strokeStyle = 'rgba(120,150,90,0.35)';
  ctx.lineWidth = 1.4;
  for(let gx=gx0; gx<camX+canvas.width/2; gx+=34){
    for(let gy=gy0; gy<camY+canvas.height/2; gy+=34){
      const h = Math.abs(Math.sin(gx*3.31+gy*7.12)*10000)%1;
      if(h>0.6){
        const ox = (h*23)%34, oy=((h*57)%34);
        const s = worldToScreen(gx+ox, gy+oy);
        const lean = Math.sin(performance.now()/900 + gx*0.05)*2;
        ctx.beginPath();
        ctx.moveTo(s.x,s.y);
        ctx.lineTo(s.x+lean, s.y-6-h*4);
        ctx.stroke();
      }
    }
  }
}

function drawFootprints(){
  for(const fp of footprints){
    const s = worldToScreen(fp.x,fp.y);
    if(s.x<-20||s.x>canvas.width+20||s.y<-20||s.y>canvas.height+20) continue;
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.rotate(fp.dir);
    ctx.fillStyle = 'rgba(20,16,10,'+(fp.life*0.28)+')';
    ctx.beginPath(); ctx.ellipse(0,3,1.6,3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,-3,1.6,3,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawCloudShadows(){
  const w = windAt(performance.now()/1000);
  ctx.fillStyle = 'rgba(6,10,6,0.10)';
  for(const c of clouds){
    const s = worldToScreen(c.x,c.y);
    if(s.x<-c.w||s.x>canvas.width+c.w||s.y<-c.h||s.y>canvas.height+c.h) continue;
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.rotate(w.dir*0.2);
    ctx.beginPath(); ctx.ellipse(0,0,c.w*0.5,c.h*0.5,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawBirds(){
  for(const bd of birds){
    const s = worldToScreen(bd.x,bd.y);
    if(s.x<-30||s.x>canvas.width+30||s.y<-30||s.y>canvas.height+30) continue;
    const flap = Math.sin(bd.phase)*4;
    ctx.strokeStyle = 'rgba(20,18,14,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s.x-6,s.y+flap*0.4);
    ctx.quadraticCurveTo(s.x-2,s.y-flap, s.x,s.y);
    ctx.quadraticCurveTo(s.x+2,s.y-flap, s.x+6,s.y+flap*0.4);
    ctx.stroke();
  }
}

function drawPond(p){
  const s = worldToScreen(p.x,p.y);
  if(s.x<-160||s.x>canvas.width+160||s.y<-160||s.y>canvas.height+160) return;
  ctx.fillStyle = 'rgba(60,50,35,0.4)';
  ctx.beginPath(); ctx.ellipse(s.x,s.y,p.r*1.12,p.r*0.8,0,0,Math.PI*2); ctx.fill();

  const grad = ctx.createRadialGradient(s.x-p.r*0.3,s.y-p.r*0.3,2,s.x,s.y,p.r);
  grad.addColorStop(0,'#5fa3b8'); grad.addColorStop(0.6,'#2f6b82'); grad.addColorStop(1,'#173d4d');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(s.x,s.y,p.r,p.r*0.68,0,0,Math.PI*2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.ellipse(s.x,s.y,p.r,p.r*0.68,0,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5;
  for(let i=0;i<3;i++){
    const rp = ((performance.now()/1400 + i*0.33 + p.seed)%1);
    ctx.beginPath();
    ctx.ellipse(s.x,s.y, p.r*rp, p.r*0.68*rp, 0, 0, Math.PI*2);
    ctx.globalAlpha = 1-rp;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if(weather.rain>0.1){
    for(let i=0;i<3;i++){
      const rp = ((performance.now()/500 + i*0.5 + p.seed*3)%1);
      ctx.beginPath();
      ctx.ellipse(s.x+rand(-p.r*0.5,p.r*0.5), s.y+rand(-p.r*0.3,p.r*0.3), p.r*0.18*rp, p.r*0.12*rp, 0, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,'+((1-rp)*weather.rain*0.3)+')';
      ctx.stroke();
    }
  }

  const tint = getSkyTint(worldTime);
  ctx.fillStyle = 'rgba('+tint.c[0]+','+tint.c[1]+','+tint.c[2]+','+(tint.a*0.6)+')';
  ctx.fillRect(s.x-p.r, s.y-p.r*0.68, p.r*2, p.r*1.36);

  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(s.x-p.r*0.32,s.y-p.r*0.28,p.r*0.28,p.r*0.12,-0.4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawFire(f){
  const s = worldToScreen(f.x,f.y);
  const fuelFrac = clamp(f.life/FIRE_MAX_LIFE, 0.12, 1);
  const flick = (0.85+Math.sin(performance.now()/70)*0.15) * (0.55+fuelFrac*0.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowR = f.r*flick*(0.85+fuelFrac*0.9);
  const glow = ctx.createRadialGradient(s.x,s.y,4,s.x,s.y,glowR);
  glow.addColorStop(0,'rgba(255,190,110,'+(0.45+fuelFrac*0.3)+')');
  glow.addColorStop(0.4,'rgba(232,120,60,'+(0.18+fuelFrac*0.1)+')');
  glow.addColorStop(1,'rgba(232,120,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(s.x,s.y,glowR,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.fillStyle='#241a10';
  ctx.save(); ctx.translate(s.x,s.y);
  ctx.rotate(0.5); ctx.fillRect(-10,-3,20,6);
  ctx.rotate(-1.0); ctx.fillRect(-10,-3,20,6);
  ctx.restore();

  const fh = (10+fuelFrac*8)*flick;
  const grad1 = ctx.createLinearGradient(s.x,s.y,s.x,s.y-fh*1.6);
  grad1.addColorStop(0,'#c96a35'); grad1.addColorStop(0.5,'#e8a15c'); grad1.addColorStop(1,'rgba(255,220,150,0.2)');
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.moveTo(s.x-8,s.y-2);
  ctx.quadraticCurveTo(s.x-10,s.y-fh*0.8, s.x-2, s.y-fh*1.6);
  ctx.quadraticCurveTo(s.x+3,s.y-fh*0.9, s.x+8,s.y-2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#fff2c9';
  ctx.beginPath(); ctx.ellipse(s.x,s.y-fh*0.5,4,fh*0.5,0,0,Math.PI*2); ctx.fill();

  // fuel bar below the fire
  const barW = 32;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(s.x-barW/2, s.y+16, barW, 4);
  ctx.fillStyle = fuelFrac>0.3 ? '#e8a15c' : '#c94a3a';
  ctx.fillRect(s.x-barW/2, s.y+16, barW*fuelFrac, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth=1;
  ctx.strokeRect(s.x-barW/2, s.y+16, barW, 4);
}

function drawTorch(){
  if(player.torchLife<=0) return;
  const s = worldToScreen(player.x,player.y);
  const brightness = torchBrightness()/100;
  const flick = 0.9+Math.sin(performance.now()/75)*0.1;
  const radius = 48 + torchProtectionRange()*0.35;
  const glow = ctx.createRadialGradient(s.x,s.y-14,2,s.x,s.y-14,radius);
  glow.addColorStop(0,'rgba(255,225,140,'+(0.45*brightness*flick)+')');
  glow.addColorStop(0.35,'rgba(255,170,70,'+(0.18*brightness)+')');
  glow.addColorStop(1,'rgba(255,130,40,0)');
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=glow;
  ctx.beginPath(); ctx.arc(s.x,s.y-14,radius,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd36a'; ctx.beginPath(); ctx.arc(s.x,s.y-17,3+brightness*2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawTree(t){
  if(isPondNoRender(t.x,t.y,24)) return;
  const spr = t.variant;
  const s = worldToScreen(t.x,t.y);
  if(s.x < -spr.w || s.x > canvas.width+spr.w || s.y < -spr.h || s.y > canvas.height+spr.h) return;
  if(t.hp<=0) return;

  const sh = shadowVec(t.r*0.9);
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,4,'+sh.alpha+')';
  ctx.beginPath();
  ctx.ellipse(s.x+sh.dx*sh.len*0.5, s.y+sh.dy*sh.len*0.5+t.r*0.3, Math.max(6,sh.len*0.55), t.r*0.4, Math.atan2(sh.dy,sh.dx), 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  const windAmt = windAt(performance.now()/1000);
  const sway = Math.sin(performance.now()/1600 + t.sway)*0.03 + Math.sin(performance.now()/450+t.sway*2)*0.012*windAmt.strength;
  const shakeX = t.shake>0 ? Math.sin(t.shake*3)*4 : 0;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(sway);
  ctx.drawImage(spr.img, -spr.cx+shakeX, -spr.cy);
  ctx.restore();
}

function drawRock(r){
  if(isPondNoRender(r.x,r.y,24)) return;
  const spr = r.variant;
  const s = worldToScreen(r.x,r.y);
  if(s.x<-spr.w||s.x>canvas.width+spr.w||s.y<-spr.h||s.y>canvas.height+spr.h) return;
  const sh = shadowVec(r.r*0.7);
  ctx.fillStyle = 'rgba(4,6,4,'+sh.alpha+')';
  ctx.beginPath();
  ctx.ellipse(s.x+sh.dx*sh.len*0.4, s.y+sh.dy*sh.len*0.4+r.r*0.25, Math.max(4,sh.len*0.4), r.r*0.3, Math.atan2(sh.dy,sh.dx), 0, Math.PI*2);
  ctx.fill();
  ctx.drawImage(spr.img, s.x-spr.cx, s.y-spr.cy);
}

function drawBush(b){
  if(isPondNoRender(b.x,b.y,24)) return;
  const s = worldToScreen(b.x,b.y);
  if(s.x<-50||s.x>canvas.width+50||s.y<-50||s.y>canvas.height+50) return;
  const windAmt = windAt(performance.now()/1000);
  const sway = Math.sin(performance.now()/1100 + b.sway)*2 + Math.sin(performance.now()/300+b.sway*3)*windAmt.strength*1.5;
  const sh = shadowVec(b.r*0.6);
  ctx.fillStyle = 'rgba(4,6,4,'+sh.alpha+')';
  ctx.beginPath();
  ctx.ellipse(s.x+sh.dx*sh.len*0.35, s.y+sh.dy*sh.len*0.35+b.r*0.3, Math.max(4,sh.len*0.35), b.r*0.35, Math.atan2(sh.dy,sh.dx), 0, Math.PI*2);
  ctx.fill();

  const clusters = [[-b.r*0.4,0],[b.r*0.4,0],[0,-b.r*0.5],[0,b.r*0.1]];
  for(const [dx,dy] of clusters){
    const grad = ctx.createRadialGradient(s.x+dx+sway*0.2-b.r*0.2,s.y+dy-b.r*0.2,1,s.x+dx+sway*0.2,s.y+dy,b.r*0.75);
    grad.addColorStop(0, b.berries>0?'#48633a':'#3a4c30');
    grad.addColorStop(1, '#233018');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(s.x+dx+sway*0.2, s.y+dy, b.r*0.75, 0, Math.PI*2); ctx.fill();
  }
  if(b.berries>0){
    for(let i=0;i<b.berries;i++){
      const bx = s.x-5+i*5, by = s.y-2;
      ctx.fillStyle = '#8a2a26';
      ctx.beginPath(); ctx.arc(bx,by,2.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(bx-0.8,by-0.8,0.8,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawHpBar(sx,sy,hp,maxHp,w,color){
  if(maxHp<=1 && hp>=maxHp) return;
  const pct = clamp(hp/maxHp,0,1);
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(sx-w/2,sy,w,3);
  ctx.fillStyle= color || (pct>0.5?'#8a3c3c':'#c94a3a');
  ctx.fillRect(sx-w/2,sy,w*pct,3);
}

function drawWolf(w){
  if(isPondNoRender(w.x,w.y,24)) return;
  const st = PREDATOR_STATS[w.kind];
  const s = worldToScreen(w.x,w.y);
  if(s.x<-60||s.x>canvas.width+60||s.y<-60||s.y>canvas.height+60) return;
  const legSwing = Math.sin(w.legPhase)*5;

  const wsh = shadowVec(6);
  ctx.fillStyle='rgba(0,0,0,'+wsh.alpha+')';
  ctx.beginPath(); ctx.ellipse(s.x,s.y+7*st.size,15*st.size,5*st.size,0,0,Math.PI*2); ctx.fill();

  const spriteSize = 46*st.size;
  if(!trySprite(w.kind, s.x, s.y, w.dir||0, spriteSize, spriteSize)){
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.scale(st.size, st.size);
    ctx.rotate(w.dir||0);

    const bodyColor = w.state==='chase' ? '#6e3230' : (w.kind==='tiger'?'#a5651f':(w.kind==='bear'?'#4a3826':'#37352f'));
    const darkColor = w.state==='chase' ? '#4a1f1f' : (w.kind==='tiger'?'#7a4a15':(w.kind==='bear'?'#2e2013':'#231f1c'));

    ctx.strokeStyle = darkColor; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(-8,4); ctx.lineTo(-8+legSwing,9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,4); ctx.lineTo(6-legSwing,9); ctx.stroke();

    ctx.strokeStyle = bodyColor; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-13,0); ctx.lineTo(-20,-4+Math.sin(w.legPhase*0.5)*2); ctx.stroke();

    const bgrad = ctx.createLinearGradient(0,-6,0,6);
    bgrad.addColorStop(0,bodyColor); bgrad.addColorStop(1,darkColor);
    ctx.fillStyle = bgrad;
    ctx.beginPath(); ctx.ellipse(0,0,13,6.5,0,0,Math.PI*2); ctx.fill();

    if(w.kind==='tiger'){
      ctx.strokeStyle='rgba(20,15,10,0.6)'; ctx.lineWidth=1.4;
      for(let i=-8;i<10;i+=4){ ctx.beginPath(); ctx.moveTo(i,-6); ctx.lineTo(i-2,6); ctx.stroke(); }
    }

    ctx.fillStyle = bgrad;
    ctx.beginPath(); ctx.ellipse(13,-1,6,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(17,-1); ctx.lineTo(22,0); ctx.lineTo(17,2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10,-4); ctx.lineTo(9,-9); ctx.lineTo(13,-5); ctx.closePath(); ctx.fill();

    if(w.state==='chase'){
      ctx.fillStyle = '#ffcf5c';
      ctx.beginPath(); ctx.arc(15,-2,1.4,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  drawHpBar(s.x, s.y-18-st.size*6, w.hp, w.maxHp, 22+st.size*6);
}

function drawPrey(p){
  if(isPondNoRender(p.x,p.y,24)) return;
  const st = PREY_STATS[p.kind];
  const s = worldToScreen(p.x,p.y);
  if(s.x<-40||s.x>canvas.width+40||s.y<-40||s.y>canvas.height+40) return;
  const legSwing = Math.sin(p.legPhase)*3;
  const scale = p.kind==='deer' ? 1.3 : 0.8;

  const psh = shadowVec(5);
  ctx.fillStyle='rgba(0,0,0,'+psh.alpha+')';
  ctx.beginPath(); ctx.ellipse(s.x,s.y+6*scale,10*scale,3.5*scale,0,0,Math.PI*2); ctx.fill();

  if(!trySprite(p.kind, s.x, s.y, p.dir||0, 34*scale, 34*scale)){
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.scale(scale,scale);
    ctx.rotate(p.dir||0);

    const color = p.kind==='deer' ? '#8a6a4a' : '#a89070';
    ctx.strokeStyle = color; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-5,3); ctx.lineTo(-5+legSwing,8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,3); ctx.lineTo(4-legSwing,8); ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0,0,9,5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9,-1,4,3,0,0,Math.PI*2); ctx.fill();
    if(p.kind==='rabbit'){
      ctx.beginPath(); ctx.ellipse(-1,-6,1.2,3,0.2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1,-6,1.2,3,-0.2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = '#5a3f28'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(8,-3); ctx.lineTo(11,-7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10,-3); ctx.lineTo(13,-6); ctx.stroke();
    }
    ctx.restore();
  }

  drawHpBar(s.x, s.y-14, p.hp, p.maxHp, 16, '#c9a35c');
}

function drawCompanionAdvice(x, y){
  if(!companion.advice || companion.adviceLife<=0) return;
  const maxWidth = 250;
  const lineHeight = 14;
  const paddingX = 10;
  const paddingY = 8;
  ctx.save();
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  const words = companion.advice.split(/\s+/);
  const lines = [];
  let line = '';
  for(const word of words){
    const candidate = line ? line+' '+word : word;
    if(line && ctx.measureText(candidate).width > maxWidth-paddingX*2){
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if(line) lines.push(line);
  const width = Math.min(maxWidth, Math.max(...lines.map(text=>ctx.measureText(text).width))+paddingX*2);
  const height = lines.length*lineHeight+paddingY*2;
  const left = clamp(x-width/2, 8, canvas.width-width-8);
  const top = Math.max(8, y-height-28);
  ctx.fillStyle = 'rgba(15,13,9,0.82)';
  ctx.strokeStyle = 'rgba(241,205,83,0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(248,231,151,'+Math.min(1, companion.adviceLife)+')';
  lines.forEach((text,index)=>ctx.fillText(text, left+paddingX, top+paddingY+11+index*lineHeight));
  ctx.restore();
}

function drawCompanion(){
  keepOutOfPonds(companion, 11);
  const s = worldToScreen(companion.x,companion.y);
  if(s.x<-60||s.x>canvas.width+60||s.y<-60||s.y>canvas.height+60) return;
  const bob = Math.sin(companion.bob*1.5)*1.2;
  const dirX = Math.cos(companion.dir);
  const dirY = Math.sin(companion.dir);
  const row = Math.abs(dirX)>Math.abs(dirY) ? 1 : (dirY<0 ? 2 : 0);

  const sh = shadowVec(12);
  ctx.fillStyle='rgba(4,6,4,'+(sh.alpha+0.08)+')';
  ctx.beginPath(); ctx.ellipse(sh.dx*sh.len*0.3+s.x, 9+sh.dy*sh.len*0.3+s.y, Math.max(8,sh.len*0.4), 4.5, Math.atan2(sh.dy,sh.dx), 0, Math.PI*2); ctx.fill();

  if(!trySprite('companion', s.x, s.y+bob*0.3, 0, 36, 46, companion.animTime, row, true, dirX<0)){
    ctx.save();
    ctx.translate(s.x, s.y+bob*0.3);
    ctx.fillStyle = '#2e3a3c';
    ctx.beginPath(); ctx.ellipse(0,6,12,12,0,0,Math.PI*2); ctx.fill();
    const bg = ctx.createRadialGradient(-3,-4,1,0,-1,14);
    bg.addColorStop(0,'#8fbfc4'); bg.addColorStop(1,'#4a7a80');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0,-2,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1005';
    ctx.beginPath(); ctx.arc(0,-12,2.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawCompanionAdvice(s.x, s.y+bob*0.3-26);

}

function drawParticle(p){
  const s = worldToScreen(p.x,p.y);
  if(p.type==='hit'){
    ctx.fillStyle = 'rgba(200,60,50,'+p.life+')';
    ctx.beginPath(); ctx.arc(s.x,s.y,3,0,Math.PI*2); ctx.fill();
  } else if(p.type==='chip'){
    ctx.fillStyle = 'rgba(160,120,70,'+p.life+')';
    ctx.fillRect(s.x-1.5,s.y-1.5,3,3);
  } else if(p.type==='leaf'){
    ctx.fillStyle = 'rgba(90,140,60,'+p.life+')';
    ctx.beginPath(); ctx.ellipse(s.x,s.y,3,1.5,p.life*4,0,Math.PI*2); ctx.fill();
  } else if(p.type==='splash'){
    ctx.strokeStyle = 'rgba(180,220,235,'+p.life+')';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(s.x,s.y,(1-p.life)*8,0,Math.PI*2); ctx.stroke();
  } else if(p.type==='ripple'){
    ctx.strokeStyle = 'rgba(180,220,235,'+(p.life*0.7)+')';
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(s.x,s.y,4+(1-p.life)*16,2+(1-p.life)*7,0,0,Math.PI*2); ctx.stroke();
  } else if(p.type==='ember'){
    ctx.fillStyle = 'rgba(255,170,90,'+p.life+')';
    ctx.beginPath(); ctx.arc(s.x,s.y,1.6,0,Math.PI*2); ctx.fill();
  } else if(p.type==='firefly'){
    const flick=(Math.sin(p.x*0.1+performance.now()/300)+1)/2;
    ctx.fillStyle = 'rgba(220,200,120,'+(p.life*flick*0.8)+')';
    ctx.beginPath(); ctx.arc(s.x,s.y,1.8,0,Math.PI*2); ctx.fill();
  } else if(p.type==='breath'){
    ctx.fillStyle = 'rgba(220,225,230,'+(p.life*0.35)+')';
    ctx.beginPath(); ctx.arc(s.x,s.y,(1-p.life)*6+2,0,Math.PI*2); ctx.fill();
  } else if(p.type==='rain'){
    ctx.strokeStyle = 'rgba(180,200,215,'+(p.life*0.5)+')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x,s.y);
    ctx.lineTo(s.x-(p.vx||0)*0.02, s.y-(p.vy||0)*0.02);
    ctx.stroke();
  }
}

function drawFirePreview(){
  if(fires.length===0 && player.wood>=Math.max(3,5-Math.floor(player.skills.firecraft.lvl/2))){
    const ps = worldToScreen(player.x,player.y);
    const pulse = 26+Math.sin(performance.now()/260)*3;
    ctx.save();
    ctx.setLineDash([5,5]);
    ctx.strokeStyle = 'rgba(232,161,92,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ps.x,ps.y,pulse,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232,161,92,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('F to build fire', ps.x, ps.y-pulse-8);
    ctx.restore();
  }
}

function drawPlayer(){
  const ps = worldToScreen(player.x,player.y);
  const moving = player.moving;
  const swimming = player.inWater;
  const phase = player.walkCycle;

  const psh = shadowVec(player.r*0.9);
  ctx.fillStyle = 'rgba(4,6,4,'+(psh.alpha+0.1)+')';
  ctx.beginPath();
  ctx.ellipse(ps.x+psh.dx*psh.len*0.4, ps.y+psh.dy*psh.len*0.4+9, Math.max(6,psh.len*0.4), 4, Math.atan2(psh.dy,psh.dx), 0, Math.PI*2);
  ctx.fill();

  const dx = Math.cos(player.dir), dy = Math.sin(player.dir);
  // player.png rows: down, left, right, up.
  const row = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
  const swimScale = swimming ? 1.12 : 1;
  const spriteY = ps.y + 9;
  const drewSprite = trySprite('player', ps.x, spriteY, 0, player.r*3.6*swimScale, player.r*3.6*swimScale, player.animTime, row, true);
  if(!drewSprite){
    ctx.fillStyle='rgba(232,161,92,0.8)';
    ctx.beginPath(); ctx.arc(ps.x,ps.y,player.r,0,Math.PI*2); ctx.fill();
  }
  if(swimming){
    ctx.strokeStyle='rgba(170,220,230,0.65)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(ps.x,ps.y+10,15+Math.sin(phase)*2,4,0,0,Math.PI*2); ctx.stroke();
  }
  if(player.hurtFlash>0){
    ctx.fillStyle='rgba(255,58,42,0.35)';
    ctx.beginPath(); ctx.arc(ps.x,ps.y,15,0,Math.PI*2); ctx.fill();
  }

  if(player.sanity<30){
    const amt=(30-player.sanity)/30;
    ctx.strokeStyle='rgba(140,90,180,'+(0.15+Math.sin(performance.now()/200)*0.1)*amt+')';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(ps.x,ps.y,20+Math.sin(performance.now()/150)*3,0,Math.PI*2); ctx.stroke();
  }
}

function draw(){
  camX += (player.x-camX)*0.12;
  camY += (player.y-camY)*0.12;

  const shakeX = screenShake>0 ? rand(-screenShake,screenShake) : 0;
  const shakeY = screenShake>0 ? rand(-screenShake,screenShake) : 0;
  ctx.save();
  ctx.translate(shakeX,shakeY);

  drawGround();
  drawCloudShadows();
  drawFootprints();
  for(const p of ponds) drawPond(p);
  for(const r of rocks) drawRock(r);
  for(const o of ores) drawRock(o);
  for(const b of bushes) drawBush(b);
  for(const f of fires) drawFire(f);
  drawBirds();
  drawCompanion();
  for(const t of trees) drawTree(t);
  for(const p of prey) drawPrey(p);
  for(const w of wolves) drawWolf(w);
  drawFirePreview();
  drawPlayer();
  drawTorch();
  for(const pt of particles){
    pt.life -= 0.02;
    pt.x += (pt.vx||0)*0.016; pt.y += (pt.vy||0)*0.016;
    if(pt.vy!==undefined) pt.vy += 40*0.016;
    drawParticle(pt);
  }
  particles = particles.filter(p=>p.life>0);

  if(isNight(worldTime) && Math.random()<0.15 && particles.length<80){
    particles.push({x:player.x+rand(-260,260), y:player.y+rand(-200,200), life:rand(1,2.4), type:'firefly', vx:rand(-5,5), vy:rand(-8,-2)});
  }

  ctx.restore();

  const night = isNight(worldTime);
  let darkness = 0;
  if(worldTime<0.24) darkness = 1 - worldTime/0.24;
  else if(worldTime<0.30) darkness = 0;
  else if(worldTime<0.68) darkness = 0;
  else if(worldTime<0.80) darkness = (worldTime-0.68)/0.12;
  else darkness = 1;
  darkness *= 0.82;

  const tint = getSkyTint(worldTime);
  ctx.fillStyle = 'rgba('+tint.c[0]+','+tint.c[1]+','+tint.c[2]+','+tint.a+')';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  if(darkness>0.01){
    const ps = worldToScreen(player.x,player.y);
    ctx.fillStyle = 'rgba(4,6,14,'+darkness+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const grad = ctx.createRadialGradient(ps.x,ps.y,20,ps.x,ps.y,150);
    grad.addColorStop(0,'rgba(4,6,14,0)'); grad.addColorStop(1,'rgba(4,6,14,'+darkness+')');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(ps.x,ps.y,150,0,Math.PI*2); ctx.fill();
    for(const f of fires){
      const s = worldToScreen(f.x,f.y);
      const fuelFrac = fireBrightness(f);
      const lightR = f.r*(1.15+fuelFrac*2.1);
      const coreR = lightR*(0.2+fuelFrac*0.15);
      const g2 = ctx.createRadialGradient(s.x,s.y,coreR,s.x,s.y,lightR);
      g2.addColorStop(0,'rgba(4,6,14,0)');
      g2.addColorStop(0.28,'rgba(4,6,14,0)');
      g2.addColorStop(0.62,'rgba(4,6,14,'+(darkness*0.28)+')');
      g2.addColorStop(1,'rgba(4,6,14,'+darkness+')');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(s.x,s.y,lightR,0,Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const warmGlow = ctx.createRadialGradient(s.x,s.y,2,s.x,s.y,lightR*0.72);
      warmGlow.addColorStop(0,'rgba(255,180,80,'+(0.12+fuelFrac*0.12)+')');
      warmGlow.addColorStop(1,'rgba(255,120,40,0)');
      ctx.fillStyle = warmGlow;
      ctx.beginPath(); ctx.arc(s.x,s.y,lightR*0.72,0,Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if(player.torchLife>0){
      const ts = worldToScreen(player.x,player.y);
      const torchPower = torchBrightness()/100;
      const torchLightR = torchProtectionRange()*(0.85+torchPower*0.7);
      const torchCoreR = torchLightR*(0.2+torchPower*0.12);
      const tg = ctx.createRadialGradient(ts.x,ts.y,torchCoreR,ts.x,ts.y,torchLightR);
      tg.addColorStop(0,'rgba(4,6,14,0)');
      tg.addColorStop(0.3,'rgba(4,6,14,0)');
      tg.addColorStop(0.65,'rgba(4,6,14,'+(darkness*0.3)+')');
      tg.addColorStop(1,'rgba(4,6,14,'+darkness+')');
      ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(ts.x,ts.y,torchLightR,0,Math.PI*2); ctx.fill();
    }
  }

  if(player.sanity<35){
    const amt = (35-player.sanity)/35;
    ctx.fillStyle = 'rgba(90,40,90,'+(amt*0.14)+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  if(player.health<25){
    const pulse = (Math.sin(performance.now()/300)+1)/2;
    ctx.fillStyle = 'rgba(140,20,20,'+(pulse*0.18)+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  if(predatorAlert>0){
    ctx.fillStyle = 'rgba(210,25,25,'+(predatorAlert*0.32)+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  if(weather.rain>0.05){
    ctx.fillStyle = 'rgba(90,110,130,'+(weather.rain*0.12)+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(200,215,225,'+(weather.rain*0.18)+')';
    ctx.lineWidth = 1;
    const wnd = windAt(performance.now()/1000);
    for(let i=0;i<Math.floor(weather.rain*40);i++){
      const rx = (i*137 + performance.now()*0.4) % (canvas.width+200) - 100;
      const ry = (i*281 + performance.now()*0.9) % (canvas.height+200) - 100;
      ctx.beginPath();
      ctx.moveTo(rx,ry);
      ctx.lineTo(rx+wnd.dir*6, ry+16);
      ctx.stroke();
    }
  }

  const vg = ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*0.3,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*0.7);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = 'overlay';
  const gx = -((performance.now()*0.03)%180), gy = -((performance.now()*0.021)%180);
  for(let x=gx-180; x<canvas.width; x+=180){
    for(let y=gy-180; y<canvas.height; y+=180){
      ctx.drawImage(grainTile, x, y);
    }
  }
  ctx.restore();

  drawMinimap();
}

/* ============================= LOOP ============================= */
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ============================= WIN / LOSE ============================= */
function endGame(title, text){
  gameActive = false;
  document.getElementById('endTitle').textContent = title;
  document.getElementById('endText').textContent = text;
  document.getElementById('endScreen').style.display='flex';
}
function loseGame(reason){
  if(!player.alive) return;
  player.alive = false;
  let cause;
  if(reason==='drowning'){
    cause = 'You crossed the water too many times without learning to swim. The Deepwood took you beneath the surface.';
  } else if(reason==='time'){
    cause = "The sixth dawn came and went. You were still breathing, but the signal never went out — Mira's tasks were never finished, and the Deepwood doesn't let anyone leave halfway.";
  } else {
    cause = 'Your body finally gave out in the Deepwood.';
    if(player.thirst<=0) cause = 'Dehydration claimed you, day '+day+'.';
    else if(player.warmth<=0) cause = 'The cold took you in the night, day '+day+'.';
    else if(player.hunger<=0) cause = 'Starvation caught up with you, day '+day+'.';
  }
  endGame('You Perished', cause);
}
function winGame(){
  gameActive = false;
  endGame('Signal Sent', "You did everything Mira asked of you, and on the sixth dawn the beacon finally caught. Somewhere above the canopy, something hears you — and for the first time in days, you believe you're actually going home.");
}

/* ============================= START ============================= */
document.getElementById('startBtn').addEventListener('click', ()=>{
  document.getElementById('start').style.display='none';
  document.getElementById('hud').style.display='flex';
  document.getElementById('bottomLeft').style.display='flex';
  if(controlMode==='mobile'){ document.getElementById('mobileControls').style.display='block'; }
  setControlMode(controlMode);
  gameActive = true;
  initAudio();
  spawnPredator('wolf'); spawnPredator('wolf'); spawnPredator('wolf'); spawnPredator('wolf');
  sayMira('Hey, I am Meera.');
  updateMissionPanel();
  last = performance.now();
  requestAnimationFrame(loop);
});
document.getElementById('muteBtn').addEventListener('click', ()=>{
  Audio_.muted = !Audio_.muted;
  if(Audio_.master) Audio_.master.gain.value = Audio_.muted?0:0.55;
  if(Audio_.bg) Audio_.bg.muted = Audio_.muted;
  document.getElementById('muteBtn').textContent = 'SOUND: '+(Audio_.muted?'OFF':'ON');
});

})();