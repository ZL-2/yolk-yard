# Party and Arena voice feasibility

WebRTC audio is feasible for Ravelfront's four-player parties and eight-player Arena matches. The existing authenticated relay can exchange connection offers, answers and ICE candidates, while browsers transmit audio through WebRTC. Voice is not enabled in Update 172.

## What is needed

- An HTTPS origin and explicit microphone permission. Capture should start only after the player enables voice and stop when voice is disabled or the session ends.
- STUN discovery plus a TURN relay for networks where direct connections fail. A production TURN service needs credentials, bandwidth funding, monitoring and a defined retention policy; none is provisioned by this update. Costs depend on participant minutes, codec bitrate and the percentage of relayed connections.
- Authenticated signaling tied to current party or Arena membership, with revalidation after kicks, party changes and room transitions. Reject unsolicited offers and stop connections immediately when membership ends.
- Opt-in push-to-talk, mute/deafen, per-player volume, speaking indicators, microphone selection and the existing block rules. Party-only and match channels should be explicit; private text messages must never implicitly start a call.

## Suggested architecture

Start with party voice: at most three peer connections per person. An eight-person Arena mesh requires seven per person, so measure uplink/CPU/TURN traffic before enabling it. Use an SFU for larger voice rooms instead of extending a peer mesh to a 48-player Royale. Keep voice traffic independent of game snapshots and degrade or stop voice without interrupting the match.

Required desktop checks for a future implementation: permission denied and revoked, no input device, restricted NAT using TURN, reconnect, party leader change, participant kick/block, channel change, duplicate tabs and device changes. Test latency and bandwidth on real networks, not only a local browser loopback.

## Primary references

- [WebRTC peer connections and signaling](https://webrtc.org/getting-started/peer-connections)
- [WebRTC TURN servers](https://webrtc.org/getting-started/turn-server)
- [MDN microphone capture, permission and secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
