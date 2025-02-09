import { RTCPeerConnection } from "../../src";

describe("trickle", () => {
  test(
    "half trickle",
    async () =>
      new Promise<void>(async (done) => {
        const pcOffer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        const pcAnswer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcAnswer.onDataChannel.subscribe((dc) => {
          dc.onMessage.subscribe((data) => {
            expect(data.toString()).toBe("hello");
            done();
          });
        });

        pcOffer.onIceCandidate.subscribe((candidate) => {
          pcAnswer.addIceCandidate(candidate);
        });

        const dc = pcOffer.createDataChannel("dc");
        dc.stateChanged.subscribe((state) => {
          if (state === "open") {
            dc.send(Buffer.from("hello"));
          }
        });

        const offer = await pcOffer.createOffer();
        pcOffer.setLocalDescription(offer);

        await pcAnswer.setRemoteDescription(offer);
        await pcAnswer.setLocalDescription(await pcAnswer.createAnswer());

        await pcOffer.setRemoteDescription(pcAnswer.localDescription!);
      }),
    15 * 1000,
  );

  test(
    "trickle",
    async () =>
      new Promise<void>(async (done) => {
        const pcOffer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        const pcAnswer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcAnswer.onDataChannel.subscribe((dc) => {
          dc.onMessage.subscribe((data) => {
            expect(data.toString()).toBe("hello");
            done();
          });
        });

        pcOffer.onIceCandidate.subscribe((candidate) => {
          pcAnswer.addIceCandidate(candidate);
        });
        pcAnswer.onIceCandidate.subscribe((candidate) => {
          pcOffer.addIceCandidate(candidate);
        });

        const dc = pcOffer.createDataChannel("dc");
        dc.stateChanged.subscribe((state) => {
          if (state === "open") {
            dc.send(Buffer.from("hello"));
          }
        });

        const offer = await pcOffer.createOffer();
        pcOffer.setLocalDescription(offer);
        await pcAnswer.setRemoteDescription(offer);

        const answer = await pcAnswer.createAnswer();
        pcAnswer.setLocalDescription(answer);
        await pcOffer.setRemoteDescription(answer);
      }),
    15 * 1000,
  );
});
