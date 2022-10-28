/* eslint-disable indent */
import { RepositoryProvider } from '@kyso-io/kyso-model';
import { importBitbucketRepositoryAction, importGithubRepositoryAction, importGitlabRepositoryAction, store } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login';
import { KysoCommand } from './kyso-command';

export default class ImportRepository extends KysoCommand {
  static description = 'Import repository to Kyso';

  static examples = [
    `$ kyso import-repository --provider github --name <repository_name> --branch <branch>`,
    `$ kyso import-repository --provider bitbucket --name <workspace/repository-name> --branch <branch>`,
    `$ kyso import-repository --provider gitlab --name <id | name_with_namespace> --branch <branch>`,
  ];

  static flags = {
    provider: Flags.string({
      char: 'p',
      description: 'provider',
      required: true,
      options: [RepositoryProvider.BITBUCKET, RepositoryProvider.GITLAB, RepositoryProvider.GITHUB],
    }),
    name: Flags.string({
      char: 'n',
      description: 'name',
      required: true,
    }),
    branch: Flags.string({
      char: 'b',
      description: 'branch',
      required: false,
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
    const { flags } = await this.parse(ImportRepository);

    if (flags.verbose) {
      this.log('Enabled verbose mode');
      this.enableVerbose();
    }

    await launchInteractiveLoginIfNotLogged();

    this.log(`Importing ${flags.provider} repository ${flags.name}. Will take a while...`);

    const args: any = {
      repositoryName: flags.name,
    };
    if (flags.branch) {
      args.branch = flags.branch;
    }

    let result: any = null;
    switch (flags.provider) {
      case RepositoryProvider.GITHUB: {
        result = await store.dispatch(importGithubRepositoryAction(args));
        break;
      }
      case RepositoryProvider.BITBUCKET: {
        result = await store.dispatch(importBitbucketRepositoryAction(args));
        break;
      }
      case RepositoryProvider.GITLAB: {
        result = await store.dispatch(importGitlabRepositoryAction(args));
        break;
      }
    }
    if (result?.error) {
      this.error(result.error.message);
    } else {
      this.log(`Successfully uploaded report`);
    }

    if (flags.verbose) {
      this.log('Disabling verbose mode');
      this.disableVerbose();
    }
  }
}
