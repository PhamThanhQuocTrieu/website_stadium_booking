import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true
});

export const joinSocketRoom = (currentUser) => {
  if (!currentUser?._id) return;
  if (!socket.connected) socket.connect();
  socket.emit('join', {
    userId: currentUser._id,
    role: currentUser.role
  });
};

export default socket;
