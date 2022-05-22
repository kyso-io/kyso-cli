/* eslint-disable no-await-in-loop */
import { Flags } from '@oclif/core'
import { readFileSync } from 'fs'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path <report_folder>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push',
      required: false,
      default: "."
    }),
  }

  static args = []

  async run(): Promise<void> {
    const kysoCredentials = JSON.parse(readFileSync(this.tokenFilePath, 'utf8').toString())
    this.log(`You are logged into ${kysoCredentials.kysoInstallUrl} as ${kysoCredentials.username}.`)
  }
}
