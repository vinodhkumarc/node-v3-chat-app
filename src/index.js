const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const app = express();
const Filter = require("bad-words");
const port = process.env.PORT || 8000;
const publicDirectoryPath = path.join(__dirname, "../public");
const server = http.createServer(app);
app.use(express.static(publicDirectoryPath));
const {
  generateMessages,
  generateLocationMessage,
} = require("../public/js/utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("../public/js/utils/users");
const io = socketio(server);

io.on("connection", (socket) => {
  socket.on("join", ({ username, room }, callback) => {
    const { user, error } = addUser({ id: socket.id, username, room });
    if (error) return callback(error);

    socket.join(room);
    socket.emit("message", generateMessages(user.username, "Welcome!"));
    socket.broadcast
      .to(room)
      .emit("message", generateMessages(`${user.username} has joined!`));

    io.to(user.room).emit("roomData", {
      room,
      users: getUsersInRoom(room),
    });
    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();
    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed");
    }
    io.to(user.room).emit("message", generateMessages(user.username, message));
    callback();
  });
  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id);
    io.emit(
      "locationMessage",
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessages(`${user.username} has left`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`The port is running at ${port}`);
});
