import { RingApi } from "ring-client-api";
import { Server } from "ws";
import {
  MediaStreamTrack,
  RTCPeerConnection,
  RTCRtpCodecParameters,
} from "../../packages/webrtc/src";
import { CustomPeerConnection } from "./peer";

const example = async () => {
  const ringApi = new RingApi({
    // Replace with your refresh token
    refreshToken: process.env.RING_REFRESH_TOKEN!,
    debug: true,
  });
  const cameras = await ringApi.getCameras();
  const camera = cameras[0];

  if (!camera) {
    console.log("No cameras found");
    return;
  }

  const track = new MediaStreamTrack({ kind: "video" });
  const ring = new CustomPeerConnection();
  ring.onVideoRtp.subscribe((rtp) => {
    track.writeRtp(rtp);
  });
  await camera.startLiveCall({
    createPeerConnection: () => ring,
  });
  const server = new Server({ port: 8888 });

  console.log(new Date().toISOString(), "session start");

  server.on("connection", async (socket) => {
    const sender = new RTCPeerConnection({
      codecs: {
        video: [
          new RTCRtpCodecParameters({
            mimeType: "video/H264",
            clockRate: 90000,
            rtcpFeedback: [
              { type: "transport-cc" },
              { type: "ccm", parameter: "fir" },
              { type: "nack" },
              { type: "nack", parameter: "pli" },
              { type: "goog-remb" },
            ],
          }),
        ],
      },
    });
    sender.addTransceiver(track, { direction: "sendonly" });

    await sender.setLocalDescription(await sender.createOffer());
    const sdp = JSON.stringify(sender.localDescription);
    socket.send(sdp);

    socket.on("message", async (data: any) => {
      await sender.setRemoteDescription(JSON.parse(data));
    });
  });
};
example().catch((e) => {
  console.error(e);
});
