import { setTimeout } from "timers/promises";

import { type Address, Event } from "../../../common/src";
import {
  CandidatePair,
  CandidatePairState,
  sortCandidatePairs,
} from "../../src";
import { Candidate, candidatePriority } from "../../src/candidate";
import { Connection } from "../../src/ice";
import { classes, methods } from "../../src/stun/const";
import { Message } from "../../src/stun/message";
import type { Protocol } from "../../src/types/model";
import { assertCandidateTypes, inviteAccept } from "../utils";

class ProtocolMock implements Protocol {
  type = "mock";
  responseAddr?: Address;
  responseMessage?: string;
  onRequestReceived: Event<[Message, Address, Buffer]> = new Event();
  onDataReceived: Event<[Buffer]> = new Event();
  localCandidate = new Candidate(
    "some-foundation",
    1,
    "udp",
    1234,
    "1.2.3.4",
    1234,
    "host",
  );
  sentMessage?: Message;
  request = async () => {
    return null as any;
  };
  sendStun = async (message: Message) => {
    this.sentMessage = message;
  };
  async connectionMade() {}
  async sendData() {}
  async close() {}
}

describe("ice", () => {
  test("test_peer_reflexive", async () => {
    const connection = new Connection(true);
    connection.remotePassword = "remote-password";
    connection.remoteUsername = "remote-username";
    const protocol = new ProtocolMock() as any;

    const request = new Message(methods.BINDING, classes.REQUEST);
    request.setAttribute("PRIORITY", 456789);
    request.setAttribute("USERNAME", `a:b`);

    connection.checkIncoming(request, ["2.3.4.5", 2345], protocol);
    expect(protocol.sentMessage).not.toBeNull();

    // # check we have discovered a peer-reflexive candidate
    expect(connection.remoteCandidates.length).toBe(1);
    const candidate = connection.remoteCandidates[0];
    expect(candidate.component).toBe(1);
    expect(candidate.transport).toBe("udp");
    expect(candidate.priority).toBe(456789);
    expect(candidate.host).toBe("2.3.4.5");
    expect(candidate.type).toBe("prflx");
    expect(candidate.generation).toBe(undefined);

    // # check a new pair was formed
    expect(connection.checkList.length).toBe(1);
    const pair = connection.checkList[0];
    expect(pair.protocol).toBe(protocol);
    expect(pair.remoteCandidate).toBe(candidate);

    // # check a triggered check was scheduled
    expect(pair.handle).not.toBeNull();
    protocol.responseAddr = ["2.3.4.5", 2345];
    protocol.responseMessage = "bad";
    await pair.handle?.awaitable;
  });

  test("test_response_with_invalid_address", async () => {
    const connection = new Connection(true);
    connection.remotePassword = "remote-password";
    connection.remoteUsername = "remote-username";

    const protocol: any = new ProtocolMock();
    protocol.responseAddr = ["3.4.5.6", 3456];
    protocol.responseMessage = "bad";

    const pair = new CandidatePair(
      protocol,
      new Candidate("some-foundation", 1, "udp", 2345, "2.3.4.5", 2345, "host"),
      true,
    );

    await connection.checkStart(pair).awaitable;
    expect(pair.state).toBe(CandidatePairState.FAILED);
  });

  test("test_connect", async () => {
    const a = new Connection(true, {});
    const b = new Connection(false, {});
    a.stunServer = undefined;
    b.stunServer = undefined;

    await inviteAccept(a, b);

    assertCandidateTypes(a, ["host"]);
    assertCandidateTypes(b, ["host"]);

    const candidate = a.getDefaultCandidate();
    expect(candidate).not.toBeUndefined();
    expect(candidate?.type).toBe("host");

    await Promise.all([a.connect(), b.connect()]);

    // # send data a -> b
    await a.send(Buffer.from("howdee"));
    let [data] = await b.onData.asPromise();
    expect(data.toString()).toBe("howdee");

    // # send data b -> a
    await b.send(Buffer.from("gotcha"));
    [data] = await a.onData.asPromise();
    expect(data.toString()).toBe("gotcha");

    await a.close();
    await b.close();
  });

  // test("test_connect_two_components", async () => {
  //   const a = new Connection(true, { components: 2 });
  //   const b = new Connection(false, { components: 2 });

  //   // # invite / accept
  //   await inviteAccept(a, b);

  //   // # we should only have host candidates
  //   assertCandidateTypes(a, ["host"]);
  //   assertCandidateTypes(b, ["host"]);

  //   // # there should be a default candidate for component 1
  //   let candidate = a.getDefaultCandidate(1);
  //   expect(candidate).not.toBeUndefined();
  //   expect(candidate?.type).toBe("host");

  //   // # there should be a default candidate for component 2
  //   candidate = a.getDefaultCandidate(2);
  //   expect(candidate).not.toBeUndefined();
  //   expect(candidate?.type).toBe("host");

  //   // # connect
  //   await Promise.all([a.connect(), b.connect()]);
  //   expect(a._components).toEqual(new Set([1, 2]));
  //   expect(b._components).toEqual(new Set([1, 2]));

  //   // # send data a -> b (component 1)
  //   await a.sendTo(Buffer.from("howdee"), 1);
  //   let [data, component] = await b.onData.asPromise();
  //   expect(data).toEqual(Buffer.from("howdee"));
  //   expect(component).toBe(1);

  //   // # send data b -> a (component 1)
  //   await b.sendTo(Buffer.from("gotcha"), 1);
  //   [data, component] = await a.onData.asPromise();
  //   expect(data).toEqual(Buffer.from("gotcha"));
  //   expect(component).toBe(1);

  //   // # send data a -> b (component 2)
  //   await a.sendTo(Buffer.from("howdee 2"), 2);
  //   [data, component] = await b.onData.asPromise();
  //   expect(data.toString()).toEqual(Buffer.from("howdee 2").toString());
  //   expect(component).toBe(2);

  //   // # send data b -> a (component 2)
  //   await b.sendTo(Buffer.from("gotcha 2"), 2);
  //   [data, component] = await a.onData.asPromise();
  //   expect(data.toString()).toEqual(Buffer.from("gotcha 2").toString());
  //   expect(component).toBe(2);

  //   await a.close();
  //   await b.close();
  // });

  // test("test_connect_two_components_vs_one_component", async () => {
  //   // """
  //   // It is possible that some of the local candidates won't get paired with
  //   // remote candidates, and some of the remote candidates won't get paired
  //   // with local candidates.  This can happen if one agent doesn't include
  //   // candidates for the all of the components for a media stream.  If this
  //   // happens, the number of components for that media stream is effectively
  //   // reduced, and considered to be equal to the minimum across both agents
  //   // of the maximum component ID provided by each agent across all
  //   // components for the media stream.
  //   // """

  //   const a = new Connection(true, { components: 2 });
  //   const b = new Connection(false, { components: 1 });

  //   // # invite / accept
  //   await inviteAccept(a, b);
  //   expect(a.localCandidates.length > 0).toBeTruthy();
  //   assertCandidateTypes(a, ["host"]);

  //   // # connect
  //   await Promise.all([a.connect(), b.connect()]);
  //   expect(a._components).toEqual(new Set([1]));
  //   expect(b._components).toEqual(new Set([1]));

  //   // # send data a -> b (component 1)
  //   await a.sendTo(Buffer.from("howdee"), 1);
  //   let [data, component] = await b.onData.asPromise();
  //   expect(data).toEqual(Buffer.from("howdee"));
  //   expect(component).toBe(1);

  //   // # send data b -> a (component 1)
  //   await b.sendTo(Buffer.from("gotcha"), 1);
  //   [data, component] = await a.onData.asPromise();
  //   expect(data).toEqual(Buffer.from("gotcha"));
  //   expect(component).toBe(1);

  //   // # close
  //   await a.close();
  //   await b.close();
  // });

  test("test_connect_ipv6", async () => {
    const a = new Connection(true, {
      useIpv4: false,
      useIpv6: true,
      useLinkLocalAddress: true,
    });
    const b = new Connection(false, {
      useIpv4: false,
      useIpv6: true,
      useLinkLocalAddress: true,
    });

    // # invite / accept
    await inviteAccept(a, b);
    assertCandidateTypes(a, ["host"]);

    // # connect
    await Promise.all([a.connect(), b.connect()]);

    // # send data a -> b
    await a.send(Buffer.from("howdee"));
    let [data] = await b.onData.asPromise();
    expect(data.toString()).toBe("howdee");

    // # send data b -> a
    await b.send(Buffer.from("gotcha"));
    [data] = await a.onData.asPromise();
    expect(data.toString()).toBe("gotcha");

    await a.close();
    await b.close();
  });

  test("test_connect_reverse_order", async () => {
    const a = new Connection(true);
    const b = new Connection(false);

    // # invite / accept
    await inviteAccept(a, b);

    // # introduce a delay so that B's checks complete before A's
    await Promise.all([
      new Promise<void>((r) =>
        setTimeout(1000).then(async () => {
          await a.connect();
          r();
        }),
      ),
      b.connect(),
    ]);

    // # send data a -> b
    await a.send(Buffer.from("howdee"));
    let [data] = await b.onData.asPromise();
    expect(data.toString()).toBe("howdee");

    // # send data b -> a
    await b.send(Buffer.from("gotcha"));
    [data] = await a.onData.asPromise();
    expect(data.toString()).toBe("gotcha");

    await a.close();
    await b.close();
  });

  test("test_connect_invalid_password", async () =>
    new Promise<void>(async (done) => {
      const a = new Connection(true);
      const b = new Connection(false);

      await a.gatherCandidates();
      b.remoteCandidates = a.localCandidates;
      b.remoteUsername = a.localUsername;
      b.remotePassword = a.remotePassword;

      await b.gatherCandidates();
      a.remoteCandidates = b.localCandidates;
      a.remoteUsername = b.localUsername;
      a.remotePassword = "wrong-password";

      try {
        await Promise.all([a.connect(), b.connect()]);
      } catch (error: any) {
        expect(error.message).toBe("Remote username or password is missing");
        await a.close();
        await b.close();
        done();
      }
    }));

  test("test_connect_invalid_username", async () =>
    new Promise<void>(async (done) => {
      const a = new Connection(true);
      const b = new Connection(false);

      await a.gatherCandidates();
      b.remoteCandidates = a.localCandidates;
      b.remoteUsername = a.localUsername;
      b.remotePassword = a.remotePassword;

      await b.gatherCandidates();
      a.remoteCandidates = b.localCandidates;
      a.remoteUsername = "wrong-username";
      a.remotePassword = b.localPassword;

      try {
        await Promise.all([a.connect(), b.connect()]);
      } catch (error: any) {
        expect(error.message).toBe("Remote username or password is missing");
        await a.close();
        await b.close();
        done();
      }
    }));

  test("test_connect_no_gather", async () =>
    new Promise<void>(async (done) => {
      // """
      // If local candidates gathering was not performed, connect fails.
      // """

      const conn = new Connection(true);
      conn.remoteCandidates = [
        Candidate.fromSdp(
          "6815297761 1 udp 659136 1.2.3.4 31102 typ host generation 0",
        ),
      ];
      conn.remoteUsername = "foo";
      conn.remotePassword = "bar";
      try {
        await conn.connect();
      } catch (error: any) {
        expect(error.message).toBe(
          "Local candidates gathering was not performed",
        );
        await conn.close();
        done();
      }
    }));

  test("test_connect_no_local_candidates", async () =>
    new Promise<void>(async (done) => {
      const conn = new Connection(true);

      conn.localCandidatesEnd = true;
      conn.remoteCandidates = [
        Candidate.fromSdp(
          "6815297761 1 udp 659136 1.2.3.4 31102 typ host generation 0",
        ),
      ];
      conn.remoteUsername = "foo";
      conn.remotePassword = "bar";
      try {
        await conn.connect();
      } catch (error: any) {
        expect(error.message).toBe("ICE negotiation failed");
        await conn.close();
        done();
      }
    }));

  test("test_connect_no_remote_candidates", async () =>
    new Promise<void>(async (done) => {
      const conn = new Connection(true);

      await conn.gatherCandidates();
      conn.remoteCandidates = [];
      conn.remoteUsername = "foo";
      conn.remotePassword = "bar";
      try {
        await conn.connect();
      } catch (error: any) {
        expect(error.message).toBe("ICE negotiation failed");
        await conn.close();
        done();
      }
    }));

  test("test_connect_no_remote_credentials", async () =>
    new Promise<void>(async (done) => {
      const conn = new Connection(true);

      await conn.gatherCandidates();
      conn.remoteCandidates = [
        Candidate.fromSdp(
          "6815297761 1 udp 659136 1.2.3.4 31102 typ host generation 0",
        ),
      ];
      try {
        await conn.connect();
      } catch (error: any) {
        expect(error.message).toBe("Remote username or password is missing");
        await conn.close();
        done();
      }
    }));

  test(
    "test_connect_role_conflict_both_controlling",
    async () => {
      const a = new Connection(true);
      const b = new Connection(true);

      //@ts-ignore
      a.tieBreaker = BigInt(1);
      //@ts-ignore
      b.tieBreaker = BigInt(2);

      await inviteAccept(a, b);

      try {
        await Promise.all([a.connect(), b.connect()]);
      } catch (error) {}
      expect(a.iceControlling).toBe(false);
      expect(b.iceControlling).toBe(true);

      await a.close();
      await b.close();
    },
    1000 * 60 * 60,
  );

  test(
    "test_connect_role_conflict_both_controlled",
    async () => {
      const a = new Connection(false);
      const b = new Connection(false);

      //@ts-ignore
      a.tieBreaker = BigInt(1);
      //@ts-ignore
      b.tieBreaker = BigInt(2);

      await inviteAccept(a, b);

      await Promise.all([a.connect(), b.connect()]);
      expect(a.iceControlling).toBe(false);
      expect(b.iceControlling).toBe(true);

      await a.close();
      await b.close();
    },
    1000 * 60 * 60,
  );

  test("test_connect_with_stun_server", async () => {
    const a = new Connection(true, {
      stunServer: ["stun.l.google.com", 19302],
    });
    const b = new Connection(false);
    b.stunServer = undefined;

    // # invite / accept
    await inviteAccept(a, b);

    // # we would have both host and server-reflexive candidates
    assertCandidateTypes(a, ["host", "srflx"]);
    assertCandidateTypes(b, ["host"]);

    const candidate = a.getDefaultCandidate()!;
    expect(candidate).not.toBeUndefined();
    expect(candidate.type).toBe("srflx");
    expect(candidate.relatedAddress).not.toBeUndefined();
    expect(candidate.relatedPort).not.toBeUndefined();

    // # connect
    await Promise.all([a.connect(), b.connect()]);

    // # send data a -> b
    await a.send(Buffer.from("howdee"));
    let [data] = await b.onData.asPromise();
    expect(data.toString()).toBe("howdee");

    // # send data b -> a
    await b.send(Buffer.from("gotcha"));
    [data] = await a.onData.asPromise();
    expect(data.toString()).toBe("gotcha");

    await a.close();
    await b.close();
  });

  test(
    "test_connect_with_stun_server_dns_lookup_error",
    async () => {
      const a = new Connection(true, {
        stunServer: ["invalid", 19302],
      });
      const b = new Connection(false, {});
      b.stunServer = undefined;

      // # invite / accept
      await inviteAccept(a, b);

      assertCandidateTypes(a, ["host"]);
      assertCandidateTypes(b, ["host"]);

      // # connect
      await Promise.all([a.connect(), b.connect()]);

      // # send data a -> b
      await a.send(Buffer.from("howdee"));
      let [data] = await b.onData.asPromise();
      expect(data.toString()).toBe("howdee");

      // # send data b -> a
      await b.send(Buffer.from("gotcha"));
      [data] = await a.onData.asPromise();
      expect(data.toString()).toBe("gotcha");

      await a.close();
      await b.close();
    },
    1000 * 60,
  );

  test(
    "test_connect_with_stun_server_ipv6",
    async () => {
      const a = new Connection(true, {
        stunServer: ["stun.l.google.com", 19302],
        useIpv4: false,
        useIpv6: true,
        useLinkLocalAddress: true,
      });
      const b = new Connection(false, {
        stunServer: ["stun.l.google.com", 19302],
        useIpv4: false,
        useIpv6: true,
        useLinkLocalAddress: true,
      });

      // # invite / accept
      await inviteAccept(a, b);

      // # we would have both host and server-reflexive candidates
      expect(a.localCandidates.length > 0).toBeTruthy();
      a.localCandidates.forEach((v) => expect(v.type).toBe("host"));

      // # connect
      await Promise.all([a.connect(), b.connect()]);

      // # send data a -> b
      await a.send(Buffer.from("howdee"));
      let [data] = await b.onData.asPromise();
      expect(data.toString()).toBe("howdee");

      // # send data b -> a
      await b.send(Buffer.from("gotcha"));
      [data] = await a.onData.asPromise();
      expect(data.toString()).toBe("gotcha");

      await a.close();
      await b.close();
    },
    60 * 1000,
  );

  test("test_connect_to_ice_lite", async () => {
    const a = new Connection(true, {});
    a.remoteIsLite = true;
    const b = new Connection(false, {});
    a.stunServer = undefined;
    b.stunServer = undefined;

    // # invite / accept
    await inviteAccept(a, b);

    // # we would have both host and server-reflexive candidates
    assertCandidateTypes(a, ["host"]);
    assertCandidateTypes(b, ["host"]);

    const candidate = a.getDefaultCandidate()!;
    expect(candidate).not.toBeUndefined();
    expect(candidate.type).toBe("host");

    // # connect
    await Promise.all([a.connect(), b.connect()]);

    // # send data a -> b
    await a.send(Buffer.from("howdee"));
    let [data] = await b.onData.asPromise();
    expect(data.toString()).toBe("howdee");

    // # send data b -> a
    await b.send(Buffer.from("gotcha"));
    [data] = await a.onData.asPromise();
    expect(data.toString()).toBe("gotcha");

    await a.close();
    await b.close();
  });
});

describe("sortCandidatePairs", () => {
  it("controlling", () => {
    const host = {
      type: "host",
      localCandidate: { priority: candidatePriority("host") },
      remoteCandidate: { priority: candidatePriority("host") },
    };

    const relay = {
      type: "relay",
      localCandidate: { priority: candidatePriority("relay") },
      remoteCandidate: { priority: candidatePriority("relay") },
    };

    const res = sortCandidatePairs([host, relay], true);
    expect(res).toEqual([host, relay]);
  });

  it("controlled", () => {
    const host = {
      type: "host",
      localCandidate: { priority: candidatePriority("host") },
      remoteCandidate: { priority: candidatePriority("host") },
    };

    const relay = {
      type: "relay",
      localCandidate: { priority: candidatePriority("relay") },
      remoteCandidate: { priority: candidatePriority("relay") },
    };

    const res = sortCandidatePairs([host, relay], true);
    expect(res).toEqual([host, relay]);
  });
});
