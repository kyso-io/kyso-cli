/* eslint-disable no-prototype-builtins */
import { Flags } from '@oclif/core'
import { existsSync, lstatSync, readdirSync } from 'fs'
import open from 'open'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
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
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    const { flags } = await this.parse(Open)

    if (flags.verbose) {
      this.log('Enabled verbose mode')
      this.enableVerbose()
    }

    const kysoCredentials: KysoCredentials | null = KysoCommand.getCredentials()
    if (!kysoCredentials) {
      this.log(`No credentials found. Please login first.`)
    }

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    if (!lstatSync(flags.path).isDirectory()) {
      this.error('Path must be a directory')
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    const files: string[] = readdirSync(basePath).map((file: string) => join(basePath, file))

    const { kysoConfigFile, valid, message } = findKysoConfigFile(files)
    if (!valid) {
      this.error(`Could not open the report using Kyso config file: ${message}`)
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

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }
}
