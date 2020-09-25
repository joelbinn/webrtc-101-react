import {AppAction, Peer} from "./state";

interface ConnectedEvent {
  event: "connected"
  uuid: string
}

interface SetPeerInfoEvent {
  event: "set_peer_info"
  uuid: string
  name: string
}

interface PeerAddedEvent {
  event: "peer_added"
  name: string
  uuid: string
}

interface PeerRemovedEvent {
  event: "peer_removed"
  name: string
  uuid: string
}

interface GeneralMessageEvent {
  event: "message"
  payload: any
}

interface RTCAnswerEvent {
  event: "rtc_answer"
  fromPeerUUID: string
  toPeerUUID: string
  description: RTCSessionDescriptionInit
}

interface RTCOfferEvent {
  event: "rtc_offer"
  fromPeerUUID: string
  toPeerUUID: string
  description: RTCSessionDescriptionInit
}

interface NewIceCandidate {
  event: 'new_ice_candidate',
  fromPeerUUID: string
  toPeerUUID: string
  candidate: RTCIceCandidate
}


type AppMessageEvent =
  ConnectedEvent |
  SetPeerInfoEvent |
  PeerAddedEvent |
  PeerRemovedEvent |
  GeneralMessageEvent |
  RTCAnswerEvent |
  RTCOfferEvent |
  NewIceCandidate
  ;

interface PeerInfo extends RTCPeerConnection {
  msgChannel: RTCDataChannel
  incomingChannel: RTCDataChannel
}

export class SignallingChannel {
  uuid?: string
  isOpen = false
  private readonly ws: WebSocket = new WebSocket('ws://localhost:9898/');
  private readonly peerConnections: { [uuid: string]: PeerInfo } = {};

  constructor(private readonly dispatch: React.Dispatch<AppAction>) {
    this.ws.onopen = () => {
      console.log('WebSocket Client Connected');
      this.isOpen = true
      dispatch({type: "SetConnectionStatus", status: "CONNECTED"})
    };

    this.ws.onclose = () => {
      console.log('WebSocket Client Closed');
      this.uuid = undefined;
      this.isOpen = false
      dispatch({type: "SetConnectionStatus", status: "CLOSED"})
    };

    this.ws.onmessage = async (me: MessageEvent) => {
      const e = JSON.parse(me.data) as AppMessageEvent;
      console.log("Received: ", e);
      switch (e.event) {
        case "connected":
          this.uuid = e.uuid
          break;
        case "peer_added":
          dispatch({type: "AddPeer", peer: {name: e.name, uuid: e.uuid}});
          break;
        case "peer_removed":
          dispatch({type: "RemovePeer", peer: {name: e.name, uuid: e.uuid}});
          break;
        case "set_peer_info": {
          dispatch({type: "SetPeerName", name: e.name, peerUUID: e.uuid})
          break;
        }
        case "message":
          break;
        case "rtc_answer": {
          const peerConnection = this.peerConnections[e.fromPeerUUID]
          if (!peerConnection) {
            console.log("Peer connection not found for", e.fromPeerUUID)
            break
          }
          const remoteDesc = new RTCSessionDescription(e.description);
          await peerConnection.setRemoteDescription(remoteDesc);
          break;
        }
        case "rtc_offer": {
          const peerConnection = this.createPeerConnection(e.fromPeerUUID);

          if (!this.uuid) {
            console.log("Have no local UUID")
            break;
          }

          if (peerConnection.currentRemoteDescription) {
            console.log("Already have remote description")
            break;
          }

          peerConnection.ondatachannel = (ev) => {
            const recChannel = ev.channel;
            peerConnection.msgChannel = recChannel
            recChannel.onmessage = (me) => {
              console.log('onmessage', me)
              dispatch({type: "ReceivedMessage", peerUUID: e.fromPeerUUID, msg: me.data})
            }
          }
          await peerConnection.setRemoteDescription(e.description);
          if (peerConnection.currentLocalDescription) {
            console.log("Already have local description")
            break;
          }
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          this.send({
            event: 'rtc_answer',
            toPeerUUID: e.fromPeerUUID,
            fromPeerUUID: this.uuid,
            description: answer
          });
          break;
        }

        case "new_ice_candidate":
          const peerConnection = this.peerConnections[e.fromPeerUUID]
          if (!peerConnection) {
            console.log("Peer connection not found for", e.fromPeerUUID)
            break
          }
          if (peerConnection.iceConnectionState === 'connected') {
            console.log("ICE connection is established", e.fromPeerUUID)
            dispatch({type: 'IceConnected', peerUUID: e.fromPeerUUID})
            break
          }
          try {
            await peerConnection.addIceCandidate(e.candidate);
            dispatch({type: "DataChannelStatusChange", peerUUID: e.fromPeerUUID, status: "READY"})
          } catch (e) {
            console.log('ICE candidate error', e)
          }
          break;
        default:
          console.log('Unexpected event from backend', e)
      }
    };
  }

  close() {
    console.log('Close WS for', this.uuid)
    this.ws.close()
  }

  async setName(name: string) {
    if (this.uuid) {
      this.send({event: 'set_peer_info', uuid: this.uuid, name})
    }
  }

  async connectTo(peer: Peer) {
    if (!this.uuid) {
      console.log("Have no local UUID")
      return;
    }

    if (this.peerConnections[peer.uuid]) {
      console.log("Already connected to", peer.uuid)
      return;
    }

    const peerConnection = this.createPeerConnection(peer.uuid, true);

    const offer = await peerConnection.createOffer({offerToReceiveAudio: true});
    await peerConnection.setLocalDescription(offer);
    this.send({
      event: 'rtc_offer',
      toPeerUUID: peer.uuid,
      fromPeerUUID: this.uuid,
      description: offer
    });
  }

  async sendMessage(peer: Peer, msg: string) {
    const peerConnection = this.peerConnections[peer.uuid];
    peerConnection.msgChannel.send(msg);
  }

  private createPeerConnection(toPeerUUID: string, withDataChannel: boolean = false) {
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
    const peerConnection = new RTCPeerConnection(configuration);
    if (withDataChannel) {
      const msgChannel = peerConnection.createDataChannel('msgChannel');
      (peerConnection as PeerInfo).msgChannel = msgChannel;
      msgChannel.onmessage = (me) => {
        console.log('onmessage from',toPeerUUID, me)
        this.dispatch({type: "ReceivedMessage", peerUUID: toPeerUUID, msg: me.data})
      }
    }
    this.peerConnections[toPeerUUID] = peerConnection as PeerInfo;
    peerConnection.onnegotiationneeded = ev => console.log('negotiationneeded', ev);
    peerConnection.onsignalingstatechange = ev => console.log('signalingstatechange', ev);
    peerConnection.onconnectionstatechange = ev => console.log('connectionstatechange', ev);
    peerConnection.onicegatheringstatechange = ev => console.log('icegatheringstatechange', ev)
    peerConnection.oniceconnectionstatechange = ev => {
      console.log('oniceconnectionstatechange', ev)
      if ((ev.currentTarget as any).iceConnectionState === 'connected') {
        this.dispatch({type: 'IceConnected', peerUUID: toPeerUUID})
        this.dispatch({type: "DataChannelStatusChange", peerUUID: toPeerUUID, status: "READY"})
      }
    }
    peerConnection.onicecandidateerror = ev => console.log('icecandidateerror', ev)
    peerConnection.onicecandidate = event => {
      console.log("icecandidate", event)
      if (event.candidate && this.uuid) {
        this.send({
          event: 'new_ice_candidate',
          fromPeerUUID: this.uuid,
          toPeerUUID,
          candidate: event.candidate
        });
      }
    };
    return this.peerConnections[toPeerUUID];
  }

  private send(message: AppMessageEvent) {
    this.ws.send(JSON.stringify(message))
  }
}
