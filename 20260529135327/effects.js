/**
 * 21 种音效预设 - 基于真实声学数据
 *
 * 参数说明：
 * - rt60:        混响衰减时间（秒），ISO 3382 标准
 * - preDelay:    预延迟（毫秒），声音直达声后第一个反射的时间
 * - damping:     高频衰减（0-1），模拟空气吸收和墙面材质
 * - hpf / lpf:   带通滤波（Hz），模拟介质/设备频响
 * - drive:       谐波失真量（0-1），模拟设备非线性
 * - delay:       回声延迟（毫秒）
 * - feedback:    回声反馈（0-1）
 * - stereoWidth: 立体声宽度（0-2），1 为正常
 * - itd:         双耳时间差（毫秒），用于 HRTF 空间感
 * - mix:         干湿比（0-1）
 *
 * 数据来源：
 * - 房间混响：MIT/IRCAM 实测脉冲响应数据库
 * - 电话频响：ITU-T G.712 (300-3400 Hz)
 * - 老式收音机：AM 调幅广播频响 (200-4000 Hz)
 * - 留声机：78 RPM 黑胶唱片频响 (250-3500 Hz)
 * - HRTF：MIT KEMAR 假人头数据集
 */

const EFFECTS = {
  /* ======================== 1. 空间混响 ======================== */
  hall: {
    name: '大厅', icon: '🏛️', cat: 'reverb',
    desc: '音乐厅 / 体积约 15000 m³ / RT60 ≈ 2.0s',
    rt60: 2.0, preDelay: 80, damping: 0.3, hpf: 80, lpf: 12000, mix: 0.55,
    earlyRefs: [{t:30,g:0.5},{t:55,g:0.4},{t:80,g:0.35},{t:120,g:0.28}]
  },
  church: {
    name: '教堂', icon: '⛪', cat: 'reverb',
    desc: '哥特教堂 / 高混响 / RT60 ≈ 4.5s / 强低频共振',
    rt60: 4.5, preDelay: 120, damping: 0.2, hpf: 60, lpf: 8000, mix: 0.6,
    earlyRefs: [{t:40,g:0.55},{t:75,g:0.45},{t:110,g:0.38},{t:160,g:0.3},{t:220,g:0.22}]
  },
  bathroom: {
    name: '浴室', icon: '🛁', cat: 'reverb',
    desc: '瓷砖小空间 / RT60 ≈ 0.8s / 高频丰富 / 多早期反射',
    rt60: 0.8, preDelay: 8, damping: 0.05, hpf: 100, lpf: 16000, mix: 0.5,
    earlyRefs: [{t:5,g:0.6},{t:11,g:0.55},{t:18,g:0.5},{t:25,g:0.42}]
  },
  smallRoom: {
    name: '小房间', icon: '🛋️', cat: 'reverb',
    desc: '20 m² 客厅 / 软装多 / RT60 ≈ 0.4s',
    rt60: 0.4, preDelay: 12, damping: 0.5, hpf: 90, lpf: 10000, mix: 0.35,
    earlyRefs: [{t:8,g:0.4},{t:16,g:0.32},{t:25,g:0.22}]
  },
  studio: {
    name: '录音棚', icon: '🎙️', cat: 'reverb',
    desc: '专业声学处理 / RT60 ≈ 0.25s / 干净无染色',
    rt60: 0.25, preDelay: 5, damping: 0.45, hpf: 50, lpf: 18000, mix: 0.2,
    earlyRefs: [{t:6,g:0.3},{t:14,g:0.18}]
  },

  /* ======================== 2. 通讯效果 ======================== */
  phone: {
    name: '电话', icon: '📞', cat: 'comm',
    desc: 'ITU-T G.712 标准 / 300-3400 Hz / 轻微失真',
    hpf: 300, lpf: 3400, drive: 0.15, mix: 1.0, mono: true
  },
  walkie: {
    name: '对讲机', icon: '📻', cat: 'comm',
    desc: 'VHF 窄带 / 400-3000 Hz / 强压缩 / 嘶嘶噪声',
    hpf: 400, lpf: 3000, drive: 0.35, noise: 0.04, mix: 1.0, mono: true,
    squelch: true
  },
  oldRadio: {
    name: '老式收音机', icon: '📡', cat: 'comm',
    desc: 'AM 调幅广播 / 200-4000 Hz / 调谐噪声',
    hpf: 200, lpf: 4000, drive: 0.2, noise: 0.025, mix: 1.0, mono: true,
    tremolo: { rate: 0.7, depth: 0.15 }
  },
  gramophone: {
    name: '留声机', icon: '💿', cat: 'comm',
    desc: '78 RPM 黑胶 / 250-3500 Hz / 唱针噪声 + 抖动',
    hpf: 250, lpf: 3500, drive: 0.25, noise: 0.05, crackle: 0.6, mix: 1.0, mono: true,
    wow: { rate: 0.5, depth: 0.008 }
  },

  /* ======================== 3. 环境模拟 ======================== */
  underwater: {
    name: '水下', icon: '🌊', cat: 'env',
    desc: '水中传播 / 高频被强吸收 / 低通 ~800Hz / 慢调制',
    hpf: 0, lpf: 800, mix: 1.0,
    rt60: 0.6, preDelay: 5, damping: 0.95, reverbMix: 0.3,
    chorus: { rate: 0.3, depth: 0.005 }
  },
  throughDoor: {
    name: '隔门', icon: '🚪', cat: 'env',
    desc: '木门遮挡 / 高频衰减 12-15 dB / 低通 ~2.5kHz',
    hpf: 100, lpf: 2500, mix: 1.0, gain: -6,
    rt60: 0.5, preDelay: 10, damping: 0.7, reverbMix: 0.25
  },
  throughWall: {
    name: '隔墙', icon: '🧱', cat: 'env',
    desc: '砖墙遮挡 / 高频衰减 25-30 dB / 低通 ~700Hz',
    hpf: 80, lpf: 700, mix: 1.0, gain: -10,
    rt60: 0.7, preDelay: 15, damping: 0.85, reverbMix: 0.3
  },
  space: {
    name: '太空', icon: '🚀', cat: 'env',
    desc: '艺术化太空音效 / 极长混响 / 低频共振 / 调制感',
    rt60: 6.0, preDelay: 100, damping: 0.4, hpf: 60, lpf: 6000, mix: 0.7,
    earlyRefs: [{t:50,g:0.4},{t:120,g:0.35},{t:200,g:0.28},{t:320,g:0.2}],
    chorus: { rate: 0.2, depth: 0.012 }
  },
  valley: {
    name: '山谷', icon: '⛰️', cat: 'env',
    desc: '开阔地形 / 多次离散回声 / 250-450ms 间隔',
    rt60: 1.5, preDelay: 250, damping: 0.4, hpf: 120, lpf: 9000, mix: 0.45,
    echoes: [{t:280,g:0.55},{t:560,g:0.35},{t:850,g:0.22},{t:1140,g:0.13}]
  },

  /* ======================== 4. 叙事效果 ======================== */
  monologue: {
    name: '内心独白', icon: '💭', cat: 'narr',
    desc: '近距离 / 紧贴感 / 极少混响 / 轻微低通',
    hpf: 80, lpf: 9000, mix: 1.0,
    rt60: 0.3, preDelay: 5, damping: 0.6, reverbMix: 0.15,
    proximity: 0.6
  },
  memory: {
    name: '回忆', icon: '📼', cat: 'narr',
    desc: '怀旧暖色调 / 中频突出 / 轻颤音 / 中等混响',
    hpf: 200, lpf: 6000, mix: 1.0,
    rt60: 1.2, preDelay: 30, damping: 0.5, reverbMix: 0.4,
    tremolo: { rate: 4, depth: 0.06 }
  },
  dream: {
    name: '梦境', icon: '🌙', cat: 'narr',
    desc: '飘渺 / 强 chorus / 长混响 / 高频弱',
    hpf: 100, lpf: 7000, mix: 1.0,
    rt60: 3.0, preDelay: 60, damping: 0.5, reverbMix: 0.55,
    chorus: { rate: 0.4, depth: 0.02 }
  },
  flashback: {
    name: '闪回', icon: '⚡', cat: 'narr',
    desc: '锐利反射 / 短促回声 / 突出 1-3kHz / 制造紧迫感',
    hpf: 300, lpf: 8000, mix: 1.0,
    rt60: 0.6, preDelay: 20, damping: 0.3, reverbMix: 0.45,
    echoes: [{t:120,g:0.5},{t:240,g:0.3}],
    presence: 0.4
  },

  /* ======================== 5. 立体声 / 空间 ======================== */
  stereoWide: {
    name: '立体声扩展', icon: '↔️', cat: 'stereo',
    desc: 'M/S 处理 / 侧向增益 +6dB / 宽度 1.6×',
    stereoWidth: 1.6, mix: 1.0
  },
  surround3d: {
    name: '3D 环绕', icon: '🎡', cat: 'stereo',
    desc: '声像自动旋转 / 0.25 Hz / 配合中等混响',
    stereoWidth: 1.3, autoPan: { rate: 0.25, depth: 0.9 }, mix: 1.0,
    rt60: 1.0, preDelay: 25, damping: 0.5, reverbMix: 0.25
  },
  hrtf: {
    name: 'HRTF', icon: '👂', cat: 'stereo',
    desc: 'MIT KEMAR / ITD 0.6ms / ILD 6dB / 头部相关传函',
    hrtf: { itd: 0.6, ild: 6, azimuth: 45 }, mix: 1.0
  },
  binaural: {
    name: '双耳渲染', icon: '🎧', cat: 'stereo',
    desc: '虚拟环绕 / 模拟头部声学 / 适合耳机播放',
    hrtf: { itd: 0.5, ild: 4, azimuth: 30 },
    rt60: 0.8, preDelay: 15, damping: 0.5, reverbMix: 0.3,
    stereoWidth: 1.4, mix: 1.0
  }
};

const CATEGORIES = {
  reverb: ['hall', 'church', 'bathroom', 'smallRoom', 'studio'],
  comm: ['phone', 'walkie', 'oldRadio', 'gramophone'],
  env: ['underwater', 'throughDoor', 'throughWall', 'space', 'valley'],
  narr: ['monologue', 'memory', 'dream', 'flashback'],
  stereo: ['stereoWide', 'surround3d', 'hrtf', 'binaural']
};
