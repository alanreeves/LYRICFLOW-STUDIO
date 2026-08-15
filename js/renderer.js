/**
 * Canvas Renderer - High-performance 60fps canvas engine for background rendering,
 * word-wrapping typography, outlines, shadows, dynamic positioning, and animation transitions.
 */
export class CanvasRenderer {
  constructor(canvas, mediaPool) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.mediaPool = mediaPool;

    // Aspect ratio & resolution configuration
    this.aspectRatio = '16-9'; // '16-9', '9-16', '1-1'
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this._updateDimensions();

    // Style Configuration
    this.style = {
      fontFamily: 'Inter',
      fontWeight: '700',
      isItalic: false,
      isUppercase: false,
      fontSize: 48,
      maxWidthPercent: 85,
      textColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: '#000000',
      shadowBlur: 16,
      boxColor: '#000000',
      boxOpacity: 0,
      positionMode: 'fixed', // 'fixed' | 'dynamic'
      verticalAlign: 'center', // 'top' | 'center' | 'bottom'
      textAlign: 'center', // 'left' | 'center' | 'right'
    };

    // Active Cue State
    this.activeCueText = '';
    this.activeCueIndex = -1;
    this.isBlank = false;

    // Dynamic & Custom Tap Position State
    this.tapPoints = []; // Array of { x: 0..1, y: 0..1 } (up to 6 points)
    this.tapPointIndex = 0;

    this.currentX = this.baseWidth / 2;
    this.currentY = this.baseHeight / 2;
    this.targetX = this.baseWidth / 2;
    this.targetY = this.baseHeight / 2;

    // Animation & Transition
    this.cueOpacity = 1.0;
    this.targetOpacity = 1.0;
    this.scale = 1.0;
    this.targetScale = 1.0;

    // Rendering loop state
    this.isRunning = false;
    this.animationFrameId = null;

    this.startLoop();
  }

  setTapPoints(points) {
    this.tapPoints = (points || []).slice(0, 6).map(p => ({
      x: Math.max(0.05, Math.min(0.95, p.x)),
      y: Math.max(0.05, Math.min(0.95, p.y))
    }));
    this.tapPointIndex = 0;
  }

  addTapPoint(normX, normY) {
    if (this.tapPoints.length < 6) {
      this.tapPoints.push({
        x: Math.max(0.08, Math.min(0.92, normX)),
        y: Math.max(0.08, Math.min(0.92, normY))
      });
      return true;
    }
    return false;
  }

  clearTapPoints() {
    this.tapPoints = [];
    this.tapPointIndex = 0;
  }

  getTapPoints() {
    return [...this.tapPoints];
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    this._updateDimensions();
    this.recalculatePositions();
  }

  _updateDimensions() {
    switch (this.aspectRatio) {
      case '16-9':
        this.baseWidth = 1920;
        this.baseHeight = 1080;
        break;
      case '9-16':
        this.baseWidth = 1080;
        this.baseHeight = 1920;
        break;
      case '1-1':
        this.baseWidth = 1080;
        this.baseHeight = 1080;
        break;
      default:
        this.baseWidth = 1920;
        this.baseHeight = 1080;
    }

    if (this.canvas.width !== this.baseWidth || this.canvas.height !== this.baseHeight) {
      this.canvas.width = this.baseWidth;
      this.canvas.height = this.baseHeight;
    }
  }

  updateStyle(newStyle) {
    this.style = { ...this.style, ...newStyle };
    this.recalculatePositions();
  }

  setCue(cue, isBlank = false) {
    this.isBlank = isBlank;
    const newText = isBlank ? '' : (cue ? cue.text : '');
    
    if (newText !== this.activeCueText) {
      this.activeCueText = newText;
      this.activeCueIndex = cue ? cue.index : -1;
      
      // Smooth fade-in transition
      this.scale = 0.95;
      this.targetScale = 1.0;
      this.cueOpacity = 0.0; // Start at 0.0 for full fade-in
      this.targetOpacity = 1.0;

      if ((this.style.positionMode === 'custom_tap' || this.style.positionMode === 'dynamic') && newText) {
        if (this.tapPoints.length > 0) {
          const pt = this.tapPoints[this.tapPointIndex % this.tapPoints.length];
          this.tapPointIndex++;
          this.targetX = this._clampX(pt.x * this.baseWidth);
          this.targetY = this._clampY(pt.y * this.baseHeight);
        } else {
          this._generateDynamicPosition();
        }
      } else {
        this.recalculatePositions();
      }
    }
  }

  recalculatePositions() {
    if (this.style.positionMode === 'fixed') {
      // Fixed Preset Alignment
      const safeMarginX = this.baseWidth * ((100 - this.style.maxWidthPercent) / 200);

      switch (this.style.textAlign) {
        case 'left':
          this.targetX = safeMarginX;
          break;
        case 'right':
          this.targetX = this.baseWidth - safeMarginX;
          break;
        case 'center':
        default:
          this.targetX = this.baseWidth / 2;
          break;
      }

      switch (this.style.verticalAlign) {
        case 'top':
          this.targetY = this.baseHeight * 0.22;
          break;
        case 'bottom':
          this.targetY = this.baseHeight * 0.80;
          break;
        case 'center':
        default:
          this.targetY = this.baseHeight * 0.50;
          break;
      }

      this.currentX = this.targetX;
      this.currentY = this.targetY;
    } else if (this.style.positionMode === 'custom_tap' && this.tapPoints.length > 0) {
      const pt = this.tapPoints[0];
      this.targetX = this._clampX(pt.x * this.baseWidth);
      this.targetY = this._clampY(pt.y * this.baseHeight);
      this.currentX = this.targetX;
      this.currentY = this.targetY;
    }
  }

  _clampX(x) {
    const margin = this.baseWidth * 0.12;
    return Math.max(margin, Math.min(this.baseWidth - margin, x));
  }

  _clampY(y) {
    const margin = this.baseHeight * 0.12;
    return Math.max(margin, Math.min(this.baseHeight - margin, y));
  }

  _generateDynamicPosition() {
    const marginX = this.baseWidth * 0.20;
    const marginY = this.baseHeight * 0.22;

    const minX = marginX;
    const maxX = this.baseWidth - marginX;
    const minY = marginY;
    const maxY = this.baseHeight - marginY;

    this.targetX = this._clampX(minX + Math.random() * (maxX - minX));
    this.targetY = this._clampY(minY + Math.random() * (maxY - minY));
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    const render = () => {
      if (!this.isRunning) return;
      this.drawFrame();
      this.animationFrameId = requestAnimationFrame(render);
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  stopLoop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  drawFrame() {
    const ctx = this.ctx;
    const w = this.baseWidth;
    const h = this.baseHeight;

    // 1. Draw Media Background
    if (this.mediaPool) {
      this.mediaPool.drawBackground(ctx, w, h);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Animate transitions with smooth fade-in and easing
    this.currentX += (this.targetX - this.currentX) * 0.14;
    this.currentY += (this.targetY - this.currentY) * 0.14;
    this.scale += (this.targetScale - this.scale) * 0.10;
    this.cueOpacity += (this.targetOpacity - this.cueOpacity) * 0.09;

    // 3. Draw Lyrics Text if present
    if (this.activeCueText && !this.isBlank && this.cueOpacity > 0.001) {
      this._renderText(ctx, this.activeCueText, this.currentX, this.currentY, w, h);
    }
  }

  _renderText(ctx, rawText, posX, posY, canvasW, canvasH) {
    ctx.save();

    let textToDraw = rawText;
    if (this.style.isUppercase) {
      textToDraw = textToDraw.toUpperCase();
    }

    // Build Font Spec
    const italicPart = this.style.isItalic ? 'italic ' : '';
    const weightPart = this.style.fontWeight || '700';
    const sizePart = `${this.style.fontSize}px`;
    const familyPart = `"${this.style.fontFamily}", sans-serif`;
    ctx.font = `${italicPart}${weightPart} ${sizePart} ${familyPart}`;
    ctx.textAlign = this.style.textAlign || 'center';
    ctx.textBaseline = 'middle';

    // Word Wrap lines according to max width
    const maxWidth = (canvasW * (this.style.maxWidthPercent / 100));
    const lines = this._wrapText(ctx, textToDraw, maxWidth);
    const lineHeight = this.style.fontSize * 1.35;
    const totalBlockHeight = lines.length * lineHeight;

    // Transform for scale animation
    ctx.translate(posX, posY);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, this.cueOpacity));

    const startY = - (totalBlockHeight / 2) + (lineHeight / 2);

    // Render Box / Pill Highlight if opacity > 0
    if (this.style.boxOpacity > 0) {
      let maxLineWidth = 0;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
      });

      const paddingX = this.style.fontSize * 0.6;
      const paddingY = this.style.fontSize * 0.4;
      const boxW = maxLineWidth + paddingX * 2;
      const boxH = totalBlockHeight + paddingY * 2;

      let boxX = -boxW / 2;
      if (this.style.textAlign === 'left') boxX = -paddingX;
      if (this.style.textAlign === 'right') boxX = -boxW + paddingX;

      const boxY = - (totalBlockHeight / 2) - paddingY;

      ctx.save();
      ctx.fillStyle = this._hexToRgba(this.style.boxColor || '#000000', this.style.boxOpacity / 100);
      this._roundRect(ctx, boxX, boxY, boxW, boxH, 16);
      ctx.fill();
      ctx.restore();
    }

    // Render Drop Shadow
    if (this.style.shadowColor) {
      ctx.shadowColor = this.style.shadowColor;
      ctx.shadowBlur = this.style.shadowBlur || 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    }

    // Render Stroke / Outline
    if (this.style.strokeWidth > 0) {
      ctx.strokeStyle = this.style.strokeColor || '#000000';
      ctx.lineWidth = this.style.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      lines.forEach((line, index) => {
        const lineY = startY + (index * lineHeight);
        ctx.strokeText(line, 0, lineY);
      });
    }

    // Clear shadow before fill to prevent double darkening
    ctx.shadowBlur = 0;

    // Render Text Fill
    ctx.fillStyle = this.style.textColor || '#ffffff';
    lines.forEach((line, index) => {
      const lineY = startY + (index * lineHeight);
      ctx.fillText(line, 0, lineY);
    });

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth) {
    const rawLines = text.split(/\r?\n/);
    const wrappedLines = [];

    rawLines.forEach(rawLine => {
      const words = rawLine.split(/\s+/);
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    });

    return wrappedLines.length > 0 ? wrappedLines : [''];
  }

  _hexToRgba(hex, alpha = 1) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
