import { KysoConfigFile } from '@kyso-io/kyso-model'
import { readFileSync } from 'fs'
import * as jsYaml from 'js-yaml'

export const findKysoConfigFile = (files: string[]): { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } => {
  let kysoConfigFile: KysoConfigFile | null = null
  let index: number = files.findIndex((file: string) => file.endsWith('kyso.json'))
  if (index > -1) {
    try {
      kysoConfigFile = KysoConfigFile.fromJSON(readFileSync(files[index], 'utf8').toString())
    } catch (error: any) {
      throw new Error(`Error parsing kyso.json: ${error.message}`)
    }
  } else {
    index = files.findIndex((file: string) => file.endsWith('kyso.yml') || file.endsWith('kyso.yaml'))
    if (index > -1) {
      try {
        kysoConfigFile = KysoConfigFile.fromYaml(readFileSync(files[index], 'utf8'));
      } catch (error: any) {
        throw new Error(`Error parsing kyso.yml: ${error.message}`)
      }
    }
  }
  if (!kysoConfigFile) {
    throw new Error('kyso.{json,yml,yaml} not found')
  }

  // To allow the possibility to rename team to channel
  if(kysoConfigFile.channel && !kysoConfigFile.team) {
    kysoConfigFile.team = kysoConfigFile.channel;
  }

  return { kysoConfigFile, kysoConfigPath: files[index] }
}
