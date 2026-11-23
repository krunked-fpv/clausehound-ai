/**
 * ClauseHound Local — Faraday Brass Desk Procedural Acoustic Engine
 * Synthesizes tactile Foley desk acoustics and shielded room ambience purely
 * via mathematical WebAudio signal processing with 0 KB external audio assets.
 */

export const MIX_PRESETS = Object.freeze({
  silent: 0.0,
  whisper: 0.32,
  studio: 0.85
});

const DEFAULT_SAMPLE_RATE = 44100;
const NOISE_DURATION_SEC = 1.6;
const AMBIENT_BUS_TARGET_GAIN = 0.28;

/**
 * Clamps a numeric value to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (value <= min) return min;
  if (value >= max) return max;
  return value;
}

/**
 * Returns a finite number or fallback.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function finiteOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Deterministic fast PRNG (Mulberry32) for consistent organic noise synthesis.
 * @param {number} seed
 * @returns {() => number}
 */
function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Safely populates a mono AudioBuffer with white noise in [-0.95, 0.95].
 * @param {AudioContext} ctx
 * @param {number} durationSec
 * @returns {AudioBuffer | null}
 */
function createWhiteNoiseBuffer(ctx, durationSec = NOISE_DURATION_SEC) {
  if (!ctx || typeof ctx.createBuffer !== "function") return null;
  const sampleRate = Math.max(8000, Math.floor(finiteOr(ctx.sampleRate, DEFAULT_SAMPLE_RATE)));
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  if (!buffer || typeof buffer.getChannelData !== "function") return buffer;
  const data = buffer.getChannelData(0);
  const rand = createPrng(0x43484c01);
  for (let i = 0; i < length; i += 1) {
    data[i] = (rand() * 2 - 1) * 0.95;
  }
  return buffer;
}

/**
 * Safely populates a mono AudioBuffer with -3 dB/octave Voss-Kellet pink noise.
 * @param {AudioContext} ctx
 * @param {number} durationSec
 * @returns {AudioBuffer | null}
 */
function createPinkNoiseBuffer(ctx, durationSec = NOISE_DURATION_SEC) {
  if (!ctx || typeof ctx.createBuffer !== "function") return null;
  const sampleRate = Math.max(8000, Math.floor(finiteOr(ctx.sampleRate, DEFAULT_SAMPLE_RATE)));
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  if (!buffer || typeof buffer.getChannelData !== "function") return buffer;
  const data = buffer.getChannelData(0);
  const rand = createPrng(0x43484c02);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i += 1) {
    const white = rand() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    data[i] = clamp(pink, -0.95, 0.95);
  }
  return buffer;
}

/**
 * Safely populates a mono AudioBuffer with sparse jittered-grid velvet noise,
 * suited for cotton paper fiber and capillary nib micro-grain.
 * @param {AudioContext} ctx
 * @param {number} durationSec
 * @returns {AudioBuffer | null}
 */
function createVelvetNoiseBuffer(ctx, durationSec = NOISE_DURATION_SEC) {
  if (!ctx || typeof ctx.createBuffer !== "function") return null;
  const sampleRate = Math.max(8000, Math.floor(finiteOr(ctx.sampleRate, DEFAULT_SAMPLE_RATE)));
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  if (!buffer || typeof buffer.getChannelData !== "function") return buffer;
  const data = buffer.getChannelData(0);
  const rand = createPrng(0x43484c03);

  const impulseDensity = 2800; // impulses per second
  const gridSize = Math.max(4, Math.floor(sampleRate / impulseDensity));
  for (let gridStart = 0; gridStart < length; gridStart += gridSize) {
    const pos = gridStart + Math.floor(rand() * Math.min(gridSize, length - gridStart));
    const sign = rand() < 0.5 ? -1 : 1;
    const amp = 0.65 + rand() * 0.3;
    data[pos] = sign * amp;
    if (pos + 1 < length) {
      data[pos + 1] = sign * amp * 0.35;
    }
  }
  return buffer;
}

/**
 * Schedules a clean AudioParam value update, working across full and minimal mocks.
 * @param {AudioParam | undefined} param
 * @param {number} value
 * @param {number} time
 */
function setParam(param, value, time) {
  if (!param || !Number.isFinite(value)) return;
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

/**
 * Schedules a linear AudioParam ramp, falling back cleanly on minimal mocks.
 * @param {AudioParam | undefined} param
 * @param {number} value
 * @param {number} endTime
 */
function rampLinear(param, value, endTime) {
  if (!param || !Number.isFinite(value)) return;
  if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, endTime);
  } else {
    setParam(param, value, endTime);
  }
}

/**
 * Schedules a strictly positive exponential AudioParam ramp.
 * @param {AudioParam | undefined} param
 * @param {number} value
 * @param {number} endTime
 */
function rampExponential(param, value, endTime) {
  const safeVal = Math.max(0.0001, finiteOr(value, 0.0001));
  if (!param) return;
  if (typeof param.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(safeVal, endTime);
  } else {
    rampLinear(param, safeVal, endTime);
  }
}

/**
 * Smoothly updates an AudioParam without zipper noise or abrupt clicks.
 * @param {AudioParam | undefined} param
 * @param {number} value
 * @param {number} time
 * @param {number} [timeConstant=0.02]
 */
function setParamSmooth(param, value, time, timeConstant = 0.02) {
  if (!param || !Number.isFinite(value)) return;
  if (typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(time);
  }
  if (typeof param.setTargetAtTime === "function") {
    param.setTargetAtTime(value, time, timeConstant);
  } else if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, time + timeConstant * 2);
  } else {
    param.value = value;
  }
}

/**
 * Safely disconnects transient WebAudio nodes once playback finishes.
 * @param {AudioScheduledSourceNode | null} sourceNode
 * @param {Array<AudioNode | null | undefined>} [extraNodes]
 */
function scheduleAutoDisconnect(sourceNode, extraNodes = []) {
  if (!sourceNode || typeof sourceNode !== "object") return;
  sourceNode.onended = () => {
    for (const node of [sourceNode, ...extraNodes]) {
      try {
        if (node && typeof node.disconnect === "function") {
          node.disconnect();
        }
      } catch {
        // Ignore teardown errors if context was already closed
      }
    }
  };
}

/**
 * Safely starts and stops a WebAudio scheduled source node.
 * @param {AudioScheduledSourceNode | null} node
 * @param {number} startTime
 * @param {number} [stopTime]
 * @param {number} [offset]
 * @param {number} [duration]
 */
function startAndStopNode(node, startTime, stopTime, offset, duration) {
  if (!node) return;
  if (typeof node.start === "function") {
    if (typeof offset === "number" && typeof duration === "number") {
      node.start(startTime, offset, duration);
    } else {
      node.start(startTime);
    }
  }
  if (typeof stopTime === "number" && typeof node.stop === "function") {
    node.stop(stopTime);
  }
}

/**
 * Creates a BiquadFilterNode configured safely for full or minimal AudioContexts.
 * @param {AudioContext} ctx
 * @param {"lowpass"|"highpass"|"bandpass"|"peaking"|"notch"} type
 * @param {number} frequency
 * @param {number} q
 * @param {number} time
 * @returns {BiquadFilterNode | GainNode}
 */
function createFilter(ctx, type, frequency, q, time) {
  if (typeof ctx.createBiquadFilter !== "function") {
    return ctx.createGain();
  }
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  setParam(filter.frequency, Math.max(20, frequency), time);
  setParam(filter.Q, Math.max(0.05, q), time);
  return filter;
}

/**
 * Synthesizes a bank of damped modal resonators (brass, bell, or mechanical detents).
 * @param {AudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} startTime
 * @param {Array<{ freq: number, endFreq?: number, gain: number, decaySec: number, type?: OscillatorType }>} modes
 */
function triggerDampedModalResonator(ctx, dest, startTime, modes) {
  if (!ctx || !dest || typeof ctx.createOscillator !== "function" || typeof ctx.createGain !== "function") {
    return;
  }
  for (const mode of modes) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const decay = Math.max(0.01, mode.decaySec);
    const peak = clamp(mode.gain, 0.001, 0.6);

    osc.type = mode.type || "sine";
    setParam(osc.frequency, Math.max(20, mode.freq), startTime);
    if (typeof mode.endFreq === "number" && mode.endFreq > 0) {
      rampExponential(osc.frequency, mode.endFreq, startTime + Math.min(decay, 0.06));
    }

    setParam(env.gain, 0.0001, startTime);
    rampLinear(env.gain, peak, startTime + 0.002);
    rampExponential(env.gain, 0.0001, startTime + decay);
    rampLinear(env.gain, 0, startTime + decay + 0.006);

    osc.connect(env);
    env.connect(dest);
    scheduleAutoDisconnect(osc, [env]);
    startAndStopNode(osc, startTime, startTime + decay + 0.01);
  }
}

/**
 * Creates a self-contained procedural WebAudio engine with injectable environment.
 * Never constructs an AudioContext at creation time to guarantee zero autoplay warnings.
 *
 * @param {{
 *   AudioContext?: typeof AudioContext,
 *   onStateChange?: (state: { supported: boolean, unlocked: boolean, mixLevel: number, ambientEnabled: boolean }) => void,
 *   now?: () => number,
 *   initialMixLevel?: number,
 *   initialAmbientEnabled?: boolean
 * }} [env]
 */
export function createAudioEngine(env = {}) {
  const hasExplicitCtor = env !== null && typeof env === "object" && Object.prototype.hasOwnProperty.call(env, "AudioContext");
  const AudioCtor = hasExplicitCtor
    ? env.AudioContext
    : (typeof globalThis !== "undefined" ? (globalThis.AudioContext || globalThis.webkitAudioContext) : undefined);

  const supported = typeof AudioCtor === "function";
  const onStateChange = typeof env?.onStateChange === "function" ? env.onStateChange : null;
  const nowFn = typeof env?.now === "function" ? env.now : null;

  let mixLevel = clamp(finiteOr(env?.initialMixLevel, MIX_PRESETS.whisper), 0, 1) + 0;
  let ambientEnabled = Boolean(env?.initialAmbientEnabled);
  let unlocked = false;

  let ctx = null;
  let sfxBus = null;
  let ambientBus = null;
  let masterGain = null;
  let compressor = null;
  let buffers = null;

  let inFlightUnlock = null;
  let ambientNodes = null;
  let ambientStopTimer = null;
  let phaseCounter = 0;

  function getAudioTime() {
    if (ctx && typeof ctx.currentTime === "number" && Number.isFinite(ctx.currentTime)) {
      return Math.max(0, ctx.currentTime);
    }
    if (nowFn) {
      const val = Number(nowFn());
      if (Number.isFinite(val) && val >= 0) {
        return val > 1e11 ? 0 : val;
      }
    }
    return 0;
  }

  function getAudioState() {
    return {
      supported,
      unlocked,
      mixLevel,
      ambientEnabled
    };
  }

  function notifyStateChange() {
    if (!onStateChange) return;
    try {
      onStateChange(getAudioState());
    } catch {
      // Isolate observer failures from audio engine stability
    }
  }

  function nextNoiseOffset(bufferDuration, neededDuration = 0.25) {
    phaseCounter = (phaseCounter + 1) % 29;
    const span = Math.max(0, bufferDuration - neededDuration - 0.02);
    return ((phaseCounter * 0.37) % 1) * span;
  }

  function ensureGraph() {
    if (!ctx || masterGain || typeof ctx.createGain !== "function") return;
    const t = getAudioTime();
    sfxBus = ctx.createGain();
    ambientBus = ctx.createGain();
    masterGain = ctx.createGain();

    setParam(sfxBus.gain, 0.9, t);
    setParam(ambientBus.gain, 0, t);
    setParam(masterGain.gain, mixLevel, t);

    if (typeof ctx.createDynamicsCompressor === "function") {
      compressor = ctx.createDynamicsCompressor();
      setParam(compressor.threshold, -14, t);
      setParam(compressor.knee, 18, t);
      setParam(compressor.ratio, 6, t);
      setParam(compressor.attack, 0.003, t);
      setParam(compressor.release, 0.18, t);
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);
    } else {
      compressor = null;
      masterGain.connect(ctx.destination);
    }

    sfxBus.connect(masterGain);
    ambientBus.connect(masterGain);

    buffers = {
      white: createWhiteNoiseBuffer(ctx, NOISE_DURATION_SEC),
      pink: createPinkNoiseBuffer(ctx, NOISE_DURATION_SEC),
      velvet: createVelvetNoiseBuffer(ctx, NOISE_DURATION_SEC)
    };
  }

  function isContextPlayable() {
    if (!ctx || !sfxBus || !masterGain) return false;
    if (ctx.state === "closed" || ctx.state === "suspended") return false;
    return unlocked;
  }

  function clearAmbientTeardownTimer() {
    if (ambientStopTimer !== null) {
      clearTimeout(ambientStopTimer);
      ambientStopTimer = null;
    }
  }

  function destroyAmbientNodes() {
    clearAmbientTeardownTimer();
    if (!ambientNodes) return;
    const active = ambientNodes;
    ambientNodes = null;
    for (const src of active.sources) {
      try {
        if (src && typeof src.stop === "function") src.stop();
      } catch {
        // Ignore already-stopped source errors
      }
      try {
        if (src && typeof src.disconnect === "function") src.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    for (const node of active.nodes) {
      try {
        if (node && typeof node.disconnect === "function") node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }

  function startAmbientNodes() {
    if (!isContextPlayable() || !ambientBus) return;
    clearAmbientTeardownTimer();
    const t = getAudioTime();
    setParamSmooth(ambientBus.gain, AMBIENT_BUS_TARGET_GAIN, t, 0.35);
    if (ambientNodes) return;

    const sources = [];
    const nodes = [];

    if (buffers?.pink && typeof ctx.createBufferSource === "function") {
      const airSrc = ctx.createBufferSource();
      airSrc.buffer = buffers.pink;
      airSrc.loop = true;

      const airLp = createFilter(ctx, "lowpass", 310, 0.7, t);
      const airGain = ctx.createGain();
      setParam(airGain.gain, 0.14, t);

      airSrc.connect(airLp);
      airLp.connect(airGain);
      airGain.connect(ambientBus);

      if (typeof ctx.createOscillator === "function" && airLp.frequency) {
        try {
          const breathLfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          breathLfo.type = "sine";
          setParam(breathLfo.frequency, 0.11, t);
          setParam(lfoGain.gain, 35, t);
          breathLfo.connect(lfoGain);
          lfoGain.connect(airLp.frequency);
          startAndStopNode(breathLfo, t);
          sources.push(breathLfo);
          nodes.push(lfoGain);
        } catch {
          // Skip optional LFO modulation on minimal AudioParam mocks
        }
      }

      startAndStopNode(airSrc, t);
      sources.push(airSrc);
      nodes.push(airLp, airGain);
    }

    if (typeof ctx.createOscillator === "function") {
      const droneFundamental = ctx.createOscillator();
      const droneHarmonic = ctx.createOscillator();
      const droneGainA = ctx.createGain();
      const droneGainB = ctx.createGain();

      droneFundamental.type = "sine";
      droneHarmonic.type = "sine";
      setParam(droneFundamental.frequency, 58, t);
      setParam(droneHarmonic.frequency, 116, t);
      setParam(droneGainA.gain, 0.022, t);
      setParam(droneGainB.gain, 0.009, t);

      droneFundamental.connect(droneGainA);
      droneHarmonic.connect(droneGainB);
      droneGainA.connect(ambientBus);
      droneGainB.connect(ambientBus);

      startAndStopNode(droneFundamental, t);
      startAndStopNode(droneHarmonic, t);
      sources.push(droneFundamental, droneHarmonic);
      nodes.push(droneGainA, droneGainB);
    }

    ambientNodes = { sources, nodes };
  }

  function stopAmbientNodes() {
    if (!ctx || !ambientBus) {
      destroyAmbientNodes();
      return;
    }
    const t = getAudioTime();
    setParamSmooth(ambientBus.gain, 0, t, 0.2);
    if (!ambientNodes) return;
    clearAmbientTeardownTimer();
    ambientStopTimer = setTimeout(() => {
      ambientStopTimer = null;
      if (!ambientEnabled) {
        destroyAmbientNodes();
      }
    }, 350);
    if (ambientStopTimer && typeof ambientStopTimer.unref === "function") {
      ambientStopTimer.unref();
    }
  }

  function syncUnlockedFlagFromContext() {
    if (!ctx) return false;
    if (ctx.state === "closed" || ctx.state === "suspended") {
      return false;
    }
    return true;
  }

  /**
   * Lazily creates and resumes the WebAudio context from a user gesture.
   * @returns {Promise<boolean>}
   */
  async function unlockAudioContext() {
    if (!supported) return false;
    if (unlocked && ctx && ctx.state !== "suspended" && ctx.state !== "closed") {
      return true;
    }
    if (inFlightUnlock) return inFlightUnlock;

    inFlightUnlock = (async () => {
      const prevUnlocked = unlocked;
      try {
        if (!ctx || ctx.state === "closed") {
          ctx = new AudioCtor();
          masterGain = null;
          sfxBus = null;
          ambientBus = null;
          compressor = null;
          buffers = null;
        }
        ensureGraph();

        if (typeof ctx.addEventListener === "function" && !ctx.__clausehoundBoundState) {
          ctx.__clausehoundBoundState = true;
          ctx.addEventListener("statechange", () => {
            const next = syncUnlockedFlagFromContext();
            if (next !== unlocked) {
              unlocked = next;
              if (unlocked && ambientEnabled) {
                startAmbientNodes();
              }
              notifyStateChange();
            }
          });
        }

        if (typeof ctx.resume === "function" && ctx.state !== "running") {
          await ctx.resume();
        }

        unlocked = syncUnlockedFlagFromContext();
        if (unlocked && ambientEnabled) {
          startAmbientNodes();
        }
        if (unlocked !== prevUnlocked) {
          notifyStateChange();
        }
        return unlocked;
      } catch {
        unlocked = false;
        if (unlocked !== prevUnlocked) {
          notifyStateChange();
        }
        return false;
      } finally {
        inFlightUnlock = null;
      }
    })();

    return inFlightUnlock;
  }

  /**
   * Clamps ASMR mix level to [0, 1] and smoothly updates masterGain.
   * @param {number} level
   * @returns {number}
   */
  function setAsmrMixLevel(level) {
    if (typeof level !== "number" || Number.isNaN(level)) {
      return mixLevel;
    }
    const clamped = clamp(level, 0, 1) + 0;
    const changed = clamped !== mixLevel;
    mixLevel = clamped;
    if (masterGain && ctx && ctx.state !== "closed") {
      setParamSmooth(masterGain.gain, mixLevel, getAudioTime(), 0.025);
    }
    if (changed) {
      notifyStateChange();
    }
    return mixLevel;
  }

  /**
   * 180ms contoured velvet/pink noise through sweeping 900Hz -> 420Hz bandpass filter.
   */
  function playPaperRustle() {
    if (!isContextPlayable() || typeof ctx.createBufferSource !== "function") return;
    const t = getAudioTime();
    const duration = 0.18;

    // Primary pink-noise folio body with 900Hz -> 420Hz bandpass sweep
    if (buffers?.pink) {
      const src = ctx.createBufferSource();
      src.buffer = buffers.pink;
      const bp = createFilter(ctx, "bandpass", 900, 1.6, t);
      const env = ctx.createGain();

      if (bp.frequency) {
        setParam(bp.frequency, 900, t);
        rampExponential(bp.frequency, 420, t + duration);
      }

      setParam(env.gain, 0.0001, t);
      rampLinear(env.gain, 0.32, t + 0.016);
      rampLinear(env.gain, 0.19, t + 0.072);
      rampLinear(env.gain, 0.26, t + 0.112);
      rampExponential(env.gain, 0.0001, t + duration);
      rampLinear(env.gain, 0, t + duration + 0.008);

      src.connect(bp);
      bp.connect(env);
      env.connect(sfxBus);
      scheduleAutoDisconnect(src, [bp, env]);
      startAndStopNode(src, t, t + duration + 0.012, nextNoiseOffset(NOISE_DURATION_SEC), duration + 0.02);
    }

    // Secondary velvet-noise cotton rag-fiber whisper
    if (buffers?.velvet) {
      const vSrc = ctx.createBufferSource();
      vSrc.buffer = buffers.velvet;
      const vBp = createFilter(ctx, "bandpass", 1550, 1.2, t);
      const vEnv = ctx.createGain();

      if (vBp.frequency) {
        setParam(vBp.frequency, 1550, t);
        rampExponential(vBp.frequency, 780, t + duration);
      }

      setParam(vEnv.gain, 0.0001, t);
      rampLinear(vEnv.gain, 0.16, t + 0.014);
      rampExponential(vEnv.gain, 0.0001, t + duration * 0.92);
      rampLinear(vEnv.gain, 0, t + duration);

      vSrc.connect(vBp);
      vBp.connect(vEnv);
      vEnv.connect(sfxBus);
      scheduleAutoDisconnect(vSrc, [vBp, vEnv]);
      startAndStopNode(vSrc, t, t + duration + 0.01, nextNoiseOffset(NOISE_DURATION_SEC), duration + 0.015);
    }
  }

  /**
   * Dynamic capillary fountain-nib friction whisper over cotton paper.
   * @param {number} [durationMs=240]
   * @param {number} [velocity=1.0]
   */
  function playPenScratch(durationMs = 240, velocity = 1.0) {
    if (!isContextPlayable() || typeof ctx.createBufferSource !== "function") return;
    const t = getAudioTime();
    const durSec = clamp(finiteOr(durationMs, 240), 40, 1200) / 1000;
    const vel = clamp(finiteOr(velocity, 1.0), 0.1, 2.0);
    const levelScale = 0.11 + vel * 0.14;

    if (buffers?.velvet) {
      const nibSrc = ctx.createBufferSource();
      nibSrc.buffer = buffers.velvet;
      const startFreq = 2100 + vel * 850;
      const endFreq = startFreq * 0.76;
      const nibBp = createFilter(ctx, "bandpass", startFreq, 3.1, t);
      const nibEnv = ctx.createGain();

      if (nibBp.frequency) {
        setParam(nibBp.frequency, startFreq, t);
        rampExponential(nibBp.frequency, endFreq, t + durSec);
      }

      setParam(nibEnv.gain, 0.0001, t);
      rampLinear(nibEnv.gain, levelScale, t + 0.014);
      rampLinear(nibEnv.gain, levelScale * 0.68, t + durSec * 0.45);
      rampLinear(nibEnv.gain, levelScale * 0.92, t + durSec * 0.72);
      rampExponential(nibEnv.gain, 0.0001, t + durSec);
      rampLinear(nibEnv.gain, 0, t + durSec + 0.008);

      nibSrc.connect(nibBp);
      nibBp.connect(nibEnv);
      nibEnv.connect(sfxBus);
      scheduleAutoDisconnect(nibSrc, [nibBp, nibEnv]);
      startAndStopNode(nibSrc, t, t + durSec + 0.012, nextNoiseOffset(NOISE_DURATION_SEC, durSec + 0.03), durSec + 0.02);
    }

    if (buffers?.pink) {
      const dragSrc = ctx.createBufferSource();
      dragSrc.buffer = buffers.pink;
      const dragBp = createFilter(ctx, "bandpass", 1050 + vel * 300, 1.7, t);
      const dragEnv = ctx.createGain();

      setParam(dragEnv.gain, 0.0001, t);
      rampLinear(dragEnv.gain, levelScale * 0.55, t + 0.018);
      rampExponential(dragEnv.gain, 0.0001, t + durSec);
      rampLinear(dragEnv.gain, 0, t + durSec + 0.008);

      dragSrc.connect(dragBp);
      dragBp.connect(dragEnv);
      dragEnv.connect(sfxBus);
      scheduleAutoDisconnect(dragSrc, [dragBp, dragEnv]);
      startAndStopNode(dragSrc, t, t + durSec + 0.012, nextNoiseOffset(NOISE_DURATION_SEC, durSec + 0.03), durSec + 0.02);
    }
  }

  /**
   * Crisp pitched mechanical brass/split-flap click for UI ticks & odometer steps.
   * @param {number} [stepIndex=0]
   */
  function playBrassClick(stepIndex = 0) {
    if (!isContextPlayable()) return;
    const t = getAudioTime();
    const step = Math.abs(Math.trunc(finiteOr(stepIndex, 0))) % 12;
    const pitchFactor = 1 + (step % 7) * 0.026;

    triggerDampedModalResonator(ctx, sfxBus, t, [
      { freq: 1480 * pitchFactor, endFreq: 1360 * pitchFactor, gain: 0.16, decaySec: 0.036, type: "triangle" },
      { freq: 3430 * pitchFactor, gain: 0.10, decaySec: 0.024, type: "sine" },
      { freq: 5700 * pitchFactor, gain: 0.055, decaySec: 0.015, type: "sine" }
    ]);

    if (buffers?.white && typeof ctx.createBufferSource === "function") {
      const pawlSrc = ctx.createBufferSource();
      pawlSrc.buffer = buffers.white;
      const pawlBp = createFilter(ctx, "bandpass", 3100 * pitchFactor, 2.2, t);
      const pawlEnv = ctx.createGain();

      setParam(pawlEnv.gain, 0.0001, t);
      rampLinear(pawlEnv.gain, 0.14, t + 0.002);
      rampExponential(pawlEnv.gain, 0.0001, t + 0.015);
      rampLinear(pawlEnv.gain, 0, t + 0.018);

      pawlSrc.connect(pawlBp);
      pawlBp.connect(pawlEnv);
      pawlEnv.connect(sfxBus);
      scheduleAutoDisconnect(pawlSrc, [pawlBp, pawlEnv]);
      startAndStopNode(pawlSrc, t, t + 0.022, nextNoiseOffset(NOISE_DURATION_SEC), 0.025);
    }
  }

  /**
   * 4.2kHz Swiss watch-escapement micro-transient subtly panned/pitched with progress.
   * @param {number} [progress=0.5]
   */
  function playScanTick(progress = 0.5) {
    if (!isContextPlayable()) return;
    const t = getAudioTime();
    const p = clamp(finiteOr(progress, 0.5), 0, 1);
    const centerFreq = 4200 + (p - 0.5) * 420;

    let targetNode = sfxBus;
    let panner = null;
    if (typeof ctx.createStereoPanner === "function") {
      panner = ctx.createStereoPanner();
      setParam(panner.pan, (p * 2 - 1) * 0.45, t);
      panner.connect(sfxBus);
      targetNode = panner;
    }

    triggerDampedModalResonator(ctx, targetNode, t, [
      { freq: centerFreq, gain: 0.085, decaySec: 0.018, type: "sine" },
      { freq: centerFreq * 1.62, gain: 0.04, decaySec: 0.012, type: "sine" }
    ]);

    if (buffers?.velvet && typeof ctx.createBufferSource === "function") {
      const tickSrc = ctx.createBufferSource();
      tickSrc.buffer = buffers.velvet;
      const tickBp = createFilter(ctx, "bandpass", centerFreq, 4.8, t);
      const tickEnv = ctx.createGain();

      setParam(tickEnv.gain, 0.0001, t);
      rampLinear(tickEnv.gain, 0.09, t + 0.0015);
      rampExponential(tickEnv.gain, 0.0001, t + 0.012);
      rampLinear(tickEnv.gain, 0, t + 0.015);

      tickSrc.connect(tickBp);
      tickBp.connect(tickEnv);
      tickEnv.connect(targetNode);
      scheduleAutoDisconnect(tickSrc, panner ? [tickBp, tickEnv, panner] : [tickBp, tickEnv]);
      startAndStopNode(tickSrc, t, t + 0.018, nextNoiseOffset(NOISE_DURATION_SEC), 0.02);
    }
  }

  /**
   * Crisp flip-clock mechanical transient.
   * @param {number} [stepIndex=0]
   */
  function playSplitFlapClick(stepIndex = 0) {
    if (!isContextPlayable()) return;
    const t = getAudioTime();
    const step = Math.abs(Math.trunc(finiteOr(stepIndex, 0))) % 16;
    const pitch = 1 + (step % 6) * 0.03;

    // Transient 1: flap release whisper
    if (buffers?.velvet && typeof ctx.createBufferSource === "function") {
      const relSrc = ctx.createBufferSource();
      relSrc.buffer = buffers.velvet;
      const relBp = createFilter(ctx, "bandpass", 2800 * pitch, 2.4, t);
      const relEnv = ctx.createGain();

      setParam(relEnv.gain, 0.0001, t);
      rampLinear(relEnv.gain, 0.13, t + 0.002);
      rampExponential(relEnv.gain, 0.0001, t + 0.016);
      rampLinear(relEnv.gain, 0, t + 0.02);

      relSrc.connect(relBp);
      relBp.connect(relEnv);
      relEnv.connect(sfxBus);
      scheduleAutoDisconnect(relSrc, [relBp, relEnv]);
      startAndStopNode(relSrc, t, t + 0.024, nextNoiseOffset(NOISE_DURATION_SEC), 0.026);
    }

    // Transient 2: split-flap card stop-pin knock (+12ms)
    const slapTime = t + 0.012;
    triggerDampedModalResonator(ctx, sfxBus, slapTime, [
      { freq: 640 * pitch, endFreq: 480 * pitch, gain: 0.14, decaySec: 0.026, type: "triangle" },
      { freq: 1920 * pitch, gain: 0.08, decaySec: 0.018, type: "sine" }
    ]);

    if (buffers?.white && typeof ctx.createBufferSource === "function") {
      const slapSrc = ctx.createBufferSource();
      slapSrc.buffer = buffers.white;
      const slapBp = createFilter(ctx, "bandpass", 3550 * pitch, 3.0, slapTime);
      const slapEnv = ctx.createGain();

      setParam(slapEnv.gain, 0.0001, slapTime);
      rampLinear(slapEnv.gain, 0.18, slapTime + 0.0015);
      rampExponential(slapEnv.gain, 0.0001, slapTime + 0.016);
      rampLinear(slapEnv.gain, 0, slapTime + 0.02);

      slapSrc.connect(slapBp);
      slapBp.connect(slapEnv);
      slapEnv.connect(sfxBus);
      scheduleAutoDisconnect(slapSrc, [slapBp, slapEnv]);
      startAndStopNode(slapSrc, slapTime, slapTime + 0.024, nextNoiseOffset(NOISE_DURATION_SEC), 0.026);
    }
  }

  /**
   * Cushioned 58Hz sub-bass brass die desk thump + warm metallic bell harmonic decay.
   */
  function playSealThud() {
    if (!isContextPlayable()) return;
    const t = getAudioTime();

    // Cushioned 58Hz desk sub-bass thump
    if (typeof ctx.createOscillator === "function") {
      const subOsc = ctx.createOscillator();
      const subEnv = ctx.createGain();
      subOsc.type = "sine";
      setParam(subOsc.frequency, 78, t);
      rampExponential(subOsc.frequency, 58, t + 0.036);

      setParam(subEnv.gain, 0.0001, t);
      rampLinear(subEnv.gain, 0.44, t + 0.006);
      rampExponential(subEnv.gain, 0.0001, t + 0.24);
      rampLinear(subEnv.gain, 0, t + 0.25);

      subOsc.connect(subEnv);
      subEnv.connect(sfxBus);
      scheduleAutoDisconnect(subOsc, [subEnv]);
      startAndStopNode(subOsc, t, t + 0.26);
    }

    // Leather blotter cushioned impact burst
    if (buffers?.pink && typeof ctx.createBufferSource === "function") {
      const padSrc = ctx.createBufferSource();
      padSrc.buffer = buffers.pink;
      const padLp = createFilter(ctx, "lowpass", 240, 0.9, t);
      const padEnv = ctx.createGain();

      if (padLp.frequency) {
        setParam(padLp.frequency, 240, t);
        rampExponential(padLp.frequency, 92, t + 0.075);
      }

      setParam(padEnv.gain, 0.0001, t);
      rampLinear(padEnv.gain, 0.24, t + 0.005);
      rampExponential(padEnv.gain, 0.0001, t + 0.085);
      rampLinear(padEnv.gain, 0, t + 0.095);

      padSrc.connect(padLp);
      padLp.connect(padEnv);
      padEnv.connect(sfxBus);
      scheduleAutoDisconnect(padSrc, [padLp, padEnv]);
      startAndStopNode(padSrc, t, t + 0.1, nextNoiseOffset(NOISE_DURATION_SEC), 0.11);
    }

    // Warm metallic brass-die harmonic bell decay
    triggerDampedModalResonator(ctx, sfxBus, t + 0.008, [
      { freq: 290, gain: 0.11, decaySec: 0.38, type: "sine" },
      { freq: 522, gain: 0.072, decaySec: 0.29, type: "sine" },
      { freq: 884, gain: 0.042, decaySec: 0.21, type: "sine" },
      { freq: 1420, gain: 0.02, decaySec: 0.13, type: "sine" }
    ]);
  }

  /**
   * Dual-transient damped brushed-brass Faraday shutter slide + lock detent.
   * @param {boolean} locked
   */
  function playAirGapLatch(locked) {
    if (!isContextPlayable()) return;
    const t = getAudioTime();
    const isLocking = Boolean(locked);

    // Transient 1: damped brushed-brass Faraday shutter slide
    const slideDur = 0.082;
    if (buffers?.pink && typeof ctx.createBufferSource === "function") {
      const slideSrc = ctx.createBufferSource();
      slideSrc.buffer = buffers.pink;
      const startFreq = isLocking ? 1650 : 680;
      const endFreq = isLocking ? 680 : 1850;
      const slideBp = createFilter(ctx, "bandpass", startFreq, 2.7, t);
      const slideEnv = ctx.createGain();

      if (slideBp.frequency) {
        setParam(slideBp.frequency, startFreq, t);
        rampExponential(slideBp.frequency, endFreq, t + slideDur);
      }

      setParam(slideEnv.gain, 0.0001, t);
      rampLinear(slideEnv.gain, 0.22, t + 0.012);
      rampExponential(slideEnv.gain, 0.0001, t + slideDur);
      rampLinear(slideEnv.gain, 0, t + slideDur + 0.008);

      slideSrc.connect(slideBp);
      slideBp.connect(slideEnv);
      slideEnv.connect(sfxBus);
      scheduleAutoDisconnect(slideSrc, [slideBp, slideEnv]);
      startAndStopNode(slideSrc, t, t + slideDur + 0.012, nextNoiseOffset(NOISE_DURATION_SEC), slideDur + 0.02);
    }

    triggerDampedModalResonator(ctx, sfxBus, t, [
      {
        freq: isLocking ? 410 : 290,
        endFreq: isLocking ? 290 : 440,
        gain: 0.065,
        decaySec: 0.075,
        type: "triangle"
      }
    ]);

    // Transient 2: heavy mechanical Faraday lock detent (+72ms)
    const detentTime = t + 0.072;
    if (isLocking) {
      triggerDampedModalResonator(ctx, sfxBus, detentTime, [
        { freq: 118, endFreq: 86, gain: 0.21, decaySec: 0.095, type: "sine" },
        { freq: 920, gain: 0.14, decaySec: 0.11, type: "triangle" },
        { freq: 2140, gain: 0.085, decaySec: 0.075, type: "sine" },
        { freq: 3560, gain: 0.045, decaySec: 0.045, type: "sine" }
      ]);
    } else {
      triggerDampedModalResonator(ctx, sfxBus, detentTime, [
        { freq: 1180, gain: 0.12, decaySec: 0.085, type: "triangle" },
        { freq: 2680, gain: 0.085, decaySec: 0.065, type: "sine" },
        { freq: 4120, gain: 0.045, decaySec: 0.04, type: "sine" }
      ]);
    }

    if (buffers?.white && typeof ctx.createBufferSource === "function") {
      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = buffers.white;
      const clickBp = createFilter(ctx, "bandpass", isLocking ? 2400 : 3200, 2.5, detentTime);
      const clickEnv = ctx.createGain();

      setParam(clickEnv.gain, 0.0001, detentTime);
      rampLinear(clickEnv.gain, 0.16, detentTime + 0.002);
      rampExponential(clickEnv.gain, 0.0001, detentTime + 0.022);
      rampLinear(clickEnv.gain, 0, detentTime + 0.026);

      clickSrc.connect(clickBp);
      clickBp.connect(clickEnv);
      clickEnv.connect(sfxBus);
      scheduleAutoDisconnect(clickSrc, [clickBp, clickEnv]);
      startAndStopNode(clickSrc, detentTime, detentTime + 0.03, nextNoiseOffset(NOISE_DURATION_SEC), 0.032);
    }
  }

  /**
   * Toggles subtle low-level Faraday room tone ambient bus.
   * @param {boolean} enabled
   * @returns {boolean}
   */
  function setAmbientDeskEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    const changed = nextEnabled !== ambientEnabled;
    ambientEnabled = nextEnabled;

    if (ambientEnabled) {
      if (isContextPlayable()) {
        startAmbientNodes();
      }
    } else {
      stopAmbientNodes();
    }

    if (changed) {
      notifyStateChange();
    }
    return ambientEnabled;
  }

  /**
   * Cleanly releases ambient generators and optional AudioContext resources.
   * @returns {Promise<void>}
   */
  async function dispose() {
    const hadUnlocked = unlocked;
    const hadAmbient = ambientEnabled;
    ambientEnabled = false;
    unlocked = false;
    destroyAmbientNodes();
    if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
      try {
        await ctx.close();
      } catch {
        // Ignore close errors in mocked or restricted contexts
      }
    }
    ctx = null;
    sfxBus = null;
    ambientBus = null;
    masterGain = null;
    compressor = null;
    buffers = null;
    if (hadUnlocked || hadAmbient) {
      notifyStateChange();
    }
  }

  return {
    unlockAudioContext,
    setAsmrMixLevel,
    playPaperRustle,
    playPenScratch,
    playBrassClick,
    playScanTick,
    playSplitFlapClick,
    playSealThud,
    playAirGapLatch,
    setAmbientDeskEnabled,
    getAudioState,
    dispose
  };
}

const defaultEngine = createAudioEngine();

export function unlockAudioContext() {
  return defaultEngine.unlockAudioContext();
}

export function setAsmrMixLevel(level) {
  return defaultEngine.setAsmrMixLevel(level);
}

export function playPaperRustle() {
  return defaultEngine.playPaperRustle();
}

export function playPenScratch(durationMs = 240, velocity = 1.0) {
  return defaultEngine.playPenScratch(durationMs, velocity);
}

export function playBrassClick(stepIndex = 0) {
  return defaultEngine.playBrassClick(stepIndex);
}

export function playScanTick(progress = 0.5) {
  return defaultEngine.playScanTick(progress);
}

export function playSplitFlapClick(stepIndex = 0) {
  return defaultEngine.playSplitFlapClick(stepIndex);
}

export function playSealThud() {
  return defaultEngine.playSealThud();
}

export function playAirGapLatch(locked) {
  return defaultEngine.playAirGapLatch(locked);
}

export function setAmbientDeskEnabled(enabled) {
  return defaultEngine.setAmbientDeskEnabled(enabled);
}

export function getAudioState() {
  return defaultEngine.getAudioState();
}
