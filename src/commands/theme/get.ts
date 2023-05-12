import { Api } from '@kyso-io/kyso-store';
import AdmZip from 'adm-zip';
import { join, resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Get extends KysoCommand {
  static description = 'Downloads the contents of the theme_name folder and stores it on the given zip_file or on the theme_name.zip file on the current directory if no zip_file is provided.';

  static examples = [
    `$ kyso theme get <theme_name> <destination_folder>`,
    `$ kyso theme get default .`,
    `$ kyso theme get default ./default-theme          - Note: default-theme folder must exist before running the command`,
  ];

  static args = [
    {
      name: 'name',
      description: 'Theme name',
      required: true,
    },
    {
      name: 'path',
      description: 'Path where to save the theme',
      required: false,
      default: '.',
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(Get);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      const buffer: Buffer = await api.downloadTheme(args.name);
      const zip: AdmZip = new AdmZip(buffer);
      const destinationPath: string = join(args.path, args.name);
      zip.extractAllTo(destinationPath, true);
      this.log(`\n🎉🎉🎉 Success! Theme downloaded to ${resolve(destinationPath)} 🎉🎉🎉\n`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = JSON.parse(e.response.data.toString());
      if (errorResponse.statusCode === 403) {
        this.log(`You don't have permission to download themes`);
      } else {
        this.log(`Error downloading theme: ${errorResponse.message}`);
      }
    }
  }
}
