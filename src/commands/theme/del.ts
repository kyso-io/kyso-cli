import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Del extends KysoCommand {
  static description = 'Removes the <theme_name> folder.';

  static examples = [`$ kyso theme del -n <theme_name>`];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Theme name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Del);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      await api.deleteTheme(flags.name);
      this.log(`\n🎉🎉🎉 Success! Theme deleted 🎉🎉🎉\n`);
    } catch (e: any) {
      this.log(`Error deleting theme: ${e.response.data.message}`);
    }
  }
}
