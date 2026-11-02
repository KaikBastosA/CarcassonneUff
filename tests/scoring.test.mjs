import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGame } from '../src/game.ts'
import { confirmGameTurn, getFollowerChoices, placeGameTile, selectGameFollower, undoGamePlacement } from '../src/game/actions.ts'
import { GameBoard } from '../src/game/board.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { applyScores, calculateScores, determineWinners, finalizeGame } from '../src/game/scoring.ts'
import { City } from '../src/game/structures.ts'
import { TileInstance } from '../src/game/tiles.ts'

function gameOf(placements, allocations = [], pending = false) {
  let model = new GameBoard()
  let previousBoard = null
  const board = {}
  for (const [x, y, kind, rotation = 0] of placements) {
    previousBoard = model
    model = model.place(new TileInstance(`${x},${y}`, kind, rotation), new Position(x, y))
    board[`${x},${y}`] = { kind, rotation }
  }
  const players = initialGame.players.map((player) => ({ ...player, followers: [...player.followers] }))
  for (const [owner, index, tileId, regionId, role] of allocations) {
    const player = players[owner]
    player.followers[index] = player.followers[index].allocate(tileId, regionId, role)
    board[tileId] = { ...board[tileId], meeple: player.color, meepleRegion: regionId }
  }
  for (const player of players) player.meeples = player.followers.filter((follower) => follower.status === 'reserve').length
  const [x, y, currentKind, rotation = 0] = placements.at(-1)
  return {
    ...initialGame, players, board, model,
    mesh: new StructureMesh(model, players.flatMap((player) => player.followers)),
    phase: pending ? 'meeple' : 'place', pendingPosition: pending ? `${x},${y}` : null,
    previousBoard: pending ? previousBoard : null, currentKind, rotation,
  }
}

const roadLoop = [[0, 0, 'curve', 270], [1, 0, 'curve'], [1, 1, 'curve', 90], [0, 1, 'curve', 180]]

test('cidades completas valem dois pontos por cartela e brasão; incompletas valem um no fim', () => {
  const complete = gameOf([[0, 0, 'city'], [0, -1, 'city', 180]])
  const city = complete.mesh.structureAt('0,0', 'city')
  assert.equal(city.score(false), 4)
  assert.equal(city.score(true), 4)
  const incomplete = gameOf([[0, 0, 'city']]).mesh.structureAt('0,0', 'city')
  assert.equal(incomplete.score(false), 0)
  assert.equal(incomplete.score(true), 1)
  const regions = city.regions.map((node, index) => ({ ...node, region: { ...node.region, shields: index === 0 ? 1 : 0 } }))
  const data = { id: 'city', regions, followers: [], openEdges: 0, surroundingCount: 0, adjacentCityIds: [], completedCityCount: 0 }
  assert.equal(new City(data).score(false), 6)
  assert.equal(new City({ ...data, openEdges: 1 }).score(true), 3)
})

test('uma cartela com duas regiões na mesma cidade conta uma única vez para pontuar', () => {
  const state = gameOf([
    [0, 0, 'city-sides'], [0, -1, 'city-corner', 90], [1, -1, 'city-center'], [2, -1, 'city-corner', 180],
    [0, 1, 'city-corner'], [1, 1, 'city-center'], [2, 1, 'city-corner', 270], [2, 0, 'city-center'],
  ])
  const city = state.mesh.structureAt('0,0', 'city-north')
  assert.equal(city.regions.length, 9)
  assert.equal(city.tileIds.length, 8)
  assert.equal(city.score(true), 8)
})

test('estradas completas e incompletas usam o número de cartelas distintas', () => {
  const loop = gameOf(roadLoop).mesh.structureAt('0,0', 'road')
  assert.equal(loop.score(false), 4)
  assert.equal(loop.score(true), 4)
  const open = gameOf([[0, 0, 'road'], [0, 1, 'road']]).mesh.structureAt('0,0', 'road')
  assert.equal(open.score(false), 0)
  assert.equal(open.score(true), 2)
})

test('mosteiros pontuam nove quando completos e a vizinhança existente no fim', () => {
  const positions = [[0, 0], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]]
  const partial = gameOf(positions.slice(0, 4).map(([x, y]) => [x, y, 'monastery']))
  assert.equal(partial.mesh.structureAt('0,0', 'monastery').score(false), 0)
  assert.equal(partial.mesh.structureAt('0,0', 'monastery').score(true), 4)
  const complete = gameOf(positions.map(([x, y]) => [x, y, 'monastery']))
  assert.equal(complete.mesh.structureAt('0,0', 'monastery').score(false), 9)
})

test('campos pontuam apenas cidades completas e só na apuração final', () => {
  const incomplete = gameOf([[0, 0, 'city']]).mesh.structureAt('0,0', 'field')
  assert.equal(incomplete.completedCityCount, 0)
  assert.equal(incomplete.score(true), 0)
  const state = gameOf([[0, 0, 'city'], [0, -1, 'city', 180]])
  const field = state.mesh.structureAt('0,0', 'field')
  assert.equal(field.completedCityCount, 1)
  assert.equal(field.score(false), 0)
  assert.equal(field.score(true), 3)
  assert.deepEqual(calculateScores([field], false), [])
})

test('confirmar pontua uma cidade e devolve o cavaleiro escolhido na própria jogada', () => {
  const pending = selectGameFollower(placeGameTile({ ...initialGame, currentKind: 'city', rotation: 180 }, '0,-1'), 'city')
  assert.equal(pending.players[0].score, 0)
  assert.equal(pending.players[0].meeples, 6)
  const confirmed = confirmGameTurn(pending)
  assert.equal(confirmed.players[0].score, 4)
  assert.equal(confirmed.players[0].meeples, 7)
  assert.equal(confirmed.board['0,-1'].meeple, undefined)
  assert.equal(confirmed.phase, 'place')
  assert.equal(confirmed.currentPlayerIndex, 1)
  assert.ok(confirmed.activity.some((event) => event.points === 4 && event.playerId === 'you'))
  assert.equal(confirmGameTurn(confirmed), confirmed)
  assert.equal(pending.players[0].score, 0)
  assert.equal(pending.mesh.structureAt('tile-0', 'city').followers.length, 1)
})

test('desfazer antes da confirmação não atribui pontos nem registra apuração', () => {
  const pending = selectGameFollower(placeGameTile({ ...initialGame, currentKind: 'city', rotation: 180 }, '0,-1'), 'city')
  const undone = undoGamePlacement(pending)
  assert.equal(undone.players[0].score, 0)
  assert.equal(undone.players[0].meeples, 7)
  assert.deepEqual(undone.scoring, [])
  assert.deepEqual(undone.activity, [])
})

test('empates dão o valor integral a todos os líderes e devolvem todos os seguidores', () => {
  const state = gameOf(roadLoop, [[0, 0, '0,0', 'road', 'thief'], [1, 0, '1,1', 'road', 'thief']], true)
  const confirmed = confirmGameTurn(state)
  assert.equal(confirmed.players[0].score, 4)
  assert.equal(confirmed.players[1].score, 4)
  assert.equal(confirmed.players[0].meeples, 7)
  assert.equal(confirmed.players[1].meeples, 7)
  assert.ok(confirmed.mesh.structures.every((structure) => structure.followers.length === 0))
})

test('a minoria não recebe pontos, mas também recupera seus seguidores', () => {
  const state = gameOf(roadLoop, [
    [0, 0, '0,0', 'road', 'thief'], [0, 1, '1,0', 'road', 'thief'], [1, 0, '1,1', 'road', 'thief'],
  ], true)
  const confirmed = confirmGameTurn(state)
  assert.equal(confirmed.players[0].score, 4)
  assert.equal(confirmed.players[1].score, 0)
  assert.equal(confirmed.players[0].meeples, 7)
  assert.equal(confirmed.players[1].meeples, 7)
})

test('uma jogada pontua estrada e cidade de donos diferentes e mantém o fazendeiro', () => {
  const state = gameOf([
    [0, 0, 'road-end', 270], [0, -1, 'monastery'], [1, -1, 'city', 180],
    [2, -1, 'monastery'], [2, 0, 'road-end', 90], [1, 0, 'city-road'],
  ], [[0, 0, '0,0', 'road', 'thief'], [1, 0, '1,-1', 'city', 'knight']], true)
  const pending = selectGameFollower({ ...state, currentPlayerIndex: 2 }, 'field-south')
  const confirmed = confirmGameTurn(pending)
  assert.deepEqual(confirmed.players.map(({ score }) => score), [3, 4, 0, 0])
  assert.deepEqual(confirmed.players.map(({ meeples }) => meeples), [7, 7, 6, 7])
  assert.equal(confirmed.board['1,0'].meepleRegion, 'field-south')
  assert.equal(confirmed.players[2].followers[0].role, 'farmer')
})

test('completar o mosteiro de outro jogador pontua para o dono e não para quem colocou', () => {
  const positions = [[0, 0], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]]
  const state = gameOf(positions.map(([x, y]) => [x, y, 'monastery']), [[0, 0, '0,0', 'monastery', 'monk']], true)
  const confirmed = confirmGameTurn({ ...state, currentPlayerIndex: 1 })
  assert.equal(confirmed.players[0].score, 9)
  assert.equal(confirmed.players[1].score, 0)
  assert.equal(confirmed.players[0].meeples, 7)
  assert.equal(confirmed.board['0,0'].meeple, undefined)
})

test('apurar duas vezes a mesma estrutura não repete pontos nem eventos', () => {
  const state = gameOf(roadLoop, [[0, 0, '0,0', 'road', 'thief']])
  const records = calculateScores(state.mesh.structures, false)
  const scored = applyScores(state, [...records, ...records])
  assert.equal(scored.players[0].score, 4)
  assert.equal(applyScores(scored, records), scored)
  assert.deepEqual(calculateScores(state.mesh.structures, false, records), [])
  assert.equal(new Set(scored.activity.map(({ id }) => id)).size, scored.activity.length)
})

test('uma estrutura sem dono não dá pontos, e estruturas abertas não são apuradas antes do fim', () => {
  const closed = gameOf([[0, 0, 'city'], [0, -1, 'city', 180]], [], true)
  const confirmed = confirmGameTurn(closed)
  assert.ok(confirmed.players.every((player) => player.score === 0))
  const open = gameOf([[0, 0, 'road']], [[0, 0, '0,0', 'road', 'thief']])
  assert.deepEqual(calculateScores(open.mesh.structures, false), [])
  assert.equal(open.players[0].meeples, 6)
})

test('a cidade já pontuada continua contando para seu campo no fim, sem pontuar a cidade de novo', () => {
  const state = gameOf([[0, 0, 'city'], [0, -1, 'city', 180]], [
    [0, 0, '0,-1', 'city', 'knight'], [1, 0, '0,0', 'field', 'farmer'],
  ], true)
  const confirmed = confirmGameTurn(state)
  assert.deepEqual(confirmed.players.map(({ score }) => score), [4, 0, 0, 0])
  assert.equal(confirmed.players[1].meeples, 6)
  const final = finalizeGame({ ...confirmed, deckIndex: confirmed.deck.length })
  assert.deepEqual(final.players.map(({ score }) => score), [4, 3, 0, 0])
  assert.equal(final.players[1].meeples, 7)
  assert.equal(final.phase, 'finished')
  assert.equal(finalizeGame(final), final)
  assert.deepEqual(final.winners, ['you'])
})

test('a última jogada pontua completas antes da apuração final e bloqueia novas ações', () => {
  const pending = selectGameFollower(placeGameTile({ ...initialGame, currentKind: 'city', rotation: 180 }, '0,-1'), 'city')
  const final = confirmGameTurn({ ...pending, deck: ['city'] })
  assert.equal(final.phase, 'finished')
  assert.equal(final.players[0].score, 4)
  assert.equal(final.deckIndex, 1)
  assert.equal(final.players[0].meeples, 7)
  assert.deepEqual(final.winners, ['you'])
  assert.equal(confirmGameTurn(final), final)
  assert.equal(placeGameTile(final, '1,0'), final)
  assert.equal(selectGameFollower(final, 'city'), final)
  assert.equal(undoGamePlacement(final), final)
  assert.deepEqual(getFollowerChoices(final), [])
})

test('a apuração final aguarda o fim da pilha e a confirmação da última peça', () => {
  assert.equal(finalizeGame(initialGame), initialGame)
  const pending = placeGameTile(initialGame, '0,-1')
  assert.equal(finalizeGame({ ...pending, deckIndex: pending.deck.length }).phase, 'meeple')
})

test('a apuração final inclui estradas, cidades e mosteiros incompletos', () => {
  const state = gameOf([
    [0, 0, 'city-road'], [0, 1, 'monastery'], [1, 0, 'road', 90],
  ], [[0, 0, '0,0', 'city', 'knight'], [1, 0, '0,1', 'monastery', 'monk'], [2, 0, '1,0', 'road', 'thief']])
  const final = finalizeGame({ ...state, deckIndex: state.deck.length })
  assert.deepEqual(final.players.map(({ score }) => score), [1, 3, 2, 0])
  assert.ok(final.players.every((player) => player.meeples === 7))
})

test('todos os empatados no placar final são vencedores, inclusive num jogo sem pontos', () => {
  assert.deepEqual(determineWinners([]), [])
  assert.deepEqual(determineWinners(initialGame.players), ['you', 'ana', 'bruno', 'carla'])
  const final = finalizeGame({ ...initialGame, deckIndex: initialGame.deck.length })
  assert.deepEqual(final.winners, ['you', 'ana', 'bruno', 'carla'])
  assert.ok(final.message.includes('Empate'))
})

test('a primeira cidade dupla da sequência permite fechar e pontuar sua cidade inferior', () => {
  const pending = selectGameFollower(placeGameTile(initialGame, '0,-1'), 'city-south')
  assert.equal(pending.players[0].score, 0)
  assert.equal(pending.players[0].meeples, 6)
  const confirmed = confirmGameTurn(pending)
  assert.equal(confirmed.players[0].score, 4)
  assert.equal(confirmed.players[0].meeples, 7)
  assert.equal(confirmed.currentKind, 'curve')
  assert.equal(confirmed.board['0,-1'].meeple, undefined)
  const unfinished = confirmGameTurn(selectGameFollower(placeGameTile(initialGame, '0,-1'), 'city-north'))
  assert.equal(unfinished.players[0].score, 0)
  assert.equal(unfinished.players[0].meeples, 6)
})

test('fazendeiros empatados recebem três pontos por cidade completa única', () => {
  const state = gameOf([
    [0, 0, 'city'], [0, -1, 'city', 180], [1, 0, 'monastery'], [1, -1, 'monastery'],
  ], [[0, 0, '0,0', 'field', 'farmer'], [1, 0, '0,-1', 'field', 'farmer']])
  const field = state.mesh.structureAt('0,0', 'field')
  assert.equal(field, state.mesh.structureAt('0,-1', 'field'))
  assert.equal(field.adjacentCityIds.length, 1)
  assert.equal(field.completedCityCount, 1)
  const final = finalizeGame({ ...state, deckIndex: state.deck.length })
  assert.deepEqual(final.players.map(({ score }) => score), [3, 3, 0, 0])
  assert.deepEqual(final.winners, ['you', 'ana'])
})

test('dois campos separados podem pontuar a mesma cidade; campos sem cidade completa valem zero', () => {
  const state = gameOf([[0, 0, 'city'], [0, -1, 'city', 180]], [
    [0, 0, '0,0', 'field', 'farmer'], [0, 1, '0,-1', 'field', 'farmer'],
  ])
  const final = finalizeGame({ ...state, deckIndex: state.deck.length })
  assert.equal(final.players[0].score, 6)
  const emptyField = gameOf([[0, 0, 'monastery']], [[0, 0, '0,0', 'field', 'farmer']])
  const noPoints = finalizeGame({ ...emptyField, deckIndex: emptyField.deck.length })
  assert.equal(noPoints.players[0].score, 0)
  assert.equal(noPoints.players[0].meeples, 7)
})
