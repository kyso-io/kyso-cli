/* eslint-disable max-params */
import { Api } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { printErrorMessage } from '../helpers/error-handler'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Pull repository from Kyso'

  static examples = [`$ kyso pull --path <destination_folder> --organization <organization> --team <team> --report <report_name> --version <version>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Destination folder in which the report will be pulled',
      required: false,
      default: '.',
    }),
    organization: Flags.string({
      char: 'o',
      description: 'Organization slug name which the report belongs to. i.e: for organization "Kyso Inc" the organization slug is "kyso-inc".',
      required: true,
    }),
    team: Flags.string({
      char: 't',
      description: 'Team slug name which the report belongs to. i.e: for team "My Awesome Team" the team slug is "my-awesome-team".',
      required: true,
    }),
    report: Flags.string({
      char: 'r',
      description: 'Report slug name to be pulled. i.e: for report with name "The Great Report" the report slug if "the-great-report"',
      required: true,
    }),
    version: Flags.integer({
      char: 'v',
      description: 'Version of the report to be pulled. Latest version is pulled if not set',
      required: false,
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
    const { flags } = await this.parse(Push)

    if (flags.verbose) {
      this.log('Enabled verbose mode')
      this.enableVerbose()
    }

    await launchInteractiveLoginIfNotLogged()

    try {
      this.log('Pulling report. Please wait...')
      let files: string[] = readdirSync(flags.path)

      if (flags?.organization && flags?.team && flags?.report) {
        await this.extractReport(flags.organization, flags.team, flags.report, flags.version, flags.path)
      } else {
        if (flags?.path) {
          files = files.map((file: string) => join(flags.path, file))
        }
        const { kysoConfigFile, valid, message } = findKysoConfigFile(files)
        if (!valid) {
          this.error(`Could not pull report using Kyso config file: ${message}`)
        }
        this.extractReport(kysoConfigFile.organization, kysoConfigFile.team, kysoConfigFile.title, flags.version, flags.path)
      }
    } catch (error: any) {
      printErrorMessage(error)
    }

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }

  async extractReport(organization: string, team: string, report: string, version: number | null, path: string): Promise<void> {
    const api: Api = new Api(KysoCommand.getCredentials().token, organization, team)
    const finalPath: string = path + '/' + report

    const data: any = {
      teamName: team,
      reportName: report,
    }
    if (version && version > 0) {
      data.version = version
    }
    const result: Buffer = await api.pullReport(report, team)

    const zip: AdmZip = new AdmZip(result)

    zip.extractAllTo(finalPath, true)

    this.log(`\n🎉🎉🎉 Success! Report downloaded to ${resolve(finalPath)} 🎉🎉🎉\n`)
  }
}
