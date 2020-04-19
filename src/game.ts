import { nanoid } from "nanoid";
import { Party, PlayerRole, GameState, ExecutiveActionType } from "./state";
import { getShuffledDeck, getFascistTile } from "./util";

const MAX_LIBERAL_TILES = 5;
const MAX_FASCIST_TILES = 6;

/* Player */

class Player {
  id: string;
  name: string;
  role?: PlayerRole = undefined;
  isDead: boolean = false;
  isConfirmedNotHitler: boolean = false;

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
  nextPresidentElect: number = 0;

  /* Mutating methods */

  addPlayer(name: string): string {
    if (this.numPlayers == 10) {
      throw new Error('Cannot have more than 10 players in game.');
    }
    const player = new Player(nanoid(), name);
    this.players.push(player);
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
    this.nextPresidentElect = Math.floor(Math.random() * this.numPlayers);
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
      throw new Error('Cannot choose self.');
    }

    switch (this.state.type) {
      case 'election':
        if (this.state.chancellorElect) {
          throw new Error('Chancellor has already been nominated.');
        }
        this.state.chancellorElect = otherPlayer;
        this.signalChange('all');
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

    this.state.votes[player] = vote;
    this.signalChange(player);
  }

  completeVoting() {
    if (this.state.type != 'election') {
      throw new Error('Not voting.');
    } 
    if (!this.state.chancellorElect) {
      throw new Error('Chancellor has not been nominated.');
    }
    
    let y = 0, n = 0;
    for (let i = 0; i < this.players.length; i++) {
      const vote = this.state.votes[i];
      if (vote === true) y++;
      if (vote === false) n++;
      if (vote === null && !this.players[i].isDead) {
        throw new Error('Not all votes are cast.');
      }
    }

    if (y > n) {
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

  discardCard(playerId: string, card: number) {
    const player = this.getPlayer(playerId);

    if (this.state.type != 'legislativeSession') {
      throw new Error('Not in a legislative session.');
    }

    switch (this.state.turn) {
      case 'President':
        if (this.state.president != player) {
          throw new Error('It is the president\'s turn to discard a policy.');
        }
        this.state.cards.splice(card);
        this.state.turn = 'Chancellor';
        this.signalChange([this.state.president, this.state.chancellor]);
        break;
      case 'Chancellor':
        if (this.state.chancellor != player) {
          throw new Error('It is the chancellor\'s turn to discard a policy.');
        }
        const { chancellor } = this.state;
        this.state.cards.splice(card);
        this.state = {
          type: 'cardReveal',
          card: this.state.cards[0],
          chaos: false
        };
        this.signalChange(chancellor);
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

    if (this.state.card == 'Fascist') {
      if (this.numFascistCards == MAX_FASCIST_TILES) {
        this.state = {
          type: 'end',
          winType: 'legislative',
          winner: 'Fascist'
        };
        this.signalChange('all');
      } else {
        const tile = getFascistTile(this.numPlayers, this.numFascistCards - 1);
        this.playExecutiveAction(tile);
      }
    }
    else if (this.state.card == 'Liberal') {
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

  /* Listeners */

  listeners: Map<number, GameListener> = new Map();
  listenerId: number = 0;

  attachListener(listener: () => any, player: number | 'all'): () => void {
    const id = this.listenerId++;
    this.listeners.set(id, { listener, player });
    return () => this.listeners.delete(id);
  }

  /* Game state inspectors */

  get numPlayers() {
    return this.players.length;
  }

  get vetoPowerUnlocked() {
    return this.numFascistCards >= 5;
  }

  getTableState() {

  }

  getPlayerState(playerId: string) {

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
    const president = this.nextPresidentElect;
    if (advance) {
      this.nextPresidentElect = (this.nextPresidentElect + 1) % this.numPlayers;
    }
    return president;
  }

  private drawCards(n: number): Party[] {
    const cards = this.drawPile.splice(this.drawPile.length - n);
    if (this.drawPile.length < 3) {
      this.drawPile = getShuffledDeck();
    }
    return cards;
  }

  /* Private mutators */

  private startElection() {
    if (this.electionTracker == 3) {
      // Chaos
      const card = this.drawCards(1)[0];
      this.playCard(card, true);
      this.electionTracker = 0;
      return;
    }
    
    this.state = {
      type: 'election',
      presidentElect: this.getNextPresident(true),
      chancellorElect: undefined,
      isSpecial: false,
      votes: this.players.map(_ => null)
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
    if (card == 'Fascist') {
      this.numFascistCards++;
    } else {
      this.numLiberalCards++;
    }
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
}

/* Game Listener */

interface GameListener {
  listener: () => any;
  player: number | 'all';
}