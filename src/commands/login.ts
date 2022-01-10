import { Command, Flags } from '@oclif/core'
import { store } from '../store'
import { loginAction } from '../store/auth/auth-slice'

export default class Login extends Command {
  static description = 'Make login request to the server'

  static examples = [
    `$ oex login
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey.....e--Elg9G6qO4wXzPIlnDc77fdBoHNoq6SbtuqDPN1uc
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
    await store.dispatch(
      loginAction({
        username: flags.username,
        password: flags.password,
        provider: flags.provider,
      })
    )
    const { auth } = store.getState()
    this.log(auth?.token || 'An error occurred making login request')
  }
}
