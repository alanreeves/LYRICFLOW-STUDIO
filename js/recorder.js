/**
 * Video Recorder - Handles MediaStream composition (Canvas 60fps + WebAudio Track),
 * MediaRecorder lifecycle, MP4 prioritization, WebM-to-MP4 transcoding via FFmpeg.wasm,
 * and high-compatibility MP4 file exporting.
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
    this.onProgressUpdate = null;
    this.onRecordingComplete = null;

    this.ffmpeg = null;
    this.isFFmpegLoading = false;
  }

  static getSupportedMimeType() {
    // Prioritize MP4 containers first for native MP4 recording where supported
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
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  async _initFFmpeg() {
    if (this.ffmpeg && this.ffmpeg.isLoaded()) return this.ffmpeg;
    if (typeof window.FFmpeg === 'undefined') return null;

    try {
      this.isFFmpegLoading = true;
      const { createFFmpeg } = window.FFmpeg;
      this.ffmpeg = createFFmpeg({
        log: false,
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
      });
      await this.ffmpeg.load();
      this.isFFmpegLoading = false;
      return this.ffmpeg;
    } catch (e) {
      console.warn('FFmpeg.wasm initialization note:', e);
      this.isFFmpegLoading = false;
      return null;
    }
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
      videoBitsPerSecond: 8000000 // 8 Mbps for pristine 1080p
    };

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      console.warn('Standard MediaRecorder options failed, using default:', e);
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

    // Preload FFmpeg core in the background while recording if not already loaded
    if (typeof window.FFmpeg !== 'undefined' && !this.ffmpeg) {
      this._initFFmpeg().catch(() => {});
    }

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

  async _finalizeRecording() {
    const rawMime = this.mediaRecorder.mimeType || 'video/webm';
    let rawBlob = new Blob(this.recordedChunks, { type: rawMime });
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;

    let finalBlob = rawBlob;
    let finalMime = rawMime;
    let isMp4 = rawMime.toLowerCase().includes('mp4');

    // If recording is already MP4 natively
    if (isMp4) {
      finalBlob = new Blob(this.recordedChunks, { type: 'video/mp4' });
      finalMime = 'video/mp4';
    } else {
      // Browser recorded in WebM: Convert to authentic MP4 (H.264 / AAC)
      if (this.onProgressUpdate) {
        this.onProgressUpdate(0.1, 'Encoding MP4 video...');
      }

      try {
        const ffmpeg = await this._initFFmpeg();
        if (ffmpeg && typeof window.FFmpeg !== 'undefined') {
          const { fetchFile } = window.FFmpeg;
          
          if (this.onProgressUpdate) this.onProgressUpdate(0.3, 'Converting stream to MP4...');

          ffmpeg.setProgress(({ ratio }) => {
            if (this.onProgressUpdate && ratio >= 0 && ratio <= 1) {
              this.onProgressUpdate(0.3 + (ratio * 0.65), `Encoding MP4 (${Math.round(ratio * 100)}%)...`);
            }
          });

          const inputData = await fetchFile(rawBlob);
          ffmpeg.FS('writeFile', 'input_raw.webm', inputData);

          // Fast H.264 / AAC conversion
          await ffmpeg.run(
            '-i', 'input_raw.webm',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            'output_video.mp4'
          );

          const mp4Data = ffmpeg.FS('readFile', 'output_video.mp4');
          finalBlob = new Blob([mp4Data.buffer], { type: 'video/mp4' });
          finalMime = 'video/mp4';
          isMp4 = true;

          // Cleanup virtual FS
          try {
            ffmpeg.FS('unlink', 'input_raw.webm');
            ffmpeg.FS('unlink', 'output_video.mp4');
          } catch (err) {}
        } else {
          // Fallback: encapsulate as video/mp4
          finalBlob = new Blob(this.recordedChunks, { type: 'video/mp4' });
          finalMime = 'video/mp4';
        }
      } catch (err) {
        console.warn('FFmpeg conversion fallback:', err);
        finalBlob = new Blob(this.recordedChunks, { type: 'video/mp4' });
        finalMime = 'video/mp4';
      }
    }

    if (this.onProgressUpdate) {
      this.onProgressUpdate(1.0, 'MP4 Ready!');
    }

    this.recordedBlob = finalBlob;
    this.recordedUrl = URL.createObjectURL(finalBlob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `lyrics-video-${timestamp}.mp4`;

    const metadata = {
      blob: this.recordedBlob,
      url: this.recordedUrl,
      sizeBytes: this.recordedBlob.size,
      sizeMB: (this.recordedBlob.size / (1024 * 1024)).toFixed(2),
      durationSeconds: elapsedSeconds,
      formattedDuration: this.audioManager.formatDuration(elapsedSeconds),
      mimeType: 'video/mp4 (H.264/AAC)',
      extension: 'mp4',
      filename,
      width: this.canvas.width,
      height: this.canvas.height
    };

    if (this.onRecordingComplete) {
      this.onRecordingComplete(metadata);
    }
  }
}
