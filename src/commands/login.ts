import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { KysoCommand } from './kyso-command'

export default class Login extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [
    `$ kyso login --username <username> --password <password> --provider <provider> --organization <organization name> --team <team name>
    Logged successfully
    `,
  ]

  static flags = {
    username: Flags.string({
      char: 'u',
      description: 'username',
      required: true,
    }),
    password: Flags.string({
      char: 'p',
      description: 'password',
      required: true,
    }),
    provider: Flags.string({
      char: 'r',
      description: 'provider',
      required: true,
    }),
    organization: Flags.string({
      char: 'o',
      description: 'organization',
      required: false,
    }),
    team: Flags.string({
      char: 't',
      description: 'team',
      required: false,
    }),
  }

  static args = []

  async run(): Promise<void> {
    const { flags } = await this.parse(Login)
    const credentials = {
      username: flags.username,
      password: flags.password,
      provider: flags.provider,
    }
    await store.dispatch(loginAction(credentials))
    const { auth } = store.getState()
    if (auth.token) {
      this.saveToken(auth.token, flags.organization || null, flags.team || null)
      this.log('Logged successfully')
    } else {
      this.error('An error occurred making login request')
    }
  }
}
