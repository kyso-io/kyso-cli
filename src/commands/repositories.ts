import { Flags } from '@oclif/core'
import { fetchReposAction, setPageAndLimit, setProvider, setSearchQuery, store } from 'kyso-store'
import { LoginProviderEnum } from 'kyso-store/dist/enums/login-provider.enum'
import { KysoCommand } from './kyso-command'

// export default class Login extends Command {
export default class Repositories extends KysoCommand {
  static description = 'Fetch team information'

  static examples = [`$ kyso-cli repositories --provider kyso --page 1 --limit 10 --filter learning`]

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'Provider',
      required: true,
      options: [LoginProviderEnum.KYSO, LoginProviderEnum.GITHUB, LoginProviderEnum.GOOGLE],
    }),
    page: Flags.integer({
      char: 'p',
      description: 'Page',
      required: true,
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'limit',
      required: true,
    }),
    filter: Flags.string({
      char: 'f',
      description: 'limit',
      required: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    await this.checkCredentials()

    const { flags } = await this.parse(Repositories)
    store.dispatch(setProvider(flags.provider as LoginProviderEnum))
    store.dispatch(setPageAndLimit({ page: flags.page, limit: flags.limit }))
    if (flags?.filter && flags.filter.length > 0) {
      store.dispatch(setSearchQuery(flags.filter))
    }

    await store.dispatch(fetchReposAction())

    const { repos } = store.getState()
    this.log(JSON.stringify(repos.list))
  }
}
