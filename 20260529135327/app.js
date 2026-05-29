/* =========================================================
 * FFmpeg 音频特效工坊 - 主程序
 * 架构：
 *  - FFmpeg.wasm: 从 mp4 抽取音轨 / 容器转换
 *  - Web Audio API: 实时音效渲染 + 离线渲染导出
 * ========================================================= */

const $ = (id) => document.getElementById(id);
const log = (msg, type = '') => {
  const el = $('log');
  const line = document.createElement('div');
  line.className = 'line ' + type;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
};
const setStatus = (text, cls = '') => {
  const s = $('status');
  s.textContent = text;
  s.className = 'status ' + cls;
};

/* =========================================================
 * 状态
 * ========================================================= */
const state = {
  audioBuffer: null,       // 解码后的 AudioBuffer
  fileName: '',
  selectedFx: null,
  ctx: null,               // AudioContext (用于试听)
  source: null,            // 当前播放源
  activeNodes: [],         // 试听时启动的所有节点（LFO/噪声等），停止时统一关闭
  outputNode: null,        // 试听时连接到 destination 的最终节点
  ffmpeg: null,
  ffmpegReady: false,
  rendering: false,
};

/* =========================================================
 * 1. 渲染效果卡片
 * ========================================================= */
function renderEffectCards() {
  const grids = document.querySelectorAll('.cat .grid');
  const catKeys = ['reverb', 'comm', 'env', 'narr', 'stereo'];
  catKeys.forEach((catKey, idx) => {
    const grid = grids[idx];
    CATEGORIES[catKey].forEach(key => {
      const fx = EFFECTS[key];
      const card = document.createElement('div');
      card.className = 'fx-card';
      card.dataset.key = key;
      card.innerHTML = `
        <div class="fx-icon">${fx.icon}</div>
        <div class="fx-name">${fx.name}</div>
      `;
      card.addEventListener('click', () => selectEffect(key));
      grid.appendChild(card);
    });
  });
}

function selectEffect(key) {
  state.selectedFx = key;
  document.querySelectorAll('.fx-card').forEach(c => {
    c.classList.toggle('active', c.dataset.key === key);
  });
  const fx = EFFECTS[key];
  $('currentEffect').textContent = `${fx.icon} ${fx.name}`;
  $('effectMeta').textContent = formatEffectMeta(fx);
  if (state.audioBuffer) {
    $('btnPreview').disabled = false;
    $('btnRender').disabled = false;
  }
}

function formatEffectMeta(fx) {
  const lines = [`说明: ${fx.desc}`];
  if (fx.rt60) lines.push(`RT60: ${fx.rt60}s    Pre-Delay: ${fx.preDelay ?? 0}ms    Damping: ${fx.damping ?? 0}`);
  if (fx.hpf || fx.lpf !== undefined) {
    const lo = fx.hpf || 20, hi = fx.lpf || 20000;
    lines.push(`频响: ${lo} Hz ~ ${hi} Hz`);
  }
  if (fx.drive) lines.push(`Drive: ${fx.drive}`);
  if (fx.noise) lines.push(`Noise Floor: ${(fx.noise * 100).toFixed(1)}%`);
  if (fx.stereoWidth) lines.push(`Stereo Width: ${fx.stereoWidth}×`);
  if (fx.hrtf) lines.push(`HRTF: ITD ${fx.hrtf.itd}ms / ILD ${fx.hrtf.ild}dB / Az ${fx.hrtf.azimuth}°`);
  if (fx.echoes) lines.push(`Echoes: ${fx.echoes.map(e => `${e.t}ms@${e.g}`).join(', ')}`);
  if (fx.chorus) lines.push(`Chorus: ${fx.chorus.rate}Hz / depth ${fx.chorus.depth}`);
  if (fx.tremolo) lines.push(`Tremolo: ${fx.tremolo.rate}Hz / depth ${fx.tremolo.depth}`);
  if (fx.autoPan) lines.push(`AutoPan: ${fx.autoPan.rate}Hz`);
  return lines.join('\n');
}

/* =========================================================
 * 2. 文件上传与解码
 * ========================================================= */
function setupUpload() {
  const dz = $('dropzone');
  const input = $('fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });
}

async function handleFile(file) {
  state.fileName = file.name.replace(/\.[^.]+$/, '');
  $('fileName').textContent = file.name;
  $('fileSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
  $('fileInfo').hidden = false;
  $('srcAudio').src = URL.createObjectURL(file);

  setStatus('正在解析音频…', 'busy');
  log(`接收文件 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);

  try {
    let arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();

    // Web Audio 解码
    if (!state.ctx) {
      state.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 优先使用浏览器原生解码（mp4/aac/wav 都支持，零依赖）
    let decoded = null;
    try {
      decoded = await state.ctx.decodeAudioData(arrayBuffer.slice(0));
      if (ext === 'mp4') log('使用浏览器原生解码 MP4 音轨', 'ok');
    } catch (nativeErr) {
      log('原生解码失败，尝试用 FFmpeg 抽取音轨…', 'warn');
      if (ext === 'mp4' || ext === 'm4a' || ext === 'mov') {
        const wavBytes = await ffmpegExtractAudio(arrayBuffer, file.name);
        decoded = await state.ctx.decodeAudioData(wavBytes.buffer.slice(0));
        log('FFmpeg 抽取并解码完成', 'ok');
      } else {
        throw nativeErr;
      }
    }
    state.audioBuffer = decoded;

    $('fileSR').textContent = state.audioBuffer.sampleRate;
    $('fileCh').textContent = state.audioBuffer.numberOfChannels;
    $('fileDur').textContent = state.audioBuffer.duration.toFixed(2) + ' s';

    setStatus('音频就绪', 'ok');
    log(`解码完成 · ${state.audioBuffer.sampleRate}Hz · ${state.audioBuffer.numberOfChannels}ch · ${state.audioBuffer.duration.toFixed(2)}s`, 'ok');

    if (state.selectedFx) {
      $('btnPreview').disabled = false;
      $('btnRender').disabled = false;
    }
  } catch (err) {
    console.error(err);
    setStatus('解码失败', 'err');
    log('错误: ' + err.message, 'err');
  }
}

/* =========================================================
 * 3. FFmpeg.wasm 加载（按需）
 * ========================================================= */
async function ensureFFmpeg() {
  if (state.ffmpegReady) return state.ffmpeg;

  // 检查 SharedArrayBuffer 是否可用
  if (typeof SharedArrayBuffer === 'undefined') {
    const msg = 'SharedArrayBuffer 不可用：请通过 `python3 server.py` 启动服务器（已配置 COOP/COEP），或使用浏览器原生支持的格式（多数 .mp4 可直接播放）。';
    log(msg, 'err');
    throw new Error(msg);
  }

  setStatus('加载 FFmpeg.wasm…', 'busy');
  log('加载本地 FFmpeg.wasm（约 23MB）…');

  // 使用本地文件，避免跨域 COEP 问题
  await loadScript('./ffmpeg/ffmpeg.min.js');
  const { createFFmpeg, fetchFile } = window.FFmpeg;
  const ffmpeg = createFFmpeg({
    log: false,
    corePath: new URL('./ffmpeg/ffmpeg-core.js', location.href).href,
    progress: ({ ratio }) => {
      if (ratio >= 0 && ratio <= 1) setStatus(`FFmpeg ${(ratio * 100).toFixed(0)}%`, 'busy');
    }
  });
  await ffmpeg.load();
  state.ffmpeg = ffmpeg;
  state.fetchFile = fetchFile;
  state.ffmpegReady = true;
  log('FFmpeg.wasm 加载完成', 'ok');
  setStatus('FFmpeg 就绪', 'ok');
  return ffmpeg;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ffmpegExtractAudio(arrayBuffer, name) {
  const ffmpeg = await ensureFFmpeg();
  const inName = 'in_' + name;
  const outName = 'out.wav';
  ffmpeg.FS('writeFile', inName, new Uint8Array(arrayBuffer));
  // 抽取为 PCM 16-bit 立体声 WAV
  await ffmpeg.run('-i', inName, '-vn', '-acodec', 'pcm_s16le', '-ar', '48000', '-ac', '2', outName);
  const data = ffmpeg.FS('readFile', outName);
  ffmpeg.FS('unlink', inName);
  ffmpeg.FS('unlink', outName);
  return data;
}

/* =========================================================
 * 4. 构建音效图（核心）
 *    支持实时（连接到 destination）和离线（OfflineAudioContext）
 * ========================================================= */
function buildEffectGraph(ctx, sourceNode, fx, opts = {}) {
  const userWet = (opts.wet ?? 50) / 100;
  const userGain = dbToGain(opts.gainDb ?? 0);
  const userHpf = opts.hpf ?? 0;
  const userLpf = opts.lpf ?? 20000;
  // 收集所有内部启动的节点（LFO 振荡器 / 噪声源等），停止时统一关闭
  const sinks = opts.sinks || [];

  let head = sourceNode;

  // ---- 单声道化（电话/对讲机/留声机） ----
  if (fx.mono) {
    const merger = ctx.createChannelMerger(2);
    const splitter = ctx.createChannelSplitter(2);
    head.connect(splitter);
    // 左右相加再分发到两声道
    const monoGain = ctx.createGain();
    monoGain.gain.value = 0.5;
    splitter.connect(monoGain, 0);
    splitter.connect(monoGain, 1);
    monoGain.connect(merger, 0, 0);
    monoGain.connect(merger, 0, 1);
    head = merger;
  }

  // ---- 带通：HPF / LPF ----
  const hpfFreq = Math.max(fx.hpf || 0, userHpf);
  if (hpfFreq > 20) {
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hpfFreq;
    hpf.Q.value = 0.707;
    head.connect(hpf); head = hpf;
  }
  const lpfFreq = Math.min(fx.lpf || 20000, userLpf);
  if (lpfFreq < 19000) {
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = lpfFreq;
    lpf.Q.value = 0.707;
    head.connect(lpf); head = lpf;
  }

  // ---- 失真（电话 / 对讲机 / 老唱片） ----
  if (fx.drive) {
    const ws = ctx.createWaveShaper();
    ws.curve = makeDistortionCurve(fx.drive);
    ws.oversample = '2x';
    head.connect(ws); head = ws;
  }

  // ---- Chorus（梦境 / 水下 / 太空） ----
  if (fx.chorus) {
    head = applyChorus(ctx, head, fx.chorus, sinks);
  }

  // ---- Tremolo（回忆 / 老收音机） ----
  if (fx.tremolo) {
    head = applyTremolo(ctx, head, fx.tremolo, sinks);
  }

  // ---- Wow & Flutter（留声机） ----
  if (fx.wow) {
    head = applyWow(ctx, head, fx.wow, sinks);
  }

  // ---- 立体声宽度 / Auto Pan ----
  if (fx.stereoWidth && fx.stereoWidth !== 1) {
    head = applyStereoWidth(ctx, head, fx.stereoWidth);
  }
  if (fx.autoPan) {
    head = applyAutoPan(ctx, head, fx.autoPan, sinks);
  }

  // ---- HRTF / 双耳 ----
  if (fx.hrtf) {
    head = applyHRTF(ctx, head, fx.hrtf);
  }

  // ---- 早期反射 + 离散回声 ----
  const dryWet = ctx.createGain();
  const wetBus = ctx.createGain();
  const dryBus = ctx.createGain();
  head.connect(dryBus);
  head.connect(wetBus);

  if (fx.earlyRefs) {
    fx.earlyRefs.forEach(r => {
      const d = ctx.createDelay(1.0);
      d.delayTime.value = r.t / 1000;
      const g = ctx.createGain();
      g.gain.value = r.g;
      head.connect(d).connect(g).connect(wetBus);
    });
  }
  if (fx.echoes) {
    fx.echoes.forEach(e => {
      const d = ctx.createDelay(2.0);
      d.delayTime.value = e.t / 1000;
      const g = ctx.createGain();
      g.gain.value = e.g;
      head.connect(d).connect(g).connect(wetBus);
    });
  }

  // ---- 卷积混响（合成 IR） ----
  if (fx.rt60) {
    const conv = ctx.createConvolver();
    conv.buffer = makeReverbIR(ctx, fx.rt60, fx.preDelay || 0, fx.damping || 0.3);
    const cWet = ctx.createGain();
    cWet.gain.value = fx.reverbMix !== undefined ? fx.reverbMix : (fx.mix ?? 0.5);
    head.connect(conv).connect(cWet).connect(wetBus);
  }

  // ---- 混合：干 + 湿 ----
  // userWet 控制整体湿度
  dryBus.gain.value = 1 - userWet * 0.6; // 不让干声完全消失
  wetBus.gain.value = userWet * 1.2;
  dryBus.connect(dryWet);
  wetBus.connect(dryWet);

  // ---- 噪声层（对讲机/老收音机/留声机） ----
  if (fx.noise || fx.crackle) {
    const noise = makeNoiseSource(ctx, fx.noise || 0, fx.crackle || 0, ctx.sampleRate, opts.duration);
    if (noise) {
      noise.connect(dryWet);
      sinks.push(noise);
    }
  }

  // ---- 主增益 ----
  const out = ctx.createGain();
  out.gain.value = userGain * (fx.gain ? dbToGain(fx.gain) : 1);
  dryWet.connect(out);

  return out;
}

/* ========== DSP 工具 ========== */
function dbToGain(db) { return Math.pow(10, db / 20); }

function makeDistortionCurve(amount) {
  // amount 0..1
  const k = amount * 100;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * 合成卷积混响 IR：
 *  - 早期反射前的预延迟
 *  - 衰减为 e^(-6.91 * t / RT60) 对应 -60dB
 *  - damping 通过对噪声做低通衰减实现
 */
function makeReverbIR(ctx, rt60, preDelayMs, damping) {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * (preDelayMs / 1000 + rt60));
  const ir = ctx.createBuffer(2, length, sr);
  const preDelaySamples = Math.floor(sr * preDelayMs / 1000);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lastLp = 0;
    const lpCoef = 1 - damping; // damping 越高，lpCoef 越小
    for (let i = preDelaySamples; i < length; i++) {
      const t = (i - preDelaySamples) / sr;
      const decay = Math.exp(-6.91 * t / rt60);
      const noise = (Math.random() * 2 - 1);
      // 简单一阶低通模拟空气吸收
      lastLp = lastLp + lpCoef * (noise - lastLp);
      data[i] = lastLp * decay;
    }
  }
  return ir;
}

function applyChorus(ctx, input, { rate, depth }, sinks = []) {
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = 0.025;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(delay.delayTime);
  lfo.start();
  sinks.push(lfo);

  const wet = ctx.createGain(); wet.gain.value = 0.5;
  const dry = ctx.createGain(); dry.gain.value = 0.7;
  const sum = ctx.createGain();
  input.connect(dry).connect(sum);
  input.connect(delay).connect(wet).connect(sum);
  return sum;
}

function applyTremolo(ctx, input, { rate, depth }, sinks = []) {
  const trem = ctx.createGain();
  trem.gain.value = 1 - depth;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(trem.gain);
  lfo.start();
  sinks.push(lfo);
  input.connect(trem);
  return trem;
}

function applyWow(ctx, input, { rate, depth }, sinks = []) {
  // 用调制延迟模拟唱片转速抖动
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = 0.01;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(delay.delayTime);
  lfo.start();
  sinks.push(lfo);
  input.connect(delay);
  return delay;
}

function applyStereoWidth(ctx, input, width) {
  // Mid/Side 处理：Mid = (L+R)/2, Side = (L-R)/2
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  input.connect(splitter);

  // 左右分别 ±gain 实现宽度调整（简化版）
  const lInv = ctx.createGain(); lInv.gain.value = -1;
  const rInv = ctx.createGain(); rInv.gain.value = -1;

  // mid = 0.5*(L+R)
  const midL = ctx.createGain(); midL.gain.value = 0.5;
  const midR = ctx.createGain(); midR.gain.value = 0.5;
  // side = 0.5*(L-R)
  const sideL = ctx.createGain(); sideL.gain.value = 0.5;
  const sideR = ctx.createGain(); sideR.gain.value = -0.5;

  const mid = ctx.createGain(); mid.gain.value = 1;
  const side = ctx.createGain(); side.gain.value = width;

  splitter.connect(midL, 0); splitter.connect(midR, 1);
  midL.connect(mid); midR.connect(mid);

  splitter.connect(sideL, 0); splitter.connect(sideR, 1);
  sideL.connect(side); sideR.connect(side);

  // L = mid + side, R = mid - side
  const sideInv = ctx.createGain(); sideInv.gain.value = -1;
  side.connect(sideInv);

  mid.connect(merger, 0, 0);
  side.connect(merger, 0, 0);
  mid.connect(merger, 0, 1);
  sideInv.connect(merger, 0, 1);
  return merger;
}

function applyAutoPan(ctx, input, { rate, depth }, sinks = []) {
  const panner = ctx.createStereoPanner();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(panner.pan);
  lfo.start();
  sinks.push(lfo);
  input.connect(panner);
  return panner;
}

function applyHRTF(ctx, input, { itd, ild, azimuth }) {
  // 简化 HRTF：左右声道分别做时间差(ITD)+电平差(ILD)+方位频率染色
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  input.connect(splitter);

  const azRad = (azimuth || 0) * Math.PI / 180;
  const sinA = Math.sin(azRad);

  // 右耳延迟更大（声源在左侧时）
  const delayL = ctx.createDelay(0.005);
  const delayR = ctx.createDelay(0.005);
  if (sinA >= 0) {
    delayR.delayTime.value = (itd / 1000);
  } else {
    delayL.delayTime.value = (itd / 1000);
  }

  const gainL = ctx.createGain();
  const gainR = ctx.createGain();
  const ildLin = dbToGain(ild);
  if (sinA >= 0) {
    gainL.gain.value = 1;
    gainR.gain.value = 1 / ildLin;
  } else {
    gainL.gain.value = 1 / ildLin;
    gainR.gain.value = 1;
  }

  // 头部遮挡造成对侧高频衰减
  const shadowL = ctx.createBiquadFilter();
  const shadowR = ctx.createBiquadFilter();
  shadowL.type = 'lowpass'; shadowR.type = 'lowpass';
  shadowL.frequency.value = sinA < 0 ? 6000 : 18000;
  shadowR.frequency.value = sinA > 0 ? 6000 : 18000;

  splitter.connect(delayL, 0).connect(gainL).connect(shadowL).connect(merger, 0, 0);
  splitter.connect(delayR, 1).connect(gainR).connect(shadowR).connect(merger, 0, 1);
  return merger;
}

function makeNoiseSource(ctx, noiseLevel, crackleLevel, sr, duration) {
  const len = Math.floor((duration || 5) * sr);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      let v = (Math.random() * 2 - 1) * noiseLevel;
      if (crackleLevel > 0 && Math.random() < 0.0008 * crackleLevel) {
        v += (Math.random() * 2 - 1) * 0.6;
      }
      d[i] = v;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

/* =========================================================
 * 5. 实时试听
 * ========================================================= */
function setupControls() {
  // 滑块联动
  const sliders = ['wet','gain','hpf','lpf'];
  const fmt = {
    wet: v => v + '%',
    gain: v => (v >= 0 ? '+' : '') + v + ' dB',
    hpf: v => v == 0 ? '关' : v + ' Hz',
    lpf: v => v >= 20000 ? '关' : v + ' Hz',
  };
  sliders.forEach(id => {
    const el = $(id);
    const upd = () => $(id + 'Val').textContent = fmt[id](Number(el.value));
    el.addEventListener('input', upd);
    upd();
  });

  $('btnPreview').addEventListener('click', startPreview);
  $('btnStop').addEventListener('click', stopPreview);
  $('btnRender').addEventListener('click', renderToFile);
}

function startPreview() {
  if (!state.audioBuffer || !state.selectedFx) return;
  stopPreview();
  if (state.ctx.state === 'suspended') state.ctx.resume();

  const sinks = [];
  const src = state.ctx.createBufferSource();
  src.buffer = state.audioBuffer;
  sinks.push(src);

  const fx = EFFECTS[state.selectedFx];
  const opts = readUserOpts(state.audioBuffer.duration);
  opts.sinks = sinks;
  const out = buildEffectGraph(state.ctx, src, fx, opts);
  out.connect(state.ctx.destination);

  src.start();
  state.source = src;
  state.activeNodes = sinks;
  state.outputNode = out;
  log(`试听：${fx.name}`);
  src.onended = () => {
    // 自然播放结束，也清理掉所有 LFO/噪声节点
    if (state.source === src) stopPreview();
  };
}

function stopPreview() {
  // 停止主播放源
  if (state.source) {
    try { state.source.onended = null; state.source.stop(); } catch (e) {}
    state.source = null;
  }
  // 停止所有 LFO / 噪声源
  if (state.activeNodes && state.activeNodes.length) {
    state.activeNodes.forEach(n => {
      try { n.stop && n.stop(); } catch (e) {}
      try { n.disconnect && n.disconnect(); } catch (e) {}
    });
    state.activeNodes = [];
  }
  // 断开输出节点链路
  if (state.outputNode) {
    try { state.outputNode.disconnect(); } catch (e) {}
    state.outputNode = null;
  }
}

function readUserOpts(duration) {
  return {
    wet: Number($('wet').value),
    gainDb: Number($('gain').value),
    hpf: Number($('hpf').value),
    lpf: Number($('lpf').value),
    duration,
  };
}

/* =========================================================
 * 6. 离线渲染 + 导出 WAV
 * ========================================================= */
async function renderToFile() {
  if (!state.audioBuffer || !state.selectedFx) return;
  if (state.rendering) return;
  state.rendering = true;
  $('btnRender').disabled = true;
  setStatus('离线渲染中…', 'busy');
  log('开始离线渲染…');

  try {
    const ab = state.audioBuffer;
    const offline = new OfflineAudioContext(
      ab.numberOfChannels, ab.length, ab.sampleRate
    );
    const src = offline.createBufferSource();
    src.buffer = ab;
    const fx = EFFECTS[state.selectedFx];
    const opts = readUserOpts(ab.duration);
    const out = buildEffectGraph(offline, src, fx, opts);
    out.connect(offline.destination);
    src.start();

    const rendered = await offline.startRendering();
    log('渲染完成，编码 WAV…', 'ok');

    const wavBlob = audioBufferToWavBlob(rendered);
    const url = URL.createObjectURL(wavBlob);
    $('outAudio').src = url;
    const dl = $('downloadLink');
    dl.href = url;
    dl.download = `${state.fileName}_${fx.name}.wav`;
    dl.hidden = false;

    setStatus('已导出 WAV', 'ok');
    log(`导出 ${(wavBlob.size/1024/1024).toFixed(2)} MB`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('渲染失败', 'err');
    log('错误：' + err.message, 'err');
  } finally {
    state.rendering = false;
    $('btnRender').disabled = false;
  }
}

/* AudioBuffer -> WAV (PCM 16-bit) */
function audioBufferToWavBlob(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(len);
  const view = new DataView(ab);

  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, len - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, len - 44, true);

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/* =========================================================
 * 启动
 * ========================================================= */
window.addEventListener('DOMContentLoaded', () => {
  renderEffectCards();
  setupUpload();
  setupControls();

  // 环境检查
  const sab = typeof SharedArrayBuffer !== 'undefined';
  const ci = self.crossOriginIsolated;
  if (sab && ci) {
    log('环境检查 ✓ SharedArrayBuffer 可用，FFmpeg.wasm 全功能就绪', 'ok');
  } else {
    log(`环境提示：SharedArrayBuffer ${sab ? '✓' : '✗'} / crossOriginIsolated ${ci ? '✓' : '✗'}`, 'warn');
    log('如需处理 mp4 兜底（FFmpeg 抽轨），请运行：python3 server.py', 'warn');
    log('当前模式：浏览器原生解码（mp4 多数可直接读取 AAC 音轨）', 'warn');
  }

  log('应用已就绪。请上传 mp4 / wav 文件并选择效果。');
});
