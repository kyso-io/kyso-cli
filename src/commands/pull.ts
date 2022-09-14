/* eslint-disable max-params */
import { NormalizedResponseDTO, Organization, Team, TeamVisibilityEnum } from '@kyso-io/kyso-model'
import { Api } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { printErrorMessage } from '../helpers/error-handler'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import slugify from '../helpers/slugify'
import { KysoCredentials } from '../types/kyso-credentials'
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
    }),
    team: Flags.string({
      char: 't',
      description: 'Team slug name which the report belongs to. i.e: for team "My Awesome Team" the team slug is "my-awesome-team".',
    }),
    report: Flags.string({
      char: 'r',
      description: 'Report slug name to be pulled. i.e: for report with name "The Great Report" the report slug if "the-great-report"',
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

    let organizationSlug: string | null = null
    let teamSlug: string | null = null
    let reportSlug: string | null = null

    try {
      this.log('Pulling report. Please wait...')

      if (flags?.organization && flags?.team && flags?.report) {
        organizationSlug = flags.organization
        teamSlug = flags.team
        reportSlug = flags.report
      } else {
        if (!flags.path) {
          this.error('Please specify a path to pull the report to')
        }
        let files: string[] = readdirSync(flags.path)
        files = files.map((file: string) => join(flags.path, file))
        const { kysoConfigFile, valid, message } = findKysoConfigFile(files)
        if (!valid) {
          this.error(`Could not pull report using Kyso config file: ${message}`)
        }
        organizationSlug = kysoConfigFile.organization
        teamSlug = kysoConfigFile.team
        reportSlug = slugify(kysoConfigFile.title)
      }
    } catch (error: any) {
      printErrorMessage(error)
    }

    if (!organizationSlug) {
      this.error('Organization is required')
    }
    if (!teamSlug) {
      this.error('Team is required')
    }
    if (!reportSlug) {
      this.error('Report is required')
    }

    // Check if team is public
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials()
    const api: Api = new Api(kysoCredentials?.token)
    let organization: Organization | null = null
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationSlug)
      organization = resultOrganization.data
    } catch {
      this.log(`\nError: Organization ${organizationSlug} does not exist.\n`)
      return
    }
    try {
      const resultTeam: NormalizedResponseDTO<Team> = await api.getTeamBySlug(organization.id, teamSlug)
      const team: Team = resultTeam.data
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        await launchInteractiveLoginIfNotLogged()
      }
    } catch (error: any) {
      const { statusCode, message } = error.response.data
      if (statusCode === 404) {
        this.log(`\nError: Team ${teamSlug} does not exist.\n`)
      } else if (statusCode === 403) {
        if (kysoCredentials?.token) {
          this.log(`\nError: ${message}\n`)
        } else {
          await launchInteractiveLoginIfNotLogged()
          this.run()
        }
      } else {
        printErrorMessage(error)
      }
      return
    }

    await this.extractReport(organizationSlug, teamSlug, reportSlug, flags.version, flags.path)

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }

  async extractReport(organization: string, team: string, report: string, version: number | null, path: string): Promise<void> {
    try {
      const api: Api = new Api(KysoCommand.getCredentials()?.token, organization, team)
      const result: Buffer = await api.pullReport(report, team, version)
      const zip: AdmZip = new AdmZip(result)
      const finalPath: string = path + '/' + report
      zip.extractAllTo(finalPath, true)
      this.log(`\n🎉🎉🎉 Success! Report downloaded to ${resolve(finalPath)} 🎉🎉🎉\n`)
    } catch (error: any) {
      const { message } = JSON.parse(error.response.data.toString())
      this.error(message)
    }
  }
}
