/** @type {SocketIO.Server} */
let _io;
// const MAX_CLIENTS = 3;

/** @param {SocketIO.Socket} socket */
function listen(socket) {
  const io = _io;
  const rooms = io.nsps["/"].adapter.rooms;
  socket.on("join", function (room) {
    let numClients = 0;

    if (rooms[room]) {
      numClients = rooms[room].length;
    }
    socket.on("ready", function (name_) {
      socket.broadcast.to(room).emit("ready", socket.id, name_);
    });
    socket.on("offer", function (id, message, name_) {
      socket.to(id).emit("offer", socket.id, message, name_);
    });
    socket.on("answer", function (id, message) {
      socket.to(id).emit("answer", socket.id, message);
    });
    socket.on("candidate", function (id, message) {
      socket.to(id).emit("candidate", socket.id, message);
    });
    socket.on("disconnect", function () {
      socket.broadcast.to(room).emit("bye", socket.id);
    });
    socket.on("new-message", function (message) {
      socket.broadcast.to(room).emit("new-message", message);
    });
    socket.on("video-ended", function () {
      socket.broadcast.to(room).emit("video-ended", socket.id);
    });
    socket.on("video-resumed", function () {
      socket.broadcast.to(room).emit("video-resumed", socket.id);
    });
    socket.join(room);
  });
}

/** @param {SocketIO.Server} io */
module.exports = function (io) {
  _io = io;
  return { listen };
};
