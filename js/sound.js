/**
 * Web Audio API Sound Synthesizer
 * Zero external audio files required. Instant playback on any browser.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2, decay = true) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      } else {
        gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ボタンクリック
  playClick() {
    this.playTone(600, 'sine', 0.08, 0.15);
  }

  // 選択決定音
  playSelect() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // カウントダウン音 (ジャン・ケン)
  playCountdown(step) {
    const freqs = [350, 440, 580];
    this.playTone(freqs[step] || 440, 'triangle', 0.18, 0.25);
  }

  // ポン！
  playPon() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // 重厚なインパクト音
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // 勝利ファンファーレ！
  playWin() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const timing = [0, 0.1, 0.2, 0.35];
    const durations = [0.12, 0.12, 0.15, 0.6];

    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durations[i]);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + durations[i]);
      }, timing[i] * 1000);
    });
  }

  // 敗北音
  playLose() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const notes = [400, 370, 340, 280];
    const timing = [0, 0.15, 0.3, 0.45];

    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }, timing[i] * 1000);
    });
  }

  // あいこ音
  playDraw() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const notes = [440, 440];
    const timing = [0, 0.12];

    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.15, 0.2);
      }, timing[i] * 1000);
    });
  }

  // 接続成功音
  playConnected() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const notes = [587.33, 880.00]; // D5, A5
    const timing = [0, 0.12];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.25);
      }, timing[i] * 1000);
    });
  }

  // QR読み取り成功
  playScanSuccess() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    this.playTone(987.77, 'sine', 0.1, 0.3); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'sine', 0.2, 0.3); // E6
    }, 100);
  }

  // リアクションスタンプ音
  playStamp() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}

window.sound = new SoundEngine();
