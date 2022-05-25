/* eslint-disable indent */
import { Login, RepositoryProvider } from '@kyso-io/kyso-model'
import { importBitbucketRepositoryAction, importGithubRepositoryAction, importGitlabRepositoryAction, loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { interactiveLogin } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'

export default class ImportRepository extends KysoCommand {
  static description = 'Import repository to Kyso'

  static examples = [
    `$ kyso import-repository --provider github --name <repository_name> --branch <branch>`,
    `$ kyso import-repository --provider bitbucket --name <workspace/repository-name> --branch <branch>`,
    `$ kyso import-repository --provider gitlab --name <id | name_with_namespace> --branch <branch>`,
  ]

  static flags = {
    provider: Flags.string({
      char: 'p',
      description: 'provider',
      required: true,
      options: [RepositoryProvider.BITBUCKET, RepositoryProvider.GITLAB, RepositoryProvider.GITHUB],
    }),
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
    const logged: boolean = await this.checkCredentials()
    if (!logged) {
      const login: Login = await interactiveLogin(this.getCredentials())
      await store.dispatch(loginAction(login))
      const { auth } = store.getState()
      if (auth.token) {
        this.saveToken(auth.token, null, null, login.kysoInstallUrl, null)
      } else {
        this.error('An error occurred making login request')
      }
    }

    const { flags } = await this.parse(ImportRepository)
    this.log(`Importing ${flags.provider} repository ${flags.name}. Will take a while...`)

    const args: any = {
      repositoryName: flags.name,
    }
    if (flags.branch) {
      args.branch = flags.branch
    }

    let result: any = null
    switch (flags.provider) {
      case RepositoryProvider.GITHUB:
        result = await store.dispatch(importGithubRepositoryAction(args))
        break
      case RepositoryProvider.BITBUCKET:
        result = await store.dispatch(importBitbucketRepositoryAction(args))
        break
      case RepositoryProvider.GITLAB:
        result = await store.dispatch(importGitlabRepositoryAction(args))
        break
    }
    if (result?.error) {
      this.error(result.error.message)
    } else {
      this.log(`Successfully uploaded report`)
    }
  }
}
