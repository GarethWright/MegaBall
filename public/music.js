// Tracker-style background music in the spirit of the Amiga Megaball soundtrack (original compositions).
// Four "Paula" channels hard-panned L/R/R/L, 16th-note rows like a ProTracker pattern, tick-rate
// chip arpeggios, a pulse lead with echo, and the Amiga's ~3.3 kHz "LED" low-pass filter on the mix.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], 7: [0, 4, 10], sus: [0, 5, 7] };

// ------------------------------------------------------------------ songs
// A pattern is 4 bars of 16 rows. chords: [bassRootMidi, type] per bar. lead: [row, midi, rows].
const GAME = {
  name: "BRICK RUNNER", bpm: 132,
  patterns: {
    intro: { chords: [[45, "m"], [41, "M"], [48, "M"], [43, "M"]], drums: "four", bass: "pulse" },
    A: { chords: [[45, "m"], [41, "M"], [48, "M"], [43, "M"]], drums: "beat", bass: "octave",
      lead: [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 74, 2], [8, 76, 4], [12, 81, 4],
        [16, 77, 3], [19, 76, 1], [20, 74, 2], [22, 72, 2], [24, 74, 6], [30, 72, 2],
        [32, 72, 3], [35, 74, 1], [36, 76, 2], [38, 79, 2], [40, 76, 4], [44, 72, 4],
        [48, 74, 3], [51, 72, 1], [52, 71, 2], [54, 67, 2], [56, 71, 8]] },
    B: { chords: [[38, "m"], [41, "M"], [45, "m"], [40, "M"]], drums: "beat", bass: "octave",
      lead: [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 77, 2], [10, 81, 2], [12, 79, 4],
        [16, 77, 4], [20, 76, 2], [22, 72, 2], [24, 77, 4], [28, 79, 4],
        [32, 81, 6], [38, 79, 2], [40, 76, 4], [44, 72, 4],
        [48, 76, 4], [52, 80, 4], [56, 83, 4], [60, 80, 4]] },
    C: { chords: [[41, "M"], [43, "M"], [40, "m"], [45, "m"]], drums: "half", bass: "walk",
      lead: [[0, 84, 8], [8, 83, 4], [12, 81, 4], [16, 79, 12], [28, 76, 4],
        [32, 79, 8], [40, 76, 4], [44, 74, 4], [48, 76, 16]] },
  },
  order: ["intro", "A", "B", "A", "B", "C", "C", "A", "B"],
  loopTo: 1,
};

const TITLE = {
  name: "NEON HORIZON", bpm: 112,
  patterns: {
    T1: { chords: [[41, "M"], [43, "M"], [40, "m"], [45, "m"]], drums: "soft", bass: "long", arpOct: 36,
      lead: [[0, 72, 6], [6, 74, 2], [8, 76, 8], [16, 74, 6], [22, 71, 2], [24, 67, 8],
        [32, 71, 4], [36, 72, 4], [40, 74, 8], [48, 69, 16]] },
    T2: { chords: [[41, "M"], [43, "M"], [45, "m"], [40, "7"]], drums: "soft", bass: "long", arpOct: 36,
      lead: [[0, 77, 6], [6, 76, 2], [8, 74, 8], [16, 74, 4], [20, 76, 4], [24, 79, 8],
        [32, 81, 12], [44, 79, 4], [48, 80, 16]] },
    T0: { chords: [[41, "M"], [43, "M"], [40, "m"], [45, "m"]], drums: "none", bass: "long", arpOct: 36 },
  },
  order: ["T0", "T1", "T2", "T1", "T2"],
  loopTo: 1,
};

const DRUMS = {
  // per 16-row bar: k = kick, s = snare, h = closed hat, o = open hat
  four: "k...k...k...k...",
  beat: "k.h.s.hkk.h.s.ho",
  half: "k.h.h.h.s.h.h.hh",
  soft: "k.......s.......",
  none: "................",
};

export function createMusic(ac, out) {
  // mix bus: channel panners -> LED filter -> music gain -> out
  const bus = ac.createGain(); bus.gain.value = 0;
  const led = ac.createBiquadFilter(); led.type = "lowpass"; led.frequency.value = 3300; led.Q.value = 0.5;
  led.connect(bus); bus.connect(out);
  const chan = [-0.7, 0.7, 0.7, -0.7].map((p) => { const n = ac.createStereoPanner(); n.pan.value = p; n.connect(led); return n; });
  // echo for the lead (dotted-eighth feedback delay)
  const delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
  fb.gain.value = 0.32; wet.gain.value = 0.35;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(chan[2]);
  // 25% pulse wave, the classic chip lead timbre
  const pulse = (() => {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    return ac.createPeriodicWave(re, im);
  })();
  const noiseBuf = (() => {
    const b = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  const env = (g, t, peak, a, dur) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const osc = (type, t, dur, dest) => {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === "pulse") o.setPeriodicWave(pulse); else o.type = type;
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return [o, g];
  };

  // ---- instruments
  const kick = (t) => { const [o, g] = osc("sine", t, 0.3, chan[0]); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.9, 0.002, 0.28); };
  const noise = (t, dur, vol, hp, dest) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
    s.connect(f); f.connect(g); g.connect(dest); env(g, t, vol, 0.001, dur); s.start(t); s.stop(t + dur + 0.02);
  };
  const snare = (t) => { noise(t, 0.18, 0.5, 900, chan[3]); const [o, g] = osc("triangle", t, 0.1, chan[3]); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); env(g, t, 0.35, 0.001, 0.1); };
  const hat = (t, open) => noise(t, open ? 0.22 : 0.045, open ? 0.16 : 0.12, 7000, chan[3]);
  const bass = (t, m, dur) => {
    const [o, g] = osc("sawtooth", t, dur, chan[0]);
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 6;
    o.disconnect(); o.connect(f); f.connect(g);
    o.frequency.value = midiHz(m);
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(260, t + Math.min(dur, 0.25));
    env(g, t, 0.42, 0.004, dur * 0.95);
  };
  const arp = (t, notes, dur, tick) => {
    const [o, g] = osc("square", t, dur, chan[1]);
    let k = 0;
    for (let tt = t; tt < t + dur - 1e-4; tt += tick) o.frequency.setValueAtTime(midiHz(notes[k++ % notes.length]), tt);
    g.gain.setValueAtTime(0.1, t); g.gain.setValueAtTime(0.1, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  };
  const lead = (t, m, dur) => {
    const [o, g] = osc("pulse", t, dur, chan[2]);
    g.connect(delay);
    o.frequency.value = midiHz(m);
    // delayed vibrato, like a tracker 4xy effect
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(midiHz(m) * 0.012, t + Math.min(dur, 0.35));
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01);
    g.gain.setValueAtTime(0.18, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };

  // ---- sequencer
  let song = null, pos = 0, row = 0, nextT = 0, timer = null;
  const playRow = (t) => {
    const pat = song.patterns[song.order[pos]];
    const rowDur = 60 / song.bpm / 4, bar = Math.floor(row / 16), r16 = row % 16;
    const [root, type] = pat.chords[bar];
    const d = DRUMS[pat.drums][r16];
    if (d === "k") kick(t);
    if (d === "s") snare(t);
    if (d === "h") hat(t, false);
    if (d === "o") hat(t, true);
    if (pat.drums === "four" && r16 % 4 === 2) hat(t, false);
    // bass
    if (pat.bass === "octave" && r16 % 2 === 0) bass(t, root + (r16 % 4 === 2 ? 12 : 0), rowDur * 1.8);
    if (pat.bass === "pulse" && r16 % 4 === 0) bass(t, root, rowDur * 3.5);
    if (pat.bass === "walk" && r16 % 4 === 0) bass(t, root + [0, 7, 12, 7][r16 / 4], rowDur * 3.6);
    if (pat.bass === "long" && r16 === 0) bass(t, root, rowDur * 15);
    // arpeggio chords: one note per tracker tick (3 ticks per row)
    const iv = CHORD[type], base = root + (pat.arpOct ?? 24);
    if (pat.arpOct ? r16 % 4 === 0 : true) arp(t, iv.map((i) => base + i), pat.arpOct ? rowDur * 4 : rowDur, rowDur / 3);
    // lead
    for (const [lr, m, len] of pat.lead ?? []) if (lr === row) lead(t, m, len * rowDur);
  };
  const tick = () => {
    if (!song) return;
    while (nextT < ac.currentTime + 0.15) {
      playRow(nextT);
      nextT += 60 / song.bpm / 4;
      if (++row >= 64) { row = 0; pos++; if (pos >= song.order.length) pos = song.loopTo; }
    }
  };
  const fade = (v, secs) => { const t = ac.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(v, t + secs); };

  let volume = 0.55, current = null, paused = false;
  return {
    play(name) {
      if (current === name) return;
      current = name;
      song = name === "title" ? TITLE : GAME;
      pos = 0; row = 0; nextT = ac.currentTime + 0.08;
      if (!timer) timer = setInterval(tick, 25);
      fade(paused ? 0 : volume, 0.4);
    },
    stop(secs = 1.2) { current = null; fade(0, secs); setTimeout(() => { if (!current) { song = null; } }, secs * 1000 + 50); },
    pause(p) { paused = p; fade(p ? 0 : volume, 0.25); },
    mute(m) { volume = m ? 0 : 0.55; fade(paused ? 0 : volume, 0.1); },
    get track() { return song?.name ?? null; },
  };
}
