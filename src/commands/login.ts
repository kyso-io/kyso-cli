/* eslint-disable no-case-declarations */
/* eslint-disable camelcase */
/* eslint-disable unicorn/prefer-module */
/* eslint-disable no-prototype-builtins */
/* eslint-disable indent */
import { LoginProviderEnum } from '@kyso-io/kyso-model'
import { loginAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { google } from 'googleapis'
import * as http from 'http'
import * as open from 'open'
import { KysoCommand } from './kyso-command'
const destroyer = require('server-destroy')

const PORT = process.env.PORT || 3000
const serverBaseUrl = `http://localhost:${PORT}`

// GOOGLE
const googleAuthCallback = `${serverBaseUrl}${process.env.AUTH_GOOGLE_REDIRECT_URL}`
const oauth2Client = new google.auth.OAuth2(process.env.AUTH_GOOGLE_CLIENT_ID, process.env.AUTH_GOOGLE_CLIENT_SECRET, googleAuthCallback)
google.options({ auth: oauth2Client })

async function authenticateWithGoogle(scopes: string[]): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
    })
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(process.env.AUTH_GOOGLE_REDIRECT_URL!)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams
            res.end('Authentication successful! Please return to the console.')
            server.close()
            // eslint-disable-next-line semi-style
            ;(server as any).destroy()
            const getTokenResponse = await oauth2Client.getToken(qs.get('code')!)
            resolve(getTokenResponse.tokens)
          } else {
            resolve(null)
          }
        } catch (error) {
          console.log(error)
          reject(error)
        }
      })
      .listen(PORT, () => {
        open(authorizeUrl, { wait: false }).then(cp => cp.unref())
      })
    destroyer(server)
  })
}

// GITHUB
const githubAuthCallback = `${serverBaseUrl}${process.env.AUTH_GITHUB_REDIRECT_URL}`

async function authenticateWithGithub(): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(process.env.AUTH_GITHUB_REDIRECT_URL!)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams
            res.end('Authentication successful! Please return to the console.')
            server.close()
            // eslint-disable-next-line semi-style
            ;(server as any).destroy()
            resolve(qs.get('code')!)
          } else {
            resolve(null)
          }
        } catch (error) {
          console.log(error)
          reject(error)
        }
      })
      .listen(PORT, () => {
        open(`https://github.com/login/oauth/authorize?client_id=${process.env.AUTH_GITHUB_CLIENT_ID}&redirect_uri=${githubAuthCallback}`, { wait: false }).then(cp => cp.unref())
      })
    destroyer(server)
  })
}

export default class Login extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [
    `$ kyso login --provider <provider> --username <username> --password <password> --organization <organization name> --team <team name>
    Logged successfully
    `,
  ]

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'provider',
      required: true,
    }),
    username: Flags.string({
      char: 'u',
      description: 'username',
      required: true,
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

    let credentials: any = null
    switch (flags.provider) {
      case LoginProviderEnum.KYSO:
        if (!flags.hasOwnProperty('password') && flags.password === '') {
          this.error('Password is required')
        }
        credentials = {
          username: flags.username,
          password: flags.password!,
          provider: flags.provider,
          payload: null,
        }
        break
      case LoginProviderEnum.GOOGLE:
        try {
          const scopes: string[] = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/user.emails.read']
          const googleResult = await authenticateWithGoogle(scopes)
          credentials = {
            username: flags.username,
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
        credentials = {
          username: flags.username,
          password: code,
          provider: LoginProviderEnum.GITHUB,
          payload: null,
        }
        break
      default:
        this.error('Provider not supported')
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
