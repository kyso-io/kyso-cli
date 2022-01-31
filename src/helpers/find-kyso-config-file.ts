import { KysoConfigFile } from '@kyso-io/kyso-model'
import { readFileSync } from 'fs'
import * as jsYaml from 'js-yaml'

export const findKysoConfigFile = (files: string[]): KysoConfigFile => {
  let kysoConfig: KysoConfigFile | null = null
  let index: number = files.findIndex((file: string) => file.endsWith('kyso.json'))
  if (index > -1) {
    try {
      kysoConfig = JSON.parse(readFileSync(files[index], 'utf8').toString())
    } catch (error: any) {
      throw new Error(`Error parsing kyso.json: ${error.message}`)
    }
  } else {
    index = files.findIndex((file: string) => file.endsWith('kyso.yml'))
    if (index > -1) {
      try {
        kysoConfig = jsYaml.load(readFileSync(files[index], 'utf8')) as KysoConfigFile
      } catch (error: any) {
        throw new Error(`Error parsing kyso.yml: ${error.message}`)
      }
    }
  }
  if (!kysoConfig) {
    throw new Error('kyso.{json,yml} not found')
  }
  return kysoConfig
}
