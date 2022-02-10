/* eslint-disable no-prototype-builtins */
import { KysoConfigFile } from '@kyso-io/kyso-model'
import { Flags } from '@oclif/core'
import { existsSync } from 'fs'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import slugify from '../helpers/slugify'
import { KysoCommand } from './kyso-command'
import * as open from 'open'

export default class Open extends KysoCommand {
  static description = 'Open a report in the browser'

  static examples = [`$ kyso open --path <project_path>`]

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
    const { flags } = await this.parse(Open)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    const files: string[] = getAllFiles(basePath, [])

    let kysoConfig: KysoConfigFile | null = null
    try {
      kysoConfig = findKysoConfigFile(files)
    } catch (error: any) {
      this.error(error)
    }

    if (!kysoConfig.hasOwnProperty('organization') || kysoConfig.organization === null || kysoConfig.organization.length === 0) {
      this.error('Kyso file does not defined the organization')
    }
    if (!kysoConfig.hasOwnProperty('team') || kysoConfig.team === null || kysoConfig.team.length === 0) {
      this.error('Kyso file does not defined the team')
    }
    if (!kysoConfig.hasOwnProperty('title') || kysoConfig.title === null || kysoConfig.title.length === 0) {
      this.error('Kyso file does not defined the title')
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kyso.io'
    const domain = new URL(baseUrl)
    const reportUrl = `${domain.protocol}//${domain.hostname}/${kysoConfig.organization}/${kysoConfig.team}/${slugify(kysoConfig.title)}`
    // const reportUrl = `http://localhost:3000/${kysoConfig.organization}/${kysoConfig.team}/${slugify(kysoConfig.title)}`
    this.log(`Opening "${reportUrl}" the in browser...`)
    await open(reportUrl)
  }
}
