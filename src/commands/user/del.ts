import type { NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import inquirer = require('inquirer');
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { ErrorResponse } from '../../types/error-response';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import { Helper } from '../../helpers/helper';

export default class DeleteUsers extends KysoCommand {
  static description = 'Delete users from the system';

  static examples = [`$ kyso user delete <list_of_emails>`];

  static args = [
    {
      name: 'list_of_emails',
      description: 'List of emails separated by commas',
      required: true,
    },
  ];

  private async deleteUser(api: Api, email: string): Promise<void> {
    let desiredEmail: string | null;
    if (!Helper.isEmail(email)) {
      const emailResponse: { email: string } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'What is the email of the user?',
          validate(email: string) {
            if (email === '') {
              return 'Email cannot be empty';
            }
            if (!Helper.isEmail(email)) {
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
    let userDto: UserDTO | null = null;
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
      userDto = users[index];
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error getting the user '${desiredEmail}': ${errorResponse.message}`);
    }
    try {
      await api.deleteUser(userDto.id);
      this.log(`User '${desiredEmail}' deleted`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error deleting the user '${desiredEmail}': ${errorResponse.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(DeleteUsers);
    const emails: string[] = args.list_of_emails.split(',');
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
      this.error("You don't have permissions to delete users");
    }
    for (const email of emails) {
      await this.deleteUser(api, email);
    }
  }
}
