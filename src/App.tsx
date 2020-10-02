import React, {useEffect, useRef} from 'react'
import {useState, useReducer} from 'reinspect'
import './App.css'
import {createSignallingChannelSubscription, INITIAL_STATE, reducer} from "./state";
import PeerView from "./PeerView";
import {Subscription} from "rxjs";


const App: React.FC = () => {
  const videoElement = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState('', 'name' )
  const [signallingChannelSubscription, setSignallingChannelSubscription] = useState<Subscription|undefined>(undefined, 'subscription')
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, state => state, 'App reducer')
  useEffect(() => {
    console.log("APP USE EFFECT")

    async function init() {
      console.log("APP INIT")
      try {
        // const videoCameras = await getConnectedDevices('videoinput')
        // console.log("SET DEVICES")
        // dispatch({type: "SetDevices", devices: videoCameras})
        //
        // const stream = await openMediaDevices({
        //   'video': {deviceId: videoCameras[0]?.deviceId},
        //   'audio': true
        // })
        // console.log("SET MEDIA STREAM")
        // dispatch({type: "SetMediaStream", stream})
        //
        // if (videoElement.current) {
        //   videoElement.current.srcObject = stream;
        // }
        //
        const name = sessionStorage.getItem('web-rtc-name')
        if (name) {
          setTimeout(() => dispatch({type: "SetName", name}), 100);
        }

        if (!signallingChannelSubscription) {
          setSignallingChannelSubscription(createSignallingChannelSubscription(dispatch))
        }

        return () => {
          if (signallingChannelSubscription) {
            signallingChannelSubscription.unsubscribe();
          }
        }

      } catch (error) {
        console.error('Error accessing media devices.', error)
      }
    }

    if (state.stream) {
      return
    }

    init()

  }, [state.stream, signallingChannelSubscription])

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
          <dd>{state?.uuid}</dd>
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
  const devices = await navigator.mediaDevices
  return devices?.getUserMedia(constraints) || [];
}

async function getConnectedDevices(type: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices?.enumerateDevices() || [];
  return devices.filter(device => device.kind === type)
}

