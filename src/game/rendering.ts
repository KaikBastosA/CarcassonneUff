import type { Rotation } from './tiles.ts'

export function drawTileImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  rotation: Rotation,
) {
  context.save()
  context.translate(x + size / 2, y + size / 2)
  context.rotate(rotation * Math.PI / 180)
  context.drawImage(image, -size / 2, -size / 2, size, size)
  context.restore()
}
