/**
 * Video Recorder - Handles MediaStream composition (Canvas 60fps + WebAudio Track),
 * MediaRecorder lifecycle, blob generation, and file exporting.
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

    this.timerInterval = null;
    this.onTimerUpdate = null;
    this.onRecordingComplete = null;
  }

  static getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  startRecording() {
    if (this.isRecording) return;

    this.recordedChunks = [];
    if (this.recordedUrl) {
      URL.revokeObjectURL(this.recordedUrl);
      this.recordedUrl = null;
    }

    // Capture 60 FPS stream from master canvas
    const canvasStream = this.canvas.captureStream(60);
    const combinedStream = new MediaStream();

    // Add Canvas video track
    canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

    // Add Audio track from Web Audio destination
    const audioTrack = this.audioManager.getAudioStreamTrack();
    if (audioTrack) {
      combinedStream.addTrack(audioTrack);
    }

    const mimeType = VideoRecorder.getSupportedMimeType();
    const options = {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 8000000 // 8 Mbps for high quality 1080p
    };

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      console.warn('Standard MediaRecorder options failed, trying fallback:', e);
      this.mediaRecorder = new MediaRecorder(combinedStream);
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
      this.mediaRecorder.stop();
    }
  }

  _finalizeRecording() {
    const mimeType = this.mediaRecorder.mimeType || 'video/webm';
    this.recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
    this.recordedUrl = URL.createObjectURL(this.recordedBlob);

    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    const isMp4 = mimeType.includes('mp4');
    const extension = isMp4 ? 'mp4' : 'webm';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `lyric-video-${timestamp}.${extension}`;

    const metadata = {
      blob: this.recordedBlob,
      url: this.recordedUrl,
      sizeBytes: this.recordedBlob.size,
      sizeMB: (this.recordedBlob.size / (1024 * 1024)).toFixed(2),
      durationSeconds: elapsedSeconds,
      formattedDuration: this.audioManager.formatDuration(elapsedSeconds),
      mimeType,
      extension,
      filename,
      width: this.canvas.width,
      height: this.canvas.height
    };

    if (this.onRecordingComplete) {
      this.onRecordingComplete(metadata);
    }
  }
}
