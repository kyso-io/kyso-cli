/* eslint-disable max-params */
import { KysoConfigFile } from '@kyso-io/kyso-model'
import { Api, pullReportAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { printErrorMessage } from '../helpers/error-handler'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class Clone extends KysoCommand {
  static description = 'Clone a report from Kyso'

  static examples = [`$ kyso clone <report_url>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Destination folder in which the report will be pulled',
      required: false,
      default: '.',
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

  static args = [{ name: 'cloneUrl' }]

  async run(): Promise<void> {
    const { flags } = await this.parse(Clone)

    if (flags.verbose) {
      this.log('Enabled verbose mode')
      this.enableVerbose()
    }

    const parsed = await this.parse(Clone)
    let cloneUrl = parsed.args.cloneUrl

    if (!cloneUrl) {
      this.log('\nError: Must provide the report URL\n')
      return
    }

    this.log(`\n✨✨✨ Cloning ${cloneUrl} ✨✨✨\n`)

    cloneUrl = cloneUrl.replace('https://', '').replace('http://', '').split('/')
    const organizationSlug = cloneUrl[1]
    const teamSlug = cloneUrl[2]
    const reportSlug = cloneUrl[3]

    await launchInteractiveLoginIfNotLogged()

    this.log('Cloning report. Please wait...')

    try {
      let files: string[] = readdirSync(flags.path)

      if (organizationSlug && teamSlug && reportSlug) {
        await this.extractReport(organizationSlug, teamSlug, reportSlug, flags.version, flags.path)
      } else {
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
        this.extractReport(kysoConfigFile.organization, kysoConfigFile.team, kysoConfigFile.title, flags.version, flags.path)
      }
    } catch(ex) {
      printErrorMessage(ex);
    }

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }

  async extractReport(organization: string, team: string, report: string, version: number | null, path: string): Promise<void> {
    const api: Api = new Api(KysoCommand.getCredentials().token, organization, team);
    const finalPath: string = path + "/" + report;

    const data: any = {
      teamName: team,
      reportName: report,
    }
    if (version && version > 0) {
      data.version = version
    }
    const result: Buffer = await api.pullReport(report, team);

    const zip: AdmZip = new AdmZip(result)
    
    zip.extractAllTo(finalPath, true)
    
    this.log(`\n🎉🎉🎉 Success! Report downloaded to ${resolve(finalPath)} 🎉🎉🎉\n`)
  }
}
