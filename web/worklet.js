/**
 * Dual Johnston-filter AudioWorklet.
 * Two 12-neuron LIF motifs run at 0.5 ms; spike-rate envelopes duck / warm the dry signal.
 */
const CIRCUIT = {
  names: [
    "JO_B_0", "JO_B_1", "JO_B_2", "JO_C_0", "JO_C_1",
    "aLN_al", "aPN1", "vPN1", "pC1", "pulse_pool", "sine_pool", "B1",
  ],
  params: { vRest: -52, vReset: -52, vThresh: -45, tauM: 20, tRef: 2.2, dt: 0.5 },
  synapses: [
    [0, 6, 4.0, 1.8], [1, 6, 4.0, 1.8], [2, 6, 3.5, 1.8],
    [0, 5, 3.5, 1.8], [1, 5, 3.5, 1.8], [2, 5, 3.0, 1.8],
    [5, 6, -8.0, 20.0], [5, 7, -3.0, 22.0],
    [6, 7, 8.0, 2.0], [7, 8, 8.0, 2.0], [8, 9, 8.0, 1.8],
    [8, 11, 8.0, 1.8], [11, 9, 4.0, 1.8],
    [3, 10, 8.0, 1.8], [4, 10, 8.0, 1.8], [3, 5, 1.5, 1.8],
    [10, 8, 2.0, 3.0], [9, 10, -3.0, 4.0], [6, 10, -1.5, 2.0],
  ],
  joPulse: [0, 1, 2],
  joSine: [3, 4],
  pulseOut: [8, 9, 11],
  sineOut: [10],
  aln: 5,
};

class LifBrain {
  constructor(seed = 0) {
    const p = CIRCUIT.params;
    this.n = CIRCUIT.names.length;
    this.p = p;
    this.v = new Float64Array(this.n).fill(p.vRest);
    this.ref = new Float64Array(this.n);
    this.pre = CIRCUIT.synapses.map((s) => s[0]);
    this.post = CIRCUIT.synapses.map((s) => s[1]);
    this.w0 = CIRCUIT.synapses.map((s) => s[2]);
    this.w = this.w0.slice();
    this.delay = CIRCUIT.synapses.map((s) => Math.max(1, Math.round(s[3] / p.dt)));
    this.buf = Math.max(...this.delay) + 1;
    this.queue = Array.from({ length: this.buf }, () => new Float64Array(this.n));
    this.head = 0;
    this.lesion = "none";
    this.pulseEma = 0;
    this.sineEma = 0;
    this.lastSpikes = 0;
    this.seed = seed >>> 0;
  }

  _rng() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }

  setShuffle(on) {
    this.w = this.w0.slice();
    if (!on) return;
    const posts = this.post.slice();
    for (let i = posts.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      const tmp = posts[i];
      posts[i] = posts[j];
      posts[j] = tmp;
    }
    this.post = posts;
  }

  setLesion(name) {
    this.lesion = name;
  }

  _blocked(preIdx) {
    if (this.lesion === "aln" && preIdx === CIRCUIT.aln) return true;
    if (this.lesion === "apn1" && preIdx === 6) return true;
    if (this.lesion === "pc1" && preIdx === 8) return true;
    return false;
  }

  step(iExt) {
    const p = this.p;
    const n = this.n;
    const q = this.queue[this.head];
    for (let i = 0; i < n; i++) {
      const dv = (-(this.v[i] - p.vRest) + iExt[i]) * (p.dt / p.tauM);
      this.v[i] += dv + q[i];
      q[i] = 0;
      this.ref[i] = Math.max(0, this.ref[i] - p.dt);
      if (this.ref[i] > 0) this.v[i] = p.vReset;
    }
    const spiked = new Uint8Array(n);
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (this.ref[i] <= 0 && this.v[i] >= p.vThresh) {
        spiked[i] = 1;
        this.v[i] = p.vReset;
        this.ref[i] = p.tRef;
        count += 1;
      }
    }
    for (let s = 0; s < this.pre.length; s++) {
      const pre = this.pre[s];
      if (!spiked[pre] || this._blocked(pre)) continue;
      const slot = (this.head + this.delay[s]) % this.buf;
      this.queue[slot][this.post[s]] += this.w[s];
    }
    this.head = (this.head + 1) % this.buf;
    this.lastSpikes = count;

    let pulse = 0;
    for (const i of CIRCUIT.pulseOut) pulse += spiked[i];
    pulse /= CIRCUIT.pulseOut.length;
    let sine = 0;
    for (const i of CIRCUIT.sineOut) sine += spiked[i];
    sine /= CIRCUIT.sineOut.length;
    const pa = Math.exp(-p.dt / 30);
    const sa = Math.exp(-p.dt / 80);
    this.pulseEma = pa * this.pulseEma + (1 - pa) * pulse;
    this.sineEma = sa * this.sineEma + (1 - sa) * sine;
    return spiked;
  }
}

class OnePole {
  constructor() {
    this.y = 0;
  }
  process(x, cutoff, sr) {
    const a = Math.exp((-2 * Math.PI * cutoff) / sr);
    this.y = a * this.y + (1 - a) * x;
    return this.y;
  }
}

class JohnstonProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.a = new LifBrain(1);
    this.b = new LifBrain(2);
    this.acc = 0;
    this.prevAbs = 0;
    this.lpLoA = new OnePole();
    this.lpHiA = new OnePole();
    this.lpLoB = new OnePole();
    this.lpHiB = new OnePole();
    this.warmA = new OnePole();
    this.warmB = new OnePole();
    this.iA = new Float64Array(CIRCUIT.names.length);
    this.iB = new Float64Array(CIRCUIT.names.length);
    this.envA = 0;
    this.envB = 0;
    this.params = {
      joB: 28,
      joC: 14,
      wet: 0.8,
      pulseDepth: 0.7,
      sineWarmth: 0.45,
      mode: "cross",
      coupleAB: 0.35,
      coupleBA: 0.35,
      coupleTarget: "aln",
      shuffleA: false,
      shuffleB: false,
      lesionA: "none",
      lesionB: "none",
    };
    this._frames = 0;
    this.port.onmessage = (ev) => this._onMsg(ev.data);
  }

  _onMsg(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "params") {
      Object.assign(this.params, msg.params || {});
      this.a.setShuffle(!!this.params.shuffleA);
      this.b.setShuffle(!!this.params.shuffleB);
      this.a.setLesion(this.params.lesionA || "none");
      this.b.setLesion(this.params.lesionB || "none");
    }
  }

  _drives(sample, lpLo, lpHi) {
    const abs = Math.abs(sample);
    this.envA = 0; // placeholder, per-channel env kept on processor
    const env = abs;
    const onset = Math.max(0, env - this.prevAbs);
    this.prevAbs = env;
    const lo = lpLo.process(sample, 80, sampleRate);
    const hi = lpHi.process(sample, 280, sampleRate);
    const band = Math.abs(hi - lo);
    return { onset, env, band };
  }

  _inject(iExt, drives, extra, joGain, sineGain) {
    iExt.fill(0);
    const pulse = joGain * Math.min(1, drives.onset * 8 + drives.env * 0.4);
    const sine = sineGain * Math.min(1, drives.band * 6);
    for (const i of CIRCUIT.joPulse) iExt[i] = pulse;
    for (const i of CIRCUIT.joSine) iExt[i] = sine;
    if (extra) {
      if (extra.target === "aln") iExt[CIRCUIT.aln] += extra.mv;
      else if (extra.target === "jo_pulse") {
        for (const i of CIRCUIT.joPulse) iExt[i] += extra.mv;
      } else if (extra.target === "jo_sine") {
        for (const i of CIRCUIT.joSine) iExt[i] += extra.mv;
      } else if (extra.target === "pc1") iExt[8] += extra.mv;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;
    const leftIn = (input && input[0]) || new Float32Array(output[0].length);
    const rightIn = (input && input[1]) || leftIn;
    const leftOut = output[0];
    const rightOut = output[1] || output[0];
    const n = leftOut.length;
    const samplesPerStep = sampleRate * (CIRCUIT.params.dt / 1000);
    const p = this.params;

    for (let i = 0; i < n; i++) {
      const xL = leftIn[i] || 0;
      const xR = rightIn[i] || 0;
      this.acc += 1;
      if (this.acc >= samplesPerStep) {
        this.acc -= samplesPerStep;
        const dA = this._channelDrive(xL, this.lpLoA, this.lpHiA, "a");
        const dBsrc = p.mode === "series" ? leftOut[Math.max(0, i - 1)] || xL : xR;
        const dB = this._channelDrive(dBsrc, this.lpLoB, this.lpHiB, "b");
        const extraB = {
          target: p.coupleTarget,
          mv: p.coupleAB * this.a.pulseEma * 40,
        };
        const extraA = {
          target: p.coupleTarget,
          mv: p.coupleBA * this.b.pulseEma * 40,
        };
        this._inject(this.iA, dA, p.mode === "cross" || p.mode === "antagonist" ? extraA : null, p.joB, p.joC);
        this._inject(this.iB, dB, p.mode === "cross" || p.mode === "antagonist" ? extraB : null, p.joB, p.joC);
        if (p.mode === "antagonist") {
          this.iB[10] -= p.coupleAB * this.a.pulseEma * 20;
          this.iA[10] -= p.coupleBA * this.b.pulseEma * 20;
        }
        this.a.step(this.iA);
        this.b.step(this.iB);
      }

      const pulse = Math.min(1, this.a.pulseEma * 8);
      const sine = Math.min(1, this.a.sineEma * 8);
      const pulseB = Math.min(1, this.b.pulseEma * 8);
      const sineB = Math.min(1, this.b.sineEma * 8);
      const gateL = 1 - p.pulseDepth * pulse;
      const gateR = 1 - p.pulseDepth * pulseB;
      const lowL = this.warmA.process(xL * gateL, 180, sampleRate);
      const lowR = this.warmB.process(xR * gateR, 180, sampleRate);
      const wetL = xL * gateL * (1 - 0.25 * sine) + lowL * (1 + p.sineWarmth * sine);
      const wetR = xR * gateR * (1 - 0.25 * sineB) + lowR * (1 + p.sineWarmth * sineB);
      leftOut[i] = p.wet * wetL + (1 - p.wet) * xL;
      rightOut[i] = p.wet * wetR + (1 - p.wet) * xR;
    }

    this._frames += 1;
    if (this._frames % 8 === 0) {
      this.port.postMessage({
        type: "telemetry",
        a: { pulse: this.a.pulseEma, sine: this.a.sineEma, spikes: this.a.lastSpikes },
        b: { pulse: this.b.pulseEma, sine: this.b.sineEma, spikes: this.b.lastSpikes },
      });
    }
    return true;
  }

  _channelDrive(sample, lpLo, lpHi, which) {
    const abs = Math.abs(sample);
    if (which === "a") {
      const onset = Math.max(0, abs - (this._prevA || 0));
      this._prevA = abs;
      const lo = lpLo.process(sample, 80, sampleRate);
      const hi = lpHi.process(sample, 280, sampleRate);
      return { onset, env: abs, band: Math.abs(hi - lo) };
    }
    const onset = Math.max(0, abs - (this._prevB || 0));
    this._prevB = abs;
    const lo = lpLo.process(sample, 80, sampleRate);
    const hi = lpHi.process(sample, 280, sampleRate);
    return { onset, env: abs, band: Math.abs(hi - lo) };
  }
}

registerProcessor("johnston-filter", JohnstonProcessor);
