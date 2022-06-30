export type SourceJson = {
  name: string
  i18n: {
    [key: string]: string
  }
  tags: string[]
  replaces?: string[]
  hides?: string[]
  category: string
  rarity?: string
  description?: string
  main: {
    overrideReplaces?: string[]
    overrideHides?: string[]
    type: string
    model: string
  }[]
}

export type Wearable = {
  id: WearableId
  imageUrl: string | undefined
  description: string | undefined
  data: Data
}

export type Data = {
  representations: BodyShapeRespresentation[]
}

export type WearableId = string

export type BodyShapeRespresentation = {
  bodyShapes: string[]
  mainFile: string
  overrideReplaces: string[]
  overrideHides: string[]
  contents: Content[]
}

export type Content = {
  path: string
  hash: string
}
