// Web Audio API procedural sound engine - Zero external audio files required!
class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.musicPlaying = false;
        this.gemStreak = 0;
        this.lastGemTime = 0;
        this.bgmTimer = null;
        this.bgmStep = 0;

        // Pentatonic scale pitches for musical gem pickup streaks
        this.pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted && this.musicPlaying) {
            this.stopMusic();
        } else if (!this.isMuted && !this.musicPlaying) {
            this.startMusic();
        }
        return this.isMuted;
    }

    // --- Sound Effects ---

    playShoot(type = 'bolt') {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'bolt') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(680, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'fire') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.2);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'lightning') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(1100, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        }
    }

    playHit() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playGemPickup() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const currentTimeMs = performance.now();

        // Increment streak if picked up in quick succession (< 450ms)
        if (currentTimeMs - this.lastGemTime < 450) {
            this.gemStreak = Math.min(this.gemStreak + 1, this.pentatonic.length - 1);
        } else {
            this.gemStreak = 0;
        }
        this.lastGemTime = currentTimeMs;

        const freq = this.pentatonic[this.gemStreak];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.09);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playDash() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    playExplosion() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    }

    playPlayerHurt() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playLevelUp() {
        if (this.isMuted || !this.ctx) return;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        const stepTime = 0.06;
        const baseNow = this.ctx.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const noteStart = baseNow + i * stepTime;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteStart);

            gain.gain.setValueAtTime(0.15, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(noteStart);
            osc.stop(noteStart + 0.22);
        });
    }

    playBossAlert() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + i * 0.28;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(95, startTime);
            osc.frequency.exponentialRampToValueAtTime(65, startTime + 0.25);

            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }

    // --- Procedural Synthwave BGM Generator ---
    startMusic() {
        if (this.musicPlaying || this.isMuted || !this.ctx) return;
        this.musicPlaying = true;
        this.bgmStep = 0;

        const bpm = 128;
        const stepDuration = 60 / bpm / 2; // 16th notes approx

        // Bassline pattern: Am - F - C - G
        const bassNotes = [
            110, 110, 110, 110, 110, 110, 110, 110, // A2
            87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, // F2
            130.81, 130.81, 130.81, 130.81, 130.81, 130.81, 130.81, 130.81, // C3
            98.00, 98.00, 98.00, 98.00, 98.00, 98.00, 98.00, 98.00 // G2
        ];

        // Lead arpeggio
        const leadNotes = [
            440, 523.25, 659.25, 880, 659.25, 523.25, 440, 523.25,
            349.23, 440, 523.25, 698.46, 523.25, 440, 349.23, 440,
            523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 523.25, 659.25,
            392, 493.88, 587.33, 783.99, 587.33, 493.88, 392, 493.88
        ];

        this.bgmTimer = setInterval(() => {
            if (this.isMuted || !this.musicPlaying) return;
            const now = this.ctx.currentTime;

            const idx = this.bgmStep % bassNotes.length;

            // Bass beat (on every 16th note with varying accent)
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bassOsc.type = 'sawtooth';
            bassOsc.frequency.setValueAtTime(bassNotes[idx], now);

            // Filter for warm retro synth sound
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, now);

            bassOsc.connect(filter);
            filter.connect(bassGain);
            bassGain.connect(this.ctx.destination);

            const isAccent = idx % 4 === 0;
            const volume = isAccent ? 0.045 : 0.025;
            bassGain.gain.setValueAtTime(volume, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.9);

            bassOsc.start(now);
            bassOsc.stop(now + stepDuration * 0.9);

            // Arp Lead (every alternating 8th note)
            if (idx % 2 === 0) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                leadOsc.type = 'sine';
                leadOsc.frequency.setValueAtTime(leadNotes[idx], now);

                leadGain.gain.setValueAtTime(0.025, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.5);

                leadOsc.connect(leadGain);
                leadGain.connect(this.ctx.destination);
                leadOsc.start(now);
                leadOsc.stop(now + stepDuration * 1.5);
            }

            // Hi-hat / Kick pulse on beats
            if (idx % 4 === 0) {
                // Kick drum
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(140, now);
                kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
                kickGain.gain.setValueAtTime(0.06, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                kickOsc.connect(kickGain);
                kickGain.connect(this.ctx.destination);
                kickOsc.start(now);
                kickOsc.stop(now + 0.1);
            }

            this.bgmStep++;
        }, stepDuration * 1000);
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

window.soundManager = new SoundManager();
