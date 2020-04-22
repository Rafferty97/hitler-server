import { Game } from "./game";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function testGame(game: Game) {
  const p1 = game.addPlayer('ALEX');
  const p2 = game.addPlayer('BOB');
  const p3 = game.addPlayer('CHARLIE');
  const p4 = game.addPlayer('DAVID');
  const p5 = game.addPlayer('EDDIE');
  const players = [p1, p2, p3, p4, p5];
  game.startGame();
  game.players.forEach(p => p.role = 'Liberal');
  game.numLiberalCards = 4;
  game.numFascistCards = 5;
  game.drawPile = ['Liberal', 'Fascist', 'Fascist', 'Fascist', 'Liberal', 'Fascist'];
  game.lastPresidentInTurn = -1;
  players.forEach(p => game.clickNext(p));
  game.choosePlayer(p1, p3);
  players.forEach((p, i) => game.vote(p, i % 2 == 0));
  game.completeVoting();
  game.discardPolicy(p1, 0);
  game.discardPolicy(p3, 1);
  await delay(4000);
  game.endCardReveal();
}