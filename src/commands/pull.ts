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

    let kysoConfig: KysoConfigFile | null = null
    try {
      kysoConfig = findKysoConfigFile(files)
    } catch (error: any) {
      this.error(error)
    }

    const result = await store.dispatch(
      pullReportAction({
        teamName: kysoConfig.team,
        reportName: kysoConfig.title,
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
