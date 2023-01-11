import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Del extends KysoCommand {
  static description = 'Removes the <theme_name> folder.';

  static examples = [`$ kyso theme del <theme_name>`];

  static args = [
    {
      name: 'name',
      description: 'Theme name',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(Del);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      await api.deleteTheme(args.name);
      this.log(`\n🎉🎉🎉 Success! Theme deleted 🎉🎉🎉\n`);
    } catch (e: any) {
      this.log(`Error deleting theme: ${e.response.data.message}`);
    }
  }
}
