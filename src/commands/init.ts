import { NormalizedResponseDTO, ReportPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model'
import { Api } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, lstatSync, readdirSync, writeFileSync } from 'fs'
import * as jsYaml from 'js-yaml'
import jwtDecode from 'jwt-decode'
import { basename, isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import { KysoCredentials } from '../types/kyso-credentials'
import { KysoCommand } from './kyso-command'
import inquirer = require('inquirer')

enum ReportTypes {
  website = 'website',
  jupyter = 'jupyter',
  markdown = 'markdown',
  other = 'other',
}

export default class Init extends KysoCommand {
  static description = 'Interactivel build a kyso.yaml file'

  static examples = [`$ kyso init`]

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

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init)

    if (flags.verbose) {
      this.log('Enabled verbose mode')
      this.enableVerbose()
    }

    await launchInteractiveLoginIfNotLogged()

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    if (!lstatSync(flags.path).isDirectory()) {
      this.error('Path must be a directory')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    const files: string[] = readdirSync(basePath)
    const { kysoConfigFile } = findKysoConfigFile(files)
    if (kysoConfigFile) {
      const confirmResponse: { confirmOverwrite } = await inquirer.prompt([
        {
          name: 'confirmOverwrite',
          default: false,
          message: 'kyso.yaml already exists, overwrite?',
          type: 'confirm',
        },
      ])
      if (!confirmResponse.confirmOverwrite) {
        return
      }
    }

    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials()
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token)
    const api: Api = new Api(kysoCredentials.token)
    const resultTokenPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username)

    if (resultTokenPermissions.data.organizations.length === 0) {
      this.error('You need to be part of an organization to initialize a report')
    }

    const organizationResponse: { organization: string } = await inquirer.prompt([
      {
        name: 'organization',
        message: 'Select an organization',
        type: 'list',
        choices: resultTokenPermissions.data.organizations.map((resourcePermission: ResourcePermissions) => ({ name: resourcePermission.name })),
      },
    ])

    const organizationResourcePermission: ResourcePermissions = resultTokenPermissions.data.organizations.find(
      (resourcePermission: ResourcePermissions) => resourcePermission.name === organizationResponse.organization
    )!
    const organizationHasCreateReportPermission: boolean = organizationResourcePermission.permissions.includes(ReportPermissionsEnum.CREATE)
    const teamsOrganizationResourcePermissions: ResourcePermissions[] = []
    for (const teamResourcePermission of resultTokenPermissions.data.teams) {
      if (teamResourcePermission.organization_id !== organizationResourcePermission.id) {
        continue
      }
      if (teamResourcePermission.organization_inherited && organizationHasCreateReportPermission) {
        teamsOrganizationResourcePermissions.push(teamResourcePermission)
      } else if (teamResourcePermission.permissions.includes(ReportPermissionsEnum.CREATE)) {
        teamsOrganizationResourcePermissions.push(teamResourcePermission)
      }
    }
    if (teamsOrganizationResourcePermissions.length === 0) {
      this.error('you do not have permissions to upload reports in this organization')
    }

    const teamResponse: { team: string } = await inquirer.prompt([
      {
        name: 'team',
        message: 'Select a team',
        type: 'list',
        choices: teamsOrganizationResourcePermissions.map((teamResourcePermissions: ResourcePermissions) => ({ name: teamResourcePermissions.name })),
      },
    ])

    const reportTypeResponse: { reportType: ReportTypes } = await inquirer.prompt([
      {
        name: 'reportType',
        message: 'Select a reportType',
        type: 'list',
        choices: [{ name: ReportTypes.website }, { name: ReportTypes.jupyter }, { name: ReportTypes.markdown }, { name: ReportTypes.other }],
      },
    ])

    let defaultFile = 'index.html'
    if (reportTypeResponse.reportType === ReportTypes.jupyter) {
      defaultFile = 'index.ipynb'
    } else if (reportTypeResponse.reportType === ReportTypes.markdown) {
      defaultFile = 'index.md'
    }

    const mainFileResponse: { mainFile: string } = await inquirer.prompt([
      {
        name: 'mainFile',
        message: 'Entrypoint file?',
        type: 'input',
        default: defaultFile,
        validate: function (mainFile: string) {
          if (mainFile === '') {
            return 'main file cannot be empty'
          }
          return true
        },
        filter: (input: string) => input.trim(),
      },
    ])

    const titleResponse: { title: string } = await inquirer.prompt([
      {
        name: 'title',
        message: 'Title',
        type: 'input',
        default: basename(process.cwd()),
        validate: function (title: string) {
          if (title === '') {
            return 'title cannot be empty'
          }
          return true
        },
        filter: (input: string) => input.trim(),
      },
    ])

    const config = {
      organization: organizationResponse.organization,
      team: teamResponse.team,
      type: reportTypeResponse.reportType,
      title: titleResponse.title,
      main: mainFileResponse.mainFile,
    }

    writeFileSync(join(flags.path, 'kyso.yaml'), jsYaml.dump(config))

    this.log(`Wrote config to ${join(flags.path, 'kyso.yaml')}`)

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }
}
