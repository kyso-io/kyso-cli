/* eslint-disable no-case-declarations */
/* eslint-disable indent */
import { Login, LoginProviderEnum } from '@kyso-io/kyso-model'
import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import * as inquirer from 'inquirer'
import { authenticateWithGithub, authenticateWithGoogle } from '../helpers/oauths'
import { KysoCommand } from './kyso-command'

export default class InteractiveLogin extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [`$ kyso interactive-login --organization <organization name> --team <team name>`]

  static flags = {
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
    const { flags } = await this.parse(InteractiveLogin)

    const login: Login = {
      username: '',
      password: '',
      provider: LoginProviderEnum.KYSO,
      payload: null,
    }
    const providerResponse: { provider: LoginProviderEnum } = await inquirer.prompt([
      {
        name: 'provider',
        message: 'Select a provider',
        type: 'list',
        choices: [
          { name: 'Kyso', value: LoginProviderEnum.KYSO },
          { name: 'Access token', value: LoginProviderEnum.KYSO_ACCESS_TOKEN },
          { name: 'Google', value: LoginProviderEnum.GOOGLE },
          { name: 'Github', value: LoginProviderEnum.GITHUB },
        ],
      },
    ])
    login.provider = providerResponse.provider
    const usernameResponse: { username: string } = await inquirer.prompt([
      {
        name: 'username',
        message: 'What is your username?',
        type: 'input',
        validate: function (password: string) {
          if (password === '') {
            return 'Username cannot be empty'
          }
          return true
        },
      },
    ])
    login.username = usernameResponse.username
    switch (providerResponse.provider) {
      case LoginProviderEnum.KYSO:
        const passwordResponse: { password: string } = await inquirer.prompt([
          {
            name: 'password',
            message: 'What is your password?',
            type: 'password',
            mask: '*',
            validate: function (password: string) {
              if (password === '') {
                return 'Password cannot be empty'
              }
              return true
            },
          },
        ])
        login.password = passwordResponse.password
        break
      case LoginProviderEnum.KYSO_ACCESS_TOKEN:
        const accessTokenResponse: { accessToken: string } = await inquirer.prompt([
          {
            name: 'accessToken',
            message: 'What is your access token?',
            type: 'accessToken',
            mask: '*',
            validate: function (accessToken: string) {
              if (accessToken === '') {
                return 'Access token cannot be empty'
              }
              return true
            },
          },
        ])
        login.password = accessTokenResponse.accessToken
        break
      case LoginProviderEnum.GOOGLE:
        try {
          const googleResult = await authenticateWithGoogle()
          login.password = googleResult.access_token
          login.payload = googleResult
        } catch (error: any) {
          this.error(error)
        }
        break
      case LoginProviderEnum.GITHUB:
        const code: string | null = await authenticateWithGithub()
        if (!code) {
          this.error('Authentication failed')
        }
        login.password = code
        break
    }
    await store.dispatch(loginAction(login))
    const { auth } = store.getState()
    if (auth.token) {
      this.saveToken(auth.token, flags.organization || null, flags.team || null)
      this.log('Login succeeded')
    } else {
      this.error('An error occurred making login request')
    }
  }
}
