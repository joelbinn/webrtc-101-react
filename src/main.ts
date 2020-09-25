export function main() {

  const startButton = document.getElementById('startButton') as HTMLButtonElement;
  const callButton = document.getElementById('callButton') as HTMLButtonElement;
  const hangupButton = document.getElementById('hangupButton') as HTMLButtonElement;
  callButton.disabled = true;
  hangupButton.disabled = true;
  startButton.onclick = start;
  callButton.onclick = call;
  hangupButton.onclick = hangup;

  const canvas = document.querySelector('canvas');

  let startTime: number | undefined;
  const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
  const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;

  localVideo.addEventListener('loadedmetadata', () => {
    return console.log(`Local video videoWidth: ${localVideo.videoWidth}px,  videoHeight: ${localVideo.videoHeight}px`);
  });

  remoteVideo.addEventListener('loadedmetadata', () => {
    return console.log(`Remote video videoWidth: ${remoteVideo.videoWidth}px,  videoHeight: ${remoteVideo.videoHeight}px`);
  });

  remoteVideo.addEventListener('resize', () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
      const elapsedTime = window.performance.now() - startTime;
      console.log(`Setup time: ${elapsedTime.toFixed(3)}ms`);
      startTime = undefined;
    }
  });

  let localStream: MediaStream;
  let pc1: RTCPeerConnection;
  let pc2: RTCPeerConnection;
  const offerOptions: RTCOfferOptions = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  };

  function getName(pc: RTCPeerConnection) {
    return (pc === pc1) ? 'pc1' : 'pc2';
  }

  function getOtherPc(pc: RTCPeerConnection) {
    return (pc === pc1) ? pc2 : pc1;
  }

  function gotStream(stream: MediaStream) {
    console.log('Received local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  }

  function start() {
    console.log('Requesting local stream');
    startButton.disabled = true;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true
      })
      .then(gotStream)
      .catch(e => alert(`getUserMedia() error: ${e.name}`));
  }

  function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    console.log('Starting call');
    startTime = window.performance.now();
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    const servers: RTCConfiguration | undefined = undefined;
    pc1 = new RTCPeerConnection(servers);
    console.log('Created local peer connection object pc1');
    pc1.onicecandidate = e => onIceCandidate(pc1, e);
    pc2 = new RTCPeerConnection(servers);
    console.log('Created remote peer connection object pc2');
    pc2.onicecandidate = e => onIceCandidate(pc2, e);
    pc1.oniceconnectionstatechange = e => onIceStateChange(pc1, e);
    pc2.oniceconnectionstatechange = e => onIceStateChange(pc2, e);
    pc2.ontrack = gotRemoteStream;

    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');

    console.log('pc1 createOffer start');
    pc1.createOffer(offerOptions).then(onCreateOfferSuccess, onCreateSessionDescriptionError);
  }

  function onCreateSessionDescriptionError(error: any) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }

  function onCreateOfferSuccess(desc: RTCSessionDescriptionInit) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log('pc1 setLocalDescription start');
    pc1.setLocalDescription(desc).then(() => onSetLocalSuccess(pc1), onSetSessionDescriptionError);
    console.log('pc2 setRemoteDescription start');
    pc2.setRemoteDescription(desc)
      .then(() => onSetRemoteSuccess(pc2), onSetSessionDescriptionError);
    console.log('pc2 createAnswer start');
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    pc2.createAnswer().then(onCreateAnswerSuccess, onCreateSessionDescriptionError);
  }

  function onSetLocalSuccess(pc: RTCPeerConnection) {
    console.log(`${getName(pc)} setLocalDescription complete`);
  }

  function onSetRemoteSuccess(pc: RTCPeerConnection) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
  }

  function onSetSessionDescriptionError(error: any) {
    console.log(`Failed to set session description: ${error.toString()}`);
  }

  function gotRemoteStream(e: RTCTrackEvent) {
    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      console.log('pc2 received remote stream');
      const streamVisualizer = new StreamVisualizer(e.streams[0], canvas);
      streamVisualizer.start();
    }
  }


  function onCreateAnswerSuccess(desc: RTCSessionDescriptionInit) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log('pc2 setLocalDescription start');
    pc2.setLocalDescription(desc).then(() => onSetLocalSuccess(pc2), onSetSessionDescriptionError);
    console.log('pc1 setRemoteDescription start');
    pc1.setRemoteDescription(desc)
      .then(() => onSetRemoteSuccess(pc1), onSetSessionDescriptionError);
  }

  function onIceCandidate(pc: RTCPeerConnection, event: RTCPeerConnectionIceEvent) {
    if (event.candidate) {
      getOtherPc(pc)
        .addIceCandidate(event.candidate)
        .then(() => onAddIceCandidateSuccess(pc), err => onAddIceCandidateError(pc, err));
      console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
    }
  }

  function onAddIceCandidateSuccess(pc: RTCPeerConnection) {
    console.log(`${getName(pc)} addIceCandidate success`);
  }

  function onAddIceCandidateError(pc: RTCPeerConnection, error: any) {
    console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
  }

  function onIceStateChange(pc: RTCPeerConnection, event: Event) {
    if (pc) {
      console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
      console.log('ICE state change event: ', event);
    }
  }

  function hangup() {
    console.log('Ending call');
    pc1.close();
    pc2.close();
    // pc1 = null;
    // pc2 = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
  }
}
