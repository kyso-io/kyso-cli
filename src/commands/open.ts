/* eslint-disable no-prototype-builtins */
import { KysoConfigFile } from '@kyso-io/kyso-model'
import { Flags } from '@oclif/core'
import { existsSync } from 'fs'
import open from 'open'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import slugify from '../helpers/slugify'
import { KysoCredentials } from '../types/kyso-credentials'
import { KysoCommand } from './kyso-command'

export default class Open extends KysoCommand {
  static description = 'Open a report in the browser'

  static examples = [`$ kyso open --path <report_path>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: "Folder's path in which kyso.json, yaml or yml file is placed",
      required: false,
      default: '.',
    }),
  }

  static args = []

  async run(): Promise<void> {
    const kysoCredentials: KysoCredentials | null = KysoCommand.getCredentials()
    if (!kysoCredentials) {
      this.log(`No credentials found. Please login first.`)
    }

    const { flags } = await this.parse(Open)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    const files: string[] = getAllFiles(basePath, [])

    let kysoConfigFile: KysoConfigFile | null = null
    try {
      const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
      kysoConfigFile = data.kysoConfigFile
    } catch (error: any) {
      this.error(error)
    }

    if (!kysoConfigFile.hasOwnProperty('organization') || kysoConfigFile.organization === null || kysoConfigFile.organization.length === 0) {
      this.error('Kyso file does not defined the organization')
    }
    if (!kysoConfigFile.hasOwnProperty('team') || kysoConfigFile.team === null || kysoConfigFile.team.length === 0) {
      this.error('Kyso file does not defined the team')
    }
    if (!kysoConfigFile.hasOwnProperty('title') || kysoConfigFile.title === null || kysoConfigFile.title.length === 0) {
      this.error('Kyso file does not defined the title')
    }

    const domain: URL = new URL(kysoCredentials.kysoInstallUrl)
    const reportUrl = `${domain.protocol}//${domain.hostname}/${kysoConfigFile.organization}/${kysoConfigFile.team}/${slugify(kysoConfigFile.title)}`
    this.log(`Opening "${reportUrl}" the in browser...`)
    await open(reportUrl)
  }
}
