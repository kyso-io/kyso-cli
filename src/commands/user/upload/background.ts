import { GlobalPermissionsEnum, NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { createReadStream, existsSync, ReadStream } from 'fs';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { isImage } from '../../../helpers/is-image';
import { ErrorResponse } from '../../../types/error-response';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class UploadUserBackground extends KysoCommand {
  static description = 'Upload user background to Kyso';

  static examples = [`$ kyso user upload background <email> <path>`];

  static args = [
    {
      name: 'email',
      required: true,
      description: 'Email of the user',
    },
    {
      name: 'path',
      required: true,
      description: 'Path to the image',
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(UploadUserBackground);
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
    if (!tokenPermissions.global || !tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
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
    if (!userDto.avatar_url) {
      this.error('User has no background');
    }
    if (!existsSync(args.path)) {
      this.log(`File ${args.path} does not exist`);
      return;
    }
    if (!isImage(args.path)) {
      this.log(`File ${args.path} is not an image. Valid formats are: png, jpg, jpeg, gif`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    try {
      const readStream: ReadStream = createReadStream(args.path);
      await api.uploadUserBackgroundImage(userDto.id, readStream);
      this.log(`Background image uploaded successfully`);
    } catch (e: any) {
      this.log(`Error uploading background image: ${e.response.data.message}`);
    }
  }
}
