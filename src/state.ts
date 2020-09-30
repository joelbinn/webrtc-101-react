// State

import {SignallingChannel} from "./signalling-server/signalling-channel";
import {Subscription} from "rxjs";
import {DataChannelStatus} from "./signalling-server/signalling-events";

export interface State {
  name?: string
  uuid?: string
  peers: Peer[]
  connectionStatus: ConnectionStatus
  stream?: MediaStream
  devices: MediaDeviceInfo[]
}

export interface Peer {
  name: string
  uuid: string
  messages?: Message[]
  iceConnected?: boolean
  dataChannelStatus?: DataChannelStatus
}

export interface Message {
  direction: 'IN' | 'OUT'
  text: string
}

export type ConnectionStatus = 'CLOSED' | 'CONNECTED'

export const INITIAL_STATE: State = {
  peers: [],
  connectionStatus: "CLOSED",
  devices: []
}

// Reducer
export const reducer = (state: State, action: AppAction): State => {
  console.log("DISPATCH ACTION:", action.type, action);
  switch (action.type) {
    case "SetName":
      signallingChannel.setName(action.name)
      sessionStorage.setItem('web-rtc-name', action.name)
      return {
        ...state,
        name: action.name
      }
    case "SetPeerName": {
      const peer = state.peers.find(p => p.uuid === action.peerUUID)
      if (!peer) {
        return state
      }
      return {
        ...state,
        peers: [
          ...state.peers.filter(p => p.uuid !== action.peerUUID),
          {...peer, name: action.name}
        ]

      };
    }
    case "SetDevices":
      return {
        ...state,
        devices: action.devices || []
      }
    case "SetMediaStream":
      return {
        ...state,
        stream: action.stream
      }
    case "SetConnectionStatus":
      return {
        ...state,
        uuid: action.uuid,
        connectionStatus: action.status
      }
    case "AddPeer":
      return {
        ...state,
        peers: [...state.peers, action.peer]
      }
    case "RemovePeer":
      return {
        ...state,
        peers: state.peers.filter(p => p.uuid !== action.peer.uuid)
      }
    case "MakeCall":
      signallingChannel.connectTo(action.peer)
      return state;
    case "DataChannelStatusChange": {
      const peer = state.peers.find(p => p.uuid === action.peerUUID)
      if (!peer) {
        return state
      }
      return {
        ...state,
        peers: [
          ...state.peers.filter(p => p.uuid !== action.peerUUID),
          {...peer, dataChannelStatus: action.status}
        ]
      };
    }
    case "SendMessage": {
      signallingChannel.sendMessage(action.peer, action.msg)
      const peer = state.peers.find(p => p.uuid === action.peer.uuid)
      if (!peer) {
        return state
      }
      const messages = peer?.messages || []
      return {
        ...state,
        peers: [
          ...state.peers.filter(p => p.uuid !== peer.uuid),
          {...peer, messages: [...messages, {direction: 'OUT', text: action.msg}]}
        ]
      };
    }
    case "ReceivedMessage": {
      const peer = state.peers.find(p => p.uuid === action.peerUUID)
      if (!peer) {
        return state
      }
      const messages = peer?.messages || []
      return {
        ...state,
        peers: [
          ...state.peers.filter(p => p.uuid !== action.peerUUID),
          {...peer, messages: [...messages, {direction: 'IN', text: action.msg}]}
        ]
      };
    }
    case "IceConnected": {
      const peer = state.peers.find(p => p.uuid === action.peerUUID)
      if (!peer) {
        return state
      }
      return {
        ...state,
        peers: [
          ...state.peers.filter(p => p.uuid !== action.peerUUID),
          {...peer, iceConnected: true}
        ]
      };
    }
    default:
      return state;
  }
}

// Actions
export interface SetName {
  type: 'SetName'
  name: string
}

export interface SetPeerName {
  type: "SetPeerName"
  name: string
  peerUUID: string
}

export interface AddPeer {
  type: 'AddPeer'
  peer: Peer
}

export interface RemovePeer {
  type: 'RemovePeer'
  peer: Peer
}

export interface SetMediaStream {
  type: 'SetMediaStream'
  stream: MediaStream
}

export interface SetDevices {
  type: 'SetDevices'
  devices: MediaDeviceInfo[]
}

export interface SetConnectionStatus {
  type: 'SetConnectionStatus'
  status: ConnectionStatus
  uuid?: string
}

interface MakeCall {
  type: "MakeCall"
  peer: Peer
}

interface IceConnected {
  type: 'IceConnected',
  peerUUID: string
}

interface DataChannelStatusChange {
  type: "DataChannelStatusChange"
  peerUUID: string
  status: DataChannelStatus
}

interface SendMessage {
  type: "SendMessage"
  peer: Peer
  msg: string
}

interface ReceivedMessage {
  type: "ReceivedMessage"
  peerUUID: string
  msg: string
}

export type AppAction =
  SetName |
  SetPeerName |
  AddPeer |
  RemovePeer |
  SetMediaStream |
  SetDevices |
  SetConnectionStatus |
  MakeCall |
  IceConnected |
  DataChannelStatusChange |
  SendMessage |
  ReceivedMessage
  ;


const signallingChannel = new SignallingChannel();

export function createSignallingChannelSubscription(dispatch: React.Dispatch<AppAction>): Subscription {
  const sub = signallingChannel.events$.subscribe(event => {
    console.log("SIGNALLING EVENT:", event.event, event);
    switch (event.event) {
      case "connected":
        dispatch({type: "SetConnectionStatus", status: "CONNECTED", uuid: event.uuid})
        break;
      case "closed":
        dispatch({type: "SetConnectionStatus", status: "CLOSED"})
        break;
      case "peer_added":
        dispatch({type: "AddPeer", peer: {name: event.name, uuid: event.uuid}})
        break;
      case "set_peer_info":
        dispatch({type: "SetPeerName", name: event.name, peerUUID: event.uuid})
        break;
      case "peer_removed":
        dispatch({type: "RemovePeer", peer: {name: event.name, uuid: event.uuid}})
        break;
      case "rtc_offer":
        break;
      case "rtc_answer":
        break;
      case "new_ice_candidate":
        dispatch({type: 'IceConnected', peerUUID: event.fromPeerUUID})
        break;
      case "PeerSignal":
        switch (event.peerEvent.name) {
          case "IceConnected":
            dispatch({type: 'IceConnected', peerUUID: event.peerEvent.peer.value});
            break;
          case "ReceivedDataMessage":
            dispatch({
              type: "ReceivedMessage",
              peerUUID: event.peerEvent.peer.value,
              msg: event.peerEvent.text
            });
            break;
          case "DataChannelStatusChange":
            dispatch({
              type: "DataChannelStatusChange",
              peerUUID: event.peerEvent.peer.value,
              status: event.peerEvent.status
            })
            break;
        }
        break;
      default:
        console.log("Unexpected event", event);
    }
  });

  signallingChannel.start();

  return sub;
}
