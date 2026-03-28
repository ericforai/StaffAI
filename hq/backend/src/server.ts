import { createWebServerRuntime } from './app/create-web-server-runtime';
import { McpGateway } from './mcp';

type WebServerRuntimeInput = Parameters<typeof createWebServerRuntime>[0];
type WebServerRuntime = ReturnType<typeof createWebServerRuntime>;

export class WebServer {
  private runtime: WebServerRuntime;
  public mcp: McpGateway | null = null;

  constructor(
    scanner: WebServerRuntimeInput['scanner'],
    store: WebServerRuntimeInput['store'],
    skillScanner: WebServerRuntimeInput['skillScanner'],
    dependencies: WebServerRuntimeInput['dependencies'] = {},
  ) {
    const runtime = createWebServerRuntime({
      scanner,
      store,
      skillScanner,
      dependencies,
    });
    this.runtime = runtime;
    this.mcp = runtime.mcp;
  }

  public broadcast(data: Parameters<WebServerRuntime['broadcast']>[0]) {
    this.runtime.broadcast(data);
  }

  public start(port: number) {
    void this.runtime.listen(port);
  }

  public listen(port: number) {
    return this.runtime.listen(port);
  }

  public stop() {
    return this.runtime.stop();
  }
}
