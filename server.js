const express = require("express");
const app = express();
let server;
let port;

const http = require("http");
server = http.createServer(app);
port = process.env.PORT || 3000;

const io = require("socket.io")(server);
const RoomService = require("./RoomService")(io);
io.sockets.on("connection", RoomService.listen);
io.sockets.on("error", (e) => console.log(e));
app.use(express.static(__dirname + "/public"));
app.get("/close", function (req, res) {
  res.send(`<html><head></head><body>
   <h1  style="display: block;text-align:center;justify-text:center; padding-top:20px" >
      You can close this tab!
    </h1>
  <script>window.close()</script>
</body></html>`);
});
app.get("*", function (req, res) {
  res.sendFile(`${__dirname}/public/index.html`);
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
