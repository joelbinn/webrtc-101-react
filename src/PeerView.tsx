import React, {useState} from "react";
import {Peer} from "./state";
import "./PeerView.css";

const PeerView: React.FC<{ peer: Peer, onMakeCall: () => void, onSendMessage: (msg: string) => void }> =
  (props) => {
    const {
      peer,
      onMakeCall = () => undefined,
      onSendMessage = () => undefined
    } = props
    const [msg, setMsg] = useState('')
    return (
      <div className="peer-view">
        <h3>{peer.name}</h3>
        <p><i>UUID: {peer.uuid}</i></p>
        <p><i>{peer.iceConnected ? 'Connected' : 'Not connected'}</i></p>
        {peer.dataChannelStatus !== 'READY' ?
          <button className="m-sm"
                  onClick={onMakeCall}>Connect
          </button>
          :
          <>
            <br/>
            {peer.messages?.map((m, i) =>
              <div className="message" key={i}><div className={m.direction}>{m.text}</div></div>
            )}
            <br/>
            <form>
              <label className="label">Message</label>
              <input type="text"
                     className="m-sm"
                     value={msg}
                     onChange={e => setMsg(e.target.value)}/>
              <button className="send.button"
                      type="submit"
                      onClick={(e) => {
                        onSendMessage(msg);
                        setMsg('');
                        e.preventDefault();
                      }}><i className="far fa-paper-plane mr-1"></i>Send
              </button>
            </form>

          </>
        }

      </div>
    )

  }

export default PeerView
