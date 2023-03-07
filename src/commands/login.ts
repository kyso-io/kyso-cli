/* eslint-disable complexity */

/* eslint-disable no-prototype-builtins */
/* eslint-disable indent */
import { Login as LoginModel, LoginProviderEnum, NormalizedResponseDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { interactiveLogin } from '../helpers/interactive-login';
import { authenticateWithBitbucket, authenticateWithGithub, authenticateWithGitlab, authenticateWithGoogle } from '../helpers/oauths';
import { ErrorResponse } from '../types/error-response';
import { KysoCommand } from './kyso-command';

export default class Login extends KysoCommand {
  static description = 'Login into Kyso';

  static examples = [
    `** NOTE: If you plan to use kyso-cli inside a CI/CD pipeline, we strongly recommend to use access tokens **`,
    `# To use the interactive login
    $ kyso login`,
    `# Direct login using kyso provider and password
    $ kyso login --kysoInstallUrl <kyso_installation_url> --provider kyso --username <your_email> --password <your_password>`,
    `# Direct login using kyso provider and access token
    $ kyso login --kysoInstallUrl <kyso_installation_url> --provider kyso --username <your_email> --token <your_access_token>`,
    `# Login using github provider (will prompt a browser window to log in). The same behavior happens using the rest of external providers 
    $ kyso login --provider github`,
  ];

  static flags = {
    provider: Flags.string({
      char: 'r',
      description: 'Authentication provider',
      required: false,
      // options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.BITBUCKET],
      // options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITHUB, LoginProviderEnum.GITLAB],
      options: [LoginProviderEnum.KYSO, LoginProviderEnum.GOOGLE, LoginProviderEnum.GITLAB],
    }),
    kysoInstallUrl: Flags.string({
      char: 'y',
      description: 'Url of your Kyso installation',
      required: false,
      multiple: false,
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
    channel: Flags.string({
      char: 'c',
      description: 'Your channel',
      required: false,
      hidden: true,
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);

    if (flags.verbose) {
      this.log('Enabled verbose mode');
      this.enableVerbose();
    }

    let loginModel: LoginModel = new LoginModel('', LoginProviderEnum.KYSO, '', null);

    if (flags?.provider && flags.provider !== '') {
      // NON-INTERACTIVE MODE
      switch (flags.provider) {
        case LoginProviderEnum.KYSO: {
          if (!flags.hasOwnProperty('kysoInstallUrl')) {
            this.error('KysoInstallUrl is required when provider is kyso');
          }
          loginModel.kysoInstallUrl = flags.kysoInstallUrl;
          if (!flags.hasOwnProperty('username')) {
            this.error('Username is required when provider is kyso');
          }
          loginModel.email = flags.username;
          if (flags.hasOwnProperty('password')) {
            loginModel.password = flags.password!;
          } else if (flags.hasOwnProperty('token')) {
            loginModel.provider = LoginProviderEnum.KYSO_ACCESS_TOKEN;
            loginModel.password = flags.token!;
          } else {
            this.error('You must provide a password or a token');
          }
          break;
        }
        case LoginProviderEnum.GOOGLE: {
          try {
            const googleResult: { code: string; redirectUrl: string; errorMessage: string | null } = await authenticateWithGoogle(flags.kysoInstallUrl);
            if (googleResult.errorMessage) {
              throw new Error(googleResult.errorMessage);
            }
            loginModel = new LoginModel(googleResult.code, LoginProviderEnum.GOOGLE, '', googleResult.redirectUrl);
          } catch (error: any) {
            this.error(error);
          }
          break;
        }
        case LoginProviderEnum.GITHUB: {
          const githubResult: { code: string; redirectUrl: string; errorMessage: string | null } = await authenticateWithGithub(flags.kysoInstallUrl);
          if (githubResult.errorMessage) {
            throw new Error(githubResult.errorMessage);
          }
          loginModel = new LoginModel(githubResult.code, LoginProviderEnum.GITHUB, '', null);
          break;
        }
        case LoginProviderEnum.BITBUCKET: {
          try {
            const bitbucketResult: { code: string; redirectUrl: string; errorMessage: string | null } = await authenticateWithBitbucket(flags.kysoInstallUrl);
            if (bitbucketResult.errorMessage) {
              throw new Error(bitbucketResult.errorMessage);
            }
            loginModel = new LoginModel(bitbucketResult.code, LoginProviderEnum.BITBUCKET, '', null);
          } catch (error: any) {
            this.error(error);
          }
          break;
        }
        case LoginProviderEnum.GITLAB: {
          try {
            const gitlabResponse: { code: string; redirectUrl: string; errorMessage: string | null } = await authenticateWithGitlab(flags.kysoInstallUrl);
            if (gitlabResponse.errorMessage) {
              throw new Error(gitlabResponse.errorMessage);
            }
            loginModel = new LoginModel(gitlabResponse.code, LoginProviderEnum.GITLAB, '', gitlabResponse.redirectUrl);
          } catch (error: any) {
            this.error(error);
          }
          break;
        }
        default: {
          this.error('Provider not supported');
        }
      }
      if (loginModel.kysoInstallUrl) {
        process.env.KYSO_API = `${loginModel.kysoInstallUrl}/api/v1`;
      }
    } else {
      // INTERACTIVE MODE
      try {
        loginModel = await interactiveLogin(KysoCommand.getCredentials());
      } catch (error: any) {
        this.error(error);
      }
    }

    try {
      const api: Api = new Api();
      const loginResult: NormalizedResponseDTO<string> = await api.login(loginModel);
      if (loginResult.data) {
        KysoCommand.saveToken(loginResult.data, flags.organization || null, flags.channel || null, loginModel.kysoInstallUrl, loginModel.email || null);
        this.log('Logged successfully');
      }
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      this.error(`Login failed: ${errorResponse.message}`);
    }

    if (flags.verbose) {
      this.log('Disabling verbose mode');
      this.disableVerbose();
    }
  }
}
