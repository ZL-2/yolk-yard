// Allow a short queued burst after server scheduling stalls, without increasing
// the sustained message/byte rate or the maximum individual frame size.
const FRAMES_PER_SECOND=200,FRAME_BURST=400,BYTES_PER_SECOND=16_000_000;
export function acceptFrame(peer,bytes,now=Date.now()){
 const elapsed=Math.max(0,(now-(peer.rateAt??now))/1000);peer.rateAt=now;
 peer.frameCredit=Math.min(FRAME_BURST,(peer.frameCredit??FRAME_BURST)+elapsed*FRAMES_PER_SECOND);
 peer.byteCredit=Math.min(BYTES_PER_SECOND,(peer.byteCredit??BYTES_PER_SECOND)+elapsed*BYTES_PER_SECOND);
 if(peer.frameCredit<1||peer.byteCredit<bytes)return false;
 peer.frameCredit--;peer.byteCredit-=bytes;return true;
}
