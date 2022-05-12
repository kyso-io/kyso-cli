/* eslint-disable complexity */
/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable indent */
import { Login as LoginModel, LoginProviderEnum } from '@kyso-io/kyso-model'
import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { interactiveLogin } from '../helpers/interactive-login'
import { authenticateWithBitbucket, authenticateWithGithub, authenticateWithGitlab, authenticateWithGoogle } from '../helpers/oauths'
import { KysoCommand } from './kyso-command'

export default class Login extends KysoCommand {
  static description = 'Login into Kyso'

  static examples = [
    `** NOTE: If you plan to use kyso-cli inside a CI/CD pipeline, we strongly recommend to use access tokens **`,
    `# To use the interactive login
    $ kyso login`,
    `# Direct login using kyso provider and password
    $ kyso login --provider kyso --username <your_email> --password <your_password>`,
    `# Direct login using kyso provider and access token
    $ kyso login --provider kyso --username <your_email> --token <your_access_token>`,
    `# Login using github provider (will prompt a browser window to log in). The same behavior happens using the rest of external providers 
    $ kyso login --provider github`,
  ]

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'Authentication provider',
      required: false,
      // options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.BITBUCKET],
      // options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.GITLAB],
      options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITLAB],
    }),
    username: Flags.string({
      char: 'u',
      description: 'Your email',
      required: false,
      multiple: false,
    }),
    token: Flags.string({
      char: 'k',
      description: 'Your access token',
      required: false,
      multiple: false,
    }),
    password: Flags.string({
      char: 'p',
      description: 'Your password',
      required: false,
      multiple: false,
    }),
    // Should we give that option? Hidden
    organization: Flags.string({
      char: 'o',
      description: 'Your organization',
      required: false,
      hidden: true,
    }),
    // Should we give that option? Hidden
    team: Flags.string({
      char: 't',
      description: 'Your team',
      required: false,
      hidden: true,
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
            const googleResult: { code: string; redirectUrl: string } | null = await authenticateWithGoogle()
            if (!googleResult) {
              this.error('Google authentication failed')
              break
            }
            loginModel = new LoginModel(googleResult.code, LoginProviderEnum.GOOGLE, '', googleResult.redirectUrl)
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
            const gitlabResult: { code: string; redirectUrl: string } | null = await authenticateWithGitlab()
            if (!gitlabResult) {
              this.error('Authentication failed')
            }
            loginModel = new LoginModel(gitlabResult.code, LoginProviderEnum.GITLAB, '', gitlabResult.redirectUrl)
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

    const { auth, error } = store.getState()
    if (auth.token) {
      this.saveToken(auth.token, flags.organization || null, flags.team || null)
      this.log('Logged successfully')
    } else {
      this.log(error.text)
      this.error('An error occurred making login request')
    }
  }
}
