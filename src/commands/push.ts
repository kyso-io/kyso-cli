import { KysoConfigFile } from '@kyso-io/kyso-model'
import { createKysoReportAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { KysoCommand } from './kyso-command'

const getAllFiles = function (dirPath: string, arrayOfFiles: string[]): string[] {
  const files: string[] = readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  for (const file of files) {
    if (file.endsWith('.git') || file.endsWith('.ipynb_checkpoints')) {
      continue
    }
    if (statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(join(dirPath, '/', file))
    }
  }
  return arrayOfFiles
}

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
    console.log("Checking credentials")
    this.checkCredentials()

    console.log('Uploading report. Wait...')
    const { flags } = await this.parse(Push)

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath = isAbsolute(flags.path) ? flags.path : join('.', flags.path)

    let files: string[] = getAllFiles(basePath, [])

    let kysoConfig: KysoConfigFile | null = null
    try {
      kysoConfig = findKysoConfigFile(files)
    } catch (error: any) {
      this.error(error)
    }

    if (kysoConfig?.organization && kysoConfig.organization.length > 0) {
      store.dispatch(setOrganizationAuthAction(kysoConfig.organization))
    }
    if (kysoConfig?.team && kysoConfig.team.length > 0) {
      store.dispatch(setTeamAuthAction(kysoConfig.team))
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

    console.log("Calling store with:")
    const data = {
      title: kysoConfig!.title,
      description: kysoConfig!.description,
      tags: kysoConfig!.tags || [],
      organization: kysoConfig!.organization,
      team: kysoConfig!.team,
      filePaths: files,
      basePath,
    };
    
    console.log(data)
    
    const reportDto = await store.dispatch(
      createKysoReportAction({
        title: kysoConfig!.title,
        description: kysoConfig!.description,
        tags: kysoConfig!.tags || [],
        organization: kysoConfig!.organization,
        team: kysoConfig!.team,
        filePaths: files,
        basePath,
      })
    )

    this.log(reportDto.payload as any)
  }
}
