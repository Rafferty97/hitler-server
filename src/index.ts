import * as express from "express";
import * as WebSocket from "ws";

const port = parseInt(process.env.PORT || '8888');
const wss = new WebSocket.Server({ port });

wss.on('connection', ws => {
  ws.on('message', message => {
    console.log('received: %s', message);
  });

  ws.send('something');
});