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

export default class Format extends KysoCommand {
  static description = 'Format your current report files to add new great features'

  static examples = [`$ kyso format --jupyter`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push. Default is "."',
      required: false,
      default: '.',
    }),
    jupyter: Flags.boolean({
      char: 'j',
      description: 'Search and process all the ipynb files to allow inline comments at Kyso',
      required: false
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Automatically answers "yes" to all the prompts',
      required: false
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false
    })
  }

  static args = []

  async run(): Promise<void> {
    const { flags } = await this.parse(Format);
    
    if(flags.verbose) {
      this.log("Enabled verbose mode");
      this.enableVerbose();
    }

    if(flags.jupyter) {
      this.formatJupyterFiles(flags);
    }
    
    if(flags.verbose) {
      this.log("Disabling verbose mode");
      this.disableVerbose();
    }
  }

  async formatJupyterFiles(flags: any) {
    let _yes = false;
      
    if(!flags.yes) {
      const result: { inlineComments: boolean } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'inlineComments',
          message: 
`Jupyter notebooks of v4.5 & above have unique cell identifiers, allowing Kyso to add inline comments to the reports. It seems that you are using an older version of Jupyter. If you want to allow for inline comments on your report without updating your version of Jupyter, select 'yes' and Kyso will process all notebooks in this push & set a random identifier automatically to all cells, with no side effects to the content of the report(s). If you select 'no' the notebooks will be published without cell ids.          

These changes will modify your .ipynb files in your local filesystem, do you want to continue?\n`,

          default: true,
        },
      ]);

      _yes = result.inlineComments;
    } else {
      _yes = true;
    }
    const _files = getValidFiles(flags.path)
    const hasIpynbFiles = _files.filter((x:string) => x.includes(".ipynb")).length > 0 ? true : false;

    if(!hasIpynbFiles) {
      this.log(`Can't find any .ipynb files in the base path ${flags.path}`);
      return;
    }

    if(_yes) {
      const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)

      let files: string[] = getAllFiles(basePath, [])

      let kysoConfigFile: KysoConfigFile | null = null
      
      try {
        const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
        kysoConfigFile = data.kysoConfigFile
      } catch (error: any) {
        this.error(error)
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

      for (const file of files) {
        if (file.endsWith('.ipynb') && !file.includes('ipynb_checkpoints')) {
          this.log(`🔍 Processing ${file}...`)
          let modifiedFile = false
          const fileContent: any = JSON.parse(readFileSync(file, 'utf8').toString())

          let identifiersAdded: number = 0;

          for (const cell of fileContent.cells) {
            if (!cell.hasOwnProperty('id')) {
              cell.id = (uuidv4() as string).substring(0, 8);
              modifiedFile = true
              identifiersAdded++;
            }
          }
          if (modifiedFile) {
            this.log(`⚙️  Added ${identifiersAdded} identifiers. Using git? Remember to push your changes! `);
            writeFileSync(file, JSON.stringify(fileContent, null, 2))
            this.log(`💾 Saved ${file}`)
          }
        }
      }
    }
  }
}
