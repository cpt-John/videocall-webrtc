/** @type {SocketIOClient.Socket} */
const socket = io.connect(window.location.origin);
const localVideo = document.getElementById("localVideo");
const remoteVideos = document.getElementById("remoteVideos");
const peerConnections = {};
let mediaState = { video: true, audio: true };
let sc = false;
let my_name = "";

let sender;
let room = !location.pathname.substring(1)
  ? "home"
  : location.pathname.substring(1);
if (window.location.search.slice(1, 3) == "sc") {
  sc = true;
  document.getElementById("control-bar").remove();
  document.getElementById("localVideo").className = "sc";
  document.getElementById("localvideocontrol").remove();
  document.getElementById("sc-txt").style.display = "block";
  my_name = window.location.search.slice(4) + "_screen_share";
}
while (!my_name) {
  my_name = prompt("enter your name", "");
}
let getUserMediaAttempts = 5;
let gettingUserMedia = false;

/** @type {RTCConfiguration} */
const config = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};

/** @type {MediaStreamConstraints} */
let constraints = {
  audio: true,
  video: true,
};

socket.on("full", function (room) {
  alert("Room " + room + " is full");
});

socket.on("bye", function (id) {
  if (sc) return;
  handleRemoteHangup(id);
});

if (room && !!room) {
  socket.emit("join", room);
}

window.onunload = window.onbeforeunload = function () {
  socket.close();
};

socket.on("ready", function (id, name_) {
  if (!(localVideo instanceof HTMLVideoElement) || !localVideo.srcObject) {
    return;
  }
  const peerConnection = new RTCPeerConnection(config);
  peerConnections[id] = peerConnection;
  addUser(id, name_);
  if (localVideo instanceof HTMLVideoElement) {
    // @ts-ignore
    let stream = localVideo.captureStream();
    stream.getTracks().forEach(function (track) {
      sender = peerConnection.addTrack(track, stream);
    });
  }
  peerConnection
    .createOffer()
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(function () {
      socket.emit("offer", id, peerConnection.localDescription, my_name);
    });
  peerConnection.ontrack = (event) => {
    if (sc) return;
    handleRemoteStreamAdded(event.streams[0], id);
  };

  peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

socket.on("offer", function (id, description, name_) {
  const peerConnection = new RTCPeerConnection(config);
  peerConnections[id] = peerConnection;
  addUser(id, name_);
  if (localVideo instanceof HTMLVideoElement) {
    // @ts-ignore
    let stream = localVideo.captureStream();
    stream.getTracks().forEach(function (track) {
      sender = peerConnection.addTrack(track, stream);
    });
  }
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(function () {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = (event) => {
    if (sc) return;
    handleRemoteStreamAdded(event.streams[0], id);
  };
  peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

socket.on("candidate", function (id, candidate) {
  peerConnections[id]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch((e) => console.error(e));
});

socket.on("answer", function (id, description) {
  peerConnections[id].setRemoteDescription(description);
});

socket.on("new-message", function (message) {
  let new_message = document.createElement("li");
  let text = document.createElement("p");
  text.className = "my-message bg-secondary  rounded text-white float-left p-2";

  text.textContent = message;
  new_message.appendChild(text);
  document.getElementById("messages").appendChild(new_message);
});

socket.on("video-ended", function (id) {
  document.getElementById(
    "video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()
  ).style.display = "none";
});
socket.on("video-resumed", function (id) {
  document.getElementById(
    "video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()
  ).style.display = "block";
});

function getUserMediaSuccess(stream) {
  if (sc) endSC(stream);
  gettingUserMedia = false;
  if (localVideo instanceof HTMLVideoElement) {
    !localVideo.srcObject && (localVideo.srcObject = stream);
  }
  socket.emit("ready", my_name);
}

function handleRemoteStreamAdded(stream, id) {
  if (sc) return;
  if (
    document.getElementById(
      "video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()
    )
  ) {
    const remoteVideo = document.getElementById(
      "video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()
    );
    // @ts-ignore
    remoteVideo.srcObject = stream;
  } else {
    const remoteVideo = document.createElement("video");
    remoteVideo.srcObject = stream;
    remoteVideo.setAttribute(
      "id",
      "video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()
    );
    remoteVideo.setAttribute("playsinline", "true");
    remoteVideo.setAttribute("autoplay", "true");
    remoteVideo.style.display = "block";
    remoteVideo.className = "remoteVideo";
    remoteVideos.appendChild(remoteVideo);
  }
}

function getUserMediaError(error) {
  console.error(error);
  gettingUserMedia = false;
  --getUserMediaAttempts > 0 && setTimeout(getUserMediaDevices, 1000);
}

function getUserMediaDevices() {
  if (localVideo instanceof HTMLVideoElement) {
    if (localVideo.srcObject) {
      getUserMediaSuccess(localVideo.srcObject);
    } else if (!gettingUserMedia && !localVideo.srcObject) {
      gettingUserMedia = true;
      if (!sc)
        navigator.mediaDevices
          .getUserMedia(constraints)
          .then(getUserMediaSuccess)
          .catch(getUserMediaError);
      else if (sc) {
        navigator.mediaDevices
          // @ts-ignore
          .getDisplayMedia(constraints)
          .then(getUserMediaSuccess)
          .catch(getUserMediaError);
      }
    }
  }
}

function handleRemoteHangup(id) {
  if (sc) return;
  peerConnections[id] && peerConnections[id].close();
  delete peerConnections[id];
  document
    .getElementById("video" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase())
    .remove();
  removeUser(id);
}

getUserMediaDevices();

//custom methods

function toggleChat() {
  if (document.getElementById("members").style.display == "flex")
    document.getElementById("members").style.display = "none";
  let value = document.getElementById("chat").style.display;
  document.getElementById("chat").style.display =
    value == "flex" ? "none" : "flex";
}
function toggleMembers() {
  if (document.getElementById("chat").style.display == "flex")
    document.getElementById("chat").style.display = "none";
  let value = document.getElementById("members").style.display;
  document.getElementById("members").style.display =
    value == "flex" ? "none" : "flex";
}
function toggleLocal() {
  let value = document.getElementById("localVideo").style.display;
  if (value == "block") {
    document.getElementById("localVideo").style.display = "none";
    document.getElementById("localvideocontrol").className =
      "fa fa-arrow-circle-right fa-2x";
    document.getElementById("localvideocontrol").style.left = "0px";
  } else {
    document.getElementById("localVideo").style.display = "block";
    document.getElementById("localvideocontrol").className =
      "fa fa-arrow-circle-left fa-2x";
    document.getElementById("localvideocontrol").style.left = "250px";
  }
}
function toggleVideo() {
  mediaState.video = !mediaState.video;
  if (localVideo instanceof HTMLVideoElement) {
    localVideo.srcObject
      // @ts-ignore
      .getVideoTracks()
      .forEach((t) => (t.enabled = !t.enabled));
  }
  mediaState.video ? socket.emit("video-resumed") : socket.emit("video-ended");
  let icon = document.getElementById("video-icon");
  icon.style.color = mediaState.video ? "#13aa2b" : "#DC3047";
}
function toggleAudio() {
  mediaState.audio = !mediaState.audio;
  if (localVideo instanceof HTMLVideoElement) {
    localVideo.srcObject
      // @ts-ignore
      .getAudioTracks()
      .forEach((t) => (t.enabled = !t.enabled));
  }
  mediaState.audio ? socket.emit("audio-resumed") : socket.emit("audio-ended");
  let icon = document.getElementById("mic-icon");
  icon.style.color = mediaState.audio ? "#13aa2b" : "#DC3047";
}
function toggleScreenShare() {
  window.open(window.location.href + "?sc=" + my_name);
}

function addUser(id, name_inp) {
  let new_li = document.createElement("li");
  new_li.id = id.replace(/[^a-zA-Z]+/g, "").toLowerCase();
  new_li.textContent = name_inp;
  document.getElementById("members").appendChild(new_li);
}
function removeUser(id) {
  document.getElementById(id.replace(/[^a-zA-Z]+/g, "").toLowerCase()).remove();
}
function sendMessage() {
  // @ts-ignore
  let message = document.getElementById("message").value;
  // @ts-ignore
  document.getElementById("message").value = "";
  if (!message) return;
  let new_message = document.createElement("li");
  let text = document.createElement("p");
  text.className = "my-message bg-primary  rounded text-white float-right p-2";

  text.textContent = "You: " + message;
  new_message.appendChild(text);
  document.getElementById("messages").appendChild(new_message);
  socket.emit("new-message", my_name + ": " + message);
}
function toggleOptions(hide, show) {
  var els = document.getElementsByClassName(hide);

  Array.prototype.forEach.call(els, function (el) {
    el.style.display = "none";
  });
  els = document.getElementsByClassName(show);

  Array.prototype.forEach.call(els, function (el) {
    el.style.display = "block";
  });
}
function endCall() {
  if (confirm("Leave Room?")) {
    window.location.href = window.location.origin + "/close";
  }
}
function endSC(stream) {
  stream.getVideoTracks()[0].onended = function () {
    window.location.href = window.location.origin + "/close";
  };
}
