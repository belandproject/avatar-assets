import { getAssetFolderAbsPath } from './assets/getAssetFolderAbsPath'
import {
  readdirSync,
  PathLike,
  readdir as readdirOrig,
  readFile as readFileOrig,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs'
import { basename, join, resolve } from 'path'
import { promisify } from 'util'
import FormData from 'form-data'
import axios from 'axios'
import { readAssetJson } from './assets/readAssetJson'
import { Wearable } from 'types'
import { Wallet } from 'ethers'

const DIST_ABS_PATH = resolve(join(__dirname, '..', 'dist'))
const readDir = promisify(readdirOrig)
const readFile = promisify(readFileOrig)
const API = process.env.API || 'https://nft-api-test.beland.io/v1'
const PRIVATE_KEY = process.env.PRIVATE_KEY
var accessToken

if (!module.parent) {
  runMain().catch((error) => console.log(error, error.stack))
}

export async function runMain() {
  await login()

  const getDirectories = (source: PathLike) =>
    readdirSync(source, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

  const collectionFolders = getDirectories(resolve(join(__dirname, '..', 'assets')))

  console.log(`Building catalog from folders '${collectionFolders.join(', ')}'...`)
  const mapCategoryFolders: { [key: string]: string[] } = {}

  for (let collectionFolder of collectionFolders) {
    const collectioName = basename(collectionFolder)
    const categoryFolderAbsPath = getAssetFolderAbsPath(collectionFolder)
    const categoryFolders = readdirSync(categoryFolderAbsPath)
    const assetFolders: string[] = []
    mapCategoryFolders[collectionFolder] = assetFolders
    categoryFolders.forEach((category) => {
      addFolderEntriesToArray(assetFolders, join(categoryFolderAbsPath, category))
    })

    console.log(`Found ${categoryFolders.length} categories with ${assetFolders.length} assets in total...`)
    let wearables: Wearable[] = []
    for (let assetFolder of assetFolders) {
      const contents = await uploadAsset(assetFolder)
      let wearable: any = {}
      const assetJSON = await readAssetJson(assetFolder)
      wearable.id = `urn:beland:off-chain:${collectioName}:${assetJSON.name}`
      wearable.name = assetJSON.name
      wearable.image = contents.find((content) => content.path == 'thumbnail.png').hash
      wearable.description = assetJSON.description || ''
      const imageName = `${assetJSON.name}.png`
      const nameBlacklist = ['asset.json', 'thumbnail.png', imageName]
      wearable.data = {
        representations: assetJSON.main.map((main) => {
          return {
            bodyShapes: [main.type],
            mainFile: main.model,
            overrideReplaces: main.overrideReplaces,
            overrideHides: main.overrideHides,
            contents: contents.filter((content) => !nameBlacklist.includes(content.path)),
          }
        }),
      }

      wearable.traits = [
        {
          name: 'type',
          value: 'wearable',
        },
        {
          name: 'category',
          value: assetJSON.category,
        },
      ]

      addTraits(wearable, assetJSON, 'tags')
      addTraits(wearable, assetJSON, 'replaces')
      addTraits(wearable, assetJSON, 'hides')

      wearables.push(wearable)
    }
    if (!existsSync(DIST_ABS_PATH)) {
      mkdirSync(DIST_ABS_PATH)
    }
    const jsonResult = JSON.stringify(wearables, null, 2)
    writeFileSync(join(DIST_ABS_PATH, 'index.json'), jsonResult)
  }
}

function addTraits(wearable, assetJSON, name) {
  if (assetJSON[name]) {
    wearable.traits = wearable.traits.concat(
      ...assetJSON[name].map((value) => {
        return {
          name: name,
          value,
        }
      })
    )
  }
}

async function uploadAsset(assetFolder) {
  const allFiles = await readDir(assetFolder)
  const fileBlacklist = ['asset.json']
  return Promise.all(
    allFiles
      .filter((file) => !fileBlacklist.includes(file))
      .map(async (file) => {
        const sourceFile = join(assetFolder, file)
        const content = await readFile(sourceFile)
        const form = new FormData()
        form.append('file', content, file)
        return axios
          .post(`${API}/upload`, form, {
            headers: {
              ...form.getHeaders(),
              Authorization: 'Bearer ' + accessToken,
            },
          })
          .then((res) => res.data[0])
      })
  )
}

function addFolderEntriesToArray(array: string[], rootFolder: string) {
  return readdirSync(rootFolder).map((entry) => array.push(join(rootFolder, entry)))
}

async function login() {
  const walletPrivateKey = new Wallet(PRIVATE_KEY)
  const timestamp = Date.now() / 1000
  const msg = ['Beland:login', 'Hi', String(timestamp)]
  const sign: string = await walletPrivateKey.signMessage(msg.join(':'))

  const token = await axios
    .post(`${API}/users/login`, {
      timestamp,
      sign,
      name: 'Hi',
      id: walletPrivateKey.address,
    })
    .then((res) => res.data)

  const users = await axios.get(`${API}/users?id=${token.user}`).then((res) => res.data)
  if (users.length == 0) {
    await axios.post(`${API}/users/me`, {
      name: 'Hi',
    })
  }
  accessToken = token.access_token
}
