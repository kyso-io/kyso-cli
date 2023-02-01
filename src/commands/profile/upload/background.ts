import { Api } from '@kyso-io/kyso-store';
import { createReadStream, existsSync, ReadStream } from 'fs';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class UploadBackground extends KysoCommand {
  static description = 'Upload the image_file as the background image.';

  static examples = [`$ kyso profile upload background <path>`];

  static args = [
    {
      name: 'path',
      required: true,
      description: 'Path to the image',
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(UploadBackground);
    // Check if file exists
    if (!existsSync(args.path)) {
      this.log(`File ${args.path} does not exist`);
      return;
    }
    // Check if file is an image
    if (!Helper.isImage(args.path)) {
      this.log(`File ${args.path} is not an image. Valid formats are: png, jpg, jpeg, gif`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    try {
      const readStream: ReadStream = createReadStream(args.path);
      await api.uploadUserBackgroundImage(decoded.payload.id, readStream);
      this.log(`Background uploaded successfully`);
    } catch (e: any) {
      this.log(`Error uploading background profile image: ${e.response.data.message}`);
    }
  }
}
