import * as express from "express";
import * as WebSocket from "ws";
import { Game } from "./game";
import { nanoid } from "nanoid";
import { createGame, PlayerSession, BoardSession } from "./session";
import { PlayerState } from "./state";

const port = parseInt(process.env.PORT || '8888');
const wss = new WebSocket.Server({ port });

wss.on('connection', ws => {
  let board: BoardSession | null = null;
  let session: PlayerSession | null = null;

  ws.on('message', text => {
    try {
      const msg = JSON.parse(text.toString());

      switch (msg.type) {
        // Board
        case 'create_game':
          const gameId = createGame();
          ws.send(JSON.stringify({
            type: 'game_created',
            gameId
          }));
          break;

        case 'board_join':
          board?.close();
          board = new BoardSession(msg.gameId);
          ws.send(JSON.stringify({
            type: 'game_joined',
            gameId: board.gameId
          }));
          board.onChange(state => {
            ws.send(JSON.stringify({
              type: 'update',
              state
            }));
          });
          break;
        
        case 'board_ping':
          // todo
          break;
        
        // case 'board_action' ??

        // Players
        case 'player_join':
          session?.close();
          session = new PlayerSession(msg.gameId, msg.name, msg.playerId);
          ws.send(JSON.stringify({
            type: 'game_joined',
            name: msg.name,
            gameId: session.gameId,
            playerId: session.playerId
          }));
          session.onChange(state => {
            ws.send(JSON.stringify({
              type: 'update',
              state
            }));
          });
          break;

        case 'player_action':
          if (session) {
            session.doAction(msg.action, msg.data);
          } else {
            throw new Error('Not in a game.');
          }
          break;
        
        case 'player_ping':
          // todo
          break;
      }
    }
    catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        error: err instanceof Error ? err.message : 'Unknown error.'
      }));
    }
  });
});