/* eslint-disable complexity */
/* eslint-disable no-prototype-builtins */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { createKysoReportAction, loginAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as jsYaml from 'js-yaml'
import { isAbsolute, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import { interactiveLogin } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path <name>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: true,
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

    const { flags } = await this.parse(Push)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)

    let files: string[] = getAllFiles(basePath, [])

    let kysoConfigFile: KysoConfigFile | null = null
    let kysoConfigPath: string | null = null
    try {
      const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
      kysoConfigFile = data.kysoConfigFile
      kysoConfigPath = data.kysoConfigPath
    } catch (error: any) {
      this.error(error)
    }

    let writeConfigFile = false
    if (!kysoConfigFile.hasOwnProperty('title') || kysoConfigFile.title.length === 0) {
      kysoConfigFile.title = uuidv4()
      writeConfigFile = true
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
      }
      return true
    })

    // Check if main file is given
    if (!kysoConfigFile.hasOwnProperty('main') || kysoConfigFile.main.length === 0) {
      const mainFileOptions: string[] = ['index.html', 'index.ipynb', 'readme.md']
      // Search main files
      for (const mainFileOption of mainFileOptions) {
        const mainFile: string | undefined = files.find((file: string) => file.endsWith(mainFileOption))
        if (mainFile) {
          kysoConfigFile.main = mainFileOption
          writeConfigFile = true
          break
        }
      }
    }

    if (writeConfigFile) {
      if (kysoConfigPath.endsWith('.json')) {
        writeFileSync(kysoConfigPath, JSON.stringify(kysoConfigFile, null, 2))
      } else {
        const yamlStr: string = jsYaml.dump(kysoConfigFile)
        writeFileSync(kysoConfigPath, yamlStr, 'utf8')
      }
    }

    this.log(`\nUploading ${files.length} files:\n`)
    for (const file of files) {
      let formatedFilePath = file.replace(basePath, '')
      if (formatedFilePath.startsWith('/')) {
        formatedFilePath = formatedFilePath.slice(1)
      }
      this.log(`${formatedFilePath}`)
    }
    this.log('\n')

    const result = await store.dispatch(
      createKysoReportAction({
        title: kysoConfigFile!.title,
        description: kysoConfigFile!.description,
        tags: kysoConfigFile!.tags || [],
        organization: kysoConfigFile!.organization,
        team: kysoConfigFile!.team,
        filePaths: files,
        basePath,
      })
    )
    if (result?.payload) {
      this.log(`Successfully uploaded report`)
    } else {
      this.error(`An error occurred while uploading report`)
    }
  }
}
