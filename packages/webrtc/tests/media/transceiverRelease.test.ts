import { vi } from "vitest";
import {
  MediaStreamTrack,
  type PeerConfig,
  defaultPeerConfig,
} from "../../src";
import { RtpRouter } from "../../src/media/router";
import { RTCRtpSender } from "../../src/media/rtpSender";
import { TransceiverManager } from "../../src/transceiverManager";
import { createDtlsTransport } from "../fixture";

const config = defaultPeerConfig as Required<PeerConfig>;

describe("media/transceiverRelease", () => {
  test("a transceiver whose slot is reused is unregistered from the router", () => {
    const router = new RtpRouter();
    const manager = new TransceiverManager("cname", config, router);
    const dtls = createDtlsTransport();

    const senders: RTCRtpSender[] = [];
    for (let i = 0; i < 10; i++) {
      const transceiver = manager.addTransceiver(
        new MediaStreamTrack({ kind: "video" }),
        dtls,
        { direction: "sendonly" },
      );
      senders.push(transceiver.sender);

      transceiver.stop();
      manager.removeTrack(transceiver.sender);
      // what the negotiation of the now inactive m-line results in
      transceiver.setCurrentDirection("inactive");
    }

    // every stream reused the slot of the previous one
    expect(manager.getTransceivers().length).toBe(1);

    // only the transceiver that is still held has routes
    const routed = Object.values(router.ssrcTable);
    expect(routed.length).toBe(1);
    expect(routed[0]).toBe(senders[senders.length - 1]);
  });

  test("unregisterTransceiver removes the receiver routes too", () => {
    const router = new RtpRouter();
    const manager = new TransceiverManager("cname", config, router);
    const dtls = createDtlsTransport();

    const kept = manager.addTransceiver("audio", dtls, {
      direction: "sendrecv",
    });
    const removed = manager.addTransceiver("audio", dtls, {
      direction: "sendrecv",
    });
    router.ssrcTable[1111] = removed.receiver;
    router.ridTable["rid"] = removed.receiver;
    router.ssrcTable[2222] = kept.receiver;

    router.unregisterTransceiver(removed);

    const routed = Object.values(router.ssrcTable);
    expect(routed.includes(removed.sender)).toBe(false);
    expect(routed.includes(removed.receiver)).toBe(false);
    expect(router.ssrcTable[kept.sender.ssrc]).toBe(kept.sender);
    expect(router.ssrcTable[2222]).toBe(kept.receiver);
    expect(Object.keys(router.ridTable)).toEqual([]);
  });

  test("a stopped sender releases its dtls transport subscription", () => {
    const dtls = createDtlsTransport();
    const sender = new RTCRtpSender("video");
    sender.setDtlsTransport(dtls);

    const onReady = vi.fn();
    sender.onReady.subscribe(onReady);

    dtls.onStateChange.execute("connected");
    expect(onReady).toBeCalledTimes(1);

    sender.stop();

    dtls.onStateChange.execute("connected");
    expect(onReady).toBeCalledTimes(1);
  });
});
