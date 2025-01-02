import { Counter, peer, sleep, waitVideoPlay } from "../fixture";

describe("bundle_max_bundle", () => {
  it(
    "bundle_max_bundle_answer",
    async () =>
      new Promise<void>(async (done) => {
        const label = "bundle_max_bundle_answer";

        const counter = new Counter(3, () => {
          pc.close();
          done();
        });

        if (!peer.connected) await new Promise<void>((r) => peer.on("open", r));
        await sleep(100);

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          bundlePolicy: "max-bundle",
        });
        peer.on("notification", (e) => {
          if (e.method === "candidate") {
            if (pc.signalingState === "closed") return;
            pc.addIceCandidate(e.data!);
          }
        });
        pc.ontrack = async ({ track }) => {
          await waitVideoPlay(track);
          counter.done();
        };
        pc.ondatachannel = ({ channel }) => {
          channel.onopen = () => {
            channel.send("ping");
          };
          channel.onmessage = (e) => {
            if (e.data === "pong") {
              counter.done();
            }
          };
        };

        {
          const [track] = (
            await navigator.mediaDevices.getUserMedia({ video: true })
          ).getTracks();
          pc.addTrack(track);
        }
        {
          const [track] = (
            await navigator.mediaDevices.getUserMedia({ video: true })
          ).getTracks();
          pc.addTrack(track);
        }

        const offer = await peer.request(label, {
          type: "init",
        });
        await pc.setRemoteDescription(offer);
        await pc.setLocalDescription(await pc.createAnswer());

        pc.onicecandidate = ({ candidate }) => {
          peer
            .request(label, {
              type: "candidate",
              payload: candidate,
            })
            .catch(() => {});
        };

        peer
          .request(label, {
            type: "answer",
            payload: pc.localDescription,
          })
          .catch(() => {});
      }),
    20 * 1000,
  );

  it(
    "bundle_max_bundle_offer",
    async () =>
      new Promise<void>(async (done) => {
        const label = "bundle_max_bundle_offer";

        const counter = new Counter(3, () => {
          pc.close();
          done();
        });

        if (!peer.connected) await new Promise<void>((r) => peer.on("open", r));
        await sleep(100);

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          bundlePolicy: "max-bundle",
        });
        pc.ontrack = async ({ track }) => {
          await waitVideoPlay(track);
          counter.done();
        };

        peer.on("notification", (e) => {
          if (e.method === "candidate") {
            if (pc.signalingState === "closed") return;
            pc.addIceCandidate(e.data!);
          }
        });

        const channel = pc.createDataChannel("dc");
        channel.onopen = () => {
          channel.send("ping");
        };
        channel.onmessage = (e) => {
          if (e.data === "pong") {
            counter.done();
          }
        };

        {
          const [track] = (
            await navigator.mediaDevices.getUserMedia({ video: true })
          ).getTracks();
          pc.addTrack(track);
        }
        {
          const [track] = (
            await navigator.mediaDevices.getUserMedia({ video: true })
          ).getTracks();
          pc.addTrack(track);
        }
        pc.onicecandidate = ({ candidate }) => {
          peer
            .request(label, {
              type: "candidate",
              payload: candidate,
            })
            .catch(() => {});
        };

        await pc.setLocalDescription(await pc.createOffer());
        const answer = await peer.request(label, {
          type: "init",
          payload: pc.localDescription,
        });
        await pc.setRemoteDescription(answer);
      }),
    20 * 1000,
  );
});
