/**
 * LyricFlow Studio - Main Application Controller
 */
import { AudioManager } from './js/audioManager.js';
import { MediaPool } from './js/mediaPool.js';
import { LyricsParser } from './js/lyricsParser.js';
import { CanvasRenderer } from './js/renderer.js';
import { VideoRecorder } from './js/recorder.js';

export const APP_VERSION = '1.0.7';

class App {
  constructor() {
    this.currentStep = 1;
    this.deferredInstallPrompt = null;
    this.customMaxDuration = null;

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
    this._setupVideoSpeedControls();
    this._setupProjectPersistenceControls();
    this._setupPwaInstall();
    this._setupSettingsMenu();
    this._setupServiceWorker();
    this._checkAppVersionUpdate();

    // Default procedural backgrounds
    this.mediaPool.loadDemoAssets();
    this._renderBgPool();

    // Update Lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast');
    const toastCard = document.getElementById('toast-card');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    
    if (toastCard) {
      toastCard.className = `toast-card toast-${type} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border pointer-events-auto`;
    }

    if (iconEl) {
      let iconName = 'info';
      let iconColor = 'text-brand-400';
      if (type === 'success') {
        iconName = 'check-circle-2';
        iconColor = 'text-emerald-400';
      } else if (type === 'error') {
        iconName = 'alert-circle';
        iconColor = 'text-red-400';
      } else if (type === 'warning') {
        iconName = 'alert-triangle';
        iconColor = 'text-amber-400';
      }
      iconEl.className = `${iconColor} shrink-0`;
      iconEl.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, duration);
  }

  showAppAlert({ title = 'Notice', message = '', type = 'info', confirmText = 'OK' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-dialog-modal');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const confirmBtn = document.getElementById('app-dialog-confirm-btn');
      const cancelBtn = document.getElementById('app-dialog-cancel-btn');
      const inputContainer = document.getElementById('app-dialog-input-container');
      const iconContainer = document.getElementById('app-dialog-icon-container');
      const iconEl = document.getElementById('app-dialog-icon');

      if (!modal) {
        alert(message);
        return resolve();
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmText;
      confirmBtn.className = 'btn-primary px-5 py-1.5 text-xs';
      if (cancelBtn) cancelBtn.classList.add('hidden');
      if (inputContainer) inputContainer.classList.add('hidden');

      let iconName = 'info';
      let iconColor = 'text-brand-400';
      let bgBorder = 'bg-brand-500/15 border-brand-500/30';
      if (type === 'success') {
        iconName = 'check-circle-2';
        iconColor = 'text-emerald-400';
        bgBorder = 'bg-emerald-500/15 border-emerald-500/30';
      } else if (type === 'error' || type === 'danger') {
        iconName = 'alert-octagon';
        iconColor = 'text-red-400';
        bgBorder = 'bg-red-500/15 border-red-500/30';
      } else if (type === 'warning') {
        iconName = 'alert-triangle';
        iconColor = 'text-amber-400';
        bgBorder = 'bg-amber-500/15 border-amber-500/30';
      }

      if (iconContainer) iconContainer.className = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColor} ${bgBorder}`;
      if (iconEl) {
        iconEl.setAttribute('data-lucide', iconName);
        if (window.lucide) window.lucide.createIcons();
      }

      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.remove('opacity-0'));

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
      };

      const onConfirm = () => {
        cleanup();
        resolve();
      };

      confirmBtn.addEventListener('click', onConfirm, { once: true });
    });
  }

  showAppConfirm({ title = 'Confirm Action', message = '', type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-dialog-modal');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const confirmBtn = document.getElementById('app-dialog-confirm-btn');
      const cancelBtn = document.getElementById('app-dialog-cancel-btn');
      const inputContainer = document.getElementById('app-dialog-input-container');
      const iconContainer = document.getElementById('app-dialog-icon-container');
      const iconEl = document.getElementById('app-dialog-icon');

      if (!modal) {
        return resolve(confirm(message));
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      cancelBtn.classList.remove('hidden');
      if (inputContainer) inputContainer.classList.add('hidden');

      if (isDanger) {
        confirmBtn.className = 'px-5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-500/25 border border-red-400/30 transition cursor-pointer';
      } else {
        confirmBtn.className = 'btn-primary px-5 py-1.5 text-xs cursor-pointer';
      }

      let iconName = isDanger ? 'trash-2' : 'help-circle';
      let iconColor = isDanger ? 'text-red-400' : 'text-amber-400';
      let bgBorder = isDanger ? 'bg-red-500/15 border-red-500/30' : 'bg-amber-500/15 border-amber-500/30';

      if (iconContainer) iconContainer.className = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColor} ${bgBorder}`;
      if (iconEl) {
        iconEl.setAttribute('data-lucide', iconName);
        if (window.lucide) window.lucide.createIcons();
      }

      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.remove('opacity-0'));

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      confirmBtn.addEventListener('click', onConfirm, { once: true });
      cancelBtn.addEventListener('click', onCancel, { once: true });
    });
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 5) return;

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

    // Position Mode: Fixed vs Tap Points (1-6)
    const posFixedBtn = document.getElementById('pos-mode-fixed');
    const posTapBtn = document.getElementById('pos-mode-tap');
    const fixedControls = document.getElementById('fixed-pos-controls');
    const tapControls = document.getElementById('tap-pos-controls');
    const tapOverlay = document.getElementById('tap-points-overlay');
    const tapHint = document.getElementById('preview-tap-hint');
    const clearTapBtn = document.getElementById('btn-clear-tap-points');
    const testNextBtn = document.getElementById('btn-test-next-pos');

    posFixedBtn?.addEventListener('click', () => {
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posTapBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls?.classList.remove('hidden');
      tapControls?.classList.add('hidden');
      if (tapHint) tapHint.classList.add('hidden');
      this._updateStyle({ positionMode: 'fixed' });
      this._syncStylePreview();
    });

    posTapBtn?.addEventListener('click', () => {
      posTapBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls?.classList.add('hidden');
      tapControls?.classList.remove('hidden');
      if (tapHint) tapHint.classList.remove('hidden');
      this._updateStyle({ positionMode: 'custom_tap' });
      this._updateTapPointsOverlayUI();
      this._syncStylePreview();
    });

    // Handle Tap on Preview Screen
    tapOverlay?.addEventListener('click', (e) => {
      const rect = tapOverlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const normX = Math.max(0.1, Math.min(0.9, clickX / rect.width));
      const normY = Math.max(0.12, Math.min(0.88, clickY / rect.height));

      const points = this.stylePreviewRenderer.getTapPoints();
      if (points.length >= 6) {
        this.showToast('Maximum 6 landing points reached. Click "Clear All Points" to reset.', 'warning');
        return;
      }

      this.stylePreviewRenderer.addTapPoint(normX, normY);
      this.renderer.addTapPoint(normX, normY);
      this._updateTapPointsOverlayUI();
      
      // Auto-switch to tap mode if not already
      posTapBtn?.click();
      this._syncStylePreview();
      this.showToast(`Placed Point [${points.length + 1}] at ${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%`, 'success', 1500);
    });

    clearTapBtn?.addEventListener('click', () => {
      this.stylePreviewRenderer.clearTapPoints();
      this.renderer.clearTapPoints();
      this._updateTapPointsOverlayUI();
      this._syncStylePreview();
      this.showToast('Cleared all tap landing points', 'info');
    });

    testNextBtn?.addEventListener('click', () => {
      const sampleInput = document.getElementById('preview-sample-text');
      const text = sampleInput?.value || 'LYRICS PREVIEW TEXT';
      this.stylePreviewRenderer.setCue({ index: 0, text });
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
        this.mediaPool.pauseAllVideos();
      } else {
        await this.audio.play();
        this.mediaPool.playActiveVideo();
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
      if (!isPlaying && !this.isStudioRecording) {
        this.mediaPool.pauseAllVideos();
      }
    };

    // Auto-Stop Mode Setup
    const limitModeSelect = document.getElementById('recording-limit-mode');
    const customSecContainer = document.getElementById('recording-custom-sec-container');
    const customSecInput = document.getElementById('recording-custom-sec-input');

    const updateLimitMode = () => {
      const val = limitModeSelect?.value || 'audio_end';
      if (val === 'audio_end') {
        this.customMaxDuration = null;
        if (customSecContainer) {
          customSecContainer.classList.add('hidden');
          customSecContainer.classList.remove('flex');
        }
      } else if (val === 'custom') {
        if (customSecContainer) {
          customSecContainer.classList.remove('hidden');
          customSecContainer.classList.add('flex');
        }
        this.customMaxDuration = parseInt(customSecInput?.value, 10) || 30;
      } else {
        if (customSecContainer) {
          customSecContainer.classList.add('hidden');
          customSecContainer.classList.remove('flex');
        }
        this.customMaxDuration = parseInt(val, 10);
      }
    };

    limitModeSelect?.addEventListener('change', updateLimitMode);
    customSecInput?.addEventListener('input', updateLimitMode);

    // Audio ended
    this.audio.onEndedCallback = () => {
      this.mediaPool.pauseAllVideos();
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
      // Check custom auto-stop limit
      if (this.isStudioRecording && this.customMaxDuration && elapsed >= this.customMaxDuration) {
        this.stopStudioRecording();
      }
    };

    // MP4 Encoding Progress callback
    this.recorder.onProgressUpdate = (ratio, statusText) => {
      const banner = document.getElementById('mp4-encoding-banner');
      const bar = document.getElementById('mp4-encoding-bar');
      const pct = document.getElementById('mp4-encoding-pct');
      const status = document.getElementById('mp4-encoding-status');

      if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
      }
      if (bar) bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
      if (pct) pct.textContent = `${Math.min(100, Math.round(ratio * 100))}%`;
      if (status) {
        status.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-brand-400"></i> <span>${statusText}</span>`;
        if (window.lucide) window.lucide.createIcons();
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
      this.mediaPool.playActiveVideo();
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
    this.mediaPool.pauseAllVideos();
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

    this.showToast('Recording finished! Generating MP4 video file...', 'info');
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
      // Ctrl+S or Cmd+S: Quick Save Project
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.saveProjectState(true);
        return;
      }

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
    this.audio.pause();
    this.mediaPool.pauseAllVideos();
    this.goToStep(5);

    const banner = document.getElementById('mp4-encoding-banner');
    if (banner) {
      banner.classList.remove('flex');
      banner.classList.add('hidden');
    }

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

    this.showToast('MP4 Video Ready for Download!', 'success');
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

    document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
      const confirmed = await this.showAppConfirm({
        title: 'Reset Entire Project?',
        message: 'This will reset all audio, background assets, and lyrics cues. Are you sure you want to start fresh?',
        confirmText: 'Reset Project',
        cancelText: 'Keep Working',
        isDanger: true
      });
      if (confirmed) {
        location.reload();
      }
    });
  }

  // ==========================================
  // 9. PWA INSTALLATION WORKFLOW
  // ==========================================
  _setupPwaInstall() {
    const installBtn = document.getElementById('btn-pwa-install');
    const settingsInstallBtn = document.getElementById('btn-settings-install');

    const handleInstallPrompt = async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast('Installing LyricFlow Studio PWA...', 'success');
        }
        this.deferredInstallPrompt = null;
        if (installBtn) installBtn.classList.add('hidden');
      } else {
        await this.showAppAlert({
          title: 'Install LyricFlow Studio',
          message: 'To install LyricFlow Studio as a desktop or mobile application:\n\n• On Chrome/Edge/Brave: Look for the Install icon (🖥️ or 📥) on the right side of the browser address bar.\n• On iOS Safari: Tap the Share button (⎋) and choose "Add to Home Screen".\n• On Android Chrome: Tap the 3-dot menu and select "Install app".',
          type: 'info'
        });
      }
    };

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.classList.remove('hidden');
      }
    });

    installBtn?.addEventListener('click', handleInstallPrompt);
    settingsInstallBtn?.addEventListener('click', handleInstallPrompt);

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      if (installBtn) installBtn.classList.add('hidden');
      this.showToast('LyricFlow Studio was installed successfully!', 'success');
    });
  }

  // ==========================================
  // 10. SETTINGS MENU & UPDATE / RELOAD SYSTEM
  // ==========================================
  _setupSettingsMenu() {
    const settingsModal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtn = document.getElementById('btn-close-settings');
    const closeFooterBtn = document.getElementById('btn-close-settings-footer');
    const backdrop = settingsModal?.querySelector('.app-dialog-backdrop');
    const reloadBtn = document.getElementById('btn-settings-reload');
    const clearCacheBtn = document.getElementById('btn-settings-clear-cache');
    const envBadge = document.getElementById('settings-env-badge');
    const versionBadge = document.getElementById('settings-version-badge');

    // Update Environment status in settings
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (envBadge) {
      envBadge.textContent = isStandalone ? 'PWA Installed (Standalone Mode)' : 'Web Browser / Online Mode';
    }
    if (versionBadge) {
      versionBadge.textContent = `v${APP_VERSION}`;
    }

    const openSettings = () => {
      if (!settingsModal) return;
      settingsModal.classList.remove('hidden');
      requestAnimationFrame(() => settingsModal.classList.remove('opacity-0'));
    };

    const closeSettings = () => {
      if (!settingsModal) return;
      settingsModal.classList.add('opacity-0');
      setTimeout(() => settingsModal.classList.add('hidden'), 200);
    };

    openBtn?.addEventListener('click', openSettings);
    closeBtn?.addEventListener('click', closeSettings);
    closeFooterBtn?.addEventListener('click', closeSettings);
    backdrop?.addEventListener('click', closeSettings);

    // Reload button: checks service worker, clears PWA cache, reloads, and flags popup
    reloadBtn?.addEventListener('click', async () => {
      const originalHTML = reloadBtn.innerHTML;
      reloadBtn.innerHTML = `
        <div class="flex items-center gap-3 text-left">
          <div class="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 animate-spin">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-white">Checking & Updating...</div>
            <div class="text-xs text-slate-400">Purging cache and synchronizing Service Worker...</div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();

      try {
        // 1. Service Worker update check & skip waiting
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            if (reg.active) {
              reg.active.postMessage({ type: 'CLEAR_CACHE' });
            }
          }
        }

        // 2. Clear browser CacheStorage directly
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        // 3. Mark update notice flag in sessionStorage
        sessionStorage.setItem('lyricflow_updated_popup', APP_VERSION);

        // 4. Force reload page
        window.location.reload(true);
      } catch (err) {
        console.error('Update check failed:', err);
        reloadBtn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons();
        await this.showAppAlert({
          title: 'Update Notice',
          message: `Update check completed: ${err.message || 'Cache cleared.'}. Reloading...`,
          type: 'info'
        });
        window.location.reload(true);
      }
    });

    // Clear Cache & Reset Data
    clearCacheBtn?.addEventListener('click', async () => {
      const confirmed = await this.showAppConfirm({
        title: 'Empty PWA Cache & Storage?',
        message: 'This will purge all offline cached assets and reset application cache. The page will then reload immediately.',
        confirmText: 'Empty Cache & Reload',
        cancelText: 'Cancel',
        isDanger: true
      });

      if (confirmed) {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        sessionStorage.setItem('lyricflow_updated_popup', APP_VERSION);
        window.location.reload(true);
      }
    });

    // Toast Close Button
    document.getElementById('toast-close-btn')?.addEventListener('click', () => {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
      }
    });
  }

  // ==========================================
  // 11. VERSION UPDATE NOTIFICATION POPUP
  // ==========================================
  _checkAppVersionUpdate() {
    const updatedPopupFlag = sessionStorage.getItem('lyricflow_updated_popup');
    const storedVersion = localStorage.getItem('lyricflow_app_version');

    if (updatedPopupFlag) {
      sessionStorage.removeItem('lyricflow_updated_popup');
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
      setTimeout(() => {
        this.showAppAlert({
          title: 'Application Updated',
          message: `✨ LyricFlow Studio has successfully loaded the newest version (v${APP_VERSION}) with refreshed caches!`,
          type: 'success',
          confirmText: 'Awesome'
        });
      }, 350);
    } else if (storedVersion && storedVersion !== APP_VERSION) {
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
      setTimeout(() => {
        this.showAppAlert({
          title: 'LyricFlow Studio Updated',
          message: `🎉 Updated to version v${APP_VERSION}! You are now enjoying the latest performance enhancements and features.`,
          type: 'success',
          confirmText: 'Got it'
        });
      }, 350);
    } else {
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
    }
  }

  // ==========================================
  // 12. VIDEO SPEED CONTROLS
  // ==========================================
  _setupVideoSpeedControls() {
    const studioSlider = document.getElementById('studio-video-speed-slider');
    const studioVal = document.getElementById('studio-video-speed-val');
    const presetBtns = document.querySelectorAll('.btn-studio-speed-preset');

    const formatSpeed = (speed) => {
      if (Math.abs(speed - 0.125) < 0.005) return '0.125x (1/8 speed)';
      if (Math.abs(speed - 0.25) < 0.005) return '0.25x (1/4 speed)';
      if (Math.abs(speed - 0.5) < 0.005) return '0.50x (1/2 speed)';
      if (Math.abs(speed - 0.75) < 0.005) return '0.75x (3/4 speed)';
      if (Math.abs(speed - 1.0) < 0.005) return '1.00x (Normal speed)';
      if (Math.abs(speed - 1.5) < 0.005) return '1.50x';
      if (Math.abs(speed - 2.0) < 0.005) return '2.00x';
      return `${speed.toFixed(2)}x`;
    };

    const updateSpeedUI = (speed, showFeedback = false) => {
      const parsedSpeed = Number(speed) || 1.0;
      const applied = this.mediaPool.setVideoSpeed(parsedSpeed);
      const formatted = formatSpeed(applied);

      if (studioSlider) studioSlider.value = applied;
      if (studioVal) studioVal.textContent = formatted;

      presetBtns.forEach((btn) => {
        const btnSpeed = parseFloat(btn.dataset.speed);
        if (Math.abs(btnSpeed - applied) < 0.02) {
          btn.classList.add('active', 'bg-brand-600', 'text-white', 'border-brand-500');
          btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
        } else {
          btn.classList.remove('active', 'bg-brand-600', 'text-white', 'border-brand-500');
          btn.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
        }
      });

      if (showFeedback) {
        this.showToast(`Background video speed: ${formatted}`, 'info', 1500);
      }
    };

    studioSlider?.addEventListener('input', (e) => {
      updateSpeedUI(parseFloat(e.target.value));
    });
    studioSlider?.addEventListener('change', (e) => {
      updateSpeedUI(parseFloat(e.target.value), true);
    });

  _updateTapPointsOverlayUI() {
    const tapOverlay = document.getElementById('tap-points-overlay');
    const tapPointsCount = document.getElementById('tap-points-count');
    const tapPointsList = document.getElementById('tap-points-list');
    const points = this.stylePreviewRenderer ? this.stylePreviewRenderer.getTapPoints() : [];

    if (tapPointsCount) tapPointsCount.textContent = `${points.length} / 6`;

    if (tapOverlay) {
      tapOverlay.innerHTML = '';
      points.forEach((pt, idx) => {
        const pin = document.createElement('div');
        pin.className = 'tap-point-marker';
        pin.style.left = `${pt.x * 100}%`;
        pin.style.top = `${pt.y * 100}%`;
        pin.textContent = `${idx + 1}`;
        tapOverlay.appendChild(pin);
      });
    }

    if (tapPointsList) {
      if (points.length === 0) {
        tapPointsList.innerHTML = `<span class="text-[11px] text-slate-500 italic">No tap points set yet. Click preview screen.</span>`;
      } else {
        tapPointsList.innerHTML = points.map((pt, idx) => `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-mono font-bold">
            <span class="w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[9px]">${idx + 1}</span>
            ${Math.round(pt.x * 100)}%, ${Math.round(pt.y * 100)}%
          </span>
        `).join('');
      }
    }
  }

  // ==========================================
  // 14. PROJECT & RECORDING SESSION PERSISTENCE
  // ==========================================
  _setupProjectPersistenceControls() {
    // Header Buttons
    document.getElementById('btn-save-project')?.addEventListener('click', () => {
      this.saveProjectState(true);
    });

    document.getElementById('btn-load-project')?.addEventListener('click', () => {
      this.loadProjectState(null, true);
    });

    // Step 4 Live Studio Toolbar Buttons
    document.getElementById('btn-studio-save-session')?.addEventListener('click', () => {
      this.saveProjectState(true);
    });

    document.getElementById('btn-studio-reload-session')?.addEventListener('click', () => {
      this.loadProjectState(null, true);
    });

    // Settings Modal Buttons
    document.getElementById('btn-settings-save-project')?.addEventListener('click', () => {
      this.saveProjectState(true);
      document.getElementById('settings-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-settings-load-project')?.addEventListener('click', () => {
      this.loadProjectState(null, true);
      document.getElementById('settings-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-settings-export-json')?.addEventListener('click', () => {
      this.exportProjectJSON();
    });

    const fileInput = document.getElementById('project-file-input');
    document.getElementById('btn-settings-import-json')?.addEventListener('click', () => {
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        this.importProjectJSON(file);
        document.getElementById('settings-modal')?.classList.add('hidden');
      }
    });
  }

  saveProjectState(showNotification = true) {
    const limitMode = document.getElementById('recording-limit-mode')?.value || 'audio_end';
    const customSec = parseInt(document.getElementById('recording-custom-sec-input')?.value, 10) || 30;

    const projectData = {
      app: 'LyricFlow Studio',
      version: APP_VERSION,
      savedAt: new Date().toISOString(),
      lyrics: {
        rawText: this.lyrics.rawText || '',
        delimitationMode: this.lyrics.delimitationMode || 'line-by-line',
        cues: this.lyrics.cues || []
      },
      style: {
        aspectRatio: this.renderer.aspectRatio,
        fontFamily: this.renderer.style.fontFamily,
        fontWeight: this.renderer.style.fontWeight,
        isItalic: this.renderer.style.isItalic,
        isUppercase: this.renderer.style.isUppercase,
        fontSize: this.renderer.style.fontSize,
        maxWidthPercent: this.renderer.style.maxWidthPercent,
        textColor: this.renderer.style.textColor,
        strokeColor: this.renderer.style.strokeColor,
        strokeWidth: this.renderer.style.strokeWidth,
        shadowColor: this.renderer.style.shadowColor,
        shadowBlur: this.renderer.style.shadowBlur,
        boxColor: this.renderer.style.boxColor,
        boxOpacity: this.renderer.style.boxOpacity,
        positionMode: this.renderer.style.positionMode,
        verticalAlign: this.renderer.style.verticalAlign,
        textAlign: this.renderer.style.textAlign,
        tapPoints: this.renderer.getTapPoints()
      },
      studio: {
        videoSpeed: this.mediaPool.getVideoSpeed(),
        recordingLimitMode: limitMode,
        recordingCustomSec: customSec,
        customMaxDuration: this.customMaxDuration,
        activeBgId: this.mediaPool.activeAssetId
      }
    };

    try {
      localStorage.setItem('lyricflow_saved_project', JSON.stringify(projectData));
      if (showNotification) {
        this.showToast('Recording session & project settings saved!', 'success', 2500);
      }
      return projectData;
    } catch (e) {
      console.error('Error saving project state:', e);
      this.showToast('Could not save project state to storage', 'error');
      return null;
    }
  }

  loadProjectState(projectData = null, showNotification = true) {
    let data = projectData;
    if (!data) {
      try {
        const raw = localStorage.getItem('lyricflow_saved_project');
        if (raw) data = JSON.parse(raw);
      } catch (e) {
        console.error('Error loading project state:', e);
      }
    }

    if (!data) {
      this.showToast('No saved project found. Click "Save" first to save your recording settings.', 'warning', 3500);
      return false;
    }

    // 1. Restore Lyrics
    if (data.lyrics) {
      const rawInput = document.getElementById('raw-lyrics-input');
      if (rawInput) rawInput.value = data.lyrics.rawText || '';
      
      this.lyrics.rawText = data.lyrics.rawText || '';
      this.lyrics.delimitationMode = data.lyrics.delimitationMode || 'line-by-line';
      if (data.lyrics.cues && Array.isArray(data.lyrics.cues) && data.lyrics.cues.length > 0) {
        this.lyrics.cues = data.lyrics.cues;
      } else {
        this.lyrics.parseRawText(data.lyrics.rawText || '');
      }

      document.querySelectorAll('.btn-chunk-rule').forEach((btn) => {
        btn.classList.toggle('active-chunk-rule', btn.getAttribute('data-mode') === this.lyrics.delimitationMode);
      });

      this._updateCueListUI();
      this._updateLyricsSummary();
    }

    // 2. Restore Style & Tap Points
    if (data.style) {
      this._applyStyleToUI(data.style);
    }

    // 3. Restore Studio Settings
    if (data.studio) {
      // Background speed
      if (data.studio.videoSpeed !== undefined) {
        const speed = parseFloat(data.studio.videoSpeed);
        this.mediaPool.setVideoSpeed(speed);
        const studioSlider = document.getElementById('studio-video-speed-slider');
        const studioVal = document.getElementById('studio-video-speed-val');
        if (studioSlider) studioSlider.value = speed;
        if (studioVal) {
          if (Math.abs(speed - 0.125) < 0.005) studioVal.textContent = '0.125x (1/8 speed)';
          else if (Math.abs(speed - 0.25) < 0.005) studioVal.textContent = '0.25x (1/4 speed)';
          else if (Math.abs(speed - 0.5) < 0.005) studioVal.textContent = '0.50x (1/2 speed)';
          else if (Math.abs(speed - 0.75) < 0.005) studioVal.textContent = '0.75x (3/4 speed)';
          else if (Math.abs(speed - 1.0) < 0.005) studioVal.textContent = '1.00x (Normal speed)';
          else studioVal.textContent = `${speed.toFixed(2)}x`;
        }

        document.querySelectorAll('.btn-studio-speed-preset').forEach((btn) => {
          const btnSpeed = parseFloat(btn.dataset.speed);
          if (Math.abs(btnSpeed - speed) < 0.02) {
            btn.classList.add('active', 'bg-brand-600', 'text-white', 'border-brand-500');
            btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
          } else {
            btn.classList.remove('active', 'bg-brand-600', 'text-white', 'border-brand-500');
            btn.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
          }
        });
      }

      // Auto-stop limit
      const limitSelect = document.getElementById('recording-limit-mode');
      const customSecContainer = document.getElementById('recording-custom-sec-container');
      const customSecInput = document.getElementById('recording-custom-sec-input');
      
      if (limitSelect && data.studio.recordingLimitMode) {
        limitSelect.value = data.studio.recordingLimitMode;
        if (data.studio.recordingLimitMode === 'custom') {
          if (customSecContainer) {
            customSecContainer.classList.remove('hidden');
            customSecContainer.classList.add('flex');
          }
          if (customSecInput && data.studio.recordingCustomSec) {
            customSecInput.value = data.studio.recordingCustomSec;
          }
          this.customMaxDuration = data.studio.recordingCustomSec || 30;
        } else if (data.studio.recordingLimitMode === 'audio_end') {
          if (customSecContainer) {
            customSecContainer.classList.add('hidden');
            customSecContainer.classList.remove('flex');
          }
          this.customMaxDuration = null;
        } else {
          if (customSecContainer) {
            customSecContainer.classList.add('hidden');
            customSecContainer.classList.remove('flex');
          }
          this.customMaxDuration = parseInt(data.studio.recordingLimitMode, 10);
        }
      }

      // Active Background
      if (data.studio.activeBgId) {
        this.mediaPool.setActiveAsset(data.studio.activeBgId);
      }
    }

    // 4. Reset studio session to fresh starting point
    this.activeCueIndex = -1;
    this.renderer.setCue(null);
    this._updatePrompterUI();
    this.audio.seek(0);
    this.audio.pause();

    const timeDisplay = document.getElementById('recording-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00.0';

    // Transition smoothly to Live Studio (Step 4) ready to record
    this._goToStep(4);

    if (showNotification) {
      this.showToast('✨ Settings reloaded fresh! Ready for your live studio session.', 'success', 3000);
    }
    return true;
  }

  _applyStyleToUI(style) {
    if (!style) return;

    // 1. Aspect ratio
    if (style.aspectRatio) {
      document.querySelectorAll('.aspect-ratio-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-ratio') === style.aspectRatio);
      });
      this.renderer.setAspectRatio(style.aspectRatio);
      this.stylePreviewRenderer.setAspectRatio(style.aspectRatio);

      const stageWrapper = document.getElementById('master-stage-wrapper');
      const previewWrapper = document.getElementById('style-preview-wrapper');
      [stageWrapper, previewWrapper].forEach((el) => {
        if (!el) return;
        el.className = el.className.replace(/aspect-(video|square|\[9\/16\])/g, '');
        if (style.aspectRatio === '16-9') el.classList.add('aspect-video');
        else if (style.aspectRatio === '9-16') el.classList.add('aspect-[9/16]');
        else if (style.aspectRatio === '1-1') el.classList.add('aspect-square');
      });
    }

    // 2. Typography
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect && style.fontFamily) fontSelect.value = style.fontFamily;

    const weightSelect = document.getElementById('font-weight-select');
    if (weightSelect && style.fontWeight) weightSelect.value = style.fontWeight;

    const italicBtn = document.getElementById('btn-toggle-italic');
    if (italicBtn && style.isItalic !== undefined) {
      italicBtn.classList.toggle('active-chunk-rule', !!style.isItalic);
    }

    const upperBtn = document.getElementById('btn-toggle-uppercase');
    if (upperBtn && style.isUppercase !== undefined) {
      upperBtn.classList.toggle('active-chunk-rule', !!style.isUppercase);
    }

    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    if (fontSizeSlider && style.fontSize) {
      fontSizeSlider.value = style.fontSize;
      if (fontSizeVal) fontSizeVal.textContent = `${style.fontSize}px`;
    }

    const maxWidthSlider = document.getElementById('max-width-slider');
    const maxWidthVal = document.getElementById('max-width-val');
    if (maxWidthSlider && style.maxWidthPercent) {
      maxWidthSlider.value = style.maxWidthPercent;
      if (maxWidthVal) maxWidthVal.textContent = `${style.maxWidthPercent}%`;
    }

    // 3. Colors
    const setPicker = (pickerId, hexId, color) => {
      const picker = document.getElementById(pickerId);
      const hex = document.getElementById(hexId);
      if (picker && color) picker.value = color;
      if (hex && color) hex.textContent = color.toUpperCase();
    };
    if (style.textColor) setPicker('text-color-picker', 'text-color-hex', style.textColor);
    if (style.strokeColor) setPicker('stroke-color-picker', 'stroke-color-hex', style.strokeColor);
    if (style.shadowColor) setPicker('shadow-color-picker', 'shadow-color-hex', style.shadowColor);
    if (style.boxColor) setPicker('box-color-picker', 'box-color-hex', style.boxColor);

    const strokeWidthSlider = document.getElementById('stroke-width-slider');
    const strokeWidthVal = document.getElementById('stroke-width-val');
    if (strokeWidthSlider && style.strokeWidth !== undefined) {
      strokeWidthSlider.value = style.strokeWidth;
      if (strokeWidthVal) strokeWidthVal.textContent = `${style.strokeWidth}px`;
    }

    const boxOpacitySlider = document.getElementById('box-opacity-slider');
    const boxOpacityVal = document.getElementById('box-opacity-val');
    if (boxOpacitySlider && style.boxOpacity !== undefined) {
      boxOpacitySlider.value = style.boxOpacity;
      if (boxOpacityVal) boxOpacityVal.textContent = `${style.boxOpacity}%`;
    }

    // 4. Alignment & Position Mode
    const posFixedBtn = document.getElementById('pos-mode-fixed');
    const posTapBtn = document.getElementById('pos-mode-tap');
    const fixedControls = document.getElementById('fixed-pos-controls');
    const tapControls = document.getElementById('tap-pos-controls');
    const tapHint = document.getElementById('preview-tap-hint');

    if (style.positionMode === 'custom_tap') {
      posTapBtn?.classList.add('bg-brand-600', 'text-white');
      posTapBtn?.classList.remove('text-slate-400');
      posFixedBtn?.classList.remove('bg-brand-600', 'text-white');
      posFixedBtn?.classList.add('text-slate-400');
      fixedControls?.classList.add('hidden');
      tapControls?.classList.remove('hidden');
      tapHint?.classList.remove('hidden');
    } else {
      posFixedBtn?.classList.add('bg-brand-600', 'text-white');
      posFixedBtn?.classList.remove('text-slate-400');
      posTapBtn?.classList.remove('bg-brand-600', 'text-white');
      posTapBtn?.classList.add('text-slate-400');
      fixedControls?.classList.remove('hidden');
      tapControls?.classList.add('hidden');
      tapHint?.classList.add('hidden');
    }

    if (style.verticalAlign) {
      document.querySelectorAll('.fixed-preset-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === style.verticalAlign);
      });
    }

    if (style.textAlign) {
      document.querySelectorAll('.text-align-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === style.textAlign);
      });
    }

    // 5. Tap Points
    if (style.tapPoints && Array.isArray(style.tapPoints)) {
      this.renderer.setTapPoints(style.tapPoints);
      this.stylePreviewRenderer.setTapPoints(style.tapPoints);
      this._updateTapPointsOverlayUI();
    }

    this._updateStyle(style);
    this._syncStylePreview();
  }

  exportProjectJSON() {
    const data = this.saveProjectState(false);
    if (!data) return;

    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `lyricflow-project-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Project JSON backup file exported successfully!', 'success', 3000);
    } catch (e) {
      console.error('Export JSON error:', e);
      this.showToast('Failed to export project JSON', 'error');
    }
  }

  importProjectJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const success = this.loadProjectState(data, true);
        if (success) {
          this.showToast(`Imported project from ${file.name}!`, 'success', 3000);
        }
      } catch (err) {
        console.error('Error importing project file:', err);
        this.showToast('Invalid project file format', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================
  // 13. SERVICE WORKER REGISTRATION (PWA)
  // ==========================================
  _setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.0.7').catch((err) => {
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
