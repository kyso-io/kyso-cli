/* eslint-disable complexity */
/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable indent */
import { Login as LoginModel, LoginProviderEnum } from '@kyso-io/kyso-model'
import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { interactiveLogin } from '../helpers/interactive-login'
import { authenticateWithBitbucket, authenticateWithGithub, authenticateWithGitlab, authenticateWithGoogle, gitlabAuthCallback } from '../helpers/oauths'
import { KysoCommand } from './kyso-command'

export default class Login extends KysoCommand {
  static description = 'Login into Kyso'

  static examples = [
    `$ kyso login <-- Will prompt a guided login`,
    `$ kyso login --organization <organization name> --team <team name>`,
    `$ kyso login --provider kyso --username <username> --password <password> --organization <organization name> --team <team name>`,
    `$ kyso login --provider kyso --username <username> --token <password> --organization <organization name> --team <team name>`,
    `$ kyso login --provider google --organization <organization name> --team <team name>`,
    `$ kyso login --provider github --organization <organization name> --team <team name>`,
    // `$ kyso login --provider bitbucket --organization <organization name> --team <team name>`,
    `$ kyso login --provider gitlab --organization <organization name> --team <team name>`,
  ]

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'provider',
      required: false,
      // options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.BITBUCKET],
      options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.GITLAB],
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

    let loginModel: LoginModel = new LoginModel('', LoginProviderEnum.KYSO, '', null)

    if (flags?.provider && flags.provider !== '') {
      // NON-INTERACTIVE MODE
      switch (flags.provider) {
        case LoginProviderEnum.KYSO:
          if (!flags.hasOwnProperty('username')) {
            this.error('Username is required when provider is specified')
          }
          if (flags.hasOwnProperty('password')) {
            loginModel.password = flags.password!
          } else if (flags.hasOwnProperty('token')) {
            loginModel.provider = LoginProviderEnum.KYSO_ACCESS_TOKEN
            loginModel.password = flags.token!
          } else {
            this.error('You must provide a password or a token')
          }
          loginModel = new LoginModel(flags.password!, flags.provider, flags.username!, null)
          break
        case LoginProviderEnum.GOOGLE:
          try {
            const googleResult = await authenticateWithGoogle()
            loginModel = new LoginModel(googleResult.id_token, LoginProviderEnum.GOOGLE, '', googleResult)
          } catch (error: any) {
            this.error(error)
          }
          break
        case LoginProviderEnum.GITHUB:
          const code: string | null = await authenticateWithGithub()
          if (!code) {
            this.error('Authentication failed')
          }
          loginModel = new LoginModel(code, LoginProviderEnum.GITHUB, '', null)
          break
        case LoginProviderEnum.BITBUCKET:
          try {
            const code: string | null = await authenticateWithBitbucket()
            if (!code) {
              this.error('Authentication failed')
            }
            loginModel = new LoginModel(code, LoginProviderEnum.BITBUCKET, '', null)
          } catch (error: any) {
            this.error(error)
          }
          break
        case LoginProviderEnum.GITLAB:
          try {
            const code: string | null = await authenticateWithGitlab()
            if (!code) {
              this.error('Authentication failed')
            }
            loginModel = new LoginModel(code, LoginProviderEnum.GITLAB, '', gitlabAuthCallback)
          } catch (error: any) {
            this.error(error)
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
