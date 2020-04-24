export type Party = 'Liberal' | 'Fascist';

export type PlayerRole = Party | 'Hitler';

/* Game states */

export type GameState
  = Lobby
  | NightRound
  | Election
  | LegislativeSession
  | CardReveal
  | ExecutiveAction
  | EndGame;

interface Lobby {
  type: 'lobby';
}

interface NightRound {
  type: 'nightRound';
  confirmations: boolean[];
}

interface Election {
  type: 'election';
  presidentElect: number;
  chancellorElect?: number;
  votes: (boolean | null)[];
  voteResult: boolean | null;
  isSpecial: boolean;
}

interface LegislativeSession {
  type: 'legislativeSession';
  president: number;
  chancellor: number;
  turn: 'President' | 'Chancellor' | 'Veto' | 'ChancellorAgain';
  cards: Party[];
  canVeto: boolean;
}

interface CardReveal {
  type: 'cardReveal';
  card: Party | 'Veto';
  chaos: boolean;
}

export type ExecutiveActionType = 'investigate' | 'specialElection' | 'policyPeak' | 'execution';

interface ExecutiveAction {
  type: 'executiveAction';
  action: ExecutiveActionType;
  playerChosen?: number;
}

interface EndGame {
  type: 'end';
  winner: Party;
  winType: 'legislative' | 'hitler';
}

/* Player states */

export interface PlayerState {
  id: string;
  name: string;
  role?: PlayerRole;
  title: PlayerTitle;
  action?: PlayerAction;
  players: PublicPlayer[];
  isDead: boolean;
}

export type PlayerTitle = 'President' | 'Chancellor' | 'President Nominee' | 'Chancellor Nominee' | 'Dead' | '';

export interface PublicPlayer {
  id: string;
  name: string;
  isDead: boolean;
  isConfirmedNotHitler: boolean;
}

export type PlayerAction
  = LobbyAction
  | NightRoundAction
  | ChoosePlayerAction
  | VoteAction
  | LegislativeAction
  | PolicyPeakAction
  | InvestigatePartyAction
  | VetoConsentAction
  | GameOverAction;

interface LobbyAction {
  type: 'lobby';
  canStart: boolean;
}

interface NightRoundAction {
  type: 'nightRound';
  roles?: PlayerRole[];
}

interface ChoosePlayerAction {
  type: 'choosePlayer';
  subtype: 'nominateChancellor' | 'investigate' | 'specialElection' | 'execution';
  players: number[];
}

interface VoteAction {
  type: 'vote';
  president: number;
  chancellor: number;
}

interface LegislativeAction {
  type: 'legislative';
  role: 'President' | 'Chancellor';
  cards: Party[];
  canVeto: boolean;
}

interface PolicyPeakAction {
  type: 'policyPeak';
  cards: Party[];
}

interface InvestigatePartyAction {
  type: 'investigateParty';
  player: number;
  party: Party;
}

interface VetoConsentAction {
  type: 'vetoConsent';
  chancellor: number;
}

interface GameOverAction {
  type: 'gameover';
  winner: Party;
  winType: 'legislative' | 'hitler';
}