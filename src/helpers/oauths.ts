/* eslint-disable unicorn/prefer-module */
/* eslint-disable camelcase */
import { google } from 'googleapis'
import * as http from 'http'
import * as open from 'open'
const destroyer = require('server-destroy')

const PORT = process.env.AUTH_SERVER_PORT || 3000
const serverBaseUrl = `http://localhost:${PORT}`

// GOOGLE
const googleScopes: string[] = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/user.emails.read']
const googleAuthCallback = `${serverBaseUrl}${process.env.AUTH_GOOGLE_REDIRECT_URL}`
const oauth2Client = new google.auth.OAuth2(process.env.AUTH_GOOGLE_CLIENT_ID, process.env.AUTH_GOOGLE_CLIENT_SECRET, googleAuthCallback)
google.options({ auth: oauth2Client })

export const authenticateWithGoogle = async (): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleScopes.join(' '),
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
// https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
// Check headers to see what OAuth scopes you have, and what the API action accepts:
// curl -H "Authorization: token token" https://api.github.com/users/codertocat -I
const githubAuthCallback = `${serverBaseUrl}${process.env.AUTH_GITHUB_REDIRECT_URL}`

export const authenticateWithGithub = async (): Promise<string | null> => {
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
      open(`https://github.com/login/oauth/authorize?client_id=${process.env.AUTH_GITHUB_CLIENT_ID}&redirect_uri=${githubAuthCallback}&scope=user%20repo`, { wait: false }).then(cp => cp.unref())
    })
    destroyer(server)
  })
}
