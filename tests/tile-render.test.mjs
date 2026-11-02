import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { rotations, tileKinds } from '../src/game/tiles.ts'

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
