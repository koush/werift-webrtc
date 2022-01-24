import {
  randomPort,
  RTCPeerConnection,
  RTCRtpCodecParameters,
  Vp8RtpPayload,
} from "../../../packages/webrtc/src";
import { Server } from "ws";
import { TransformStream } from "stream/web";
import { RTCEncodedFrame } from "werift/src/media/rtpReceiver";
import { exec, spawn } from "child_process";
import { createSocket } from "dgram";

// open ./answer.html

const server = new Server({ port: 8888 });
console.log("start");

server.on("connection", async (socket) => {
  const pc = new RTCPeerConnection({
    codecs: {
      video: [
        new RTCRtpCodecParameters({
          mimeType: "video/VP8",
          clockRate: 90000,
          rtcpFeedback: [],
        }),
      ],
    },
  });

  const transceiver = pc.addTransceiver("video");

  const { readable, writable } = transceiver.receiver.createEncodedStreams();
  let cache: Buffer | undefined = undefined;
  const transformStream = new TransformStream<RTCEncodedFrame, RTCEncodedFrame>(
    {
      transform: (frame, controller) => {
        const packet = Vp8RtpPayload.deSerialize(frame.data);
        if (!packet.isKeyframe && Math.random() < 0.05) {
          console.log("lost");
          transceiver.receiver.sendRtcpPLI(frame.ssrc);
          frame.data = cache;
        } else {
          cache = frame.data;
        }
        controller.enqueue(frame);
      },
    }
  );
  readable.pipeThrough(transformStream).pipeTo(writable);

  const udp = createSocket("udp4");
  const port = await randomPort();

  transceiver.onTrack.subscribe((track) => {
    transceiver.sender.replaceTrack(track);
    track.onReceiveRtp.subscribe((rtp) => {
      udp.send(rtp.serialize(), port);
    });
  });

  const args = [
    `udpsrc port=${port} caps = "application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)VP8, payload=(int)97"`,
    "rtpvp8depay",
    "webmmux",
    `filesink location=./gst.webm`,
  ].join(" ! ");
  console.log(args);

  const process = spawn("gst-launch-1.0", args.split(" "));

  setTimeout(() => {
    process.kill("SIGINT");
    console.log("stop");
  }, 15_000);

  await pc.setLocalDescription(await pc.createOffer());
  const sdp = JSON.stringify(pc.localDescription);
  socket.send(sdp);

  socket.on("message", (data: any) => {
    pc.setRemoteDescription(JSON.parse(data));
  });
});
