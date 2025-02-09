import io from "socket.io-client";
import { RTCPeerConnection } from "../../packages/webrtc/src";

const socket = io("https://serene-anchorage-28732.herokuapp.com/");

(async () => {
  const pc = new RTCPeerConnection({});
  const dc = pc.createDataChannel("chat", { protocol: "bob" });
  dc.stateChanged.subscribe((v) => {
    if (v === "open") {
      console.log("open");
      setInterval(() => {
        dc.send(Buffer.from("ping"));
      }, 1000);
    }
  });
  dc.onMessage.subscribe((data) => {
    console.log("message", data.toString());
  });

  const offer = await pc.createOffer()!;
  await pc.setLocalDescription(offer);

  socket.emit("join", { roomId: "test" });
  socket.on("join", () => {
    socket.emit("sdp", {
      sdp: JSON.stringify(pc.localDescription),
      roomId: "test",
    });
  });
  socket.on("sdp", (data: any) => {
    pc.setRemoteDescription(JSON.parse(data.sdp));
  });
})();
