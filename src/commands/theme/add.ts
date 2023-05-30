import { Api } from '@kyso-io/kyso-store';
import type { ReadStream } from 'fs';
import { createReadStream, existsSync } from 'fs';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { ErrorResponse } from '../../types/error-response';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Add extends KysoCommand {
  static description = 'Uploads the <zip_file_path> to the given <theme_name> folder replacing its previous contents.';

  static examples = [`$ kyso theme add <theme_name> <zip_file_path>`, `$ kyso theme add default default.zip`];

  static args = [
    {
      name: 'name',
      description: 'Theme name',
      required: true,
    },
    {
      name: 'path',
      description: 'Zipped theme path',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(Add);
    // Check if file exists
    if (!existsSync(args.path)) {
      this.log(`File ${args.path} does not exist`);
      return;
    }
    // Check if file is a zip file
    if (!args.path.endsWith('.zip')) {
      this.log(`File ${args.path} is not a zip file`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(`${kysoCredentials?.kysoInstallUrl}/api/v1`, kysoCredentials?.token);
    try {
      const readStream: ReadStream = createReadStream(args.path);
      await api.uploadTheme(args.name, readStream);
      this.log(`Theme ${args.name} uploaded successfully`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 403) {
        this.log(`You don't have permission to upload themes`);
      } else {
        this.log(`Error adding theme: ${e.response.data.message}`);
      }
    }
  }
}
