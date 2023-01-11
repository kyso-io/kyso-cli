import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Set extends KysoCommand {
  static description = 'Set the <theme_name> as default.';

  static examples = [`$ kyso theme set <theme_name>`];

  static args = [
    {
      name: 'name',
      description: 'Theme name',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(Set);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      await api.setDefaultTheme(args.name);
      this.log(`\n🎉🎉🎉 Success! The theme has been changed 🎉🎉🎉\n`);
      this.log(`\n`);
      this.log(`Remember that users must close and reopen their browser for the changes to take effect.`);
    } catch (e: any) {
      this.log(`Error changing the theme: ${e.response.data.message}`);
    }
  }
}
