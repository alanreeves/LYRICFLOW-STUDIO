/**
 * LyricFlow Studio - Main Application Controller
 */
import { AudioManager } from './js/audioManager.js';
import { MediaPool } from './js/mediaPool.js';
import { LyricsParser } from './js/lyricsParser.js';
import { CanvasRenderer } from './js/renderer.js';
import { VideoRecorder } from './js/recorder.js';

class App {
  constructor() {
    this.currentStep = 1;

    // Subsystems
    this.audio = new AudioManager();
    this.mediaPool = new MediaPool();
    this.lyrics = new LyricsParser();
    
    // Canvases
    this.masterCanvas = document.getElementById('master-canvas');
    this.styleCanvas = document.getElementById('style-preview-canvas');

    this.renderer = new CanvasRenderer(this.masterCanvas, this.mediaPool);
    this.stylePreviewRenderer = new CanvasRenderer(this.styleCanvas, this.mediaPool);

    this.recorder = new VideoRecorder(this.masterCanvas, this.audio);

    // Studio State
    this.activeCueIndex = -1;
    this.isStudioRecording = false;

    this.init();
  }

  init() {
    this._setupStepper();
    this._setupAssetUploads();
    this._setupLyricsEditor();
    this._setupStyleControls();
    this._setupStudioControls();
    this._setupExportControls();
    this._setupGlobalShortcuts();
    this._setupDemoLoader();
    this._setupServiceWorker();

    // Default procedural backgrounds
    this.mediaPool.loadDemoAssets();
    this._renderBgPool();

    // Update Lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (type === 'success') {
      iconEl.className = 'text-emerald-400';
    } else if (type === 'error') {
      iconEl.className = 'text-red-400';
    } else {
      iconEl.className = 'text-brand-400';
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 5) return;

    // Validation before stepping forward
    if (stepNumber > 1 && !this.audio.duration && !this.audio.file) {
      // Audio is recommended
    }

    this.currentStep = stepNumber;

    // Hide all step views
    for (let i = 1; i <= 5; i++) {
      const view = document.getElementById(`step-view-${i}`);
      const btn = document.getElementById(`step-btn-${i}`);
      if (view) {
        if (i === stepNumber) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      }
      if (btn) {
        if (i === stepNumber) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    }

    if (stepNumber === 2) {
      this._updateCueListUI();
    } else if (stepNumber === 3) {
      this._syncStylePreview();
    } else if (stepNumber === 4) {
      this._setupStudioSession();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // 1. STEPPER SETUP
  // ==========================================
  _setupStepper() {
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`step-btn-${i}`);
      if (btn) {
        btn.addEventListener('click', () => this.goToStep(i));
      }
    }

    document.getElementById('step-1-next-btn')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('step-2-prev-btn')?.addEventListener('click', () => this.goToStep(1));
    document.getElementById('step-2-next-btn')?.addEventListener('click', () => this.goToStep(3));
    document.getElementById('step-3-prev-btn')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('step-3-next-btn')?.addEventListener('click', () => this.goToStep(4));
    document.getElementById('step-4-prev-btn')?.addEventListener('click', () => {
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      }
      this.goToStep(3);
    });
  }

  // ==========================================
  // 2. ASSET UPLOAD SETUP
  // ==========================================
  _setupAssetUploads() {
    // Audio Upload
    const audioInput = document.getElementById('audio-input');
    const audioBadge = document.getElementById('audio-status-badge');
    const audioPreview = document.getElementById('audio-preview-container');
    const audioPlayer = document.getElementById('audio-player-preview');
    const audioName = document.getElementById('audio-file-name');
    const audioDur = document.getElementById('audio-file-duration');

    audioInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const info = await this.audio.loadAudioFile(file);
          audioBadge.className = 'badge-success';
          audioBadge.textContent = 'Audio Ready';
          audioPreview.classList.remove('hidden');
          audioPlayer.src = this.audio.audioUrl;
          audioName.textContent = info.name;
          audioDur.textContent = this.audio.formatDuration(info.duration);
          this.showToast(`Loaded audio: ${file.name}`, 'success');
        } catch (err) {
          this.showToast('Failed to load audio file', 'error');
        }
      }
    });

    // Background Media Pool Upload
    const bgInput = document.getElementById('bg-input');
    bgInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        try {
          await this.mediaPool.addFile(file);
        } catch (err) {
          console.warn(err);
        }
      }
      this._renderBgPool();
      this.showToast(`Added ${files.length} background assets`, 'success');
    });

    // Add Gradient BG button
    document.getElementById('btn-add-gradient-bg')?.addEventListener('click', () => {
      const palettes = [
        ['#020617', '#4338ca', '#be185d', '#059669'],
        ['#0f172a', '#7c3aed', '#db2777', '#2563eb'],
        ['#18181b', '#0284c7', '#0d9488', '#e11d48'],
        ['#09090b', '#dc2626', '#d97706', '#4f46e5'],
      ];
      const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
      this.mediaPool.addProceduralGradient(`Neon Motion ${this.mediaPool.assets.length + 1}`, randomPalette);
      this._renderBgPool();
      this.showToast('Added animated gradient background', 'success');
    });

    // Lyrics File Upload
    const lyricsInput = document.getElementById('lyrics-input');
    lyricsInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target.result;
          this.lyrics.setRawText(text);
          const rawInput = document.getElementById('raw-lyrics-input');
          if (rawInput) rawInput.value = text;
          this._updateLyricsSummary();
          this.showToast(`Loaded lyrics (${this.lyrics.cues.length} cues)`, 'success');
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('btn-quick-paste')?.addEventListener('click', () => {
      this.goToStep(2);
    });

    // Drag & Drop visual highlights
    document.querySelectorAll('.upload-dropzone').forEach(dropzone => {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', () => {
        dropzone.classList.remove('dragover');
      });
    });
  }

  _renderBgPool() {
    const list = document.getElementById('bg-pool-list');
    const countBadge = document.getElementById('bg-pool-count');
    const strip = document.getElementById('style-bg-selector-strip');
    const switcher = document.getElementById('studio-bg-switcher');

    if (!list) return;

    list.innerHTML = '';
    if (strip) strip.innerHTML = '';
    if (switcher) switcher.innerHTML = '';

    countBadge.textContent = `${this.mediaPool.assets.length} Loaded`;
    if (this.mediaPool.assets.length > 0) {
      countBadge.className = 'badge-success';
    }

    this.mediaPool.assets.forEach((asset, idx) => {
      // Step 1 Pool Card
      const item = document.createElement('div');
      item.className = `media-pool-item ${asset.id === this.mediaPool.activeAssetId ? 'active' : ''}`;
      item.innerHTML = `
        <img src="${asset.thumbnail}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition p-1 text-center">
          <span class="text-[10px] text-white font-medium truncate">${asset.name}</span>
        </div>
        <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white font-bold">${idx + 1}</span>
      `;
      item.addEventListener('click', () => {
        this.mediaPool.setActiveAsset(asset.id);
        this._renderBgPool();
      });
      list.appendChild(item);

      // Step 3 Style Preview Strip
      if (strip) {
        const mini = document.createElement('div');
        mini.className = `w-14 h-9 rounded-lg overflow-hidden border-2 cursor-pointer flex-shrink-0 relative ${asset.id === this.mediaPool.activeAssetId ? 'border-brand-500 shadow-md' : 'border-slate-700 opacity-70'}`;
        mini.innerHTML = `<img src="${asset.thumbnail}" class="w-full h-full object-cover">`;
        mini.addEventListener('click', () => {
          this.mediaPool.setActiveAsset(asset.id);
          this._renderBgPool();
        });
        strip.appendChild(mini);
      }

      // Step 4 Studio Switcher Strip
      if (switcher) {
        const studioBtn = document.createElement('button');
        studioBtn.className = `flex-shrink-0 flex items-center gap-2 p-1.5 rounded-xl border transition ${asset.id === this.mediaPool.activeAssetId ? 'bg-brand-500/20 border-brand-500 text-white' : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'}`;
        studioBtn.innerHTML = `
          <div class="w-10 h-7 rounded overflow-hidden relative">
            <img src="${asset.thumbnail}" class="w-full h-full object-cover">
            <span class="absolute bottom-0 right-0 px-1 rounded-tl bg-black/80 text-[8px] font-mono text-white font-bold">${idx + 1}</span>
          </div>
          <span class="text-xs font-medium truncate max-w-[90px] pr-1">${asset.name}</span>
        `;
        studioBtn.addEventListener('click', () => {
          this.mediaPool.setActiveAsset(asset.id);
          this._renderBgPool();
          this.showToast(`Switched to Background [${idx + 1}]: ${asset.name}`, 'info');
        });
        switcher.appendChild(studioBtn);
      }
    });
  }

  _updateLyricsSummary() {
    const badge = document.getElementById('lyrics-status-badge');
    const linesCount = document.getElementById('lyrics-lines-count');
    const cuesBadge = document.getElementById('cues-total-badge');

    if (this.lyrics.cues.length > 0) {
      if (badge) {
        badge.className = 'badge-success';
        badge.textContent = 'Lyrics Ready';
      }
      if (linesCount) linesCount.textContent = `${this.lyrics.cues.length} cue chunks ready`;
      if (cuesBadge) cuesBadge.textContent = `${this.lyrics.cues.length} Cues`;
    } else {
      if (badge) {
        badge.className = 'badge-neutral';
        badge.textContent = 'Required';
      }
      if (linesCount) linesCount.textContent = `0 lines ready`;
      if (cuesBadge) cuesBadge.textContent = `0 Cues`;
    }
  }

  // ==========================================
  // 3. LYRICS DELIMITATION & EDITOR
  // ==========================================
  _setupLyricsEditor() {
    const rawInput = document.getElementById('raw-lyrics-input');
    const charCount = document.getElementById('editor-char-count');

    rawInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      this.lyrics.setRawText(val);
      const lines = val.split('\n').length;
      if (charCount) charCount.textContent = `${val.length} characters, ${lines} lines`;
      this._updateLyricsSummary();
      this._updateCueListUI();
    });

    // Delimitation mode buttons
    const modeButtons = [
      { id: 'chunk-by-empty-line', mode: 'empty-line' },
      { id: 'chunk-by-single-line', mode: 'single-line' },
      { id: 'chunk-by-two-lines', mode: 'two-lines' },
      { id: 'chunk-by-sentence', mode: 'sentence' },
    ];

    modeButtons.forEach(({ id, mode }) => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => {
        modeButtons.forEach(b => document.getElementById(b.id)?.classList.remove('active-chunk-rule'));
        btn.classList.add('active-chunk-rule');
        this.lyrics.setDelimitationMode(mode);
        this._updateCueListUI();
        this._updateLyricsSummary();
        this.showToast(`Grouped lyrics by ${mode.replace('-', ' ')}`, 'info');
      });
    });

    document.getElementById('btn-format-trim')?.addEventListener('click', () => {
      this.lyrics.trimAll();
      if (rawInput) rawInput.value = this.lyrics.rawText;
      this._updateCueListUI();
      this.showToast('Trimmed extra lines and whitespace', 'info');
    });

    document.getElementById('btn-uppercase-all')?.addEventListener('click', () => {
      this.lyrics.toUpperCase();
      if (rawInput) rawInput.value = this.lyrics.rawText;
      this._updateCueListUI();
      this.showToast('Converted lyrics to UPPERCASE', 'info');
    });
  }

  _updateCueListUI() {
    const container = document.getElementById('cue-chunks-container');
    if (!container) return;

    if (this.lyrics.cues.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
          <i data-lucide="text-quote" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm">No cues generated yet.</p>
          <p class="text-xs text-slate-600 mt-1">Paste lyrics in the left editor or load sample data.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = '';
    this.lyrics.cues.forEach((cue, idx) => {
      const card = document.createElement('div');
      card.className = 'cue-card flex items-start justify-between gap-3 group';
      card.innerHTML = `
        <div class="flex items-start gap-2.5 flex-1">
          <span class="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">${idx + 1}</span>
          <textarea class="cue-edit-textarea w-full bg-transparent text-sm text-slate-200 resize-none outline-none font-medium leading-relaxed focus:bg-slate-900/80 p-1 rounded transition" rows="${Math.max(1, cue.lines.length)}">${cue.text}</textarea>
        </div>
        <button class="btn-delete-cue text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1" title="Delete cue">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;

      const textarea = card.querySelector('.cue-edit-textarea');
      textarea.addEventListener('input', (e) => {
        this.lyrics.updateCueText(idx, e.target.value);
      });

      card.querySelector('.btn-delete-cue')?.addEventListener('click', () => {
        this.lyrics.deleteCue(idx);
        this._updateCueListUI();
        this._updateLyricsSummary();
      });

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // 4. STYLE & LAYOUT CONTROLS
  // ==========================================
  _setupStyleControls() {
    // Aspect ratio buttons
    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aspect-ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ratio = btn.getAttribute('data-ratio');
        
        this.renderer.setAspectRatio(ratio);
        this.stylePreviewRenderer.setAspectRatio(ratio);

        const stageWrapper = document.getElementById('master-stage-wrapper');
        const previewWrapper = document.getElementById('style-preview-wrapper');

        // Adjust wrapper CSS aspect ratios
        [stageWrapper, previewWrapper].forEach(el => {
          if (!el) return;
          el.className = el.className.replace(/aspect-(video|square|\[9\/16\])/g, '');
          if (ratio === '16-9') el.classList.add('aspect-video');
          else if (ratio === '9-16') el.classList.add('aspect-[9/16]');
          else if (ratio === '1-1') el.classList.add('aspect-square');
        });

        this.showToast(`Aspect ratio changed to ${ratio.replace('-', ':')}`, 'info');
      });
    });

    // Font family
    const fontSelect = document.getElementById('font-family-select');
    fontSelect?.addEventListener('change', (e) => {
      this._updateStyle({ fontFamily: e.target.value });
    });

    // Font weight
    const weightSelect = document.getElementById('font-weight-select');
    weightSelect?.addEventListener('change', (e) => {
      this._updateStyle({ fontWeight: e.target.value });
    });

    // Italic Toggle
    const italicBtn = document.getElementById('btn-toggle-italic');
    let isItalic = false;
    italicBtn?.addEventListener('click', () => {
      isItalic = !isItalic;
      italicBtn.classList.toggle('active-chunk-rule', isItalic);
      this._updateStyle({ isItalic });
    });

    // Uppercase Toggle
    const upperBtn = document.getElementById('btn-toggle-uppercase');
    let isUpper = false;
    upperBtn?.addEventListener('click', () => {
      isUpper = !isUpper;
      upperBtn.classList.toggle('active-chunk-rule', isUpper);
      this._updateStyle({ isUppercase: isUpper });
    });

    // Font size slider
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    fontSizeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      fontSizeVal.textContent = `${val}px`;
      this._updateStyle({ fontSize: val });
    });

    // Max Width slider
    const maxWidthSlider = document.getElementById('max-width-slider');
    const maxWidthVal = document.getElementById('max-width-val');
    maxWidthSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      maxWidthVal.textContent = `${val}%`;
      this._updateStyle({ maxWidthPercent: val });
    });

    // Colors: Text, Stroke, Shadow, Box
    this._bindColorInput('text-color-picker', 'text-color-hex', (c) => this._updateStyle({ textColor: c }));
    this._bindColorInput('stroke-color-picker', 'stroke-color-hex', (c) => this._updateStyle({ strokeColor: c }));
    this._bindColorInput('shadow-color-picker', 'shadow-color-hex', (c) => this._updateStyle({ shadowColor: c }));
    this._bindColorInput('box-color-picker', 'box-color-hex', (c) => this._updateStyle({ boxColor: c }));

    // Stroke width slider
    const strokeWidthSlider = document.getElementById('stroke-width-slider');
    const strokeWidthVal = document.getElementById('stroke-width-val');
    strokeWidthSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      strokeWidthVal.textContent = `${val}px`;
      this._updateStyle({ strokeWidth: val });
    });

    // Box Opacity slider
    const boxOpacitySlider = document.getElementById('box-opacity-slider');
    const boxOpacityVal = document.getElementById('box-opacity-val');
    boxOpacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      boxOpacityVal.textContent = `${val}%`;
      this._updateStyle({ boxOpacity: val });
    });

    // Position Mode: Fixed vs Dynamic
    const posFixedBtn = document.getElementById('pos-mode-fixed');
    const posDynamicBtn = document.getElementById('pos-mode-dynamic');
    const fixedControls = document.getElementById('fixed-pos-controls');
    const dynamicControls = document.getElementById('dynamic-pos-controls');

    posFixedBtn?.addEventListener('click', () => {
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posDynamicBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls.classList.remove('hidden');
      dynamicControls.classList.add('hidden');
      this._updateStyle({ positionMode: 'fixed' });
    });

    posDynamicBtn?.addEventListener('click', () => {
      posDynamicBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls.classList.add('hidden');
      dynamicControls.classList.remove('hidden');
      this._updateStyle({ positionMode: 'dynamic' });
    });

    // Fixed vertical presets (Top, Center, Bottom)
    document.querySelectorAll('.fixed-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fixed-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const align = btn.getAttribute('data-align');
        this._updateStyle({ verticalAlign: align });
      });
    });

    // Horizontal alignment buttons
    document.querySelectorAll('.text-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.text-align-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const align = btn.getAttribute('data-align');
        this._updateStyle({ textAlign: align });
      });
    });

    // Test preview text input
    const previewSampleInput = document.getElementById('preview-sample-text');
    previewSampleInput?.addEventListener('input', (e) => {
      this.stylePreviewRenderer.setCue({ index: 0, text: e.target.value });
    });
  }

  _bindColorInput(inputId, hexId, callback) {
    const input = document.getElementById(inputId);
    const hex = document.getElementById(hexId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (hex) hex.textContent = val.toUpperCase();
      callback(val);
    });
  }

  _updateStyle(newProps) {
    this.renderer.updateStyle(newProps);
    this.stylePreviewRenderer.updateStyle(newProps);
  }

  _syncStylePreview() {
    const sampleInput = document.getElementById('preview-sample-text');
    const text = sampleInput ? sampleInput.value : (this.lyrics.cues[0]?.text || 'LYRICS PREVIEW TEXT');
    this.stylePreviewRenderer.setCue({ index: 0, text });
  }

  // ==========================================
  // 5. LIVE RECORDING STUDIO
  // ==========================================
  _setupStudioControls() {
    // Big Tap / Advance Cue Button
    const fireBtn = document.getElementById('btn-fire-cue');
    fireBtn?.addEventListener('click', () => {
      this.advanceCue();
    });

    // Prev Cue Button
    document.getElementById('btn-prev-cue')?.addEventListener('click', () => {
      this.previousCue();
    });

    // Blank Cue Button
    document.getElementById('btn-blank-cue')?.addEventListener('click', () => {
      this.toggleBlankCue();
    });

    // Toggle Record & Play Button
    const recBtn = document.getElementById('btn-toggle-record');
    recBtn?.addEventListener('click', () => {
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      } else {
        this.startStudioRecording();
      }
    });

    // Audio Play/Pause Button inside studio
    const studioAudioBtn = document.getElementById('btn-studio-audio-toggle');
    studioAudioBtn?.addEventListener('click', async () => {
      if (this.audio.isPlaying) {
        this.audio.pause();
      } else {
        await this.audio.play();
      }
    });

    // Audio Progress scrubber
    const progressContainer = document.getElementById('audio-progress-bar-container');
    progressContainer?.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = fraction * this.audio.duration;
      this.audio.seek(targetTime);
    });

    // Time update callback for studio bar
    this.audio.onTimeUpdateCallback = (current, total) => {
      const bar = document.getElementById('audio-progress-bar');
      const curText = document.getElementById('studio-time-current');
      const totText = document.getElementById('studio-time-total');

      if (bar) {
        const percent = total > 0 ? (current / total) * 100 : 0;
        bar.style.width = `${percent}%`;
      }
      if (curText) curText.textContent = this.audio.formatDuration(current);
      if (totText) totText.textContent = this.audio.formatDuration(total);
    };

    // Play state change callback
    this.audio.onPlayStateChangeCallback = (isPlaying) => {
      const icon = document.getElementById('studio-play-icon');
      if (icon) {
        icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
        if (window.lucide) window.lucide.createIcons();
      }
    };

    // Audio ended
    this.audio.onEndedCallback = () => {
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      }
    };

    // Video Recorder timer callback
    this.recorder.onTimerUpdate = (elapsed) => {
      const timerDisplay = document.getElementById('recording-time-display');
      if (timerDisplay) {
        timerDisplay.textContent = this.audio.formatTime(elapsed);
      }
    };

    // Video Recorder complete callback
    this.recorder.onRecordingComplete = (metadata) => {
      this._showExportView(metadata);
    };
  }

  _setupStudioSession() {
    this.activeCueIndex = -1;
    this.renderer.setCue(null);
    this._updatePrompterUI();
    this._renderBgPool();

    const totText = document.getElementById('studio-time-total');
    if (totText) totText.textContent = this.audio.formatDuration(this.audio.duration);
  }

  async startStudioRecording() {
    if (this.lyrics.cues.length === 0) {
      this.showToast('Please add some lyrics first before recording!', 'error');
      this.goToStep(2);
      return;
    }

    this.isStudioRecording = true;
    this.activeCueIndex = -1;
    this.renderer.setCue(null);

    // Audio start
    this.audio.seek(0);
    try {
      await this.audio.play();
    } catch (e) {
      console.warn('Audio play request:', e);
    }

    // Recorder start
    this.recorder.startRecording();

    // UI Updates
    const recBtn = document.getElementById('btn-toggle-record');
    const recText = document.getElementById('btn-toggle-record-text');
    const recDot = document.getElementById('rec-status-dot');
    const recBadge = document.getElementById('live-rec-badge');

    if (recBtn) {
      recBtn.classList.add('recording');
      if (recText) recText.textContent = 'Stop & Finalize Recording';
    }
    if (recDot) {
      recDot.className = 'w-3.5 h-3.5 rounded-full bg-red-500 animate-ping';
    }
    if (recBadge) {
      recBadge.classList.remove('hidden');
      recBadge.classList.add('flex');
    }

    this._updatePrompterUI();
    this.showToast('Recording started! Hit Spacebar to advance lyrics.', 'success');
  }

  stopStudioRecording() {
    if (!this.isStudioRecording) return;
    this.isStudioRecording = false;

    this.audio.pause();
    this.recorder.stopRecording();

    const recBtn = document.getElementById('btn-toggle-record');
    const recText = document.getElementById('btn-toggle-record-text');
    const recDot = document.getElementById('rec-status-dot');
    const recBadge = document.getElementById('live-rec-badge');

    if (recBtn) {
      recBtn.classList.remove('recording');
      if (recText) recText.textContent = 'Start Recording & Play';
    }
    if (recDot) {
      recDot.className = 'w-3.5 h-3.5 rounded-full bg-slate-600';
    }
    if (recBadge) {
      recBadge.classList.add('hidden');
      recBadge.classList.remove('flex');
    }

    this.showToast('Recording finalized! Compiling video export...', 'info');
  }

  advanceCue() {
    const totalCues = this.lyrics.cues.length;
    if (totalCues === 0) return;

    if (this.activeCueIndex < totalCues - 1) {
      this.activeCueIndex++;
      const activeCue = this.lyrics.cues[this.activeCueIndex];
      this.renderer.setCue(activeCue, false);
      this._updatePrompterUI();
    } else {
      // Reached the end of lyrics
      this.showToast('Final lyric cue reached!', 'info');
    }
  }

  previousCue() {
    if (this.activeCueIndex > 0) {
      this.activeCueIndex--;
      const activeCue = this.lyrics.cues[this.activeCueIndex];
      this.renderer.setCue(activeCue, false);
      this._updatePrompterUI();
    } else if (this.activeCueIndex === 0) {
      this.activeCueIndex = -1;
      this.renderer.setCue(null, false);
      this._updatePrompterUI();
    }
  }

  toggleBlankCue() {
    this.renderer.isBlank = !this.renderer.isBlank;
    this.showToast(this.renderer.isBlank ? 'Screen blanked (Text hidden)' : 'Text unhidden', 'info');
    this._updatePrompterUI();
  }

  _updatePrompterUI() {
    const totalCues = this.lyrics.cues.length;
    const currentCue = this.activeCueIndex >= 0 ? this.lyrics.cues[this.activeCueIndex] : null;
    const nextCue = this.activeCueIndex + 1 < totalCues ? this.lyrics.cues[this.activeCueIndex + 1] : null;

    // HUD Counter
    const counterHud = document.getElementById('cue-counter-hud');
    if (counterHud) {
      counterHud.textContent = `Cue ${Math.max(0, this.activeCueIndex + 1)} / ${totalCues}`;
    }

    // HUD Next text
    const hudNext = document.getElementById('hud-next-cue-text');
    if (hudNext) {
      hudNext.textContent = nextCue ? nextCue.text.replace(/\n/g, ' ') : (currentCue ? '— End of Lyrics —' : 'Hit Spacebar for 1st Cue');
    }

    // Prompter Cards
    const prompterActive = document.getElementById('prompter-active-text');
    const prompterNext = document.getElementById('prompter-next-text');
    const prompterStatus = document.getElementById('prompter-status');

    if (prompterStatus) {
      prompterStatus.textContent = this.isStudioRecording ? 'LIVE ON AIR' : 'Ready';
    }

    if (prompterActive) {
      prompterActive.textContent = currentCue ? currentCue.text : '(No cue active yet)';
    }

    if (prompterNext) {
      prompterNext.textContent = nextCue ? nextCue.text.replace(/\n/g, ' ') : '— End of Lyrics —';
    }

    // Mini Cue List
    const prompterList = document.getElementById('prompter-cue-list');
    if (prompterList) {
      prompterList.innerHTML = '';
      this.lyrics.cues.forEach((cue, idx) => {
        const item = document.createElement('div');
        const isActive = idx === this.activeCueIndex;
        const isPast = idx < this.activeCueIndex;
        item.className = `p-1.5 px-2.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${isActive ? 'bg-brand-500/20 border border-brand-500/40 text-white font-semibold' : isPast ? 'text-slate-500 opacity-60' : 'text-slate-400 hover:bg-slate-800'}`;
        item.innerHTML = `
          <span class="truncate mr-2">${idx + 1}. ${cue.text.replace(/\n/g, ' ')}</span>
          ${isActive ? '<span class="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 animate-pulse"></span>' : ''}
        `;
        item.addEventListener('click', () => {
          this.activeCueIndex = idx;
          this.renderer.setCue(cue, false);
          this._updatePrompterUI();
        });
        prompterList.appendChild(item);
      });
    }
  }

  // ==========================================
  // 6. GLOBAL SHORTCUTS
  // ==========================================
  _setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Spacebar: Advance Cue
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.currentStep === 4) {
          this.advanceCue();
        }
      }

      // Right Arrow: Next Cue
      if (e.code === 'ArrowRight') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.advanceCue();
        }
      }

      // Left Arrow: Prev Cue
      if (e.code === 'ArrowLeft') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.previousCue();
        }
      }

      // 'B' Key: Toggle Blank Cue
      if (e.key === 'b' || e.key === 'B') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.toggleBlankCue();
        }
      }

      // 1-9 Keys: Switch Background mid-recording
      if (e.key >= '1' && e.key <= '9') {
        const bgIdx = parseInt(e.key, 10) - 1;
        if (bgIdx < this.mediaPool.assets.length) {
          e.preventDefault();
          this.mediaPool.setActiveByIndex(bgIdx);
          this._renderBgPool();
          this.showToast(`Switched Background [${e.key}]`, 'info');
        }
      }
    });
  }

  // ==========================================
  // 7. EXPORT & REVIEW CONTROLS
  // ==========================================
  _setupExportControls() {
    document.getElementById('btn-re-record')?.addEventListener('click', () => {
      this.goToStep(4);
    });

    document.getElementById('btn-export-to-studio')?.addEventListener('click', () => {
      this.goToStep(4);
    });
  }

  _showExportView(metadata) {
    this.goToStep(5);

    const videoPlayer = document.getElementById('export-video-player');
    const dlBtn1 = document.getElementById('btn-download-video');
    const dlBtn2 = document.getElementById('btn-download-video-secondary');

    const statDuration = document.getElementById('export-stat-duration');
    const statRes = document.getElementById('export-stat-res');
    const statFormat = document.getElementById('export-stat-format');
    const statSize = document.getElementById('export-stat-size');

    if (videoPlayer) {
      videoPlayer.src = metadata.url;
      videoPlayer.play().catch(() => {});
    }

    if (dlBtn1) {
      dlBtn1.href = metadata.url;
      dlBtn1.download = metadata.filename;
    }

    if (dlBtn2) {
      dlBtn2.href = metadata.url;
      dlBtn2.download = metadata.filename;
    }

    if (statDuration) statDuration.textContent = metadata.formattedDuration;
    if (statRes) statRes.textContent = `${metadata.width} x ${metadata.height}`;
    if (statFormat) statFormat.textContent = metadata.mimeType;
    if (statSize) statSize.textContent = `${metadata.sizeMB} MB`;
  }

  // ==========================================
  // 8. DEMO PROJECT LOADER & RESET
  // ==========================================
  _setupDemoLoader() {
    document.getElementById('btn-load-demo')?.addEventListener('click', async () => {
      try {
        this.showToast('Generating procedural audio track & demo assets...', 'info');
        
        // 1. Generate audio track
        const audioInfo = await this.audio.generateDemoSynthAudio();
        const audioBadge = document.getElementById('audio-status-badge');
        const audioPreview = document.getElementById('audio-preview-container');
        const audioPlayer = document.getElementById('audio-player-preview');
        const audioName = document.getElementById('audio-file-name');
        const audioDur = document.getElementById('audio-file-duration');

        if (audioBadge) {
          audioBadge.className = 'badge-success';
          audioBadge.textContent = 'Demo Track Ready';
        }
        if (audioPreview) audioPreview.classList.remove('hidden');
        if (audioPlayer) audioPlayer.src = this.audio.audioUrl;
        if (audioName) audioName.textContent = audioInfo.name;
        if (audioDur) audioDur.textContent = this.audio.formatDuration(audioInfo.duration);

        // 2. Load demo motion backgrounds
        await this.mediaPool.loadDemoAssets();
        this._renderBgPool();

        // 3. Load demo lyrics
        const demoLyricsText = this.lyrics.getDemoLyrics();
        this.lyrics.setRawText(demoLyricsText);
        const rawInput = document.getElementById('raw-lyrics-input');
        if (rawInput) rawInput.value = demoLyricsText;

        this._updateLyricsSummary();
        this._updateCueListUI();

        // 4. Default high-contrast visual styling
        this._updateStyle({
          fontFamily: 'Outfit',
          fontWeight: '900',
          fontSize: 52,
          isUppercase: true,
          strokeColor: '#000000',
          strokeWidth: 8,
          textColor: '#ffffff',
          shadowColor: '#000000',
          shadowBlur: 20
        });

        this.showToast('Demo project loaded! Ready to customize or record.', 'success');
        this.goToStep(2);
      } catch (e) {
        console.error('Demo loading failed:', e);
        this.showToast('Failed to generate demo', 'error');
      }
    });

    document.getElementById('btn-reset-all')?.addEventListener('click', () => {
      if (confirm('Reset the entire project and clear loaded assets?')) {
        location.reload();
      }
    });
  }

  // ==========================================
  // 9. SERVICE WORKER REGISTRATION (PWA)
  // ==========================================
  _setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.0.0').catch((err) => {
          console.warn('SW registration info:', err);
        });
      });
    }
  }
}

// Instantiate app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
