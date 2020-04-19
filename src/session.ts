import { Game } from "./game";
import { PlayerState } from "./state";

const games: Map<string, Game> = new Map();
games.set('', new Game());

function createGameID(): string {
  let id = '';
  while (games.has(id)) {
    id = '';
    for (let i = 0; i < 4; i++) {
      id += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
  }
  return id;
}

export function createGame(): string {
  const id = createGameID();
  const game = new Game();
  games.set(id, game);
  return id;
}

export class PlayerSession {
  gameId: string;
  game: Game;
  playerId: string;
  listeners: ((state: PlayerState) => any)[] = [];
  unsubscribe: () => any = () => {};

  constructor(gameId: string, name: string, playerId?: string) {
    // Find game
    this.gameId = gameId;
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game does not exist.');
    }
    this.game = game;
    // Add to game
    if (playerId) {
      if (!this.game.hasPlayerWithID(playerId)) {
        throw new Error('Invalid player ID.');
      }
      this.playerId = playerId;
    } else {
      this.playerId = this.game.addPlayer(name);
    }
    // Subscribe to events
    this.unsubscribe = this.game.attachListener(() => {
      this.listeners.forEach(listener => listener(this.game.getPlayerState(this.playerId)));
    }, this.playerId);
  }

  onChange(listener: (state: PlayerState) => any) {
    this.listeners.push(listener);
    listener(this.game.getPlayerState(this.playerId));
  }

  doAction(action: string, data: any) {
    const state = this.game.getPlayerState(this.playerId);
    if (!state.action || state.action.type !== action) {
      throw new Error('Wrong action type');
    }
    switch (state.action?.type) {
      case 'lobby':
        if (state.action.canStart && data === 'start') {
          this.game.startGame();
        } else {
          throw new Error('Unexpected data.');
        }
        break;
      case 'nightRound':
        if (data === 'done') {
          this.game.clickNext(this.playerId);
        } else {
          throw new Error('Unexpected data.');
        }
        break;
      case 'choosePlayer':
        if (state.action.players.indexOf(data) != -1) {
          this.game.choosePlayer(this.playerId, data);
        } else {
          throw new Error('Invalid player chosen.');
        }
        break;
      case 'vote':
        if (typeof data === 'boolean') {
          this.game.vote(this.playerId, data);
        } else {
          throw new Error('Vote must be a boolean.');
        }
        break;
      case 'legislative':
        switch (data.type) {
          case 'discard':
            const idx = data.idx;
            if (typeof idx === 'number' && idx >= 0 && idx < state.action.cards.length) {
              this.game.discardPolicy(this.playerId, idx);
            } else {
              throw new Error('Discard index must be a valid integer.');
            }
            break;
          case 'veto':
            if (state.action.canVeto) {
              this.game.vetoAgenda(this.playerId);
            } else {
              throw new Error('Veto is unavailable.');
            }
            break;
          default:
            throw new Error('Invalid action.');
        }
        break;
      case 'vetoConsent':
        if (typeof data === 'boolean') {
          if (data) {
            this.game.vetoAgenda(this.playerId);
          } else {
            this.game.rejectVeto(this.playerId);
          }
        } else {
          throw new Error('Veto consent must be a boolean.');
        }
        break;
      case 'policyPeak':
      case 'investigateParty':
        if (data === 'done') {
          this.game.endExecutiveAction();
        } else {
          throw new Error('Unexpected data.');
        }
        break;
      default:
        throw new Error('Unexpected action.');
    }
  }

  close() {
    this.unsubscribe();
  }
}

export class BoardSession {
  gameId: string;
  game: Game;
  listeners: ((state: Game) => any)[] = [];
  unsubscribe: () => any = () => {};

  constructor(gameId: string) {
    // Find game
    this.gameId = gameId;
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game does not exist.');
    }
    this.game = game;
    // Subscribe to events
    this.unsubscribe = this.game.attachListener(() => {
      this.listeners.forEach(listener => listener(this.game));
    }, 'board');
  }

  onChange(listener: (state: Game) => any) {
    this.listeners.push(listener);
    listener(this.game);
  }

  // doAction() ??

  close() {
    this.unsubscribe();
  }
}