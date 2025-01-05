# werift

werift (**We**b**r**tc **I**mplementation **f**or **T**ypeScript)

werift is a WebRTC Implementation for TypeScript (Node.js), includes ICE/DTLS/SCTP/RTP.

# install

`npm install werift`

requires at least Node.js 16

# Documentation (WIP)

- [Website](https://shinyoshiaki.github.io/werift-webrtc/website/build/)
- [API Reference](https://shinyoshiaki.github.io/werift-webrtc/website/build/docs/api)

# examples

https://github.com/shinyoshiaki/werift-webrtc/tree/master/examples

### SFU

https://github.com/shinyoshiaki/node-sfu

# demo

## MediaChannel

```sh
yarn media
```

open
https://shinyoshiaki.github.io/werift-webrtc/examples/mediachannel/pubsub/answer

see console & chrome://webrtc-internals/

## DataChannel

run

```sh
yarn datachannel
```

open
https://shinyoshiaki.github.io/werift-webrtc/examples/datachannel/answer

see console & chrome://webrtc-internals/

# RoadMap

## Work in Progress Towards 1.0

- [x] STUN
- [x] TURN
  - [x] UDP
- [x] ICE
  - [x] Vanilla ICE
  - [x] Trickle ICE
  - [x] ICE-Lite Client Side
  - [ ] ICE-Lite Server Side
  - [x] ICE restart
- [x] DTLS
  - [x] DTLS-SRTP
  - [x] Curve25519
  - [x] P-256
- [x] DataChannel
- [x] MediaChannel
  - [x] sendonly
  - [x] recvonly
  - [x] sendrecv
  - [x] multi track
  - [x] RTX
  - [x] RED
- [x] RTP
  - [x] RFC 3550
  - [x] Parse RTP Payload Format for VP8 Video
  - [x] Parse RTP Payload Format for VP9 Video
  - [x] Parse RTP Payload Format for H264 Video
  - [x] Parse RTP Payload Format for AV1 Video
  - [x] RED (RFC 2198)
- [x] RTCP
  - [x] SR/RR
  - [x] Picture Loss Indication
  - [x] ReceiverEstimatedMaxBitrate
  - [x] GenericNack
  - [x] TransportWideCC
- [x] SRTP
- [x] SRTCP
- [x] SDP
  - [x] reuse inactive m-line
- [x] PeerConnection
- [x] Simulcast
  - [x] recv
- [x] BWE
  - [x] sender side BWE
- [ ] Documentation
- [x] Compatibility
  - [x] Chrome
  - [x] Safari
  - [x] FireFox
  - [x] Pion
  - [x] aiortc
  - [x] sipsorcery
  - [x] webrtc-rs
- [x] Interop E2E test
  - [x] Chrome
  - ↓↓↓ https://github.com/sipsorcery/webrtc-echoes
  - [x] Pion
  - [x] aiortc
  - [x] sipsorcery
  - [x] webrtc-rs
- [ ] Unit Tests
  - [ ] follow [Web Platform Tests](https://github.com/web-platform-tests/wpt)
- [x] MediaRecorder
  - [x] OPUS
  - [x] VP8
  - [x] H264
  - [x] VP9
  - [x] AV1

## Road Map Towards 2.0

- [ ] API compatible with browser RTCPeerConnection
- [ ] Simulcast
  - [ ] send
- [ ] support more cipher suites
- [ ] getStats
- [ ] TURN
  - [ ] TCP

# reference

- aiortc https://github.com/aiortc/aiortc
- pion/webrtc https://github.com/pion/webrtc
- etc ....
