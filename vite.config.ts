import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

function wsPlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  let viteServer: ViteDevServer | null = null;

  return {
    name: "ws-plugin",
    configureServer(server: ViteDevServer) {
      viteServer = server;
      const httpServer = server.httpServer;
      if (!httpServer) return;

      wss = new WebSocketServer({ noServer: true });

      httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const pathname = request.url || "";
        if (pathname === "/_ws" || pathname.startsWith("/_ws?")) {
          wss!.handleUpgrade(request, socket, head, (ws) => {
            wss!.emit("connection", ws, request);
          });
        }
      });

      wss.on("connection", (ws: WebSocket) => {
        // 缓冲在 handler 加载完之前收到的消息
        const bufferedMessages: string[] = [];
        let handlerReady = false;

        ws.on("message", (data: Buffer) => {
          const msg = data.toString();
          if (handlerReady) return; // handler 已接管
          bufferedMessages.push(msg);
        });

        // 异步加载 handler 模块
        viteServer!.ssrLoadModule("/src/ws-handler.ts").then((mod) => {
          handlerReady = true;
          // 把 ws 和缓冲的消息交给 handler
          mod.handleConnection(ws, bufferedMessages);
        }).catch((err) => {
          console.error("[WS] Failed to load handler:", err);
          ws.close();
        });
      });

      console.log("[WS] WebSocket server attached at /_ws");
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    hmr: {
      path: "/__vite_hmr",
    },
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    wsPlugin(),
  ],
});
