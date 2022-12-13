import { GlobalPermissionsEnum, NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { isEmail } from '../../helpers/is-email';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class DeleteUsers extends KysoCommand {
  static description = 'Delete users from the system';

  static examples = [`$ kyso user delete`, `$ kyso user delete -o <list_of_users>`];

  static flags = {
    emails: Flags.string({
      char: 'l',
      description: 'List of users separated by spaces',
      required: false,
      multiple: true,
    }),
  };

  private async deleteUser(api: Api, email?: string): Promise<void> {
    let desiredEmail: string | null;
    if (!isEmail(email)) {
      const emailResponse: { email: string } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'What is the email of the user?',
          validate: function (email: string) {
            if (email === '') {
              return 'Email cannot be empty';
            }
            if (!isEmail(email)) {
              return 'Email is not valid';
            }
            return true;
          },
        },
      ]);
      desiredEmail = emailResponse.email;
    } else {
      desiredEmail = email;
    }
    let user: UserDTO | null = null;
    try {
      const usersResponse: NormalizedResponseDTO<UserDTO[]> = await api.getUsers({ userIds: [], page: 1, per_page: 1000, sort: 'email', search: encodeURIComponent(desiredEmail) });
      const users: UserDTO[] = usersResponse.data;
      if (users.length === 0) {
        this.log(`Error: User with email '${desiredEmail}' not found`);
        return;
      }
      const index: number = users.findIndex((user: UserDTO) => user.email === desiredEmail);
      if (index === -1) {
        this.log(`Error: User with email '${desiredEmail}' not found`);
        return;
      }
      user = users[index];
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error getting the user '${desiredEmail}': ${errorResponse.message}`);
    }
    try {
      await api.deleteUser(user.id);
      this.log(`User '${desiredEmail}' deleted`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error deleting the user '${desiredEmail}': ${errorResponse.message}`);
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(DeleteUsers);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
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
    if (flags?.emails && flags.emails.length > 0) {
      for (const email of flags.emails) {
        await this.deleteUser(api, email);
      }
    } else {
      await this.deleteUser(api);
    }
  }
}
