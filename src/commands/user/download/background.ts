import { GlobalPermissionsEnum, NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import jwtDecode from 'jwt-decode';
import { join, resolve } from 'path';
import { Helper } from '../../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { ErrorResponse } from '../../../types/error-response';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class DownloadUserBackground extends KysoCommand {
  static description = 'Download user background from Kyso';

  static examples = [`$ kyso user download background <email>`, `$ kyso profile download background <email> -p <path>`];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Destination folder in which the background will be downloaded',
      required: false,
      default: '.',
    }),
  };

  static args = [
    {
      name: 'email',
      required: true,
      description: 'Email of the user',
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DownloadUserBackground);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    if (!tokenPermissions.global || !Helper.isGlobalAdmin(tokenPermissions)) {
      this.error("You don't have permissions to delete users");
    }
    let userDto: UserDTO | null = null;
    try {
      const usersResponse: NormalizedResponseDTO<UserDTO[]> = await api.getUsers({ userIds: [], page: 1, per_page: 1000, sort: 'email', search: encodeURIComponent(args.email) });
      const users: UserDTO[] = usersResponse.data;
      if (users.length === 0) {
        this.log(`Error: User with email '${args.email}' not found`);
        return;
      }
      const index: number = users.findIndex((user: UserDTO) => user.email === args.email);
      if (index === -1) {
        this.log(`Error: User with email '${args.email}' not found`);
        return;
      }
      userDto = users[index];
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error getting the user '${args.email}': ${errorResponse.message}`);
    }
    if (!userDto.background_image_url) {
      this.error('User has no background image');
    }
    try {
      const imageUrl: string = userDto.background_image_url.startsWith('http') ? userDto.background_image_url : kysoCredentials.kysoInstallUrl + userDto.background_image_url;
      const axiosResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const urlParts: string[] = axiosResponse.request.res.responseUrl.split('/');
      if (urlParts.length === 0) {
        this.error('Error downloading background image');
      }
      const fileName: string = urlParts[urlParts.length - 1];
      if (!fileName.includes('.')) {
        this.error('Background image has no extension');
      }
      const filePath: string = resolve(join(flags.path, fileName));
      writeFileSync(filePath, axiosResponse.data, 'binary');
      this.log(`Photo downloaded to ${filePath}`);
    } catch (e: any) {
      this.error('Error downloading background image');
    }
  }
}
