import { Flags } from '@oclif/core'
import { loginAction, store } from '@kyso-io/kyso-store'
import { KysoCommand } from './kyso-command'

export default class Login extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [
    `$ oex login --username admin --password 123456 --provider kyso
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
    console.log(auth)
    if (auth.token) {
      this.saveToken(auth.token)
      this.log('Logged successfully')
    } else {
      this.error('An error occurred making login request')
    }
  }
}
