import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { rotations, tileKinds } from '../src/game/tiles.ts'
import { initialGame } from '../src/game.ts'
import { confirmGameTurn, getFollowerChoices, placeGameTile, selectGameFollower } from '../src/game/actions.ts'

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
    const state = selectGameFollower(placeGameTile({ ...initialGame, currentKind: 'road', rotation: 90 }, '1,0'), 'field-east')
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: state.players[0], phase: state.phase, kind: state.currentKind, rotation: state.rotation,
      deckCount: 18, pendingMeeple: true, followerChoices: getFollowerChoices(state), message: '',
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
    const final = confirmGameTurn({ ...pending, deck: ['city-sides'] })
    const markup = renderToStaticMarkup(createElement(TurnPanel, {
      player: final.players[0], phase: final.phase, kind: final.currentKind, rotation: final.rotation,
      deckCount: 0, pendingMeeple: false, followerChoices: [], message: final.message,
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
