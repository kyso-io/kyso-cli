/* eslint-disable max-params */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { loginAction, pullReportAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import * as AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { interactiveLogin } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Pull repository from Kyso'

  static examples = [`$ kyso pull --path <destination_folder> --organization <organization> --team <team> --report <report_name> --version <version>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: false,
      default: '.',
    }),
    organization: Flags.string({
      char: 'o',
      description: 'organization',
      required: false,
      default: '',
    }),
    team: Flags.string({
      char: 't',
      description: 'team',
      required: false,
      default: '',
    }),
    report: Flags.string({
      char: 'r',
      description: 'report',
      required: false,
      default: '',
    }),
    version: Flags.integer({
      char: 'v',
      description: 'version',
      required: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    const logged: boolean = await this.checkCredentials()
    if (!logged) {
      const login: Login = await interactiveLogin()
      await store.dispatch(loginAction(login))
      const { auth } = store.getState()
      if (auth.token) {
        this.saveToken(auth.token, null, null)
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
    this.log('Already up to date.')
  }
}
