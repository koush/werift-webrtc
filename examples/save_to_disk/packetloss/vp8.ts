import { MediaRecorder, RTCPeerConnection } from "../../../packages/webrtc/src";
import { Server } from "ws";
import { TransformStream } from "stream/web";

// open ./answer.html

const server = new Server({ port: 8888 });
console.log("start");

server.on("connection", async (socket) => {
  const recorder = new MediaRecorder([], "./test.webm", {
    width: 640,
    height: 360,
  });

  const pc = new RTCPeerConnection();

  const transceiver = pc.addTransceiver("video");

  const { readable, writable } = transceiver.receiver.createEncodedStreams();
  const transformStream = new TransformStream({
    transform: (data, controller) => {
      if (Math.random() < 0.3) {
        controller.enqueue(undefined);
        return;
      }
      controller.enqueue(data);
    },
  });
  readable.pipeThrough(transformStream).pipeTo(writable);

  transceiver.onTrack.subscribe((track) => {
    transceiver.sender.replaceTrack(track);
    recorder.addTrack(track);
    recorder.start();
  });

  setTimeout(() => {
    recorder.stop();
    console.log("stop");
  }, 5_000);

  await pc.setLocalDescription(await pc.createOffer());
  const sdp = JSON.stringify(pc.localDescription);
  socket.send(sdp);

  socket.on("message", (data: any) => {
    pc.setRemoteDescription(JSON.parse(data));
  });
});
