/* eslint-disable indent */
/* eslint-disable no-case-declarations */
import { Login, LoginProviderEnum } from '@kyso-io/kyso-model'
import { authenticateWithBitbucket, authenticateWithGithub, authenticateWithGoogle } from './oauths'
import inquirer = require('inquirer')

export const interactiveLogin = async (): Promise<Login> => {
  const login: Login = new Login('', LoginProviderEnum.KYSO, '', null)

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
        { name: 'Bitbucket', value: LoginProviderEnum.BITBUCKET },
      ],
    },
  ])
  login.provider = providerResponse.provider
  switch (login.provider) {
    case LoginProviderEnum.KYSO:
    case LoginProviderEnum.KYSO_ACCESS_TOKEN:
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
      break
  }
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
        login.password = googleResult.id_token
        login.payload = googleResult
      } catch (error: any) {
        throw new Error(error)
      }
      break
    case LoginProviderEnum.GITHUB:
      const githubCode: string | null = await authenticateWithGithub()
      if (!githubCode) {
        throw new Error('Authentication failed')
      }
      login.password = githubCode
      break
    case LoginProviderEnum.BITBUCKET:
      const bitbucketCode: string | null = await authenticateWithBitbucket()
      if (!bitbucketCode) {
        throw new Error('Authentication failed')
      }
      login.password = bitbucketCode
      break
  }
  return login
}
