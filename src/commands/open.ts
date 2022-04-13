/* eslint-disable unicorn/prefer-ternary */
/* eslint-disable no-prototype-builtins */
import { KysoConfigFile } from '@kyso-io/kyso-model'
import { Flags } from '@oclif/core'
import { existsSync } from 'fs'
import * as open from 'open'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import slugify from '../helpers/slugify'
import { KysoCommand } from './kyso-command'

export default class Open extends KysoCommand {
  static description = 'Open a report in the browser'

  static examples = [`$ kyso open --path <project_path>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: "folder's path in which kyso.json, yaml or yml file is placed",
      required: false,
      default: '.',
    }),
  }

  static args = []

  async run(): Promise<void> {
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

    let baseUrl = null
    let reportUrl = null
    if (process.env.NODE_ENV === 'development') {
      baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      reportUrl = `${baseUrl}/${kysoConfigFile.organization}/${kysoConfigFile.team}/${slugify(kysoConfigFile.title)}`
    } else {
      baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kyso.io'
      const domain = new URL(baseUrl)
      reportUrl = `${domain.protocol}//${domain.hostname}/${kysoConfigFile.organization}/${kysoConfigFile.team}/${slugify(kysoConfigFile.title)}`
    }
    this.log(`Opening "${reportUrl}" the in browser...`)
    await open(reportUrl)
  }
}
