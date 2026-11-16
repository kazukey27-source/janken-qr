/**
 * Camera QR Code Scanner with Native BarcodeDetector + jsQR fallback
 */
class QRCameraScanner {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.scanning = false;
    this.facingMode = 'environment'; // 'environment' (back) or 'user' (front)
    this.barcodeDetector = null;
    this.onScanCallback = null;
    this.animId = null;

    if ('BarcodeDetector' in window) {
      try {
        this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector format qr_code not supported:', e);
      }
    }
  }

  async start(videoElement, canvasElement, onScan) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.onScanCallback = onScan;
    this.scanning = true;

    // jsQR が必要かつロードされていない場合はロード
    if (!this.barcodeDetector && typeof jsQR === 'undefined') {
      await this.loadJsQR();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', true);
      await this.video.play();

      this.scanLoop();
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      this.scanning = false;
      throw err;
    }
  }

  loadJsQR() {
    return new Promise((resolve) => {
      if (typeof jsQR !== 'undefined') return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => resolve();
      script.onerror = () => {
        console.warn('Failed to load jsQR CDN');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  async switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.scanning && this.video && this.canvas) {
      this.stop();
      await this.start(this.video, this.canvas, this.onScanCallback);
    }
  }

  async scanLoop() {
    if (!this.scanning) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      const vWidth = this.video.videoWidth;
      const vHeight = this.video.videoHeight;

      this.canvas.width = vWidth;
      this.canvas.height = vHeight;
      this.ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

      let detectedCode = null;

      // 1. Native BarcodeDetector (高速・高精度)
      if (this.barcodeDetector) {
        try {
          const barcodes = await this.barcodeDetector.detect(this.video);
          if (barcodes.length > 0) {
            detectedCode = barcodes[0].rawValue;
          }
        } catch (e) {
          // detect エラー時はフォールバック
        }
      }

      // 2. jsQR フォールバック
      if (!detectedCode && typeof jsQR !== 'undefined') {
        const imageData = this.ctx.getImageData(0, 0, vWidth, vHeight);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          detectedCode = code.data;
        }
      }

      if (detectedCode) {
        console.log('QR Code Detected:', detectedCode);
        if (this.onScanCallback) {
          this.onScanCallback(detectedCode);
        }
        return; // 検出後はループを抜ける（呼び出し側でstopまたは再開）
      }
    }

    this.animId = requestAnimationFrame(() => this.scanLoop());
  }

  stop() {
    this.scanning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }
}

window.qrScanner = new QRCameraScanner();
