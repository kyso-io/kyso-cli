import { createKysoReportAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { KysoConfig } from '../interfaces/kyso-config'
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
      required: false,
      default: '.',
    }),
  }

  static args = []

  async run(): Promise<void> {
    this.checkCredentials()

    this.log('Uploading report. Wait...')
    const { flags } = await this.parse(Push)
    let files: string[] = getAllFiles(flags.path, [])

    const index: number = files.findIndex((file: string) => file.endsWith('kyso.json'))
    if (index === -1) {
      this.error('kyso.json not found')
    }
    const kysoConfig: KysoConfig = JSON.parse(readFileSync(files[index], 'utf8').toString())
    const gitIgnores: any[] = files.filter((file: string) => file.endsWith('.gitignore'))
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

    const reportDto = await store.dispatch(
      createKysoReportAction({
        title: kysoConfig.title,
        description: kysoConfig.description,
        organization: kysoConfig.organization,
        team: kysoConfig.team,
        filePaths: files,
        basePath: flags?.path ? flags.path : null,
      })
    )
    this.log(reportDto.payload as any)
  }
}
