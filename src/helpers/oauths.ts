/* eslint-disable no-async-promise-executor */
/* eslint-disable indent */
/* eslint-disable unicorn/prefer-module */
/* eslint-disable camelcase */
import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { fetchPublicKysoSettings, store } from '@kyso-io/kyso-store'
import * as http from 'http'
import open from 'open'
const destroyer = require('server-destroy')

const PORT = process.env.AUTH_SERVER_PORT || 3000
const serverBaseUrl = `http://localhost:${PORT}`

// GOOGLE
export const authenticateWithGoogle = async (): Promise<{ code: string; redirectUrl: string } | null> => {
  return new Promise<{ code: string; redirectUrl: string } | null>(async (resolve, reject) => {
    const data: any = await store.dispatch(fetchPublicKysoSettings())
    const settings: KysoSetting[] = data.payload
    if (!settings) {
      resolve(null)
      return
    }
    const googleClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID)
    if (!googleClientIdSetting || !googleClientIdSetting.value || googleClientIdSetting.value === '') {
      resolve(null)
      return
    }
    const googleScopes: string[] = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/user.emails.read']
    const redirectUrl = '/oauth/google/callback'
    const googleAuthCallback = `${serverBaseUrl}${redirectUrl}`
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    const options: any = {
      redirect_uri: googleAuthCallback,
      client_id: googleClientIdSetting.value,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: googleScopes.join(' '),
    }
    const qs = new URLSearchParams(options)
    const authorizeUrl = `${rootUrl}?${qs.toString()}`
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams
            res.end('Authentication successful! Please return to the console.')
            server.close()
            // eslint-disable-next-line semi-style
            ;(server as any).destroy()
            resolve({ code: qs.get('code'), redirectUrl: googleAuthCallback })
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

export const authenticateWithGithub = async (): Promise<string | null> => {
  return new Promise<string | null>(async (resolve, reject) => {
    const data: any = await store.dispatch(fetchPublicKysoSettings())
    const settings: KysoSetting[] = data.payload
    if (!settings) {
      resolve(null)
      return
    }
    const githubClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID)
    if (!githubClientIdSetting || !githubClientIdSetting.value || githubClientIdSetting.value === '') {
      resolve(null)
      return
    }
    const redirectUrl = '/oauth/github/callback'
    const githubAuthCallback = `${serverBaseUrl}${redirectUrl}`
    console.log(githubAuthCallback)
    const server: http.Server = http
      .createServer(async (req, res) => {
        console.log(req?.url)
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
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
        open(`https://github.com/login/oauth/authorize?client_id=${githubClientIdSetting.value}&redirect_uri=${githubAuthCallback}&scope=user%20repo`, { wait: false }).then(cp => cp.unref())
      })
    destroyer(server)
  })
}

// BITBUCKET
// https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/
// const bitbucketAuthCallback = `${serverBaseUrl}${process.env.AUTH_BITBUCKET_REDIRECT_URL}`
export const authenticateWithBitbucket = async (): Promise<string | null> => {
  return new Promise<string | null>(async (resolve, reject) => {
    const data: any = await store.dispatch(fetchPublicKysoSettings())
    const settings: KysoSetting[] = data.payload
    if (!settings) {
      resolve(null)
      return
    }
    const bitbucketClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID)
    if (!bitbucketClientIdSetting || !bitbucketClientIdSetting.value || bitbucketClientIdSetting.value === '') {
      resolve(null)
      return
    }
    const redirectUrl = '/oauth/bitbucket/callback'
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
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
        open(`https://bitbucket.org/site/oauth2/authorize?client_id=${bitbucketClientIdSetting.value}&response_type=code`, { wait: false }).then(cp => cp.unref())
      })
    destroyer(server)
  })
}

// GITLAB
// https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

export const authenticateWithGitlab = async (): Promise<{ code: string; redirectUrl: string } | null> => {
  return new Promise<{ code: string; redirectUrl: string } | null>(async (resolve, reject) => {
    const data: any = await store.dispatch(fetchPublicKysoSettings())
    const settings: KysoSetting[] = data.payload
    if (!settings) {
      resolve(null)
      return
    }
    const gitlabClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID)
    if (!gitlabClientIdSetting || !gitlabClientIdSetting.value || gitlabClientIdSetting.value === '') {
      resolve(null)
      return
    }
    const redirectUrl = '/oauth/gitlab/callback'
    const gitlabAuthCallback = `${serverBaseUrl}${redirectUrl}`
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams
            res.end('Authentication successful! Please return to the console.')
            server.close()
            // eslint-disable-next-line semi-style
            ;(server as any).destroy()
            resolve({ code: qs.get('code'), redirectUrl: gitlabAuthCallback })
          } else {
            resolve(null)
          }
        } catch (error) {
          console.log(error)
          reject(error)
        }
      })
      .listen(PORT, () => {
        open(`https://gitlab.com/oauth/authorize?client_id=${gitlabClientIdSetting.value}&redirect_uri=${gitlabAuthCallback}&response_type=code`, { wait: false }).then(cp => cp.unref())
      })
    destroyer(server)
  })
}
