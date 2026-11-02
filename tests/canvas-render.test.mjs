import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drawTileImage } from '../src/game/rendering.ts'

test('o canvas gira a mesma imagem em torno do centro sem acumular transformações', () => {
  const image = {}
  const calls = []
  const context = Object.fromEntries(['save', 'translate', 'rotate', 'drawImage', 'restore'].map((name) => [
    name, (...args) => calls.push([name, ...args]),
  ]))
  for (let turn = 0; turn < 8; turn++) {
    const angle = turn % 4 * 90
    calls.length = 0
    drawTileImage(context, image, 20, 30, 100, angle)
    assert.deepEqual(calls, [
      ['save'], ['translate', 70, 80], ['rotate', angle * Math.PI / 180],
      ['drawImage', image, -50, -50, 100, 100], ['restore'],
    ])
  }
})
