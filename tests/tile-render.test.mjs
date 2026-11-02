import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { rotations, tileKinds, TileInstance } from '../src/game/tiles.ts'
import { finalizeGame } from '../src/game/scoring.ts'
import { GameSession } from '../src/game/session.ts'
import { initialGame, withTile } from './helpers/game.mjs'
import { confirmGameTurn as settleTurn, getFollowerChoices, placeGameTile, selectGameFollower } from '../src/game/actions.ts'

test('a rotação visual usa a mesma imagem desde a primeira volta e acompanha o ângulo selecionado', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: Tile } = await server.ssrLoadModule('/src/components/Tile.tsx')
    for (const kind of tileKinds) {
      let source
      for (let turn = 0; turn < 8; turn++) {
        const rotation = rotations[turn % rotations.length]
        const markup = renderToStaticMarkup(createElement(Tile, { kind, rotation, meeple: 'blue' }))
        const image = markup.match(/<img class="tile-art"[^>]*>/)?.[0]
        assert.ok(image, kind)
        const currentSource = image.match(/src="([^"]+)"/)?.[1]
        assert.ok(currentSource?.endsWith('0.webp'), `${kind} ${rotation}`)
        source ??= currentSource
        assert.equal(currentSource, source, `${kind} ${rotation}`)
        assert.ok(image.includes(`transform:rotate(${rotation}deg)`), `${kind} ${rotation}`)
        assert.ok(markup.includes('class="tile-meeple"'), kind)
      }
    }
  } finally {
    await server.close()
  }
})

test('o painel mostra regiões selecionáveis e o fazendeiro é desenhado na região escolhida', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: Tile } = await server.ssrLoadModule('/src/components/Tile.tsx')
    const { default: TurnPanel } = await server.ssrLoadModule('/src/components/TurnPanel.tsx')
    const state = selectGameFollower(placeGameTile(withTile(initialGame, 'road', 90), '1,0'), 'field-east')
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: state.players[0], phase: state.phase, kind: state.deck[state.deckIndex].kind, rotation: state.rotation,
      deckCount: 18, discardedCount: 0, pendingMeeple: true, followerChoices: getFollowerChoices(state), message: '',
      validCount: 0, unfillableCount: 0, onRotate() {}, onSelectFollower() {}, onUndo() {}, onConfirm() {},
    }))
    assert.ok(markup.includes('Região do seguidor'))
    assert.ok(markup.includes('Cavaleiro') === false)
    assert.ok(markup.includes('Fazendeiro'))
    assert.ok(markup.includes('Ladrão'))
    assert.ok(markup.includes('aria-pressed="true"'))
    assert.ok(markup.includes('Remover seguidor'))
    const tile = renderToStaticMarkup(createElement(Tile, state.board['1,0']))
    assert.ok(tile.includes('left:50%'))
    assert.ok(tile.includes('top:80%'))
    assert.ok(tile.includes('translate(-50%, -50%) rotate(90deg)'))
  } finally {
    await server.close()
  }
})

test('o painel final apresenta o vencedor e o placar sem oferecer outra jogada', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: TurnPanel } = await server.ssrLoadModule('/src/components/TurnPanel.tsx')
    const pending = selectGameFollower(placeGameTile(initialGame, '0,-1'), 'city-south')
    const final = finalizeGame(settleTurn({ ...pending, deck: [pending.deck[0]] }))
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: final.players[0], phase: final.phase, kind: final.deck.at(-1).kind, rotation: final.rotation,
      deckCount: 0, discardedCount: 0, pendingMeeple: false, followerChoices: [], message: final.message,
      validCount: 0, unfillableCount: 0, standings: final.players, winners: final.winners,
      onRotate() {}, onSelectFollower() {}, onUndo() {}, onConfirm() {},
    }))
    assert.ok(markup.includes('Pontuação final'))
    assert.ok(markup.includes('Você · Vencedor'))
    assert.ok(markup.includes('4 pts'))
    assert.ok(!markup.includes('Confirmar jogada'))
    assert.ok(!markup.includes('Girar peça'))
  } finally {
    await server.close()
  }
})

test('a aplicação começa na configuração e o quinto jogador recebe meeple verde', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  const previousDocument = globalThis.document
  try {
    globalThis.document = { documentElement: { dataset: { theme: 'light' } } }
    const { default: App } = await server.ssrLoadModule('/src/App.tsx')
    const markup = renderToStaticMarkup(createElement(App))
    assert.ok(markup.includes('Configurar partida'))
    assert.ok(markup.includes('Iniciar partida'))
    assert.ok(markup.includes('Quem começa'))
    assert.ok(!markup.includes('<canvas'))
    const { default: Meeple } = await server.ssrLoadModule('/src/components/Meeple.tsx')
    const green = renderToStaticMarkup(createElement(Meeple, { color: 'green' }))
    assert.ok(green.includes('meeple_road_blue.webp'))
    assert.ok(green.includes('hue-rotate(-90deg)'))
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
    await server.close()
  }
})

test('o brasão aparece na região da cidade e gira com a arte sem cobrir o seguidor', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: Tile } = await server.ssrLoadModule('/src/components/Tile.tsx')
    const { default: TurnPanel } = await server.ssrLoadModule('/src/components/TurnPanel.tsx')
    const { shieldImage } = await server.ssrLoadModule('/src/tiles.ts')
    for (const kind of ['city-corner', 'city-center']) for (const rotation of rotations) {
      const tile = new TileInstance('view', kind, rotation, 'shield')
      const anchor = tile.shieldMarkers[0]
      const markup = renderToStaticMarkup(createElement(Tile, { kind, rotation, variant: 'shield', meeple: 'blue', meepleRegion: 'city' }))
      const icon = markup.match(/<img class="tile-shield"[^>]*>/)?.[0]
      assert.ok(icon, markup)
      assert.equal(icon.match(/src="([^"]+)"/)?.[1].replaceAll('&#x27;', "'").replaceAll('&amp;', '&'), shieldImage)
      assert.ok(icon.includes('alt="Brasão"'))
      assert.ok(icon.includes(`left:${anchor.x * 100}%`))
      assert.ok(icon.includes(`top:${anchor.y * 100}%`))
      assert.ok(icon.includes(`rotate(${rotation}deg)`))
      const follower = tile.regions.find(({ id }) => id === 'city').anchor
      assert.ok(Math.hypot(anchor.x - follower.x, anchor.y - follower.y) > 0.26)
      const plain = renderToStaticMarkup(createElement(Tile, { kind, rotation }))
      assert.ok(!plain.includes('class="tile-shield"'))
    }
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: initialGame.players[0], phase: 'place', kind: 'city-corner', variant: 'shield', rotation: 0,
      deckCount: 5, discardedCount: 0, pendingMeeple: false, followerChoices: [], message: '',
      validCount: 1, unfillableCount: 0, standings: [], winners: [],
      onRotate() {}, onSelectFollower() {}, onUndo() {}, onConfirm() {},
    }))
    assert.ok(markup.includes('Cidade em curva com brasão'))
    assert.ok(markup.includes('class="tile-shield"'))
  } finally {
    await server.close()
  }
})

test('configuração distingue humanos e IA e o painel bloqueia ações durante o turno automático', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: GameSetup } = await server.ssrLoadModule('/src/components/GameSetup.tsx')
    const { default: TurnPanel } = await server.ssrLoadModule('/src/components/TurnPanel.tsx')
    const configuration = {
      players: [{ name: 'Um', color: 'blue', control: 'human' }, { name: 'Dois', color: 'red', control: 'human' }, { name: 'Robô', color: 'yellow', control: 'computer' }],
      startingPlayerIndex: 2, seed: 1,
    }
    const setup = renderToStaticMarkup(createElement(GameSetup, { configuration, message: '', onStart() {} }))
    assert.ok(setup.includes('Controle do jogador 3'))
    assert.equal((setup.match(/<option value="computer" selected="">IA<\/option>/g) ?? []).length, 1)
    assert.equal((setup.match(/<option value="human" selected="">Humano<\/option>/g) ?? []).length, 2)
    const match = GameSession.configure().start(configuration)
    for (const phase of ['place', 'meeple']) {
      const markup = renderToStaticMarkup(createElement(TurnPanel, {
        player: match.snapshot.players[2], phase, kind: match.snapshot.deck[0].kind, rotation: 0,
        deckCount: 70, discardedCount: 0, pendingMeeple: false, followerChoices: [], message: '',
        validCount: 0, unfillableCount: 0, standings: [], winners: [],
        onRotate() {}, onSelectFollower() {}, onUndo() {}, onConfirm() {},
      }))
      assert.ok(markup.includes('Robô · IA'))
      assert.ok(markup.includes('IA pensando…'))
      assert.equal((markup.match(/disabled="" aria-label="Girar peça/g) ?? []).length, 2)
      assert.ok(!markup.includes('Confirmar jogada'))
      assert.ok(!markup.includes('Desfazer colocação'))
    }
  } finally {
    await server.close()
  }
})

test('dificuldade é escolhida para cada IA e identificada no painel', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
  try {
    const { default: GameSetup } = await server.ssrLoadModule('/src/components/GameSetup.tsx')
    const { default: TurnPanel } = await server.ssrLoadModule('/src/components/TurnPanel.tsx')
    const configuration = {
      players: [{ name: 'Humano', color: 'blue', control: 'human' },
        { name: 'IA um', color: 'red', control: 'computer', difficulty: 'basic' },
        { name: 'IA dois', color: 'yellow', control: 'computer', difficulty: 'strategic' }],
      startingPlayerIndex: 2, seed: 1,
    }
    const setup = renderToStaticMarkup(createElement(GameSetup, { configuration, message: '', onStart() {} }))
    assert.ok(!setup.includes('Dificuldade do jogador 1'))
    assert.ok(setup.includes('Dificuldade do jogador 2'))
    assert.ok(setup.includes('Dificuldade do jogador 3'))
    assert.equal((setup.match(/<option value="basic" selected="">Básico<\/option>/g) ?? []).length, 1)
    assert.equal((setup.match(/<option value="strategic" selected="">Estratégico<\/option>/g) ?? []).length, 1)
    const match = GameSession.configure().start(configuration)
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: match.snapshot.players[2], phase: 'place', kind: match.snapshot.deck[0].kind, rotation: 0,
      deckCount: 70, discardedCount: 0, pendingMeeple: false, followerChoices: [], message: '',
      validCount: 0, unfillableCount: 0, standings: [], winners: [],
      onRotate() {}, onSelectFollower() {}, onUndo() {}, onConfirm() {},
    }))
    assert.ok(markup.includes('IA dois · IA · Estratégico'))
  } finally {
    await server.close()
  }
})
