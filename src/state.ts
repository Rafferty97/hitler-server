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
  isSpecial: boolean;
}

interface LegislativeSession {
  type: 'legislativeSession';
  president: number;
  chancellor: number;
  turn: 'President' | 'Chancellor' | 'Veto';
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

interface PublicPlayer {
  id: string;
  name: string;
  currLegislativeRole?: 'President' | 'Chancellor';
  prevLegislativeRole?: 'President' | 'Chancellor';
  isDead: boolean;
  isConfirmedNotHitler: boolean;
}

type PlayerAction
  = ChoosePlayerAction
  | VoteAction
  | LegislativeAction;

interface ChoosePlayerAction {
  type: 'choosePlayer';
  subtype: 'nominateChancellor' | 'investigate' | 'specialElection' | 'execute';
  players: string[];
}

interface VoteAction {
  type: 'vote';
  president: string;
  chancellor: string;
}

interface LegislativeAction {
  type: 'legislative';
  role: 'President' | 'Chancellor';
  cards: Party[];
}

interface PolicyPeakAction {
  type: 'policyPeak';
  cards: Party[];
}

interface VetoConsentAction {
  type: 'vetoConsent';
}