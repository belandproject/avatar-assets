import { readFileSync } from 'fs'
import { SourceJson } from 'types'
import { join } from 'path'

export function readAssetJson(folder: string): SourceJson {
  return JSON.parse(readFileSync(join(folder, 'asset.json')).toString())
}