import { Game } from "./game";

export async function testGame(game: Game) {
  const p1 = game.addPlayer('ALEX');
  const p2 = game.addPlayer('BOB');
  const p3 = game.addPlayer('CHARLIE');
  const p4 = game.addPlayer('DAVID');
  const p5 = game.addPlayer('EDDIE');
  const players = [p1, p2, p3, p4, p5];
  game.startGame();
  game.numFascistCards = 3;
  game.drawPile = ['Fascist', 'Liberal', 'Fascist', 'Fascist', 'Liberal', 'Fascist'];
  game.lastPresidentInTurn = -1;
  players.forEach(p => game.clickNext(p));
  game.choosePlayer(p1, p3);
  players.forEach((p, i) => game.vote(p, i % 2 == 0));
  await new Promise(r => setTimeout(r, 1000));
  game.completeVoting();
  await new Promise(r => setTimeout(r, 1000));
  game.discardPolicy(p1, 0);
  game.discardPolicy(p3, 1);
  await new Promise(r => setTimeout(r, 4000));
  game.endCardReveal();
  game.choosePlayer(p2, p4);
  players.forEach((p, i) => game.vote(p, true));
  await new Promise(r => setTimeout(r, 2000));
  game.completeVoting();
  game.discardPolicy(p2, 0);
  game.discardPolicy(p4, 0);
  await new Promise(r => setTimeout(r, 4000));
  game.endCardReveal();
}