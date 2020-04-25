import { Party, ExecutiveActionType } from "./types";

export function getShuffledDeck(libCards: number = 0, fasCards: number = 0): Party[] {
  let numLiberals = 6 - libCards;
  let numFascists = 11 - fasCards;
  let deck: Party[] = [];

  while (numLiberals + numFascists > 0) {
    const liberalProb = numLiberals / (numLiberals + numFascists);
    if (Math.random() < liberalProb) {
      deck.push('Liberal');
      numLiberals--;
    } else {
      deck.push('Fascist');
      numFascists--;
    }
  }
  
  return deck;
}

export function getFascistTile(numPlayers: number, index: number): ExecutiveActionType | null {
  type Tile = ExecutiveActionType | null;

  const board1: Tile[] = [null, null, 'policyPeak', 'execution', 'execution', null];
  const board2: Tile[] = [null, 'investigate', 'specialElection', 'execution', 'execution', null];
  const board3: Tile[] = ['investigate', 'investigate', 'specialElection', 'execution', 'execution', null];

  switch (numPlayers) {
    case 5:
    case 6:
      return board1[index];
    case 7:
    case 8:
      return board2[index];
    case 9:
    case 10:
      return board3[index];
    default:
      throw new Error('Invalid number of players.');
  }
}