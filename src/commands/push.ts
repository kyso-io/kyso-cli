/* eslint-disable max-depth */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-negated-condition */
import { KysoConfigFile, Login } from '@kyso-io/kyso-model'
import { createKysoReportAction, loginAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import { getValidFiles } from '../helpers/get-valid-files'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import slugify from '../helpers/slugify'
import { KysoCommand } from './kyso-command'
import inquirer = require('inquirer')
import { v4 as uuidv4 } from 'uuid';

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path <report_folder> --inlineComments`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push. Default is "."',
      required: false,
      default: '.',
    }),
    inlineComments: Flags.enum({
      char: 'i',
      options: ['y', 'n'],
      description: 'Postprocess the .ipynb files to allow inline comments at Kyso',
      required: false,
    }),
    verbose: Flags.enum({
      char: 'v',
      options: [],
      description: 'Verbose mode for debugging',
      required: false,
    })
  }

  static args = []

  private async uploadReport(basePath: string, enabledInlineComments: boolean): Promise<void> {
    const parts: string[] = basePath.split('/')
    const folderName: string = parts[parts.length - 1]
    const kysoCredentials = JSON.parse(readFileSync(KysoCommand.tokenFilePath, 'utf8').toString())
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
              cell.id = (uuidv4() as string).substring(0, 8);
              console.log(cell.id);
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
    const { flags } = await this.parse(Push);
    
    if(flags.verbose) {
      this.log("Enabled verbose mode");
      this.enableVerbose();
    }

    await launchInteractiveLoginIfNotLogged()

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    let enabledInlineComments = false;

    const files = getValidFiles(flags.path)
    const hasIpynbFiles = files.filter((x:string) => x.includes(".ipynb")).length > 0 ? true : false;
    
    if (!flags.inlineComments && hasIpynbFiles) {
      const result: { inlineComments: boolean } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'inlineComments',
          message: 
`Uploading Jupyter notebook files ... 🤔
          
Jupyter notebooks of v4.5 & above have unique cell identifiers, allowing Kyso to add inline comments to the reports. It seems that you are using an older version of Jupyter. If you want to allow for inline comments on your report without updating your version of Jupyter, select 'yes' and Kyso will process all notebooks in this push & set a random identifier automatically to all cells, with no side effects to the content of the report(s). If you select 'no' the notebooks will be published without cell ids.          

These changes will modify your .ipynb files in your local filesystem, do you want to continue?`,

          default: true,
        },
      ])
      enabledInlineComments = result.inlineComments
    } else {
      enabledInlineComments = flags.inlineComments === 'y'
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    await this.uploadReport(basePath, enabledInlineComments)

    this.log("Disabling verbose mode");
    this.disableVerbose();
  }
}
