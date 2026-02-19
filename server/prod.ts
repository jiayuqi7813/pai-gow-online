import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { handleConnection } from "../src/ws-handler";

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

async function main() {
  // 动态导入构建产出的服务端模块
  const serverModule = await import("../dist/server/server.js");
  const handler = serverModule.default;

  const clientDir = join(import.meta.dirname, "..", "dist", "client");

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // 尝试静态文件（dist/client 下的资源：/assets/, /audio/, /favicon.ico 等）
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/audio/") || url.pathname === "/favicon.ico") {
      try {
        const filePath = join(clientDir, url.pathname);
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        });
        res.end(content);
        return;
      } catch {
        // 文件不存在，继续走 SSR
      }
    }

    // SSR: 将 Node.js req 转为 Web Request，交给 TanStack Start 处理
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
      const webRequest = new Request(`${protocol}://${host}${req.url}`, {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD"
          ? await readBody(req)
          : undefined,
        // @ts-ignore - duplex needed for streaming
        duplex: "half",
      });

      const response: Response = await handler.fetch(webRequest);

      // 写入响应头
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

      // 流式写入响应体
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      console.error("[SSR] Error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  // 挂载 WebSocket
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url || "";
    if (pathname === "/_ws" || pathname.startsWith("/_ws?")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    handleConnection(ws, []);
  });

  httpServer.listen(PORT, () => {
    console.log(`[Server] Pai Gow Online running at http://localhost:${PORT}`);
    console.log(`[WS] WebSocket server attached at /_ws`);
  });
}

function readBody(req: import("node:http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
