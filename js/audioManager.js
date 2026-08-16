/**
 * Audio Manager - Handles audio loading, Web Audio routing, playback synchronization,
 * and audio stream capture for recording.
 */
export class AudioManager {
  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    this.audioContext = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.freqDataArray = null;
    this.timeDataArray = null;

    // Smoothed telemetry cache
    this._smoothedBass = 0;
    this._smoothedMid = 0;
    this._smoothedTreble = 0;
    this._smoothedVol = 0;
    this._beatIntensity = 0;

    this.file = null;
    this.audioUrl = null;
    this.duration = 0;
    this.isPlaying = false;
    this.isInitialized = false;

    this.onTimeUpdateCallback = null;
    this.onEndedCallback = null;
    this.onPlayStateChangeCallback = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.currentTime, this.duration);
      }
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(false);
      if (this.onEndedCallback) this.onEndedCallback();
    });

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(true);
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.onPlayStateChangeCallback) this.onPlayStateChangeCallback(false);
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.duration = this.audioElement.duration || 0;
    });
  }

  async initAudioContext() {
    if (this.isInitialized && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      
      // Source node from audio element
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
      
      // Destination stream for MediaRecorder
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      // Master gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Analyser node for audio-reactive visuals
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.freqDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.timeDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Connect source -> gain -> speakers & recording stream & analyser
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.connect(this.destinationNode);
      this.gainNode.connect(this.analyserNode);

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization note:', e);
    }
  }

  /**
   * Returns real-time audio analysis metrics (frequencies, bands, volume, beat pulse)
   */
  getAudioTelemetry() {
    if (!this.analyserNode || !this.isInitialized) {
      // Natural idle drift values when audio is inactive
      this._smoothedBass = Math.max(0, this._smoothedBass * 0.92);
      this._smoothedMid = Math.max(0, this._smoothedMid * 0.92);
      this._smoothedTreble = Math.max(0, this._smoothedTreble * 0.92);
      this._smoothedVol = Math.max(0, this._smoothedVol * 0.92);
      this._beatIntensity = Math.max(0, this._beatIntensity * 0.90);

      return {
        isPlaying: this.isPlaying,
        bass: this._smoothedBass,
        mid: this._smoothedMid,
        treble: this._smoothedTreble,
        volume: this._smoothedVol,
        beat: this._beatIntensity,
        frequencyData: null,
        timeDomainData: null
      };
    }

    this.analyserNode.getByteFrequencyData(this.freqDataArray);
    this.analyserNode.getByteTimeDomainData(this.timeDataArray);

    const binCount = this.freqDataArray.length;
    let bassSum = 0;
    let bassCount = 0;
    let midSum = 0;
    let midCount = 0;
    let trebleSum = 0;
    let trebleCount = 0;
    let totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const val = this.freqDataArray[i] / 255;
      totalSum += val;

      if (i >= 1 && i <= 14) { // ~30Hz - ~300Hz
        bassSum += val;
        bassCount++;
      } else if (i > 14 && i <= 70) { // ~300Hz - ~2.5kHz
        midSum += val;
        midCount++;
      } else if (i > 70 && i <= 180) { // ~2.5kHz - ~8kHz
        trebleSum += val;
        trebleCount++;
      }
    }

    const rawBass = bassCount > 0 ? (bassSum / bassCount) : 0;
    const rawMid = midCount > 0 ? (midSum / midCount) : 0;
    const rawTreble = trebleCount > 0 ? (trebleSum / trebleCount) : 0;
    const rawVol = binCount > 0 ? (totalSum / binCount) : 0;

    // Smooth response with fast attack and natural release
    this._smoothedBass += (rawBass - this._smoothedBass) * (rawBass > this._smoothedBass ? 0.45 : 0.15);
    this._smoothedMid += (rawMid - this._smoothedMid) * (rawMid > this._smoothedMid ? 0.35 : 0.15);
    this._smoothedTreble += (rawTreble - this._smoothedTreble) * (rawTreble > this._smoothedTreble ? 0.40 : 0.18);
    this._smoothedVol += (rawVol - this._smoothedVol) * (rawVol > this._smoothedVol ? 0.40 : 0.12);

    // Instantaneous beat onset detection
    if (rawBass > 0.35 && rawBass > this._smoothedBass * 1.25) {
      this._beatIntensity = Math.min(1.0, this._beatIntensity + 0.5);
    } else {
      this._beatIntensity = Math.max(0, this._beatIntensity * 0.88);
    }

    return {
      isPlaying: this.isPlaying,
      bass: this._smoothedBass,
      mid: this._smoothedMid,
      treble: this._smoothedTreble,
      volume: this._smoothedVol,
      beat: this._beatIntensity,
      frequencyData: this.freqDataArray,
      timeDomainData: this.timeDataArray
    };
  }

  async loadAudioFile(file) {
    this.file = file;
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
    this.audioUrl = URL.createObjectURL(file);
    this.audioElement.src = this.audioUrl;
    
    return new Promise((resolve, reject) => {
      this.audioElement.onloadedmetadata = () => {
        this.duration = this.audioElement.duration || 0;
        resolve({
          name: file.name,
          duration: this.duration,
          size: file.size
        });
      };
      this.audioElement.onerror = (err) => {
        reject(err);
      };
    });
  }

  async loadAudioFromUrl(url, name = 'demo-track.mp3') {
    this.file = null;
    this.audioUrl = url;
    this.audioElement.src = url;

    return new Promise((resolve, reject) => {
      this.audioElement.onloadedmetadata = () => {
        this.duration = this.audioElement.duration || 0;
        resolve({
          name,
          duration: this.duration,
          size: 0
        });
      };
      this.audioElement.onerror = (err) => {
        reject(err);
      };
    });
  }

  /**
   * Generates a procedural upbeat synth sample track directly in Web Audio if the user wants an instant demo
   */
  async generateDemoSynthAudio() {
    const sampleRate = 44100;
    const duration = 24; // 24 seconds preview
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    // Chords progression: Am - F - C - G
    const chords = [
      [220.00, 261.63, 329.63], // Am (A3, C4, E4)
      [174.61, 220.00, 261.63], // F (F3, A3, C4)
      [130.81, 164.81, 196.00], // C (C3, E3, G3)
      [196.00, 246.94, 293.66], // G (G3, B3, D4)
    ];

    const chordDuration = 3.0; // 3 seconds per chord
    const totalBars = Math.floor(duration / chordDuration);

    for (let bar = 0; bar < totalBars; bar++) {
      const chord = chords[bar % chords.length];
      const barStart = bar * chordDuration;

      chord.forEach((freq) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, barStart);

        gain.gain.setValueAtTime(0.01, barStart);
        gain.gain.exponentialRampToValueAtTime(0.12, barStart + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.06, barStart + chordDuration - 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, barStart + chordDuration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(barStart);
        osc.stop(barStart + chordDuration);
      });

      // Add kick/percussion pulse
      for (let beat = 0; beat < 4; beat++) {
        const beatTime = barStart + (beat * 0.75);
        if (beatTime < duration) {
          const kickOsc = offlineCtx.createOscillator();
          const kickGain = offlineCtx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(140, beatTime);
          kickOsc.frequency.exponentialRampToValueAtTime(35, beatTime + 0.18);

          kickGain.gain.setValueAtTime(0.3, beatTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.2);

          kickOsc.connect(kickGain);
          kickGain.connect(offlineCtx.destination);
          kickOsc.start(beatTime);
          kickOsc.stop(beatTime + 0.25);
        }
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = this._audioBufferToWavBlob(renderedBuffer);
    const audioUrl = URL.createObjectURL(wavBlob);
    
    this.audioUrl = audioUrl;
    this.audioElement.src = audioUrl;
    this.duration = duration;
    
    return {
      name: 'Demo Synth Track (Procedural).wav',
      duration: duration,
      size: wavBlob.size
    };
  }

  _audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    function setUint16(data) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF identifier
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);  // file length - 8
    setUint32(0x45564157); // "WAVE"

    // fmt sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // SubChunk1Size (16 for PCM)
    setUint16(1);  // AudioFormat (1 for PCM)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample

    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  async play() {
    await this.initAudioContext();
    return this.audioElement.play();
  }

  pause() {
    this.audioElement.pause();
  }

  seek(seconds) {
    this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.duration));
  }

  get currentTime() {
    return this.audioElement.currentTime || 0;
  }

  getAudioStreamTrack() {
    if (this.destinationNode && this.destinationNode.stream) {
      const tracks = this.destinationNode.stream.getAudioTracks();
      if (tracks.length > 0) return tracks[0];
    }
    return null;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
