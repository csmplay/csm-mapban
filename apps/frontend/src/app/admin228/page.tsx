'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCopy, Trash2, LogIn, Users, Eye } from 'lucide-react';

type PickedMap = { map: string; teamName: string; side: string };
type BannedMap = { map: string; teamName: string };

type Lobby = {
    lobbyId: string;
    members: string[];
    teamNames: [string, string][]; // [socketId, teamName]
    picked: PickedMap[];
    banned: BannedMap[];
};

export default function AdminPage() {
    const [lobbies, setLobbies] = useState<Lobby[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        socketRef.current = io('http://localhost:4000');

        const fetchLobbies = async () => {
            try {
                const response = await fetch('http://localhost:4000/admin/lobbies');
                const data: Lobby[] = await response.json();
                setLobbies(data);
            } catch (error) {
                console.error('Error fetching lobbies:', error);
            }
        };

        (async () => {
            await fetchLobbies();
        })();

        // Polling every 5 seconds to update the lobby list
        const interval = setInterval(fetchLobbies, 5000);

        socketRef.current.on('lobbyDeleted', (deletedLobbyId: string) => {
            setLobbies((prevLobbies) =>
                prevLobbies.filter((lobby) => lobby.lobbyId !== deletedLobbyId)
            );
        });

        return () => {
            clearInterval(interval);
            socketRef.current?.disconnect();
        };
    }, []);

    const handleDeleteLobby = (lobbyId: string) => {
        if (socketRef.current) {
            setLobbies(prevLobbies => prevLobbies.filter(lobby => lobby.lobbyId !== lobbyId));
            socketRef.current.emit('delete', lobbyId);
        }
    };

    const handleCopyLink = (lobbyId: string) => {
        const lobbyUrl = `http://localhost:3000/lobby/${lobbyId}/obs`;
        navigator.clipboard.writeText(lobbyUrl).then(
            () => {
                toast({
                    description: "Ссылка для OBS скопирована в буфер обмена",
                });
            },
            () => {
                toast({
                    description: "Не получилось :(",
                });
            }
        );
    };

    const handleConnectToLobby = (lobbyId: string) => {
        router.push(`/lobby/${lobbyId}`);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">Admin</h1>
                {lobbies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {lobbies.map((lobby) => (
                            <Card key={lobby.lobbyId} className="w-full bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <CardHeader className="bg-gray-50 border-b">
                                    <CardTitle className="text-xl text-gray-700 flex items-center justify-between">
                                        <span className="truncate">Lobby: {lobby.lobbyId}</span>
                                        <Badge variant="secondary" className="ml-2 flex items-center">
                                            <Users className="w-4 h-4 mr-1" />
                                            {lobby.members.length}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <ScrollArea className="h-64 pr-4">
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Teams:</h3>
                                                <ul className="space-y-1">
                                                    {lobby.teamNames.map(([socketId, teamName]) => (
                                                        <li key={socketId} className="flex items-center text-sm">
                                                            <Badge variant="outline" className="mr-2">{teamName}</Badge>
                                                            <span className="text-gray-500 truncate">{socketId}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <Separator />
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Picked:</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {lobby.picked.map((item, index) => (
                                                        <Badge key={index} variant="secondary">
                                                            {item.map} ({item.teamName}, Side: {item.side.toUpperCase()})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <Separator />
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Banned:</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {lobby.banned.map((item, index) => (
                                                        <Badge key={index} variant="destructive">
                                                            {item.map} ({item.teamName})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                                <CardFooter className="bg-gray-50 border-t p-4 flex flex-wrap gap-2">
                                    <Button onClick={() => handleConnectToLobby(lobby.lobbyId)} variant="outline" className="flex-1">
                                        <LogIn className="w-4 h-4 mr-2" />
                                        Connect
                                    </Button>
                                    <Button onClick={() => handleCopyLink(lobby.lobbyId)} variant="outline" className="flex-1">
                                        <Eye className="w-4 h-4 mr-2" />
                                        Copy Obs Link
                                    </Button>
                                    <Button onClick={() => handleDeleteLobby(lobby.lobbyId)} variant="destructive" className="flex-1">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="w-full max-w-md mx-auto bg-white shadow-lg">
                        <CardContent className="p-6 text-center text-gray-600">
                            <p className="text-xl">Nothin' here yet...</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
