import React, {useEffect, useReducer, useRef, useState} from 'react'
import './App.css'
import {INITIAL_STATE, reducer} from "./state";
import {SignallingChannel} from "./signalling-channel";
import PeerView from "./PeerView";

const App: React.FC = () => {
  const videoElement = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState('')
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  useEffect(() => {
    async function init() {
      try {
        const videoCameras = await getConnectedDevices('videoinput')
        dispatch({type: "SetDevices", devices: videoCameras})

        const stream = await openMediaDevices({
          'video': {deviceId: videoCameras[0]?.deviceId},
          'audio': true
        })
        dispatch({type: "SetMediaStream", stream})

        if (videoElement.current) {
          videoElement.current.srcObject = stream;
        }

        if (!state.signallingChannel) {
          dispatch({
            type: "SetSignallingChannel",
            signallingChannel: new SignallingChannel(dispatch)
          })
        }

        const name = sessionStorage.getItem('web-rtc-name')
        if (name) {
          setTimeout(() => dispatch({type: "SetName", name}), 100);
        }

      } catch (error) {
        console.error('Error accessing media devices.', error)
      }
    }

    if (state.stream) {
      return
    }

    init()

    return () => {
      if (state.signallingChannel !== undefined) {
        state.signallingChannel.close()
      }
    }
  }, [state.signallingChannel, state.stream])

  return (
    <div className="App">
      <h1>Web RTC</h1>
      <>
        <dl className="m-sm">
          <dt>Name</dt>
          {state.name ?
            <dd>{state.name}</dd>
            :
            <>
              <input
                value={name}
                onChange={(ev) => setName(ev.target.value)}/>
              <button className="m-sm"
                      onClick={() => dispatch({type: "SetName", name})}>Set
              </button>
            </>
          }
          <dt>UUID</dt>
          <dd>{state.signallingChannel && state.signallingChannel?.uuid}</dd>
          <dt>WS open</dt>
          <dd>{state.signallingChannel && JSON.stringify(state.signallingChannel?.isOpen)}</dd>
        </dl>
        <h2>Peers</h2>
        {state.peers.map(peer =>
          <PeerView key={peer.uuid}
                    peer={peer}
                    onMakeCall={() => dispatch({type: "MakeCall", peer})}
                    onSendMessage={(msg) => dispatch({type: "SendMessage", peer, msg})}/>
        )}

        <hr/>

        <h2>Video</h2>
        <dl>
          <dt>Stream</dt>
          <dd>{state.stream?.id}</dd>
          <dt>Devices</dt>
          <dd>{JSON.stringify(state.devices, undefined, 2)}</dd>
        </dl>
        <video className="m-sm" ref={videoElement} autoPlay={true}/>
      </>
    </div>
  )
}

export default App

async function openMediaDevices(constraints: MediaStreamConstraints): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia(constraints)
}

async function getConnectedDevices(type: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === type)
}

