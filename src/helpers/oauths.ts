/* eslint-disable no-async-promise-executor */
/* eslint-disable indent */

/* eslint-disable camelcase */
import type { KysoSetting, NormalizedResponseDTO } from '@kyso-io/kyso-model';
import { KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import * as http from 'http';
import open from 'open';

const destroyer = require('server-destroy');

const PORT = process.env.AUTH_SERVER_PORT || 3000;
const serverBaseUrl = `http://localhost:${PORT}`;
const TIMEOUT_HTTP_SERVER = 60 * 1000; // 1 minute

// GOOGLE
export const authenticateWithGoogle = async (kysoInstallUrl: string): Promise<{ code: string; redirectUrl: string; errorMessage: string | null } | null> => {
  return new Promise<{ code: string; redirectUrl: string; errorMessage: string | null } | null>(async (resolve) => {
    let serverClosed = false;
    let timeout = null;
    const api: Api = new Api();
    api.configure(`${kysoInstallUrl}/api/v1`);
    let settings: KysoSetting[] = [];
    try {
      const response: NormalizedResponseDTO<KysoSetting[]> = await api.getPublicSettings();
      settings = response.data;
    } catch {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Could not get public settings' });
      return;
    }
    const googleClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID);
    if (!googleClientIdSetting) {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Google client id not found' });
      return;
    }
    if (!googleClientIdSetting.value || googleClientIdSetting.value === '') {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Google client id does not have a value' });
      return;
    }
    const googleScopes: string[] = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/user.emails.read'];
    const redirectUrl = '/oauth/google/callback';
    const googleAuthCallback = `${serverBaseUrl}${redirectUrl}`;
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options: any = {
      redirect_uri: googleAuthCallback,
      client_id: googleClientIdSetting.value,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: googleScopes.join(' '),
    };
    const qs = new URLSearchParams(options);
    const authorizeUrl = `${rootUrl}?${qs.toString()}`;
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const queryString = new URL(req.url, serverBaseUrl).searchParams;
            res.end('Authentication successful! Please return to the console.');
            resolve({ code: queryString.get('code'), redirectUrl: googleAuthCallback, errorMessage: null });
          } else {
            resolve({ code: null, redirectUrl: googleAuthCallback, errorMessage: 'Could not authenticate with Google' });
          }
        } catch (error: any) {
          resolve({ code: null, redirectUrl: googleAuthCallback, errorMessage: error.message });
        }
        clearTimeout(timeout);
        server.close();

        (server as any).destroy();
      })
      .listen(PORT, () => {
        open(authorizeUrl, { wait: false }).then((cp) => cp.unref());
      })
      .on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ code: null, redirectUrl: googleAuthCallback, errorMessage: `Port ${PORT} is already in use. Please close the application using it and try again` });
        }
      })
      .on('close', () => {
        serverClosed = true;
      });
    destroyer(server);
    timeout = setTimeout(() => {
      if (!serverClosed) {
        server.close();

        (server as any).destroy();
        resolve({ code: null, redirectUrl: googleAuthCallback, errorMessage: 'No response received from the user.' });
      }
    }, TIMEOUT_HTTP_SERVER);
  });
};

// GITHUB
// https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
// Check headers to see what OAuth scopes you have, and what the API action accepts:
// curl -H "Authorization: token token" https://api.github.com/users/codertocat -I

export const authenticateWithGithub = async (kysoInstallUrl: string): Promise<{ code: string; redirectUrl: string; errorMessage: string | null }> => {
  return new Promise<{ code: string; redirectUrl: string; errorMessage: string | null }>(async (resolve) => {
    let serverClosed = false;
    let timeout = null;
    const api: Api = new Api();
    api.configure(`${kysoInstallUrl}/api/v1`);
    let settings: KysoSetting[] = [];
    try {
      const response: NormalizedResponseDTO<KysoSetting[]> = await api.getPublicSettings();
      settings = response.data;
    } catch {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Could not get public settings' });
      return;
    }
    const githubClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID);
    if (!githubClientIdSetting) {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Github client id not found' });
      return;
    }
    if (!githubClientIdSetting.value || githubClientIdSetting.value === '') {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Github client id does not have a value' });
      return;
    }
    const redirectUrl = '/oauth/github/callback';
    const githubAuthCallback = `${serverBaseUrl}${redirectUrl}`;
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams;
            res.end('Authentication successful! Please return to the console.');
            resolve({ code: qs.get('code'), redirectUrl: githubAuthCallback, errorMessage: null });
          } else {
            resolve({ code: null, redirectUrl: githubAuthCallback, errorMessage: 'Could not authenticate with Github.' });
          }
        } catch (error: any) {
          resolve({ code: null, redirectUrl: githubAuthCallback, errorMessage: error.message });
        }
        clearTimeout(timeout);
        server.close();

        (server as any).destroy();
      })
      .listen(PORT, () => {
        open(`https://github.com/login/oauth/authorize?client_id=${githubClientIdSetting.value}&redirect_uri=${githubAuthCallback}&scope=user%20repo`, { wait: false }).then((cp) => cp.unref());
      })
      .on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ code: null, redirectUrl: githubAuthCallback, errorMessage: `Port ${PORT} is already in use. Please close the application using it and try again` });
        }
      })
      .on('close', () => {
        serverClosed = true;
      });
    destroyer(server);
    timeout = setTimeout(() => {
      if (!serverClosed) {
        server.close();

        (server as any).destroy();
        resolve({ code: null, redirectUrl: githubAuthCallback, errorMessage: 'No response received from the user.' });
      }
    }, TIMEOUT_HTTP_SERVER);
  });
};

// BITBUCKET
// https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/
// const bitbucketAuthCallback = `${serverBaseUrl}${process.env.AUTH_BITBUCKET_REDIRECT_URL}`
export const authenticateWithBitbucket = async (kysoInstallUrl: string): Promise<{ code: string; redirectUrl: string; errorMessage: string | null }> => {
  return new Promise<{ code: string; redirectUrl: string; errorMessage: string | null }>(async (resolve) => {
    let serverClosed = false;
    let timeout = null;
    const api: Api = new Api();
    api.configure(`${kysoInstallUrl}/api/v1`);
    let settings: KysoSetting[] = [];
    try {
      const response: NormalizedResponseDTO<KysoSetting[]> = await api.getPublicSettings();
      settings = response.data;
    } catch {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Could not get public settings' });
      return;
    }
    const bitbucketClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID);
    if (!bitbucketClientIdSetting) {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Bitbucket client id not found' });
      return;
    }
    if (!bitbucketClientIdSetting.value || bitbucketClientIdSetting.value === '') {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Bitbucket client id does not have a value' });
      return;
    }
    const redirectUrl = '/oauth/bitbucket/callback';
    const bitbucketAuthCallback = `${serverBaseUrl}${redirectUrl}`;
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams;
            res.end('Authentication successful! Please return to the console.');
            resolve({ code: qs.get('code'), redirectUrl: bitbucketAuthCallback, errorMessage: null });
          } else {
            resolve({ code: null, redirectUrl: bitbucketAuthCallback, errorMessage: 'Could not authenticate with Github.' });
          }
        } catch (error: any) {
          resolve({ code: null, redirectUrl: bitbucketAuthCallback, errorMessage: error.message });
        }
        clearTimeout(timeout);
        server.close();

        (server as any).destroy();
      })
      .listen(PORT, () => {
        open(`https://bitbucket.org/site/oauth2/authorize?client_id=${bitbucketClientIdSetting.value}&response_type=code`, { wait: false }).then((cp) => cp.unref());
      })
      .on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ code: null, redirectUrl: bitbucketAuthCallback, errorMessage: `Port ${PORT} is already in use. Please close the application using it and try again` });
        }
      })
      .on('close', () => {
        serverClosed = true;
      });
    destroyer(server);
    timeout = setTimeout(() => {
      if (!serverClosed) {
        server.close();

        (server as any).destroy();
        resolve({ code: null, redirectUrl: bitbucketAuthCallback, errorMessage: 'No response received from the user.' });
      }
    }, TIMEOUT_HTTP_SERVER);
  });
};

// GITLAB
// https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

export const authenticateWithGitlab = async (kysoInstallUrl: string): Promise<{ code: string; redirectUrl: string; errorMessage: string | null } | null> => {
  return new Promise<{ code: string; redirectUrl: string; errorMessage: string | null } | null>(async (resolve) => {
    let serverClosed = false;
    let timeout = null;
    const api: Api = new Api();
    api.configure(`${kysoInstallUrl}/api/v1`);
    let settings: KysoSetting[] = [];
    try {
      const response: NormalizedResponseDTO<KysoSetting[]> = await api.getPublicSettings();
      settings = response.data;
    } catch {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Could not get public settings' });
      return;
    }
    const gitlabClientIdSetting: KysoSetting | undefined = settings.find((x: KysoSetting) => x.key === KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID);
    if (!gitlabClientIdSetting) {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Gitlab client id not found' });
      return;
    }
    if (!gitlabClientIdSetting.value || gitlabClientIdSetting.value === '') {
      resolve({ code: null, redirectUrl: null, errorMessage: 'Gitlab client id does not have a value' });
      return;
    }
    const redirectUrl = '/oauth/gitlab/callback';
    const gitlabAuthCallback = `${serverBaseUrl}${redirectUrl}`;
    const server: http.Server = http
      .createServer(async (req, res) => {
        try {
          if (req && req.url && req.url.includes(redirectUrl)) {
            const qs = new URL(req.url, serverBaseUrl).searchParams;
            res.end('Authentication successful! Please return to the console.');
            resolve({ code: qs.get('code'), redirectUrl: gitlabAuthCallback, errorMessage: null });
          } else {
            resolve({ code: null, redirectUrl: gitlabAuthCallback, errorMessage: 'Could not authenticate with Gitlab.' });
          }
        } catch (error: any) {
          resolve({ code: null, redirectUrl: gitlabAuthCallback, errorMessage: error.message });
        }
        clearTimeout(timeout);
        server.close();

        (server as any).destroy();
      })
      .listen(PORT, () => {
        open(`https://gitlab.com/oauth/authorize?client_id=${gitlabClientIdSetting.value}&redirect_uri=${gitlabAuthCallback}&response_type=code`, { wait: false }).then((cp) => cp.unref());
      })
      .on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ code: null, redirectUrl: gitlabAuthCallback, errorMessage: `Port ${PORT} is already in use. Please close the application using it and try again` });
        }
      })
      .on('close', () => {
        serverClosed = true;
      });
    destroyer(server);
    timeout = setTimeout(() => {
      if (!serverClosed) {
        server.close();

        (server as any).destroy();
        resolve({ code: null, redirectUrl: gitlabAuthCallback, errorMessage: 'No response received from the user.' });
      }
    }, TIMEOUT_HTTP_SERVER);
  });
};
