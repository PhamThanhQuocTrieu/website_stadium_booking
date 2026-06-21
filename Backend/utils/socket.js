let ioInstance = null;

const setSocket = (io) => {
  ioInstance = io;
};

const getSocket = () => ioInstance;

const emitToAdmin = (eventName, payload) => {
  if (ioInstance) {
    ioInstance.to('admin').emit(eventName, payload);
    ioInstance.to('admin_room').emit(eventName, payload);
  }
};

const emitToUser = (userId, eventName, payload) => {
  if (ioInstance && userId) {
    ioInstance.to(`user:${userId}`).emit(eventName, payload);
    ioInstance.to(`user_${userId}`).emit(eventName, payload);
  }
};

module.exports = {
  setSocket,
  getSocket,
  emitToAdmin,
  emitToUser
};
