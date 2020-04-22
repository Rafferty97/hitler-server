import { nanoid } from "nanoid";
import {
  Party, PlayerRole, GameState, ExecutiveActionType,
  PlayerState, PlayerAction, PublicPlayer, PlayerTitle
} from "./types";
import { getShuffledDeck, getFascistTile } from "./util";

const MAX_LIBERAL_TILES = 5;
const MAX_FASCIST_TILES = 6;
const NUM_FASCISTS = new Map<number, number>([
  [5, 1], [6, 1], [7, 2], [8, 2], [9, 3], [10, 3]
]);

/* Player */

class Player {
  id: string;
  name: string;
  role?: PlayerRole = undefined;
  isDead: boolean = false;
  isConfirmedNotHitler: boolean = false;
  hasBeenInvestigated: boolean = false;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  
  get party(): Party {
    if (!this.role) {
      throw new Error('Player has not been assigned a role.');
    }
    return this.role == 'Hitler' ? 'Fascist' : this.role;
  }
}

/* Game */

export class Game {

  /* Game state */

  players: Player[] = [];
  state: GameState = { type: 'lobby' };
  roundIndex: number = 0;
  electionTracker: number = 0;
  numLiberalCards: number = 0;
  numFascistCards: number = 0;
  drawPile: Party[] = [];
  lastPresident: number = -1;
  lastChancellor: number = -1;
  lastPresidentInTurn: number = -1;

  /* Mutating methods */

  addPlayer(name: string) {
    if (this.numPlayers == 10) {
      throw new Error('Cannot have more than 10 players in game.');
    }
    const player = new Player(nanoid(), name);
    this.players.push(player);
    this.signalChange('all');
    return player.id;
  }

  startGame() {
    if (this.numPlayers < 5) {
      throw new Error('Need at least 5 players to start game.');
    }
    this.state = {
      type: 'nightRound',
      confirmations: this.players.map(_ => false)
    };
    this.drawPile = getShuffledDeck();
    this.lastPresidentInTurn = Math.floor(Math.random() * this.numPlayers);
    this.players.forEach(player => player.role = 'Liberal');
    this.getRandomPlayer().role = 'Hitler';
    for (let i = 0; i < (NUM_FASCISTS.get(this.numPlayers) ?? 0);) {
      const player = this.getRandomPlayer();
      if (player.role == 'Liberal') {
        player.role = 'Fascist';
        i++;
      }
    }
    this.signalChange('all');
  }

  clickNext(playerId: string) {
    const player = this.getPlayer(playerId);

    switch (this.state.type) {
      case 'nightRound':
        this.state.confirmations[player] = true;
        if (this.state.confirmations.reduce((x, y) => x && y, true)) {
          this.startElection();
        } else {
          this.signalChange(player);
        }
        break;
    }
  }

  choosePlayer(playerId: string, otherPlayerId: string) {
    const player = this.getPlayer(playerId);
    const otherPlayer = this.getPlayer(otherPlayerId);

    if (player == otherPlayer) {
      throw new Error('Cannot choose yourself.');
    }

    switch (this.state.type) {
      case 'election':
        if (this.state.chancellorElect) {
          throw new Error('Chancellor has already been nominated.');
        }
        if (this.getEligibleChancellors(this.state.presidentElect).indexOf(otherPlayer) == -1) {
          throw new Error('This player cannot be chancellor.');
        }
        this.state.chancellorElect = otherPlayer;
        this.signalChange('all');
        break;
      case 'executiveAction':
        if (this.state.action == 'policyPeak') {
          throw new Error('This executive action doesn\'t involve another player.');
        }
        if (this.state.playerChosen) {
          throw new Error('Player already chosen.');
        }
        if (this.players[otherPlayer].isDead) {
          throw new Error('Can\'t choose a dead player.');
        }
        this.state.playerChosen = otherPlayer;
        this.signalChange([player, otherPlayer]);
        break;
    }
  }

  vote(playerId: string, vote: boolean) {
    const player = this.getPlayer(playerId);

    if (this.state.type != 'election' || !this.state.chancellorElect) {
      throw new Error('Not currently voting.');
    }

    if (this.players[player].isDead) {
      throw new Error('Dead players can\'t vote.');
    }

    // Record the vote
    this.state.votes[player] = vote;
    
    // Compute the voting result, if voting is finished
    let y = 0, n = 0, c = true;
    for (let i = 0; i < this.players.length; i++) {
      const vote = this.state.votes[i];
      if (vote === true) y++;
      if (vote === false) n++;
      if (vote === null && !this.players[i].isDead) {
        c = false;
      }
    }
    this.state.voteResult = c ? y > n : null;

    // Signal change
    this.signalChange(player);
  }

  completeVoting() {
    if (this.state.type != 'election') {
      throw new Error('Not voting.');
    } 
    if (!this.state.chancellorElect) {
      throw new Error('Chancellor has not been nominated.');
    }
    if (this.state.voteResult == null) {
      throw new Error('Not all votes are cast.');
    }

    if (this.state.voteResult) {
      // Vote passed
      if (this.checkHitlerWin(this.state.chancellorElect)) {
        return;
      }
      this.state = {
        type: 'legislativeSession',
        cards: this.drawCards(3),
        president: this.state.presidentElect,
        chancellor: this.state.chancellorElect,
        turn: 'President',
        canVeto: this.vetoPowerUnlocked
      };
      this.signalChange(this.state.president);
    } else {
      // Vote failed
      this.electionTracker++;
      this.startElection();
    }
  }

  discardPolicy(playerId: string, card: number) {
    const player = this.getPlayer(playerId);

    if (this.state.type != 'legislativeSession') {
      throw new Error('Not in a legislative session.');
    }

    switch (this.state.turn) {
      case 'President':
        if (this.state.president != player) {
          throw new Error('It is the president\'s turn to discard a policy.');
        }
        this.state.cards.splice(card, 1);
        this.state.turn = 'Chancellor';
        this.signalChange([this.state.president, this.state.chancellor]);
        break;
      case 'Chancellor':
        if (this.state.chancellor != player) {
          throw new Error('It is the chancellor\'s turn to discard a policy.');
        }
        this.lastPresident = this.state.president;
        this.lastChancellor = this.state.chancellor;
        this.state.cards.splice(card, 1);
        this.state = {
          type: 'cardReveal',
          card: this.state.cards[0],
          chaos: false
        };
        this.signalChange(this.lastChancellor);
        break;
      case 'Veto':
        throw new Error('Chancellor has called for a veto.');
    }
  }

  vetoAgenda(playerId: string) {
    const player = this.getPlayer(playerId);

    if (this.state.type != 'legislativeSession') {
      throw new Error('Not in a legislative session.');
    }
    if (!this.state.canVeto) {
      throw new Error('Veto power is not available.');
    }

    switch (this.state.turn) {
      case 'President':
        throw new Error('The president cannot initiate a veto.');
      case 'Chancellor':
        if (this.state.chancellor != player) {
          throw new Error('It is the chancellor\'s turn to discard a policy.');
        }
        this.state.turn = 'Veto';
        this.signalChange([this.state.president, this.state.chancellor]);
        break;
      case 'Veto':
        if (this.state.president != player) {
          throw new Error('Only the president can conset to the veto.');
        }
        this.lastPresident = this.state.president;
        this.lastChancellor = this.state.chancellor;
        this.state = {
          type: 'cardReveal',
          card: 'Veto',
          chaos: false
        };
        break;
    }
  }

  rejectVeto(playerId: string) {
    const player = this.getPlayer(playerId);

    if (this.state.type != 'legislativeSession') {
      throw new Error('Not in a legislative session.');
    }
    if (this.state.turn != 'Veto') {
      throw new Error('A veto has not been proposed.');
    }
    if (this.state.president != player) {
      throw new Error('Only the president can reject a veto.');
    }

    this.state.turn = 'Chancellor';
    this.state.canVeto = false;
    this.signalChange([this.state.president, this.state.chancellor]);
  }

  endCardReveal() {
    if (this.state.type != 'cardReveal') {
      throw new Error('Not in a card reveal.');
    }

    const chaos = this.state.chaos;
    if (chaos) {
      this.lastPresident = -1;
      this.lastChancellor = -1;
    }

    if (this.state.card == 'Fascist') {
      this.numFascistCards++;
      if (this.numFascistCards == MAX_FASCIST_TILES) {
        this.state = {
          type: 'end',
          winType: 'legislative',
          winner: 'Fascist'
        };
        this.signalChange('all');
      } else {
        const tile = chaos ? null : getFascistTile(this.numPlayers, this.numFascistCards - 1);
        this.playExecutiveAction(tile);
      }
    }
    else if (this.state.card == 'Liberal') {
      this.numLiberalCards++;
      if (this.numLiberalCards == MAX_LIBERAL_TILES) {
        this.state = {
          type: 'end',
          winType: 'legislative',
          winner: 'Liberal'
        };
        this.signalChange('all');
      } else {
        this.playExecutiveAction(null);
      }
    }
    else {
      this.electionTracker++;
      this.startElection();
    }
  }

  endExecutiveAction() {
    if (this.state.type != 'executiveAction') {
      throw new Error('Not in an executive action.');
    }
    
    switch (this.state.action) {
      case 'execution':
        if (this.state.playerChosen == null) {
          throw new Error('Player has not been chosen.');
        }
        this.players[this.state.playerChosen].isDead = true;
        this.startElection();
        break;
      case 'specialElection':
        if (this.state.playerChosen == null) {
          throw new Error('Player has not been chosen.');
        }
        this.startElection(this.state.playerChosen);
        break;
      default:
        this.startElection();
        break;
    }
  }

  /* Listeners */

  listeners: Map<number, GameListener> = new Map();
  listenerId: number = 0;

  attachListener(listener: () => any, playerId: string): () => void {
    const id = this.listenerId++;
    if (playerId == 'board') {
      this.listeners.set(id, { listener, player: 'all' });
    } else {
      const ind = this.players.findIndex(p => p.id == playerId);
      this.listeners.set(id, { listener, player: ind });
    }
    return () => this.listeners.delete(id);
  }

  /* Game state inspectors */

  get numPlayers() {
    return this.players.length;
  }

  get vetoPowerUnlocked() {
    return this.numFascistCards >= 5;
  }

  hasPlayerWithID(playerId: string): boolean {
    return this.players.find(player => player.id == playerId) != undefined;
  }

  getPlayerState(playerId: string): PlayerState {
    const ind = this.getPlayer(playerId);
    const player = this.players[ind];
    let action: PlayerAction | undefined = undefined;

    let title: PlayerTitle = player.isDead ? 'Dead' : '';

    switch (this.state.type) {
      case 'lobby':
        action = {
          type: 'lobby',
          canStart: this.numPlayers >= 5
        };
        break;
      case 'nightRound':
        action = { type: 'nightRound' };
        break;
      case 'election':
        if (this.state.presidentElect === ind) {
          title = 'President Nominee';
        }
        if (this.state.chancellorElect === ind) {
          title = 'Chancellor Nominee';
        }
        if (!this.state.chancellorElect) {
          if (title == 'President Nominee') {
            action = {
              type: 'choosePlayer',
              subtype: 'nominateChancellor',
              players: this.getEligibleChancellors(ind)
            };
          }
        } else {
          if (this.state.votes[ind] === null) {
            action = {
              type: 'vote',
              president: this.state.presidentElect,
              chancellor: this.state.chancellorElect
            };
          }
        }
        break;
      case 'legislativeSession':
        if (this.state.president === ind) {
          title = 'President';
        }
        if (this.state.chancellor === ind) {
          title = 'Chancellor';
        }
        if (this.state.turn == title) {
          action = {
            type: 'legislative',
            role: title,
            cards: this.state.cards,
            canVeto: this.state.turn == 'Chancellor' && this.state.canVeto
          };
        }
        else if (this.state.turn == 'Veto') {
          action = {
            type: 'vetoConsent',
            chancellor: this.state.chancellor
          };
        }
        break;
      case 'cardReveal':
        if (this.lastPresident === ind) {
          title = 'President';
        }
        if (this.lastChancellor === ind) {
          title = 'Chancellor';
        }
        break;
      case 'executiveAction':
        if (this.lastPresident === ind) {
          title = 'President';
        }
        if (this.lastChancellor === ind) {
          title = 'Chancellor';
        }
        if (title == 'President') {
          if (this.state.playerChosen) {
            switch (this.state.action) {
              case 'investigate':
                action = {
                  type: 'investigateParty',
                  player: this.state.playerChosen,
                  party: this.players[this.state.playerChosen].party
                };
                break;
            }
          } else {
            switch (this.state.action) {
              case 'execution':
              case 'investigate':
              case 'specialElection':
                action = {
                  type: 'choosePlayer',
                  subtype: this.state.action,
                  players: this.getEligiblePlayersForAction(ind, this.state.action)
                };
                break;
              case 'policyPeak':
                action = {
                  type: 'policyPeak',
                  cards: this.drawPile.slice(this.drawPile.length - 3)
                };
                break;
            }
          }
        }
        break;
      case 'end':
        action = {
          type: 'gameover',
          winner: this.state.winner,
          winType: this.state.winType
        };
        break;
    }

    return {
      id: player.id,
      name: player.name,
      role: player.role,
      title,
      action,
      players: this.getPublicPlayers()
    };
  }

  getPublicPlayers(): PublicPlayer[] {
    return this.players.map(p => ({
      id: p.id,
      name: p.name,
      isDead: p.isDead,
      isConfirmedNotHitler: p.isConfirmedNotHitler
    }));
  }

  /* Private methods */

  private getPlayer(playerId: string): number {
    const index = this.players.findIndex(player => player.id == playerId);
    if (index == -1) {
      throw new Error('Cannot find player with given ID.');
    }
    return index;
  }

  private signalChange(players: number | number[] | 'all' | 'board') {
    let playersArr: number[];
    if (typeof players == 'number') {
      playersArr = [players];
    }
    else if (players === 'all') {
      playersArr = this.players.map((_, i) => i);
    }
    else if (players === 'board') {
      playersArr = [];
    }
    else {
      playersArr = players;
    }
    this.listeners.forEach(listener => {
      if (listener.player == 'all' || playersArr.indexOf(listener.player) != -1) {
        listener.listener();
      }
    });
  }

  private getNextPresident(advance: boolean = false) {
    let i = (this.lastPresidentInTurn + 1) % this.numPlayers;
    while (this.players[i].isDead) {
      i = (i + 1) % this.numPlayers;
    }
    if (advance) {
      this.lastPresidentInTurn = i;
    }
    return i;
  }

  private drawCards(n: number): Party[] {
    const cards = this.drawPile.splice(this.drawPile.length - n);
    if (this.drawPile.length < 3) {
      this.drawPile = getShuffledDeck();
    }
    return cards;
  }

  private getEligibleChancellors(president: number): number[] {
    return this.players
      .map((player, i) => {
        if (i == president) return -1;
        if (player.isDead) return -1;
        if (this.lastChancellor == i) return -1;
        if (this.numPlayers > 5 && this.lastPresident == i) return -1;
        return i;
      })
      .filter(i => i != -1);
  }

  private getEligiblePlayersForAction(president: number, action: ExecutiveActionType): number[] {
    return this.players
      .map((player, i) => {
        if (i == president) return -1;
        if (player.isDead) return -1;
        if (action == 'investigate' && player.hasBeenInvestigated) return -1;
        return i;
      })
      .filter(i => i != -1);
  }

  /* Private mutators */

  private startElection(president?: number) {
    if (this.electionTracker == 3) {
      // Chaos
      const card = this.drawCards(1)[0];
      this.lastPresident = -1;
      this.lastChancellor = -1;
      this.playCard(card, true);
      return;
    }
    
    this.state = {
      type: 'election',
      presidentElect: president ?? this.getNextPresident(true),
      chancellorElect: undefined,
      isSpecial: president != undefined,
      votes: this.players.map(_ => null),
      voteResult: null
    };
    this.signalChange('all');
  }

  private checkHitlerWin(chancellor: number): boolean {
    if (this.numFascistCards >= 3) {
      if (this.players[chancellor].role == 'Hitler') {
        this.state = {
          type: 'end',
          winner: 'Fascist',
          winType: 'hitler'
        };
        return true;
      }
    }
    return false;
  }

  private playCard(card: Party, chaos: boolean = false) {
    this.state = {
      type: 'cardReveal',
      chaos,
      card
    };
    this.electionTracker = 0;
    this.signalChange('board');
  }

  private playExecutiveAction(tile: ExecutiveActionType | null) {
    if (tile) {
      this.state = {
        type: 'executiveAction',
        action: tile,
        playerChosen: undefined
      };
      this.signalChange('all');
    } else {
      this.startElection();
    }
  }

  private getRandomPlayer(): Player {
    return this.players[Math.floor(Math.random() * this.numPlayers)];
  }
}

/* Game Listener */

interface GameListener {
  listener: () => any;
  player: number | 'all';
}