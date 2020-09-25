const WebSocket = require('ws');
const uuid = require('uuid')

const wss = new WebSocket.Server({port: 9898});

wss.on('connection', (ws) => {
  ws.uuid = uuid.v4();
  connections[ws.uuid] = ws
  console.log('connected', ws.uuid);
  ws.send(JSON.stringify({event: 'connected', uuid: ws.uuid}));

  Object.values(connections)
  .filter(c => c.uuid !== ws.uuid)
  .forEach(c => c.send(JSON.stringify({event: 'peer_added', uuid: ws.uuid, name: ws.name})))

  Object.values(connections)
  .filter(c => c.uuid !== ws.uuid)
  .forEach(c => ws.send(JSON.stringify({event: 'peer_added', uuid: c.uuid, name: c.name})))

  ws.on('message', function incoming(data) {
    const msg = JSON.parse(data)
    console.log("Message", msg)
    switch (msg.event) {
      case "set_peer_info":
        ws.name = msg.name;
        Object.values(connections)
        .filter(c => c.uuid !== ws.uuid)
        .forEach(c => c.send(data))
        break
      case "rtc_answer":
      case "new_ice_candidate":
      case "rtc_offer": {
        const conn = connections[msg.toPeerUUID];
        if (conn) {
          conn.send(data)
        }
        break;
      }
    }
    console.log('message', data);
  });

  ws.on('close', () => {
    console.log('close', ws.uuid);
    delete connections[ws.uuid];
    Object.values(connections)
    .filter(c => c.uuid !== ws.uuid)
    .forEach(
        c => c.send(JSON.stringify({event: 'peer_removed', uuid: ws.uuid})));
  })
});

const connections = {}

console.log("Started signalling server on port 9898")
