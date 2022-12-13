import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import AdmZip from 'adm-zip';
import { join, resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Get extends KysoCommand {
  static description = 'Downloads the contents of the <theme_name> and stores it given a path.';

  static examples = [`$ kyso theme get -n <theme_name> -p <destination_folder>`];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Theme name',
      required: true,
    }),
    path: Flags.string({
      char: 'p',
      description: 'Path where to save the theme',
      required: false,
      default: '.',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Get);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      const buffer: Buffer = await api.downloadTheme(flags.name);
      const zip: AdmZip = new AdmZip(buffer);
      const destinationPath: string = join(flags.path, flags.name);
      zip.extractAllTo(destinationPath, true);
      this.log(`\n🎉🎉🎉 Success! Theme downloaded to ${resolve(destinationPath)} 🎉🎉🎉\n`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = JSON.parse(e.response.data.toString());
      this.log(`Error downloading theme: ${errorResponse.message}`);
    }
  }
}
