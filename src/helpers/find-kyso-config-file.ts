import { KysoConfigFile } from '@kyso-io/kyso-model'
import { readFileSync } from 'fs'

export const findKysoConfigFile = (files: string[]): { kysoConfigFile: KysoConfigFile | null; kysoConfigPath: string | null; valid: boolean; message: string | null } => {
  let data: {
    valid: boolean;
    message: string | null;
    kysoConfigFile: KysoConfigFile | null;
  } = {
    valid: false,
    message: null,
    kysoConfigFile: null,
  }
  let index: number = files.findIndex((file: string) => file.endsWith('kyso.json'))
  if (index > -1) {
    try {
      data = KysoConfigFile.fromJSON(readFileSync(files[index], 'utf8').toString())
    } catch (error: any) {
      throw new Error(`Error parsing kyso.json: ${error.message}`)
    }
  } else {
    index = files.findIndex((file: string) => file.endsWith('kyso.yml') || file.endsWith('kyso.yaml'))
    if (index > -1) {
      try {
        data = KysoConfigFile.fromYaml(readFileSync(files[index], 'utf8'))
      } catch (error: any) {
        throw new Error(`Error parsing kyso.yml: ${error.message}`)
      }
    }
  }

  let kysoConfigPath: string | null = null
  if (index === -1) {
    data.message = 'No kyso config file found.'
  } else {
    kysoConfigPath = files[index]
  }

  // To allow the possibility to rename team to channel
  if (data?.kysoConfigFile && data.kysoConfigFile.channel && !data.kysoConfigFile.team) {
    data.kysoConfigFile.team = data.kysoConfigFile.channel
  }

  return { kysoConfigFile: data.kysoConfigFile, kysoConfigPath, valid: data.valid, message: data.message }
}
