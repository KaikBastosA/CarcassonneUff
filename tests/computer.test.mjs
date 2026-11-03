import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardSnapshot, renderBoard } from '../src/game/board-state.ts'
import { Worker } from 'node:worker_threads'
import { playerColors } from '../src/game.ts'
import { getFollowerChoices } from '../src/game/actions.ts'
import { GameBoard } from '../src/game/board.ts'
import { applyComputerDecision, scheduleComputerTurn } from '../src/game/computer-turn.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { GameSession, InProgressState } from '../src/game/session.ts'
import { ComputerStrategy, HumanStrategy, decisionView, firstLegalDecision } from '../src/game/strategy.ts'
import { TileInstance, tileCatalog, tileKinds } from '../src/game/tiles.ts'

function boardView(state) { return renderBoard(state.board, state.players) }

function configuration(controls = ['human', 'human', 'computer'], seed = 1, startingPlayerIndex = controls.length - 1) {
  return { players: controls.map((control, index) => ({ name: `Jogador ${index + 1}`, color: playerColors[index], control })), seed, startingPlayerIndex }
}

function start(controls, seed, starter) {
  return GameSession.configure().start(configuration(controls, seed, starter))
}

function scenario(placements, tile, configurePlayers = (players) => players, remaining = []) {
  const base = start()
  const model = placements.reduce((board, [id, kind, rotation, x, y]) => board.place(new TileInstance(id, kind, rotation), new Position(x, y)), new GameBoard())
  const players = configurePlayers(base.snapshot.players)
  const board = boardSnapshot(model, players.flatMap(({ followers }) => followers))
  return new GameSession({
    ...base.snapshot, players, model, board, mesh: new StructureMesh(model, players.flatMap(({ followers }) => followers), players),
    deck: [tile, ...remaining], deckIndex: 0, discarded: [],
  }, new InProgressState(), base.configuration)
}

function choose(match) {
  const view = decisionView(match.snapshot)
  const decision = match.snapshot.players[match.snapshot.currentPlayerIndex].strategy.chooseTurn(structuredClone(view))
  assert.ok(decision)
  return decision
}

test('cada assento recebe sua estratégia e configuração inválida não inicia uma mesa', () => {
  const match = start()
  assert.deepEqual(match.snapshot.players.map(({ strategy }) => strategy.automatic), [false, false, true])
  assert.ok(match.snapshot.players[0].strategy instanceof HumanStrategy)
  assert.ok(match.snapshot.players[2].strategy instanceof ComputerStrategy)
  assert.ok(Object.isFrozen(match.snapshot.players[2].strategy))
  for (const controls of [['invalid', 'computer'], ['human', 'invalid']]) {
    const invalid = GameSession.configure().start(configuration(controls))
    assert.equal(invalid.phase, 'configure')
    assert.ok(invalid.snapshot.message)
    assert.equal(invalid.snapshot.model.size, 0)
  }
  assert.ok(start(['human', 'computer'], 3, 1).computerTurn)
  assert.ok(start(['human', 'human'], 3, 0).humanTurn)
})

test('IA recebe apenas informações públicas e sua escolha não muda se a pilha futura mudar', () => {
  const match = start()
  const state = match.snapshot
  const view = decisionView(state)
  assert.deepEqual(Object.keys(view).sort(), ['difficulty', 'discardedTiles', 'followers', 'placements', 'playerId', 'playerIds', 'remainingTiles', 'tile'])
  const changed = { ...state, seed: 999, deck: [state.deck[0], ...state.deck.slice(1).reverse()] }
  assert.deepEqual(decisionView(changed), view)
  assert.deepEqual(choose(match), choose(match))
  assert.deepEqual(new ComputerStrategy().chooseTurn(decisionView(changed)), choose(match))
  assert.equal(new HumanStrategy().chooseTurn(view), null)
  assert.equal(decisionView(match.newGame().snapshot), null)
})

test('turno automático bloqueia comandos humanos e rejeita decisões inválidas sem alterações parciais', () => {
  const match = start()
  const valid = choose(match)
  for (const operation of [() => match.place(valid.position), () => match.rotate(1), () => match.selectFollower('city'), () => match.undo(), () => match.confirm()]) {
    assert.equal(operation(), match)
  }
  for (const decision of [null, { ...valid, tileId: 'outra' }, { ...valid, rotation: 45 }, { ...valid, position: '0,0' },
    { ...valid, position: '9999,9999' }, { ...valid, position: 'NaN,0' },
    { ...valid, position: { x: NaN, y: 0 } }, { ...valid, position: { x: 0.5, y: 0 } },
    { ...valid, position: { x: 9007199254740992, y: 0 } }, { ...valid, regionId: 'inexistente' }]) {
    assert.equal(match.playComputerTurn(decision), match)
  }
  const after = match.playComputerTurn(valid)
  assert.ok(after.snapshot.deckIndex > match.snapshot.deckIndex)
  assert.equal(after.snapshot.model.size, 2)
  assert.equal(after.snapshot.pendingPosition, null)
  assert.equal(after.snapshot.currentPlayerIndex, 0)
  assert.equal(after.playComputerTurn(valid), after)
  assert.equal(after.snapshot.round, 1)
  assert.equal(match.snapshot.model.size, 1)
})

test('IA considera rotações e ocupa cidade livre que fecha com brasão, recebendo os pontos e o seguidor', () => {
  const match = scenario([
    ['a', 'city-corner', 90, 0, 0], ['b', 'city-corner', 180, 1, 0], ['c', 'city-corner', 270, 1, 1],
  ], new TileInstance('drawn', 'city-corner', 180, 'shield'))
  const decision = choose(match)
  assert.deepEqual(decision, { tileId: 'drawn', position: new Position(0, 1), rotation: 0, regionId: 'city' })
  const after = match.playComputerTurn(decision)
  assert.equal(after.phase, 'finished')
  assert.equal(after.snapshot.players[2].score, 10)
  assert.equal(after.snapshot.players[2].meeples, 7)
  assert.equal(boardView(after.snapshot)['0,1'].variant, 'shield')
  assert.equal(after.snapshot.winners[0].id, after.snapshot.players[2].id)
  assert.equal(after.playComputerTurn(decision), after)
})

test('IA não coloca seguidor em cidade ocupada por humano e evita presenteá-lo quando há alternativa', () => {
  const match = scenario([['a', 'city', 0, 0, 0]], new TileInstance('drawn', 'city'), (players) => players.map((player, index) => index === 0
    ? { ...player, meeples: 6, followers: player.followers.map((follower, index) => index === 0 ? follower.allocate('a', 'city', 'knight') : follower) }
    : player), [new TileInstance('next', 'road')])
  assert.notEqual(choose(match).position.key, '0,-1')
  const illegal = { tileId: 'drawn', position: new Position(0, -1), rotation: 180, regionId: 'city' }
  assert.equal(match.playComputerTurn(illegal), match)
  const legal = match.playComputerTurn({ ...illegal, regionId: null })
  assert.equal(legal.snapshot.players[0].score, 4)
  assert.equal(legal.snapshot.players[0].meeples, 7)
  assert.equal(legal.snapshot.players[2].score, 0)
})

test('IA continua jogando sem seguidores na reserva', () => {
  const placements = Array.from({ length: 7 }, (_, index) => [`m${index}`, 'monastery', 0, index, 0])
  const match = scenario(placements, new TileInstance('drawn', 'road'), (players) => players.map((player, index) => index === 2
    ? { ...player, meeples: 0, followers: player.followers.map((follower, index) => follower.allocate(`m${index}`, 'monastery', 'monk')) }
    : player))
  const decision = choose(match)
  assert.equal(decision.regionId, null)
  assert.equal(match.playComputerTurn(decision).phase, 'finished')
})

test('IA e humano empatados na mesma cidade recebem a pontuação integral sem privilégios', () => {
  const match = scenario([
    ['a', 'city', 0, 0, 0], ['bridge', 'monastery', 0, 1, 0], ['b', 'city', 270, 1, -1],
  ], new TileInstance('drawn', 'city-corner'), (players) => players.map((player, index) => index === 1 ? player : {
    ...player, meeples: 6, followers: player.followers.map((follower, slot) => slot === 0 ? follower.allocate(index === 0 ? 'a' : 'b', 'city', 'knight') : follower),
  }), [new TileInstance('next', 'road')])
  const decision = choose(match)
  assert.equal(decision.position.key, '0,-1')
  assert.equal(decision.rotation, 90)
  assert.notEqual(decision.regionId, 'city')
  const after = match.playComputerTurn(decision)
  assert.equal(after.snapshot.players[0].score, 6)
  assert.equal(after.snapshot.players[2].score, 6)
  assert.equal(after.snapshot.players[0].meeples, 7)
  assert.equal(after.snapshot.players[2].meeples, 7)
})

test('na última compra a IA pode escolher fazendeiro para pontuar cidade já concluída', () => {
  const match = scenario([['a', 'city', 0, 0, 0], ['b', 'city', 180, 0, -1]], new TileInstance('drawn', 'road'))
  const decision = choose(match)
  assert.ok(decision.regionId?.startsWith('field-'))
  const after = match.playComputerTurn(decision)
  assert.equal(after.phase, 'finished')
  assert.equal(after.snapshot.players[2].score, 3)
  assert.ok(after.snapshot.scoring.some(({ terrain, final, points, playerId }) => terrain === 'field' && final && points === 3 && playerId === after.snapshot.players[2].id))
})

test('IA completa a vizinhança de seu mosteiro e recupera o monge', () => {
  const placements = [[0, 0], [0, -1], [1, -1], [1, 0], [-1, 0], [-1, -1], [-1, 1], [0, 1]]
    .map(([x, y], index) => [`m${index}`, 'monastery', 0, x, y])
  const match = scenario(placements, new TileInstance('drawn', 'monastery'), (players) => players.map((player, index) => index === 2 ? {
    ...player, meeples: 6, followers: player.followers.map((follower, slot) => slot === 0 ? follower.allocate('m0', 'monastery', 'monk') : follower),
  } : player), [new TileInstance('next', 'road')])
  const decision = choose(match)
  assert.equal(decision.position.key, '1,1')
  const after = match.playComputerTurn(decision)
  assert.equal(after.snapshot.players[2].score, 9)
  assert.equal(after.snapshot.players[2].followers[0].status, 'reserve')
})

test('descarte mantém a vez da IA e esgotamento encerra sem pedir decisão', () => {
  const match = scenario([['a', 'monastery', 0, 0, 0]], new TileInstance('impossible', 'city-center'), (players) => players, [new TileInstance('playable', 'road')])
  const entered = new InProgressState().enter(match)
  assert.equal(entered.snapshot.discarded[0].id, 'impossible')
  assert.equal(entered.snapshot.currentPlayerIndex, 2)
  assert.equal(choose(entered).tileId, 'playable')
  const finished = entered.playComputerTurn(choose(entered))
  assert.equal(finished.phase, 'finished')
  assert.equal(finished.computerTurn, false)
  assert.equal(decisionView(finished.snapshot), null)
  const exhausted = new InProgressState().enter(scenario([['a', 'monastery', 0, 0, 0]], new TileInstance('impossible', 'city-center')))
  assert.equal(exhausted.phase, 'finished')
})

test('nova partida conserva os controles e limpa tabuleiro, seguidores e decisões anteriores', () => {
  const match = start()
  const decision = choose(match)
  const next = match.playComputerTurn(decision).newGame()
  assert.deepEqual(next.configuration.players.map(({ control }) => control), ['human', 'human', 'computer'])
  assert.equal(next.snapshot.model.size, 0)
  assert.equal(next.playComputerTurn(decision), next)
  assert.ok(next.snapshot.players.every(({ meeples, score }) => meeples === 7 && score === 0))
})

test('partidas mistas completas respeitam turnos, inventário, reservas e pontuação com até quatro IAs', () => {
  for (const [controls, seed, starter] of [
    [['human', 'human', 'computer'], 7, 2],
    [['human', 'computer'], 41, 0],
    [['computer', 'human', 'computer', 'computer', 'computer'], 89, 4],
  ]) {
    let match = start(controls, seed, starter)
    let turns = 0
    let automaticTurns = 0
    while (match.phase !== 'finished') {
      const before = match.snapshot
      if (match.computerTurn) {
        match = match.playComputerTurn(choose(match))
        automaticTurns++
      } else {
        const move = before.model.getValidMoves(before.deck[before.deckIndex])[(turns * 17) % before.model.getValidMoves(before.deck[before.deckIndex]).length]
        while (match.snapshot.rotation !== move.tile.rotation) match = match.rotate(1)
        match = match.place(move.position)
        const choice = getFollowerChoices(match.snapshot).find(({ available }) => available)
        if (choice && turns % 3 !== 0) match = match.selectFollower(choice.id)
        if (turns % 5 === 0) {
          match = match.undo()
          assert.deepEqual(match.snapshot.model.placements, before.model.placements)
          assert.deepEqual(match.snapshot.players, before.players)
          match = match.place(move.position)
        }
        match = match.confirm()
      }
      const after = match.snapshot
      assert.ok(after.deckIndex > before.deckIndex)
      assert.equal(after.model.size, before.model.size + 1)
      if (after.winners.length === 0) assert.equal(after.currentPlayerIndex, (before.currentPlayerIndex + 1) % controls.length)
      assert.equal(after.pendingPosition, null)
      const tiles = [...after.model.placements.map(({ tile }) => tile), ...after.discarded, ...after.deck.slice(after.deckIndex)]
      assert.equal(tiles.length, 72)
      assert.equal(new Set(tiles.map(({ id }) => id)).size, 72)
      assert.equal(tiles.reduce((total, tile) => total + tile.shields, 0), 3)
      for (const kind of tileKinds) assert.equal(tiles.filter((tile) => tile.kind === kind).length, tileCatalog[kind].quantity)
      for (const player of after.players) {
        assert.equal(player.followers.length, 7)
        assert.equal(player.meeples, player.followers.filter(({ status }) => status === 'reserve').length)
        assert.equal(player.score, after.scoring.filter(({ playerId }) => playerId === player.id).reduce((sum, record) => sum + record.points, 0))
      }
      assert.equal(new Set(after.scoring.map(({ structureId, playerId }) => `${structureId}:${playerId}`)).size, after.scoring.length)
      assert.ok(++turns <= 71)
    }
    assert.ok(automaticTurns > 0)
    assert.ok(match.snapshot.players.every(({ meeples }) => meeples === 7))
    const maximum = Math.max(...match.snapshot.players.map(({ score }) => score))
    assert.deepEqual(match.snapshot.winners, match.snapshot.players.filter(({ score }) => score === maximum))
  }
})

function workerStub() {
  return { onmessage: null, onerror: null, terminated: false, view: null,
    terminate() { this.terminated = true }, postMessage(view) { this.view = structuredClone(view) },
  }
}

test('agendamento cancela antes de iniciar e ignora respostas após cancelamento', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const match = start()
  const worker = workerStub()
  let creations = 0
  const completed = []
  const create = () => { creations++; return worker }
  const cancelBefore = scheduleComputerTurn(match, (decision) => completed.push(decision), create)
  cancelBefore()
  context.mock.timers.tick(450)
  assert.equal(creations, 0)
  const cancelAfter = scheduleComputerTurn(match, (decision) => completed.push(decision), create)
  context.mock.timers.tick(450)
  assert.equal(creations, 1)
  cancelAfter()
  assert.ok(worker.terminated)
  worker.onmessage({ data: choose(match) })
  context.mock.timers.tick(10000)
  assert.deepEqual(completed, [])
})

test('resposta duplicada é aplicada uma vez e só o turno automático cria worker', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const match = start()
  const worker = workerStub()
  const completed = []
  scheduleComputerTurn(match, (decision) => completed.push(decision), () => worker)
  context.mock.timers.tick(450)
  const decision = choose(match)
  worker.onmessage({ data: decision })
  worker.onmessage({ data: decision })
  context.mock.timers.tick(10000)
  assert.deepEqual(completed, [decision])
  assert.ok(worker.terminated)
  const human = start(['human', 'computer'], 1, 0)
  scheduleComputerTurn(human, () => assert.fail('não deve jogar'), () => assert.fail('não deve criar worker'))
  scheduleComputerTurn(match.newGame(), () => assert.fail('não deve jogar'), () => assert.fail('não deve criar worker'))
  context.mock.timers.tick(450)
})

test('falha, indisponibilidade ou timeout do worker usam uma jogada legal sem seguidor', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const match = start()
  for (const failure of ['unavailable', 'error', 'timeout', 'empty']) {
    const worker = workerStub()
    const completed = []
    scheduleComputerTurn(match, (decision) => completed.push(decision), () => {
      if (failure === 'unavailable') throw new Error('Worker indisponível')
      return worker
    })
    context.mock.timers.tick(450)
    if (failure === 'error') worker.onerror({ preventDefault() {} })
    if (failure === 'empty') worker.onmessage({ data: null })
    context.mock.timers.tick(10000)
    assert.equal(completed.length, 1)
    assert.equal(completed[0].regionId, null)
    assert.notEqual(match.playComputerTurn(completed[0]), match)
    assert.deepEqual(completed[0], firstLegalDecision(decisionView(match.snapshot)))
  }
})

test('aplicação rejeita resposta de outra sessão e usa alternativa legal para resposta inválida', () => {
  const match = start()
  const decision = choose(match)
  const restarted = match.newGame().start(configuration())
  assert.equal(restarted.snapshot.deck[0].id, match.snapshot.deck[0].id)
  assert.equal(applyComputerDecision(restarted, match, decision), restarted)
  const applied = applyComputerDecision(match, match, decision)
  assert.equal(applyComputerDecision(applied, match, decision), applied)
  const fallback = applyComputerDecision(match, match, { ...decision, position: '0,0' })
  assert.equal(fallback.snapshot.model.size, 2)
  assert.equal(fallback.snapshot.pendingPosition, null)
})

test('montar, limpar e remontar o agendamento como no StrictMode executa somente um turno', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const initial = start()
  let current = initial
  const workers = []
  const create = () => { const worker = workerStub(); workers.push(worker); return worker }
  const complete = (decision) => { current = applyComputerDecision(current, initial, decision) }
  const cleanup = scheduleComputerTurn(initial, complete, create)
  context.mock.timers.tick(450)
  cleanup()
  scheduleComputerTurn(initial, complete, create)
  context.mock.timers.tick(450)
  const decision = choose(initial)
  workers[0].onmessage({ data: decision })
  workers[1].onmessage({ data: decision })
  workers[1].onmessage({ data: decision })
  assert.equal(current.snapshot.model.size, 2)
  assert.equal(current.snapshot.deckIndex, 1)
  assert.equal(current.snapshot.currentPlayerIndex, 0)
})

test('worker de produção recebe dados serializados e retorna uma decisão válida para a sessão', async () => {
  const workerURL = new URL('../src/game/computer.worker.ts', import.meta.url)
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads')
    globalThis.self = { postMessage: (data) => parentPort.postMessage(data) }
    import(${JSON.stringify(workerURL.href)}).then(() => parentPort.on('message', (data) => self.onmessage({ data })))
  `, { eval: true })
  try {
    const match = start()
    const response = new Promise((resolve, reject) => {
      worker.once('message', resolve)
      worker.once('error', reject)
    })
    worker.postMessage(decisionView(match.snapshot))
    const decision = await response
    assert.deepEqual(decision, structuredClone(choose(match)))
    assert.notEqual(match.playComputerTurn(decision), match)
  } finally {
    await worker.terminate()
  }
})

test('mesas de duas ou cinco IAs avançam pelo agendamento até o fim sem ações humanas', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  for (const count of [2, 5]) {
    let current = start(Array(count).fill('computer'), 23, count - 1)
    let turns = 0
    while (current.phase !== 'finished') {
      const expected = current
      const before = current.snapshot
      assert.ok(current.computerTurn)
      assert.equal(current.place('0,0'), current)
      assert.equal(current.confirm(), current)
      const worker = workerStub()
      const cleanup = scheduleComputerTurn(expected, (decision) => {
        current = applyComputerDecision(current, expected, decision)
      }, () => worker)
      context.mock.timers.tick(450)
      worker.onmessage({ data: choose(expected) })
      cleanup()
      const after = current.snapshot
      assert.ok(worker.terminated)
      assert.ok(after.deckIndex > before.deckIndex)
      assert.equal(after.model.size, before.model.size + 1)
      if (after.winners.length === 0) assert.equal(after.currentPlayerIndex, (before.currentPlayerIndex + 1) % count)
      assert.equal(after.pendingPosition, null)
      const inventory = [...after.model.placements.map(({ tile }) => tile), ...after.discarded, ...after.deck.slice(after.deckIndex)]
      assert.equal(inventory.length, 72)
      assert.equal(new Set(inventory.map(({ id }) => id)).size, 72)
      assert.equal(inventory.reduce((sum, tile) => sum + tile.shields, 0), 3)
      assert.ok(++turns <= 71)
    }
    assert.ok(current.snapshot.winners.length > 0)
    for (const player of current.snapshot.players) {
      assert.equal(player.meeples, 7)
      assert.equal(player.score, current.snapshot.scoring.filter(({ playerId }) => playerId === player.id).reduce((sum, record) => sum + record.points, 0))
    }
    scheduleComputerTurn(current, () => assert.fail('partida encerrada'), () => assert.fail('worker após o fim'))
    context.mock.timers.tick(10000)
    const fresh = current.newGame()
    assert.equal(fresh.phase, 'configure')
    assert.ok(fresh.configuration.players.every(({ control }) => control === 'computer'))
    assert.ok(fresh.start().computerTurn)
  }
})

test('o comando automático sem argumento calcula a estratégia do assento e mantém a decisão equivalente', () => {
  const match = start(['computer', 'computer'], 5, 0)
  const explicit = match.playComputerTurn(choose(match))
  const automatic = match.playComputerTurn()
  assert.deepEqual(automatic.snapshot.model.placements, explicit.snapshot.model.placements)
  assert.deepEqual(automatic.snapshot.players, explicit.snapshot.players)
  assert.equal(automatic.snapshot.deckIndex, explicit.snapshot.deckIndex)
  assert.equal(automatic.snapshot.currentPlayerIndex, explicit.snapshot.currentPlayerIndex)
  assert.equal(match.snapshot.model.size, 1)
})
