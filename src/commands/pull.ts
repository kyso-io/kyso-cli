/* eslint-disable max-params */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { loginAction, pullReportAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { interactiveLogin } from '../helpers/interactive-login'
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
  }

  static args = []

  async run(): Promise<void> {
    const logged: boolean = await this.checkCredentials()
    if (!logged) {
      const login: Login = await interactiveLogin(this.getCredentials())
      /**
       * WTF?
       * Argument of type 
       * 'import("/home/fjbarrena/Projects/kyso/kyso-cli/node_modules/@kyso-io/kyso-model/dist/models/login.model").Login'
       * is not assignable to parameter of type 
       * 'import("/home/fjbarrena/Projects/kyso/kyso-cli/node_modules/@kyso-io/kyso-store/node_modules/@kyso-io/kyso-model/dist/models/login.model").Login'.
       * 
       * Casting to any for now
       */
      await store.dispatch(loginAction(login as any))
      const { auth } = store.getState()
      if (auth.token) {
        this.saveToken(auth.token, null, null, login.kysoInstallUrl, null)
      } else {
        this.error('An error occurred making login request')
      }
    }

    this.log('Pulling report. Wait...')
    const { flags } = await this.parse(Push)
    let files: string[] = readdirSync(flags.path)

    if (flags?.organization && flags?.team && flags?.report) {
      await this.extractReport(flags.organization, flags.team, flags.report, flags.version, flags.path)
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
  }

  async extractReport(organization: string, team: string, report: string, version: number | null, path: string): Promise<void> {
    await store.dispatch(setOrganizationAuthAction(organization))
    await store.dispatch(setTeamAuthAction(team))
    const data: any = {
      teamName: team,
      reportName: report,
    }
    if (version && version > 0) {
      data.version = version
    }
    const result = await store.dispatch(pullReportAction(data))
    if (!result || !result.payload) {
      this.error('Error pulling report')
    }
    const zip: AdmZip = new AdmZip(result.payload as Buffer)
    zip.extractAllTo(path, true)
    this.log(`\n🎉🎉🎉 Success! Report downloaded to ${resolve(path)} 🎉🎉🎉\n`)
  }
}
