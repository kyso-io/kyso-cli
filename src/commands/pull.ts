import { KysoConfigFile } from '@kyso-io/kyso-model'
import { pullReportAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import * as AdmZip from 'adm-zip'
import { readdirSync } from 'fs'
import { join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Pull repository from Kyso'

  static examples = [`$ kyso pull --path <name>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: false,
      default: '.',
    }),
    team: Flags.string({
      char: 't',
      description: 'team',
      required: false,
      default: '',
    }),
    report: Flags.string({
      char: 'r',
      description: 'report',
      required: false,
      default: '',
    }),
  }

  static args = []

  async run(): Promise<void> {
    this.checkCredentials()

    this.log('Pulling report. Wait...')
    const { flags } = await this.parse(Push)
    let files: string[] = readdirSync(flags.path)
    
    if(flags?.team && flags?.report) {
      await this.extractReport(flags.team, flags.report, flags.path);
    } else {
      if (flags?.path) {
        files = files.map((file: string) => join(flags.path, file))
      }
  
      let kysoConfigFile: KysoConfigFile | null = null
      try {
        const data: { kysoConfigFile: KysoConfigFile; kysoConfigPath: string } = findKysoConfigFile(files)
        kysoConfigFile = data.kysoConfigFile
      } catch (error: any) {
        this.error(error)
      }

      this.extractReport(kysoConfigFile.team, kysoConfigFile.title, flags.path)
    }
  }

  async extractReport(team, report, path) {
    const result = await store.dispatch(
      pullReportAction({
        teamName: team,
        reportName: report,
      })
    )
    if (!result || !result.payload) {
      this.error('Error pulling report')
    }

    const zip: AdmZip = new AdmZip(result.payload as Buffer)
    zip.extractAllTo(path, true)
    this.log('Already up to date.')
  }
}


  /*

  async extractReport() {
    const result = await store.dispatch(
      pullReportAction({
        teamName: kysoConfigFile.team,
        reportName: kysoConfigFile.title,
      })
    )
    if (!result || !result.payload) {
      this.error('Error pulling report')
    }

    const zip: AdmZip = new AdmZip(result.payload as Buffer)
    zip.extractAllTo(flags.path, true)
    this.log('Already up to date.')
  }
}
*/