import { Api } from '@kyso-io/kyso-store';
import { NormalizedResponseDTO } from '@kyso-io/kyso-model';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class List extends KysoCommand {
  static description = 'List all available themes';

  static examples = [`$ kyso theme list`];

  static args = [];

  async run(): Promise<void> {
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      const response: NormalizedResponseDTO<string[]> = await api.getAvailableThemes();
      for (const theme of response.data) {
        this.log(theme);
      }
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 403) {
        this.log(`You don't have permission to list the themes`);
      } else {
        this.log(`Error listing themes: ${errorResponse.message}`);
      }
    }
  }
}
