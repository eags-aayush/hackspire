import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocketClient(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000', {
      transports: ['websocket'],
    });
  }
  return socket;
}
