import { mkdir, readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const sourceDirectory = 'src/assets'
const assets = (await readdir(sourceDirectory)).filter((file) => /^nft(?:One|Two|Three|Four)\.svg$/i.test(file))

await mkdir(sourceDirectory, { recursive: true })

for (const asset of assets) {
  const input = join(sourceDirectory, asset)
  const output = join(sourceDirectory, `${basename(asset, extname(asset))}.webp`)
  await sharp(input)
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(output)
  console.log(`Optimized ${asset} -> ${output}`)
}
