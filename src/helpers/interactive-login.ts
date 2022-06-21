/* eslint-disable indent */
/* eslint-disable no-case-declarations */
import { Login, LoginProviderEnum } from '@kyso-io/kyso-model'
import { KysoCredentials } from '../types/kyso-credentials'
import { authenticateWithBitbucket, authenticateWithGithub, authenticateWithGitlab, authenticateWithGoogle } from './oauths'
import inquirer = require('inquirer')

export const interactiveLogin = async (kysoCredentials: KysoCredentials | null): Promise<Login> => {
  const login: Login = new Login('', LoginProviderEnum.KYSO, '', null, null)

  const kysoApiResponse: { kysoInstallUrl: string } = await inquirer.prompt([
    {
      name: 'kysoInstallUrl',
      message: 'What is the url of your kyso installation?',
      type: 'input',
      default: kysoCredentials?.kysoInstallUrl,
      validate: function (password: string) {
        if (password === '') {
          return 'Url cannot be empty'
        }
        return true
      },
    },
  ])
  login.kysoInstallUrl = kysoApiResponse.kysoInstallUrl

  const providerResponse: { provider: LoginProviderEnum } = await inquirer.prompt([
    {
      name: 'provider',
      message: 'Select a provider',
      type: 'list',
      choices: [
        { name: 'Kyso', value: LoginProviderEnum.KYSO },
        { name: 'Access token', value: LoginProviderEnum.KYSO_ACCESS_TOKEN },
        { name: 'Gitlab', value: LoginProviderEnum.GITLAB },
        { name: 'Google', value: LoginProviderEnum.GOOGLE },
        // { name: 'Bitbucket', value: LoginProviderEnum.BITBUCKET },
        // { name: 'Github', value: LoginProviderEnum.GITHUB },
      ],
    },
  ])
  login.provider = providerResponse.provider
  switch (login.provider) {
    case LoginProviderEnum.KYSO:
    case LoginProviderEnum.KYSO_ACCESS_TOKEN:
      const emailResponse: { email: string } = await inquirer.prompt([
        {
          name: 'email',
          message: 'What is your email?',
          type: 'input',
          validate: function (password: string) {
            if (password === '') {
              return 'Email cannot be empty'
            }
            return true
          },
        },
      ])
      login.email = emailResponse.email
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
          message: `What is your access token (Get one from ${login.kysoInstallUrl}/settings )?`,
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
        const googleResult: { code: string; redirectUrl: string } | null = await authenticateWithGoogle()
        if (!googleResult) {
          throw new Error('Authentication failed')
        }
        login.password = googleResult.code
        login.payload = googleResult.redirectUrl
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
    case LoginProviderEnum.GITLAB:
      const gitlabCode: { code: string; redirectUrl: string } | null = await authenticateWithGitlab()
      if (!gitlabCode) {
        throw new Error('Authentication failed')
      }
      login.password = gitlabCode.code
      login.payload = gitlabCode.redirectUrl
      break
  }
  if (login.kysoInstallUrl) {
    process.env.KYSO_API = `${login.kysoInstallUrl}/api/v1`
  }
  return login
}
