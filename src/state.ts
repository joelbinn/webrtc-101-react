// State

import {SignallingChannel} from "./signalling-channel";

export interface State {
  name?: string;
  peers: Peer[]
  connectionStatus: ConnectionStatus
  stream?: MediaStream
  devices: MediaDeviceInfo[]
  signallingChannel?: SignallingChannel
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
export type DataChannelStatus = 'READY' | 'NOT_READY'

export const INITIAL_STATE: State = {
  peers: [],
  connectionStatus: "CLOSED",
  devices: []
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

export interface SetSignallingChannel {
  type: 'SetSignallingChannel'
  signallingChannel: SignallingChannel
}

export interface SetConnectionStatus {
  type: 'SetConnectionStatus'
  status: ConnectionStatus
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
  SetSignallingChannel |
  SetConnectionStatus |
  MakeCall |
  IceConnected |
  DataChannelStatusChange |
  SendMessage |
  ReceivedMessage
  ;

// Reducer
export const reducer = (state: State, action: AppAction): State => {
  switch (action.type) {
    case "SetName":
      state.signallingChannel?.setName(action.name)
      sessionStorage.setItem('web-rtc-name', action.name)
      return {
        ...state,
        name: action.name
      }
    case "SetPeerName": {
      console.log('SetPeerName', action)
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
      console.log('Devices found:', action.devices);
      return {
        ...state,
        devices: action.devices || []
      }
    case "SetMediaStream":
      console.log('Got MediaStream:', action.stream)
      return {
        ...state,
        stream: action.stream
      }
    case "SetSignallingChannel":
      return {
        ...state,
        signallingChannel: action.signallingChannel
      }
    case "SetConnectionStatus":
      return {
        ...state,
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
      state.signallingChannel?.connectTo(action.peer)
      return state;
    case "DataChannelStatusChange": {
      console.log('DataChannelStatusChange', action)
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
      console.log('SendMessage', action)
      state.signallingChannel?.sendMessage(action.peer, action.msg)
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
      console.log('ReceivedMessage', action)
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
      console.log('IceConnected', action)
      const peer = state.peers.find(p => p.uuid === action.peerUUID)
      if (!peer) {
        return state
      }
      const messages = peer?.messages || []
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


