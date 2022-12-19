import { GlobalPermissionsEnum, NormalizedResponseDTO, SignUpDto, TokenPermissions, User } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { isEmail } from '../../helpers/is-email';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class AddUsers extends KysoCommand {
  static description = 'Add users to the system';

  static examples = [`$ kyso user add <list_of_emails>`];

  static args = [
    {
      name: 'list_of_emails',
      description: 'List of emails separated by commas',
      required: true,
    },
  ];

  private async createUser(api: Api, email: string): Promise<void> {
    const signUpDto: SignUpDto = new SignUpDto(email, '', '', '');
    if (!isEmail(signUpDto.email)) {
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
      signUpDto.email = emailResponse.email;
    }
    const usernameResponse: { username: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'What is the username of the user?',
        validate: function (username: string) {
          if (username === '') {
            return 'Username cannot be empty';
          }
          return true;
        },
      },
    ]);
    signUpDto.username = usernameResponse.username;
    const displayNameResponse: { display_name: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'display_name',
        message: 'What is the name of the user?',
        validate: function (display_name: string) {
          if (display_name === '') {
            return 'Name cannot be empty';
          }
          return true;
        },
      },
    ]);
    signUpDto.display_name = displayNameResponse.display_name;
    const passwordResponse: { password: string } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'What is the password of the user?',
        validate: function (password: string) {
          if (password === '') {
            return 'Password cannot be empty';
          }
          return true;
        },
      },
    ]);
    signUpDto.password = passwordResponse.password;
    await inquirer.prompt([
      {
        type: 'password',
        name: 'password_confirmation',
        message: 'What is the password confirmation of the user?',
        validate: function (password_confirmation: string) {
          if (password_confirmation === '') {
            return 'Password confirmation cannot be empty';
          }
          if (password_confirmation !== passwordResponse.password) {
            return 'Password confirmation does not match';
          }
          return true;
        },
      },
    ]);
    try {
      const userResult: NormalizedResponseDTO<User> = await api.signup(signUpDto);
      const user: User = userResult.data;
      const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
      this.log(`\nUser '${user.email} - ${user.display_name}' created. Visit its page ${kysoCredentials.kysoInstallUrl}/user/${user.username}\n`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error creating the user '${signUpDto.email} - ${signUpDto.display_name}': ${errorResponse.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(AddUsers);
    const emails: string[] = args.list_of_emails.split(',');
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
      this.error("You don't have permissions to add users");
    }
    for (const email of emails) {
      await this.createUser(api, email);
    }
  }
}
