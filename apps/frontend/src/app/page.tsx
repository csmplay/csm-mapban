'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [lobbyId, setLobbyId] = useState('');
  const router = useRouter();

  const handleJoinLobby = () => {
    if (lobbyId) {
      router.push(`/lobby/${lobbyId}`);
    }
  };

  const handleCreateLobby = () => {
      let rndmId = Math.floor(Math.random() * 10000).toString();
      router.push(`/lobby/${rndmId}`);
  };

  return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-md">
              <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center text-gray-800">CSM MAP BAN</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <Button
                      className="w-full bg-gray-800 text-white hover:bg-gray-700"
                      onClick={handleCreateLobby}
                  >
                      Create Lobby
                  </Button>
                  <div className="space-y-4">
                      <Separator className="bg-gray-200"/>
                      <div className="flex justify-center space-x-2">
                          <InputOTP
                              maxLength={4}
                              value={lobbyId}
                              onChange={(value) => setLobbyId(value)}
                          >
                              <InputOTPGroup>
                                  <InputOTPSlot index={0}/>
                                  <InputOTPSlot index={1}/>
                              </InputOTPGroup>
                              <InputOTPSeparator/>
                              <InputOTPGroup>
                                  <InputOTPSlot index={2}/>
                                  <InputOTPSlot index={3}/>
                              </InputOTPGroup>
                          </InputOTP>
                      </div>
                          <Button
                              className="w-full bg-zinc-800 text-white hover:bg-zinc-700"
                              onClick={handleJoinLobby}
                              disabled={lobbyId.length !== 4}
                          >
                              Join Lobby
                          </Button>
                      </div>
              </CardContent>
          </Card>
      </div>
);
}
