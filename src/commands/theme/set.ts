import { Api } from '@kyso-io/kyso-store';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { ErrorResponse } from '../../types/error-response';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Set extends KysoCommand {
  static description = 'Set the <theme_name> as default.';

  static examples = [`$ kyso theme set <theme_name>`, `$ kyso theme set default`];

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
    api.configure(`${kysoCredentials?.kysoInstallUrl}/api/v1`, kysoCredentials?.token);
    try {
      await api.setDefaultTheme(args.name);
      this.log(`\n🎉🎉🎉 Success! The theme has been changed 🎉🎉🎉\n`);
      this.log(`\n`);
      this.log(`Remember that users must close and reopen their browser for the changes to take effect.`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 403) {
        this.log(`You don't have permission to change the theme`);
      } else {
        this.log(`Error changing the theme: ${e.response.data.message}`);
      }
    }
  }
}
