import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Set extends KysoCommand {
  static description = 'Set the <theme_name> as default.';

  static examples = [`$ kyso theme set -n <theme_name>`];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Theme name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Set);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      await api.setDefaultTheme(flags.name);
      this.log(`\n🎉🎉🎉 Success! The theme has been changed 🎉🎉🎉\n`);
    } catch (e: any) {
      this.log(`Error changing the theme: ${e.response.data.message}`);
    }
  }
}
