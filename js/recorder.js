/**
 * Video Recorder - Handles MediaStream composition (Canvas 60fps + WebAudio Track),
 * hardware-accelerated MediaRecorder lifecycle, zero-overhead instant export,
 * and robust MediaStreamTrack lifecycle cleanup to prevent GPU/CPU memory leaks.
 */
export class VideoRecorder {
  constructor(canvas, audioManager) {
    this.canvas = canvas;
    this.audioManager = audioManager;

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = 0;
    this.recordedBlob = null;
    this.recordedUrl = null;

    this.canvasStream = null;
    this.combinedStream = null;

    this.timerInterval = null;
    this.onTimerUpdate = null;
    this.onProgressUpdate = null;
    this.onRecordingComplete = null;
  }

  static getSupportedMimeType() {
    // Prioritize high-performance hardware-accelerated containers
    const types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];

    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  _stopStreamTracks() {
    if (this.canvasStream) {
      try {
        this.canvasStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      } catch (e) {}
      this.canvasStream = null;
    }

    if (this.combinedStream) {
      try {
        this.combinedStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      } catch (e) {}
      this.combinedStream = null;
    }
  }

  startRecording() {
    if (this.isRecording) return;

    // 1. Release previous recordings & tracks to prevent memory thrashing
    this.recordedChunks = [];
    if (this.recordedUrl) {
      URL.revokeObjectURL(this.recordedUrl);
      this.recordedUrl = null;
    }
    this.recordedBlob = null;
    this._stopStreamTracks();

    // 2. Capture 60 FPS stream from master canvas
    this.canvasStream = this.canvas.captureStream(60);
    this.combinedStream = new MediaStream();

    // Add Canvas video tracks
    this.canvasStream.getVideoTracks().forEach(track => this.combinedStream.addTrack(track));

    // Add Audio track from Web Audio destination
    const audioTrack = this.audioManager.getAudioStreamTrack();
    if (audioTrack) {
      this.combinedStream.addTrack(audioTrack);
    }

    const mimeType = VideoRecorder.getSupportedMimeType();
    const options = {
      videoBitsPerSecond: 8000000 // 8 Mbps for pristine 1080p
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
    } catch (e) {
      console.warn('Standard MediaRecorder options failed, using fallback default:', e);
      this.mediaRecorder = new MediaRecorder(this.combinedStream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this._finalizeRecording();
    };

    this.mediaRecorder.start(250); // Collect data chunks every 250ms
    this.isRecording = true;
    this.startTime = performance.now();

    // Start timer interval for recording display
    this.timerInterval = setInterval(() => {
      if (this.isRecording && this.onTimerUpdate) {
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.onTimerUpdate(elapsed);
      }
    }, 100);
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('MediaRecorder stop note:', e);
      }
    }

    // Stop active stream tracks immediately to release GPU video capture pipeline
    this._stopStreamTracks();
  }

  async _finalizeRecording() {
    const rawMime = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'video/webm';
    const isMp4 = rawMime.toLowerCase().includes('mp4');
    const elapsedSeconds = Math.max(0.1, (performance.now() - this.startTime) / 1000);

    if (this.onProgressUpdate) {
      this.onProgressUpdate(0.5, 'Finalizing video stream...');
    }

    const finalMime = isMp4 ? 'video/mp4' : (rawMime || 'video/webm');
    this.recordedBlob = new Blob(this.recordedChunks, { type: finalMime });
    this.recordedChunks = []; // Release chunk memory immediately
    this.recordedUrl = URL.createObjectURL(this.recordedBlob);

    if (this.onProgressUpdate) {
      this.onProgressUpdate(1.0, 'Video Ready!');
    }

    const ext = isMp4 ? 'mp4' : 'webm';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `lyrics-video-${timestamp}.${ext}`;
    const formatName = isMp4 ? 'MP4 Video (H.264/AAC)' : 'WebM HD Video (Hardware Encoded)';

    const metadata = {
      blob: this.recordedBlob,
      url: this.recordedUrl,
      sizeBytes: this.recordedBlob.size,
      sizeMB: (this.recordedBlob.size / (1024 * 1024)).toFixed(2),
      durationSeconds: elapsedSeconds,
      formattedDuration: this.audioManager.formatDuration(elapsedSeconds),
      mimeType: formatName,
      extension: ext,
      filename,
      width: this.canvas.width,
      height: this.canvas.height
    };

    if (this.onRecordingComplete) {
      this.onRecordingComplete(metadata);
    }
  }

  cleanup() {
    this.stopRecording();
    this._stopStreamTracks();
    if (this.recordedUrl) {
      URL.revokeObjectURL(this.recordedUrl);
      this.recordedUrl = null;
    }
    this.recordedBlob = null;
    this.recordedChunks = [];
  }
}
