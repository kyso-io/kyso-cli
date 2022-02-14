import { importGithubRepositoryAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { KysoCommand } from './kyso-command'

export default class ImportGithubRepository extends KysoCommand {
  static description = 'Import Github repository to Kyso'

  static examples = [`$ kyso import-github-repository --name <repository name> --branch <branch>`]

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'name',
      required: true,
    }),
    branch: Flags.string({
      char: 'b',
      description: 'branch',
      required: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    this.checkCredentials()

    const { flags } = await this.parse(ImportGithubRepository)
    this.log(`Importing Github repository ${flags.name}. Will take a while...`)

    const args: any = {
      repositoryName: flags.name,
    }
    if (flags.branch) {
      args.branch = flags.branch
    }

    await store.dispatch(importGithubRepositoryAction(args))
    this.log(`Successfully uploaded report`)
  }
}
