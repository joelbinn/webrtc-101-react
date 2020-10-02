import {SignallingChannel} from "./signalling-channel";
import {UUID} from "./uuid";
import {dataChannelStatusChange, iceConnected, receivedDataMessage} from "./signalling-events";

const audioContext = new AudioContext();
const localOutput = audioContext.createMediaStreamDestination();


export class PeerProxy {
  private constructor(
    public readonly ownUUID: UUID,
    public readonly remotePeerUUID: UUID,
    private readonly signallingChannel: SignallingChannel
  ) {
    this.localTracks = getLocalTracks();
    this.localTracks.then(ts => console.log('---'))
      .catch(e => console.log('Error fetching local tracks', e))
    this.remoteStream = new Promise(r => this.resolveRemoteStream = r)
  }

  private peerConnection?: RTCPeerConnection;
  private msgChannel?: RTCDataChannel;
  private readonly localTracks: Promise<LocalTracks>;
  private readonly remoteStream: Promise<MediaStream>;
  private resolveRemoteStream: (value?: (PromiseLike<MediaStream> | MediaStream)) => void = () => {
  };

  static async connectRemote(
    ownUUID: UUID,
    remotePeerUuid: UUID,
    signallingChannel: SignallingChannel
  ): Promise<PeerProxy> {
    const peerProxy = new PeerProxy(ownUUID, remotePeerUuid, signallingChannel)
    await peerProxy.establishConnection();
    return peerProxy;
  }

  static async acceptRemote(
    ownUUID: UUID,
    remotePeerUUID: UUID,
    signallingChannel: SignallingChannel,
    sessionDescription: RTCSessionDescriptionInit
  ): Promise<PeerProxy> {
    const peerProxy = new PeerProxy(ownUUID, remotePeerUUID, signallingChannel)
    await peerProxy.handleReceivedOffer(sessionDescription);
    return peerProxy;
  }

  async handleIceCandidate(candidate: RTCIceCandidate) {
    if (this.peerConnection?.iceConnectionState === 'connected') {
      console.log("ICE connection is established", this.remotePeerUUID)
      this.signallingChannel.onPeerEvent(iceConnected(this.remotePeerUUID, this.remoteStream))
      return;
    }
    try {
      await this.peerConnection?.addIceCandidate(candidate);
      this.signallingChannel.onPeerEvent(dataChannelStatusChange(this.remotePeerUUID, "READY"))
    } catch (e) {
      console.log('ICE candidate error', e)
    }
  }

  async handleAnswer(description: RTCSessionDescriptionInit) {
    const remoteDesc = new RTCSessionDescription(description);
    await this.peerConnection?.setRemoteDescription(remoteDesc);
  }

  sendDataMessage(msg: string): void {
    this.msgChannel?.send(msg);
  }

  async getLocalAudio(): Promise<MediaStream> {
    const localTracks = await this.localTracks;
    return localTracks.stream;
  }

  async getRemoteAudio(): Promise<MediaStream> {
    return await this.remoteStream;
  }

  private async establishConnection() {
    const peerConn = await this.createPeerConnection(true);

    peerConn.ontrack = (ev) => {
      console.log('Received remote stream', ev.streams[0]);
      this.resolveRemoteStream(ev.streams[0]);
      this.remoteStream.then(s => {
        console.log('Connect remote stream', ev.streams[0]);
        audioContext.createMediaStreamSource(s).connect(localOutput)
      })
    }

    const localTracks = await this.localTracks;
    localTracks.tracks.forEach(t => this.peerConnection?.addTrack(t, localTracks.stream));

    const offer = await peerConn.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
      voiceActivityDetection: false
    });
    await peerConn.setLocalDescription(offer);
    this.signallingChannel.send({
      event: 'rtc_offer',
      toPeerUUID: this.remotePeerUUID.value,
      fromPeerUUID: this.ownUUID.value,
      description: offer
    });
  }

  private async handleReceivedOffer(sessionDescription: RTCSessionDescriptionInit) {
    const peerConnection = await this.createPeerConnection();

    const localTracks = await this.localTracks;
    localTracks.tracks.forEach(t => this.peerConnection?.addTrack(t, localTracks.stream));

    if (peerConnection.currentRemoteDescription) {
      console.log("Already have remote description")
      return;
    }

    peerConnection.ondatachannel = (ev) => {
      const recChannel = ev.channel;
      this.msgChannel = recChannel
      recChannel.onmessage = (me) => {
        console.log('onmessage', me)
        this.signallingChannel.onPeerEvent(receivedDataMessage(this.remotePeerUUID, me.data))
      }
    }
    peerConnection.ontrack = ev => {
      console.log('Received remote stream', ev.streams[0]);
      this.resolveRemoteStream(ev.streams[0]);
      this.remoteStream.then(s => {
        console.log('Connect remote stream', ev.streams[0]);
        audioContext.createMediaStreamSource(s).connect(localOutput)
      })
    }

    await peerConnection.setRemoteDescription(sessionDescription);
    if (peerConnection.currentLocalDescription) {
      console.log("Already have local description")
      return;
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.signallingChannel.send({
      event: 'rtc_answer',
      toPeerUUID: this.remotePeerUUID.value,
      fromPeerUUID: this.ownUUID.value,
      description: answer
    });
  }

  private async createPeerConnection(setupDataChannel: boolean = false): Promise<RTCPeerConnection> {
    this.peerConnection = new RTCPeerConnection(configuration);
    if (setupDataChannel) {
      this.msgChannel = this.peerConnection.createDataChannel('msgChannel');
      this.msgChannel.onmessage = (me) => {
        console.log('onmessage from', this.remotePeerUUID, me)
        this.signallingChannel.onPeerEvent(receivedDataMessage(this.remotePeerUUID, me.data));
      }
    }

    this.peerConnection.onnegotiationneeded = ev => console.log('negotiationneeded', ev);
    this.peerConnection.onsignalingstatechange = ev => console.log('signalingstatechange', ev);
    this.peerConnection.onconnectionstatechange = ev => console.log('connectionstatechange', ev);
    this.peerConnection.onicegatheringstatechange = ev => console.log('icegatheringstatechange', ev)
    this.peerConnection.oniceconnectionstatechange = ev => {
      console.log('oniceconnectionstatechange', ev)
      if ((ev.currentTarget as any).iceConnectionState === 'connected') {
        this.signallingChannel.onPeerEvent(iceConnected(this.remotePeerUUID, this.remoteStream))
        this.signallingChannel.onPeerEvent(dataChannelStatusChange(this.remotePeerUUID, "READY"))
      }
    }
    this.peerConnection.onicecandidateerror = ev => console.log('icecandidateerror', ev)
    this.peerConnection.onicecandidate = event => {
      console.log("icecandidate", event)
      if (event.candidate) {
        this.signallingChannel.send({
          event: 'new_ice_candidate',
          fromPeerUUID: this.ownUUID.value,
          toPeerUUID: this.remotePeerUUID.value,
          candidate: event.candidate
        });
      }
    };

    return this.peerConnection;
  }
}

async function getLocalTracks(): Promise<{ tracks: MediaStreamTrack[], stream: MediaStream }> {
  await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: false
    });
  console.log('Got local stream', localStream);
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    console.log(`Using Audio device: ${audioTracks[0].label}`);
  }

  return {tracks: await localStream.getTracks(), stream: localStream};
}

interface LocalTracks {
  tracks: MediaStreamTrack[],
  stream: MediaStream
}

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

