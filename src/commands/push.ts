/* eslint-disable max-depth */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-negated-condition */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { createKysoReportAction, loginAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as nanoid from 'nanoid'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import { getValidFiles } from '../helpers/get-valid-files'
import { interactiveLogin } from '../helpers/interactive-login'
import slugify from '../helpers/slugify'
import { KysoCommand } from './kyso-command'
import inquirer = require('inquirer')

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path <report_folder> --inlineComments`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push',
      required: false,
      default: '.',
    }),
    inlineComments: Flags.enum({
      char: 'i',
      options: ['y', 'n'],
      description: 'Inline comments',
      required: false,
    }),
  }

  static args = []

  private async uploadReport(basePath: string, enabledInlineComments: boolean): Promise<void> {
    const parts: string[] = basePath.split('/')
    const folderName: string = parts[parts.length - 1]
    const kysoCredentials = JSON.parse(readFileSync(this.tokenFilePath, 'utf8').toString())
    this.log(`Uploading report '${folderName}'`)

    let files: string[] = getAllFiles(basePath, [])

    let kysoConfigFile: KysoConfigFile | null = null
    try {
      const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
      kysoConfigFile = data.kysoConfigFile
    } catch (error: any) {
      this.error(error)
    }

    if (kysoConfigFile?.organization && kysoConfigFile.organization.length > 0) {
      store.dispatch(setOrganizationAuthAction(kysoConfigFile.organization))
    }
    if (kysoConfigFile?.team && kysoConfigFile.team.length > 0) {
      store.dispatch(setTeamAuthAction(kysoConfigFile.team))
    }

    if (kysoConfigFile?.reports) {
      for (const reportFolderName of kysoConfigFile.reports) {
        const folderBasePath = join(basePath, reportFolderName)
        const folderFiles: string[] = getValidFiles(folderBasePath)
        files = [...files, ...folderFiles]
      }
    } else {
      files = getValidFiles(basePath)
    }

    this.log(`\nFounded ${files.length} ${files.length > 1 ? 'files' : 'file'}:`)

    if (enabledInlineComments) {
      for (const file of files) {
        if (file.endsWith('.ipynb') && !file.includes('ipynb_checkpoints')) {
          let modifiedFile = false
          const fileContent: any = JSON.parse(readFileSync(file, 'utf8').toString())
          for (const cell of fileContent.cells) {
            if (!cell.hasOwnProperty('id')) {
              cell.id = nanoid(8)
              modifiedFile = true
            }
          }
          if (modifiedFile) {
            writeFileSync(file, JSON.stringify(fileContent, null, 2))
          }
        }
      }
    }

    this.log('\nUploading files. Wait a moment..\n')

    const result: any = await store.dispatch(
      createKysoReportAction({
        filePaths: files,
        basePath,
      })
    )
    if (result?.payload?.isAxiosError || result.payload === null) {
      this.error(`\n😞 Something went wrong. Please check the console log.`)
    } else {
      const reportUrl = `${kysoCredentials.kysoInstallUrl}/${kysoConfigFile.organization}/${kysoConfigFile.team}/${slugify(kysoConfigFile.title)}`
      this.log(`\n🎉🎉🎉 Report was uploaded to\n\n${reportUrl}\n\n🎉🎉🎉\n`)
    }
  }

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

    const { flags } = await this.parse(Push)
    let enabledInlineComments = false
    if (!flags.inlineComments) {
      const result: { inlineComments: boolean } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'inlineComments',
          message: 'Do you want to inline comments?',
          default: true,
        },
      ])
      enabledInlineComments = result.inlineComments
    } else {
      enabledInlineComments = flags.inlineComments === 'y'
    }

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    await this.uploadReport(basePath, enabledInlineComments)
  }
}
