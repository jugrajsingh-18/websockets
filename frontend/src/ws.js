import { io } from 'socket.io-client';

export function connectWS() {
    return io('https://websockets-r7p2.onrender.com');
}
