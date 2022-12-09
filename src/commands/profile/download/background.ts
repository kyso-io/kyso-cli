import { NormalizedResponseDTO, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import jwtDecode from 'jwt-decode';
import { join, resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class DownloadPhoto extends KysoCommand {
  static description = 'Download user background profile from Kyso';

  static examples = [`$ kyso profile download background`];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Destination folder in which the photo will be downloaded',
      required: false,
      default: '.',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DownloadPhoto);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    try {
      const result: NormalizedResponseDTO<UserDTO> = await api.getUserProfileByUsername(decoded.payload.username);
      const userDTO: UserDTO = result.data;
      if (!userDTO.background_image_url) {
        this.error('User has no photo');
      }
      const imageUrl: string = userDTO.background_image_url.startsWith('http') ? userDTO.background_image_url : kysoCredentials.kysoInstallUrl + userDTO.background_image_url;
      const axiosResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const urlParts: string[] = axiosResponse.request.res.responseUrl.split('/');
      if (urlParts.length === 0) {
        this.error('Error downloading photo');
      }
      const fileName: string = urlParts[urlParts.length - 1];
      if (!fileName.includes('.')) {
        this.error('User profile photo has no extension');
      }
      const filePath: string = resolve(join(flags.path, fileName));
      writeFileSync(filePath, axiosResponse.data, 'binary');
      this.log(`Photo downloaded to ${filePath}`);
    } catch (e) {
      this.error('Error downloading photo');
    }
  }
}
