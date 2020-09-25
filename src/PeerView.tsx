import React, {useState} from "react";
import {Peer} from "./state";

const PeerView: React.FC<{ peer: Peer, onMakeCall: () => void, onSendMessage: (msg: string) => void }> =
  (props) => {
    const {
      peer,
      onMakeCall = () => undefined,
      onSendMessage = () => undefined
    } = props
    const [msg, setMsg] = useState('')
    return (
      <div
        style={{border: 'solid 2px grey', borderRadius: '5px', padding: '10px', margin: '10px'}}>
        <h3>{peer.name}</h3>
        <p><i>UUID: {peer.uuid}</i></p>
        <p><i>{peer.iceConnected?'Connected':'Not connected'}</i></p>
        {peer.dataChannelStatus !== 'READY' ?
          <button className="m-sm"
                  onClick={onMakeCall}>Connect
          </button>
          :
          <>
            <br/>
            <input type="text"
                   className="m-sm"
                   value={msg}
                   onChange={e => setMsg(e.target.value)}/><br/>
            <button className="m-sm"
                    onClick={() => {
                      onSendMessage(msg);
                      setMsg('')
                    }}>Send
            </button>
            <h4>Messages</h4>
            <ul>
              {peer.messages?.map((m, i) => <li key={i}>{m.direction} - {m.text}</li>)}
            </ul>
          </>
        }

      </div>
    )

  }

export default PeerView
