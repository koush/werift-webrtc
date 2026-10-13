import { verify } from "crypto";
import {
  CipherSuite,
  HashAlgorithm,
  NamedCurveAlgorithm,
  SignatureAlgorithm,
} from "../../src/cipher/const";
import { generateKeyPair } from "../../src/cipher/namedCurve";
import { CipherContext } from "../../src/context/cipher";
import { ClientHello } from "../../src/handshake/message/client/hello";
import { ServerKeyExchange } from "../../src/handshake/message/server/keyExchange";
import { DtlsRandom } from "../../src/handshake/random";
import { FragmentedHandshake } from "../../src/record/message/fragment";
import { parsePacket } from "../../src/record/receive";
import { DtlsServer } from "../../src/server";

test.each([false, true])(
  "cookie-authenticated ClientHello random signs ServerKeyExchange (changed: %s)",
  async (changed) => {
    const hash = {
      hash: HashAlgorithm.sha256_4,
      signature: SignatureAlgorithm.ecdsa_3,
    };
    const { certPem, keyPem } =
      await CipherContext.createSelfSignedCertificateWithKey(hash);
    const server = new DtlsServer({
      cert: certPem,
      key: keyPem,
      signatureHash: hash,
      transport: {
        type: "udp",
        closed: false,
        send: async () => {
          server.dtls.flight = 6;
        },
        close: async () => {},
        onData: () => {},
        address: { address: "127.0.0.1", port: 0, family: "IPv4" },
      },
    });
    server.cipher.localRandom = new DtlsRandom();
    const currentRandom = new DtlsRandom();
    server.cipher.remoteRandom = changed ? new DtlsRandom() : currentRandom;
    server.cipher.namedCurve = NamedCurveAlgorithm.secp256r1_23;
    server.cipher.localKeyPair = generateKeyPair(server.cipher.namedCurve);
    server.cipher.cipherSuite =
      CipherSuite.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256_49195;
    server.dtls.cookie = Buffer.from("test cookie");
    const hello = new ClientHello(
      { major: 254, minor: 253 },
      currentRandom,
      Buffer.alloc(0),
      server.dtls.cookie,
      [server.cipher.cipherSuite],
      [0],
      [],
    );
    hello.messageSeq = 1;
    // Cookie 検証済みの ClientHello を処理する。
    await server.onHandleHandshakes([hello.toFragment()]);
    // 署名と鍵導出には、受理した ClientHello の乱数を使用する。
    expect(server.cipher.remoteRandom.serialize()).toEqual(
      currentRandom.serialize(),
    );
    const exchangeBody = FragmentedHandshake.deSerialize(
      parsePacket(server.dtls.lastMessage[2])[0].fragment,
    ).fragment;
    const exchange = ServerKeyExchange.deSerialize(exchangeBody);
    const signedData = Buffer.concat([
      currentRandom.serialize(),
      server.cipher.localRandom.serialize(),
      exchangeBody.subarray(0, 4 + exchange.publicKeyLength),
    ]);
    expect(verify("sha256", signedData, certPem, exchange.signature)).toBe(
      true,
    );
    const originalFlight = server.dtls.lastMessage;
    const acceptedRandom = server.cipher.remoteRandom.serialize();
    server.dtls.flight = 4;
    hello.random = new DtlsRandom();
    // 再送はキャッシュ済み flight を使用し、受理済みの乱数を変更しない。
    await server.onHandleHandshakes([hello.toFragment()]);
    expect(server.dtls.lastMessage).toBe(originalFlight);
    expect(server.cipher.remoteRandom.serialize()).toEqual(acceptedRandom);
  },
);
