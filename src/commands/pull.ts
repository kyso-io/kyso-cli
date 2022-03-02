import { KysoConfigFile } from '@kyso-io/kyso-model'
import { pullReportAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import * as AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Pull repository from Kyso'

  static examples = [`$ kyso pull --path <name>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: false,
      default: '.',
    }),
  }

  static args = []

  async run(): Promise<void> {
    this.checkCredentials()

    this.log('Pulling report. Wait...')
    const { flags } = await this.parse(Push)
    let files: string[] = readdirSync(flags.path)
    if (flags?.path) {
      files = files.map((file: string) => join(flags.path, file))
    }

    let kysoConfigFile: KysoConfigFile | null = null
    try {
      const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
      kysoConfigFile = data.kysoConfigFile
    } catch (error: any) {
      this.error(error)
    }

    const result = await (store as any).dispatch(
      pullReportAction({
        teamName: kysoConfigFile.team,
        reportName: kysoConfigFile.title,
      })
    )
    if (!result || !result.payload) {
      this.error('Error pulling report')
    }

    const zip: AdmZip = new AdmZip(result.payload as Buffer)
    zip.extractAllTo(flags.path, true)
    this.log('Already up to date.')
  }
}
