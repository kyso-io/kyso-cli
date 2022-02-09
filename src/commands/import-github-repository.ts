import { importGithubRepositoryAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { KysoCommand } from './kyso-command'

export default class ImportGithubRepository extends KysoCommand {
  static description = 'Import Github repository to Kyso'

  static examples = [`$ kyso import-github-repository --name <repository name>`]

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'name',
      required: true,
    }),
  }

  static args = []

  async run(): Promise<void> {
    this.checkCredentials()

    const { flags } = await this.parse(ImportGithubRepository)
    this.log(`Importing Github repository ${flags.name}. Will take a while...`)

    const reportDto = await store.dispatch(importGithubRepositoryAction(flags.name))
    // this.log(reportDto.payload as any)
    this.log(`Successfully uploaded report`)
  }
}
