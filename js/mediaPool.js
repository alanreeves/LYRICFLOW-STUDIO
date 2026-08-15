/**
 * Media Pool - Handles background asset pool (static images, looping video files, and animated gradients)
 * and seamless background switching during live recording.
 */
export class MediaPool {
  constructor() {
    this.assets = []; // Array of { id, type: 'image'|'video'|'procedural', name, url, element, thumbnail, isCustom }
    this.activeAssetId = null;
    this.onAssetChangeCallback = null;
    this.onActiveChangeCallback = null;

    // Procedural gradient animation time counter
    this.animTime = 0;

    // Background playback speed rate (0.125x [1/8 speed] - 3.0x)
    this.videoSpeed = 1.0;
  }

  setVideoSpeed(speed) {
    const val = Math.max(0.125, Math.min(3.0, parseFloat(speed) || 1.0));
    this.videoSpeed = Number(val.toFixed(3));
    this.assets.forEach((asset) => {
      if (asset.type === 'video' && asset.element) {
        asset.element.playbackRate = this.videoSpeed;
        asset.element.defaultPlaybackRate = this.videoSpeed;
      }
    });
    return this.videoSpeed;
  }

  getVideoSpeed() {
    return this.videoSpeed;
  }

  async addFile(file) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      throw new Error('Unsupported file format. Please upload an image or video.');
    }

    const id = 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const url = URL.createObjectURL(file);

    let element = null;
    let thumbnail = null;

    if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.playbackRate = this.videoSpeed;

      await new Promise((resolve) => {
        video.onloadeddata = () => {
          video.play().catch(() => {});
          resolve();
        };
        video.onerror = () => resolve();
      });

      element = video;
      thumbnail = await this._generateVideoThumbnail(video);
    } else {
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'anonymous';

      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      element = img;
      thumbnail = url;
    }

    const asset = {
      id,
      type: isVideo ? 'video' : 'image',
      name: file.name,
      url,
      element,
      thumbnail: thumbnail || url,
      isCustom: true
    };

    this.assets.push(asset);

    if (!this.activeAssetId) {
      this.setActiveAsset(asset.id);
    }

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }

    return asset;
  }

  addProceduralGradient(name = 'Neon Cyber Aurora', colors = ['#0f172a', '#312e81', '#4c1d95', '#064e3b']) {
    const id = 'proc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const asset = {
      id,
      type: 'procedural',
      name,
      colors,
      url: null,
      element: null,
      thumbnail: this._generateProceduralThumbnail(colors),
      isCustom: false
    };

    this.assets.push(asset);

    if (!this.activeAssetId) {
      this.setActiveAsset(asset.id);
    }

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }

    return asset;
  }

  async loadDemoAssets() {
    this.clear();

    // 1. Neon Pulse Procedural
    this.addProceduralGradient('Neon Cyber Pulse', ['#09090b', '#3b0764', '#1e1b4b', '#0369a1']);
    
    // 2. Sunset Glow Procedural
    this.addProceduralGradient('Sunset Horizon', ['#18181b', '#831843', '#701a75', '#1e1b4b']);

    // 3. Dark Starfield Procedural
    this.addProceduralGradient('Deep Cosmos', ['#020617', '#0f172a', '#1e293b', '#082f49']);

    if (this.assets.length > 0) {
      this.setActiveAsset(this.assets[0].id);
    }
  }

  _generateProceduralThumbnail(colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 160, 90);
    colors.forEach((c, idx) => grad.addColorStop(idx / (colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 160, 90);
    return canvas.toDataURL();
  }

  async _generateVideoThumbnail(video) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 160, 90);
      return canvas.toDataURL();
    } catch (e) {
      return null;
    }
  }

  setActiveAsset(id) {
    const found = this.assets.find(a => a.id === id);
    if (found) {
      this.activeAssetId = id;
      if (found.type === 'video' && found.element) {
        found.element.playbackRate = this.videoSpeed;
        found.element.defaultPlaybackRate = this.videoSpeed;
        found.element.play().catch(() => {});
      }
      if (this.onActiveChangeCallback) {
        this.onActiveChangeCallback(found);
      }
    }
  }

  setActiveByIndex(index) {
    if (index >= 0 && index < this.assets.length) {
      this.setActiveAsset(this.assets[index].id);
    }
  }

  getActiveAsset() {
    return this.assets.find(a => a.id === this.activeAssetId) || this.assets[0] || null;
  }

  removeAsset(id) {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      const removed = this.assets.splice(index, 1)[0];
      if (removed.url && removed.isCustom) {
        URL.revokeObjectURL(removed.url);
      }
      if (this.activeAssetId === id) {
        this.activeAssetId = this.assets.length > 0 ? this.assets[0].id : null;
      }
      if (this.onAssetChangeCallback) {
        this.onAssetChangeCallback(this.assets);
      }
      if (this.onActiveChangeCallback) {
        this.onActiveChangeCallback(this.getActiveAsset());
      }
    }
  }

  clear() {
    this.assets.forEach(a => {
      if (a.url && a.isCustom) URL.revokeObjectURL(a.url);
    });
    this.assets = [];
    this.activeAssetId = null;
    if (this.onAssetChangeCallback) this.onAssetChangeCallback(this.assets);
  }

  /**
   * Render background onto any canvas context
   */
  drawBackground(ctx, width, height) {
    const active = this.getActiveAsset();
    this.animTime += 0.015 * this.videoSpeed;

    if (!active) {
      // Default dark backdrop
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (active.type === 'image' && active.element) {
      this._drawImageCover(ctx, active.element, width, height);
    } else if (active.type === 'video' && active.element) {
      if (active.element.playbackRate !== this.videoSpeed) {
        active.element.playbackRate = this.videoSpeed;
      }
      if (active.element.paused) {
        active.element.play().catch(() => {});
      }
      this._drawImageCover(ctx, active.element, width, height);
    } else if (active.type === 'procedural') {
      this._drawProceduralMotion(ctx, width, height, active.colors);
    }
  }

  _drawImageCover(ctx, media, targetW, targetH) {
    const mediaW = media.videoWidth || media.naturalWidth || media.width || targetW;
    const mediaH = media.videoHeight || media.naturalHeight || media.height || targetH;

    const targetRatio = targetW / targetH;
    const mediaRatio = mediaW / mediaH;

    let drawW, drawH, drawX, drawY;

    if (mediaRatio > targetRatio) {
      drawH = targetH;
      drawW = targetH * mediaRatio;
      drawX = (targetW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = targetW;
      drawH = targetW / mediaRatio;
      drawX = 0;
      drawY = (targetH - drawH) / 2;
    }

    try {
      ctx.drawImage(media, drawX, drawY, drawW, drawH);
    } catch (e) {
      // Fallback
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, targetW, targetH);
    }
  }

  _drawProceduralMotion(ctx, width, height, colors) {
    const t = this.animTime;
    
    // Background base
    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 1
    const x1 = width * (0.5 + 0.35 * Math.sin(t * 0.7));
    const y1 = height * (0.5 + 0.3 * Math.cos(t * 0.5));
    const r1 = Math.max(width, height) * 0.6;
    const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    grad1.addColorStop(0, colors[1] || '#4f46e5');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 2
    const x2 = width * (0.5 + 0.3 * Math.cos(t * 0.6 + 1.5));
    const y2 = height * (0.5 + 0.35 * Math.sin(t * 0.8 + 2.0));
    const r2 = Math.max(width, height) * 0.55;
    const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
    grad2.addColorStop(0, colors[2] || '#ec4899');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 3
    if (colors[3]) {
      const x3 = width * (0.5 + 0.25 * Math.sin(t * 1.1 + 3.0));
      const y3 = height * (0.5 + 0.25 * Math.cos(t * 0.9 + 4.0));
      const r3 = Math.max(width, height) * 0.5;
      const grad3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
      grad3.addColorStop(0, colors[3]);
      grad3.addColorStop(1, 'transparent');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, width, height);
    }

    // Subtle dark vignette on edges
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }
}
