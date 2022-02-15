/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable indent */
import { Login as LoginModel, LoginProviderEnum } from '@kyso-io/kyso-model'
import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { interactiveLogin } from '../helpers/interactive-login'
import { authenticateWithGithub, authenticateWithGoogle } from '../helpers/oauths'
import { KysoCommand } from './kyso-command'

export default class Login extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [
    `$ kyso login --organization <organization name> --team <team name>`,
    `$ kyso login --provider kyso --username <username> --password <password> --organization <organization name> --team <team name>`,
    `$ kyso login --provider kyso --username <username> --token <password> --organization <organization name> --team <team name>`,
    `$ kyso login --provider google --username <username> --organization <organization name> --team <team name>`,
    `$ kyso login --provider github --username <username> --organization <organization name> --team <team name>`,
  ]

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'provider',
      required: false,
      options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB],
    }),
    username: Flags.string({
      char: 'u',
      description: 'username',
      required: false,
    }),
    token: Flags.string({
      char: 'k',
      description: 'token',
      required: false,
    }),
    password: Flags.string({
      char: 'p',
      description: 'password',
      required: false,
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

    let loginModel: LoginModel = {
      username: '',
      password: '',
      provider: LoginProviderEnum.KYSO,
      payload: null,
    }

    if (flags?.provider && flags.provider !== '') {
      if (!flags.hasOwnProperty('username')) {
        this.error('Username is required when provider is specified')
      }
      // NON-INTERACTIVE MODE
      switch (flags.provider) {
        case LoginProviderEnum.KYSO:
          if (flags.hasOwnProperty('password')) {
            loginModel.password = flags.password!
          } else if (flags.hasOwnProperty('token')) {
            loginModel.provider = LoginProviderEnum.KYSO_ACCESS_TOKEN
            loginModel.password = flags.token!
          } else {
            this.error('You must provide a password or a token')
          }
          loginModel = {
            username: flags.username!,
            password: flags.password!,
            provider: flags.provider,
            payload: null,
          }
          break
        case LoginProviderEnum.GOOGLE:
          try {
            const googleResult = await authenticateWithGoogle()
            loginModel = {
              username: flags.username!,
              password: googleResult.access_token,
              provider: LoginProviderEnum.GOOGLE,
              payload: googleResult,
            }
          } catch (error: any) {
            this.error(error)
          }
          break
        case LoginProviderEnum.GITHUB:
          const code: string | null = await authenticateWithGithub()
          if (!code) {
            this.error('Authentication failed')
          }
          loginModel = {
            username: flags.username!,
            password: code,
            provider: LoginProviderEnum.GITHUB,
            payload: null,
          }
          break
        default:
          this.error('Provider not supported')
      }
    } else {
      // INTERACTIVE MODE
      try {
        loginModel = await interactiveLogin()
      } catch (error: any) {
        this.error(error)
      }
    }

    await store.dispatch(loginAction(loginModel))
    const { auth } = store.getState()
    if (auth.token) {
      this.saveToken(auth.token, flags.organization || null, flags.team || null)
      this.log('Logged successfully')
    } else {
      this.error('An error occurred making login request')
    }
  }
}
