import type { NormalizedResponseDTO, TokenPermissions, User } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import type { AxiosResponse } from 'axios';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class SetGlobalAdmin extends KysoCommand {
  static description = 'Set user as global admin';

  static examples = [`How to use: \n\t$ kyso user set-global-admin <email@kyso.io>`];

  static args = [
    {
      name: 'email',
      description: 'User mail to set as a global admin: email@kyso.io',
      required: true,
    },
  ];

  private async setUserAsGlobalAdmin(api: Api, email: string): Promise<void> {
    let userId: string | null = null;
    try {
      const userResult: AxiosResponse<NormalizedResponseDTO<User[]>> = await api.getHttpClient().get(`/users?email=${encodeURIComponent(email)}`);
      const users: User[] = userResult.data.data;
      if (users.length === 0) {
        this.error(`User with email '${email}' not found`);
      }
      userId = users[0].id;
    } catch (e: any) {
      // const errorResponse: ErrorResponse = e.response.data;
      this.error('Error getting user');
    }
    try {
      await api.setUserAsGlobalAdmin(userId);
      this.log(`User with email '${email}' is now a global admin`);
    } catch (e: any) {
      // const errorResponse: ErrorResponse = e.response.data;
      this.error('Error setting user as global admin');
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(SetGlobalAdmin);
    if (!Helper.isEmail(args.email)) {
      this.log('Invalid email');
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const api: Api = new Api();
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials?.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    if (!tokenPermissions.global || !Helper.isGlobalAdmin(tokenPermissions)) {
      this.error("You don't have permissions set users as global admins");
    }
    await this.setUserAsGlobalAdmin(api, args.email);
  }
}
