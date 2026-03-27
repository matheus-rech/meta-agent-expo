/**
 * WebR Service for React Native
 *
 * Uses a hidden WebView to run R via WebAssembly.
 * The WebView loads WebR and communicates via postMessage/onMessage.
 */

export interface WebRResult {
  success: boolean;
  output?: string;
  error?: string;
  plots?: string[]; // Base64 encoded plot images
  data?: unknown;
  executionTime?: number;
}

export interface WebRPackage {
  name: string;
  version?: string;
  installed: boolean;
}

export type WebRStatus =
  | "uninitialized"
  | "loading"
  | "ready"
  | "error"
  | "busy";

export interface WebRServiceConfig {
  webRBaseUrl?: string;
  repos?: string[];
  preloadPackages?: string[];
  executionTimeout?: number;
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<WebRServiceConfig> = {
  webRBaseUrl: "https://webr.r-wasm.org/latest/",
  repos: ["https://repo.r-wasm.org/"],
  preloadPackages: ["metafor", "meta"],
  executionTimeout: 60000,
  debug: false,
};

type StatusListener = (status: WebRStatus, message?: string) => void;

/**
 * Generate HTML for the hidden WebView that runs WebR
 */
export function generateWebRHtml(config: Required<WebRServiceConfig>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebR Runtime</title>
  <script type="module">
    import { WebR } from '${config.webRBaseUrl}webr.mjs';

    const webR = new WebR({
      baseUrl: '${config.webRBaseUrl}',
    });

    let isReady = false;
    let isBusy = false;

    function sendToRN(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      }
    }

    async function initialize() {
      try {
        sendToRN('status', { status: 'loading', message: 'Initializing WebR...' });
        await webR.init();
        sendToRN('status', { status: 'loading', message: 'WebR initialized, installing packages...' });

        const packages = ${JSON.stringify(config.preloadPackages)};
        for (const pkg of packages) {
          try {
            sendToRN('status', { status: 'loading', message: 'Installing ' + pkg + '...' });
            await webR.installPackages([pkg], {
              repos: ${JSON.stringify(config.repos)},
            });
          } catch (e) {
            sendToRN('warning', { message: 'Failed to install ' + pkg + ': ' + e.message });
          }
        }

        isReady = true;
        sendToRN('status', { status: 'ready', message: 'WebR is ready' });
      } catch (error) {
        sendToRN('status', { status: 'error', message: error.message });
      }
    }

    async function executeR(code, requestId) {
      if (!isReady) {
        sendToRN('result', { requestId, success: false, error: 'WebR is not ready' });
        return;
      }
      if (isBusy) {
        sendToRN('result', { requestId, success: false, error: 'WebR is busy' });
        return;
      }

      isBusy = true;
      sendToRN('status', { status: 'busy', message: 'Executing R code...' });
      const startTime = Date.now();

      try {
        const shelter = await new webR.Shelter();
        const result = await shelter.captureR(code, {
          withAutoprint: true,
          captureStreams: true,
          captureConditions: false,
          captureGraphics: { width: 700, height: 500 },
        });

        const outputLines = [];
        for (const item of result.output) {
          if (item.type === 'stdout' || item.type === 'stderr') {
            outputLines.push(String(item.data));
          }
        }

        const plots = [];
        if (result.images && result.images.length > 0) {
          for (const img of result.images) {
            try {
              const canvas = new OffscreenCanvas(img.width, img.height);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const blob = await canvas.convertToBlob({ type: 'image/png' });
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                if (base64 && base64.length > 100) {
                  plots.push(base64);
                }
              }
            } catch (plotErr) {
              console.warn('Failed to convert plot:', plotErr);
            }
          }
        }

        shelter.purge();

        sendToRN('result', {
          requestId,
          success: true,
          output: outputLines.join('\\n') || '(no output)',
          plots,
          executionTime: Date.now() - startTime,
        });
      } catch (error) {
        sendToRN('result', {
          requestId,
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
        });
      } finally {
        isBusy = false;
        sendToRN('status', { status: 'ready', message: 'Ready' });
      }
    }

    async function installPackage(packageName, requestId) {
      if (!isReady) {
        sendToRN('packageInstall', { requestId, name: packageName, success: false, error: 'WebR is not ready' });
        return;
      }

      try {
        sendToRN('status', { status: 'busy', message: 'Installing ' + packageName + '...' });
        await webR.installPackages([packageName], {
          repos: ${JSON.stringify(config.repos)},
        });
        sendToRN('packageInstall', { requestId, name: packageName, success: true });
        sendToRN('status', { status: 'ready', message: 'Package installed' });
      } catch (error) {
        sendToRN('packageInstall', { requestId, name: packageName, success: false, error: error.message });
        sendToRN('status', { status: 'ready', message: 'Install failed' });
      }
    }

    window.addEventListener('message', async (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        switch (msg.type) {
          case 'execute': await executeR(msg.code, msg.requestId); break;
          case 'installPackage': await installPackage(msg.packageName, msg.requestId); break;
          case 'getStatus':
            sendToRN('status', { status: isReady ? (isBusy ? 'busy' : 'ready') : 'loading' });
            break;
        }
      } catch (error) {
        sendToRN('error', { error: 'Parse error: ' + error.message });
      }
    });

    // Also listen on document for React Native WebView on Android
    document.addEventListener('message', async (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        switch (msg.type) {
          case 'execute': await executeR(msg.code, msg.requestId); break;
          case 'installPackage': await installPackage(msg.packageName, msg.requestId); break;
          case 'getStatus':
            sendToRN('status', { status: isReady ? (isBusy ? 'busy' : 'ready') : 'loading' });
            break;
        }
      } catch (error) {
        sendToRN('error', { error: 'Parse error: ' + error.message });
      }
    });

    initialize();
  </script>
</head>
<body style="margin:0;padding:0;background:#000;">
  <div id="status" style="color:#666;font-family:monospace;font-size:10px;">Loading WebR...</div>
</body>
</html>`;
}

/**
 * WebR Service — manages WebView communication
 */
export class WebRService {
  private config: Required<WebRServiceConfig>;
  private status: WebRStatus = "uninitialized";
  private pendingRequests: Map<
    string,
    {
      resolve: (value: WebRResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private statusListeners: Set<StatusListener> = new Set();
  private requestCounter = 0;
  private installedPackages: Set<string> = new Set();
  private sendMessageFn: ((message: string) => void) | null = null;

  constructor(config: WebRServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<WebRServiceConfig>;
  }

  getWebViewHtml(): string {
    return generateWebRHtml(this.config);
  }

  getStatus(): WebRStatus {
    return this.status;
  }

  getInstalledPackages(): string[] {
    return Array.from(this.installedPackages);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  setSendMessage(fn: (message: string) => void) {
    this.sendMessageFn = fn;
  }

  /**
   * Handle messages coming from the WebView
   */
  handleWebViewMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (this.config.debug) {
        console.log("[WebR] Message:", message);
      }

      switch (message.type) {
        case "status":
          this.status = message.payload.status;
          if (message.payload.status === "ready") {
            // Mark preload packages as installed
            for (const pkg of this.config.preloadPackages) {
              this.installedPackages.add(pkg);
            }
          }
          this.statusListeners.forEach((listener) =>
            listener(message.payload.status, message.payload.message)
          );
          break;

        case "result":
          this.resolveRequest(message.payload.requestId, {
            success: message.payload.success,
            output: message.payload.output,
            error: message.payload.error,
            plots: message.payload.plots,
            data: message.payload.data,
            executionTime: message.payload.executionTime,
          });
          break;

        case "packageInstall":
          if (message.payload.success) {
            this.installedPackages.add(message.payload.name);
          }
          this.resolveRequest(message.payload.requestId, {
            success: message.payload.success,
            error: message.payload.error,
          });
          break;

        case "error":
          console.error("[WebR] Error:", message.payload.error);
          break;

        case "warning":
          console.warn("[WebR] Warning:", message.payload.message);
          break;
      }
    } catch (error) {
      console.error("[WebR] Failed to parse message:", error);
    }
  }

  async executeR(code: string): Promise<WebRResult> {
    if (this.status !== "ready") {
      return {
        success: false,
        error: `WebR is not ready (status: ${this.status})`,
      };
    }

    if (!this.sendMessageFn) {
      return {
        success: false,
        error: "WebView not connected",
      };
    }

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    const message = JSON.stringify({
      type: "execute",
      code,
      requestId,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: `Execution timed out after ${this.config.executionTimeout}ms`,
        });
      }, this.config.executionTimeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject: () =>
          resolve({ success: false, error: "Request rejected" }),
        timeout,
      });
      this.sendMessageFn!(message);
    });
  }

  async installPackage(packageName: string): Promise<WebRResult> {
    if (this.status !== "ready") {
      return {
        success: false,
        error: "WebR is not ready",
      };
    }

    if (!this.sendMessageFn) {
      return { success: false, error: "WebView not connected" };
    }

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    const message = JSON.stringify({
      type: "installPackage",
      packageName,
      requestId,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: "Package installation timed out",
        });
      }, 120000);

      this.pendingRequests.set(requestId, {
        resolve,
        reject: () =>
          resolve({ success: false, error: "Request rejected" }),
        timeout,
      });
      this.sendMessageFn!(message);
    });
  }

  private resolveRequest(requestId: string, result: WebRResult): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(result);
    }
  }

  dispose(): void {
    this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingRequests.clear();
    this.statusListeners.clear();
    this.sendMessageFn = null;
  }
}

// Singleton
let webRServiceInstance: WebRService | null = null;

export function getWebRService(config?: WebRServiceConfig): WebRService {
  if (!webRServiceInstance) {
    webRServiceInstance = new WebRService(config);
  }
  return webRServiceInstance;
}

export function resetWebRService(): void {
  if (webRServiceInstance) {
    webRServiceInstance.dispose();
    webRServiceInstance = null;
  }
}
