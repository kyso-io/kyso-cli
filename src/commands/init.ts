import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { existsSync, writeFileSync } from 'fs'
import * as jsYaml from 'js-yaml'
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { isAbsolute, join, basename } from 'path'
import { getAllFiles } from '../helpers/get-all-files'
import {Command, Flags} from '@oclif/core'
import inquirer = require('inquirer')
import { store, loginAction, fetchOrganizationsAction, fetchTeamsAction } from '@kyso-io/kyso-store'
import { title } from 'process'
import { interactiveLogin } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

enum ReportTypes {
  website = 'website',
  jupyter = 'jupyter',
  markdown = 'markdown'
}

export default class Init extends KysoCommand {
  static description = 'Interactivel build a kyso.yaml file'

  static examples = [
    `$ kyso init`,
  ]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: "Folder's path in which kyso.json, yaml or yml file is placed",
      required: false,
      default: '.',
    })
  }

  static args = []

  public async run(): Promise<void> {
    const logged: boolean = await this.checkCredentials()
    if (!logged) {
      const login: Login = await interactiveLogin(this.getCredentials())
      await store.dispatch(loginAction(login))
      const { auth } = store.getState()
      if (auth.token) {
        this.saveToken(auth.token, null, null, login.kysoInstallUrl, null)
      } else {
        this.error('An error occurred making login request')
      }
    }

    const {args, flags} = await this.parse(Init)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    const files: string[] = getAllFiles(basePath, [])

    let kysoConfigFile: KysoConfigFile | null = null
    try {
      const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
      kysoConfigFile = data.kysoConfigFile
      const confirmResponse: { confirmOverwrite } = await inquirer.prompt([
        {
          name: 'confirmOverwrite',
          default: false,
          message: 'kyso.yaml already exists, overwrite?',
          type: 'confirm'
        },
      ])

      if (!confirmResponse.confirmOverwrite) {
        return
      }
    } catch (error: any) {
      // continue
    }

    const { payload: orgPayload } = await store.dispatch(fetchOrganizationsAction({}))
    const organizationResponse: { organization } = await inquirer.prompt([
      {
        name: 'organization',
        message: 'Select an organization',
        type: 'list',
        choices: orgPayload.map(org => ({ name: org.sluglified_name })),
      },
    ])

    const orgId = orgPayload.find(org => org.sluglified_name === organizationResponse.organization).id
    const {payload: teamPayload} = await store.dispatch(fetchTeamsAction({
      filter: {
        organization_id: orgId,
      }
    }))

    const teamResponse: { team } = await inquirer.prompt([
      {
        name: 'team',
        message: 'Select an team',
        type: 'list',
        choices: teamPayload.map(team => ({ name: team.sluglified_name })),
      },
    ])

    const reportTypeResponse: { reportType: ReportTypes } = await inquirer.prompt([
      {
        name: 'reportType',
        message: 'Select a reportType',
        type: 'list',
        choices: [
          { name: ReportTypes.website },
          { name: ReportTypes.jupyter },
          { name: ReportTypes.markdown },
        ],
      },
    ])

    let defaultFile = 'index.html'
    if (reportTypeResponse.reportType === ReportTypes.jupyter) {
      defaultFile = 'index.ipynb'
    }
    if (reportTypeResponse.reportType === ReportTypes.markdown) {
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
      },
    ])

    const config = {
      organization: organizationResponse.organization,
      team: teamResponse.team,
      type: reportTypeResponse.reportType,
      title: titleResponse.title,
      main: mainFileResponse.mainFile
    }

    await writeFileSync(join(process.cwd(), 'kyso.yaml'), jsYaml.dump(config))

    this.log(`Wrote config to ${join(process.cwd(), 'kyso.yaml')}`)
  }
}
