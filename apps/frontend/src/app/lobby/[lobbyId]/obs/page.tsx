"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

export default function LobbyObsPage() {
  const { lobbyId } = useParams();
  const router = useRouter();
  const [, setSocket] = useState<Socket | null>(null);

  const backendUrl =
    process.env.NODE_ENV === "development"
      ? process.env.BACKEND_URL + "/" || "http://localhost:4000/"
      : "/";

  useEffect(() => {
    const newSocket = io(backendUrl);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      if (lobbyId) {
        // Request game type for this lobby
        newSocket.emit("getLobbyGameCategory", lobbyId);
        console.log(`Requested game type for lobby ${lobbyId}`);
      }
    });

    newSocket.on("lobbyGameCategory", (gameCategory: string) => {
      if (gameCategory === "splatoon") {
        router.push(`/splatoon/lobby/${lobbyId}/obs`);
      } else {
        router.push(`/fps/lobby/${lobbyId}/obs`);
      }
    });

    newSocket.on("lobbyNotFound", () => {
      router.push("/");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [lobbyId, router, backendUrl]);

  return <div className="bg-transparent" />;
}
