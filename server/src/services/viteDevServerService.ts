import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const VITE_PORT = 5100;
const WORKSPACE_PATH = path.resolve(__dirname, '../../.workspace');

class ViteDevServerService {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;

  /**
   * Start the Vite dev server
   * Called once when the backend starts
   */
  async start(): Promise<void> {
    if (this.process) {
      console.log('Vite dev server already running');
      return;
    }

    console.log(`Starting Vite dev server on port ${VITE_PORT}...`);

    this.process = spawn('npx', ['vite', '--port', VITE_PORT.toString(), '--host'], {
      cwd: WORKSPACE_PATH,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Wait for server to be ready
    await this.waitForReady();

    console.log(`Vite dev server started on port ${VITE_PORT}`);
  }

  /**
   * Wait for Vite to be ready by watching stdout
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Vite server startup timeout'));
      }, 60000);

      const onData = (data: Buffer) => {
        const output = data.toString();
        console.log('[Vite]', output.trim());

        // Look for indicators that Vite is ready
        if (output.includes('ready in') || output.includes('Local:') || output.includes(`localhost:${VITE_PORT}`)) {
          clearTimeout(timeout);
          this.isReady = true;
          resolve();
        }
      };

      this.process?.stdout?.on('data', onData);
      this.process?.stderr?.on('data', onData);

      this.process?.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.process?.on('exit', (code) => {
        if (code !== 0 && code !== null && !this.isReady) {
          clearTimeout(timeout);
          reject(new Error(`Vite process exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Stop the Vite dev server
   * Called when the backend shuts down
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('Stopping Vite dev server...');

    this.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
    this.isReady = false;
    console.log('Vite dev server stopped');
  }

  /**
   * Get the port the Vite server is running on
   */
  getPort(): number {
    return VITE_PORT;
  }

  /**
   * Check if the server is ready
   */
  isServerReady(): boolean {
    return this.isReady;
  }

  /**
   * Get the workspace path
   */
  getWorkspacePath(): string {
    return WORKSPACE_PATH;
  }
}

export const viteDevServerService = new ViteDevServerService();

// Register cleanup handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up Vite server...');
  await viteDevServerService.stop();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, cleaning up Vite server...');
  await viteDevServerService.stop();
});
