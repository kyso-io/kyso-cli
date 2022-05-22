/* eslint-disable no-await-in-loop */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { createKysoReportAction, loginAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readdirSync, readFileSync } from 'fs'
import slugify from '../helpers/slugify'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import { interactiveLogin } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path <report_folder>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push',
      required: false,
      default: "."
    }),
  }

  static args = []

  private async uploadReport(basePath: string): Promise<void> {
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

    const gitIgnores: any[] = files.filter((file: string) => file.endsWith('.gitignore') || file.endsWith('.kysoignore'))
    let ignoredFiles: string[] = []
    for (const gitIgnore of gitIgnores) {
      const ifs: string[] = readFileSync(gitIgnore, 'utf8').toString().split('\n')
      // Delete empty lines
      ignoredFiles = [...ignoredFiles, ...ifs.filter((file: string) => file.length > 0)]
    }
    files = files.filter((file: string) => {
      for (const ignoredFile of ignoredFiles) {
        if (file.endsWith(ignoredFile)) {
          return false
        }
        if (file.startsWith(ignoredFile)) {
          return false
        }
      }
      return true
    })

    this.log(`\nFounded ${files.length} ${files.length > 1 ? 'files' : 'file'}:`)
    for (const file of files) {
      let formatedFilePath = file.replace(basePath, '')
      if (formatedFilePath.startsWith('/')) {
        formatedFilePath = formatedFilePath.slice(1)
      }
      this.log(`Processing ${file}`)
    }

    this.log('\nUploading files. Wait a moment..\n')

    const result: any = await store.dispatch(
      createKysoReportAction({
        filePaths: files,
        basePath,
      })
    )
    if (result?.payload?.isAxiosError) {
      this.error(`😞 Something went wrong: ${result.payload.response.data.statusCode} ${result.payload.response.data.message}`)
    } else {
      const reportUrl = `${kysoCredentials.kysoInstallUrl}/${kysoConfigFile.organization}/${kysoConfigFile.team}/${slugify(kysoConfigFile.title)}`
      this.log(`\n🎉🎉🎉 Report was uploaded to\n\n${reportUrl}\n\n🎉🎉🎉\n`)
    }
  }

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

    const { flags } = await this.parse(Push)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    await this.uploadReport(basePath)
  }
}
