import { setTimeout } from "timers/promises";

import { Connection } from "../../src";
import { assertCandidateTypes } from "../utils";

describe("IceTrickleTest", () => {
  test("test_trickle_connect", async () => {
    const a = new Connection(true);
    a.stunServer = undefined;
    const b = new Connection(false);
    b.stunServer = undefined;

    await a.gatherCandidates();
    b.remoteUsername = a.localUsername;
    b.remotePassword = a.localPassword;

    await b.gatherCandidates();
    a.remoteUsername = b.localUsername;
    a.remotePassword = b.localPassword;

    assertCandidateTypes(a, ["host"]);
    assertCandidateTypes(b, ["host"]);

    const candidate = a.getDefaultCandidate()!;
    expect(candidate).not.toBeUndefined();
    expect(candidate.type).toBe("host");

    const addCandidatesLater = async (a: Connection, b: Connection) => {
      await setTimeout(100);
      for (const candidate of b.localCandidates) {
        a.addRemoteCandidate(candidate);
        await setTimeout(100);
      }
      a.addRemoteCandidate(undefined);
    };

    await Promise.all([
      a.connect(),
      b.connect(),
      addCandidatesLater(a, b),
      addCandidatesLater(b, a),
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
});
