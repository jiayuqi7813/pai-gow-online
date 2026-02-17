import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useWebSocket } from "~/hooks/useWebSocket";
import { Lobby } from "~/components/Lobby";
import { GameBoard } from "~/components/GameBoard";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams({ from: "/room/$roomId" });
  const ws = useWebSocket();

  // 如果没有在任何房间中，跳回首页并携带房间码
  useEffect(() => {
    if (ws.connected && !ws.gameState && !ws.roomId) {
      navigate({ to: "/", search: { join: urlRoomId.toUpperCase() } });
    }
  }, [ws.connected, ws.gameState, ws.roomId, navigate, urlRoomId]);

  if (!ws.connected) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse-slow text-2xl text-amber-400 mb-4">连接中...</div>
          <p className="text-gray-500 text-sm">正在连接服务器</p>
        </div>
      </div>
    );
  }

  if (!ws.gameState) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse-slow text-2xl text-amber-400 mb-4">加载中...</div>
          <p className="text-gray-500 text-sm">正在同步房间状态</p>
        </div>
      </div>
    );
  }

  const isWaiting = ws.gameState.phase === "waiting";

  if (isWaiting) {
    return <Lobby ws={ws} />;
  }

  return <GameBoard ws={ws} />;
}
