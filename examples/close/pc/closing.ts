import { Server } from "ws";
import { RTCPeerConnection } from "../../../packages/webrtc/src";

const server = new Server({ port: 8888 });
console.log("start");

server.on("connection", async (socket) => {
  const pc = new RTCPeerConnection({});
  const dc = pc.createDataChannel("chat", { protocol: "bob" });
  const offer = await pc.createOffer()!;
  await pc.setLocalDescription(offer);
  socket.send(JSON.stringify(pc.localDescription));

  const answer = JSON.parse(
    await new Promise((r) => socket.on("message", (data) => r(data as string))),
  );
  console.log(answer);

  await pc.setRemoteDescription(answer);
  dc.stateChanged.subscribe((v) => {
    if (v === "open") {
      let index = 0;
      setInterval(() => {
        if (index < 4) dc.send(Buffer.from("ping" + index++));
        if (index === 4) {
          pc.close();
          index++;
        }
      }, 1000);
    }
  });
  dc.onMessage.subscribe((data) => {
    console.log("message", data.toString());
  });
  pc.iceConnectionStateChange.subscribe((v) =>
    console.log("iceConnectionStateChange", v),
  );
  dc.stateChanged.subscribe((v) => console.log("dc.state", v));
});
