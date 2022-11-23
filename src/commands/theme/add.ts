import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream, existsSync, ReadStream } from 'fs';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class Add extends KysoCommand {
  static description = 'Uploads the <zip_file> to the given <theme_name> folder replacing its previous contents.';

  static examples = [`$ kyso theme add -n <theme_name> -p <zip_file>`];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Theme name',
      required: true,
    }),
    path: Flags.string({
      char: 'p',
      description: 'Zipped theme path',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Add);
    // Check if file exists
    if (!existsSync(flags.path)) {
      this.log(`File ${flags.path} does not exist`);
      return;
    }
    // Check if file is a zip file
    if (!flags.path.endsWith('.zip')) {
      this.log(`File ${flags.path} is not a zip file`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials?.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      const readStream: ReadStream = createReadStream(flags.path);
      await api.uploadTheme(flags.name, readStream);
      this.log(`Theme ${flags.name} uploaded successfully`);
    } catch (e: any) {
      this.log(`Error adding theme: ${e.response.data.message}`);
    }
  }
}
