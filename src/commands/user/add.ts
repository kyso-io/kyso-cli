import type { NormalizedResponseDTO, TokenPermissions, User } from '@kyso-io/kyso-model';
import { SignUpDto } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import inquirer = require('inquirer');
import { Flags } from '@oclif/core';
import * as crypto from 'crypto';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { ErrorResponse } from '../../types/error-response';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import { Helper } from '../../helpers/helper';

export default class AddUsers extends KysoCommand {
  static description = 'Add users to the system';

  static examples = [
    `How to use: \n\t$ kyso user add <display_name>:<email@email.io>,<email2@email.io>`,
    `Prompting: \n\t$ kyso user add Emilio:emilio@kyso.io,amidala@kyso.io`,
    `No prompting: \n\t$ kyso user add Emilio:emilio@kyso.io,amidala@kyso.io --yes`,
    `Display names with empty spaces: \n\t$ kyso user add "Emilio Pastor:emilio@kyso.io,amidala@kyso.io" --yes`,
  ];

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      description: "Don't ask with prompter and use default values. The password will be autogenerated but not shown. The user will use the recover password procedure",
      required: false,
      default: false,
    }),
    silent: Flags.boolean({
      char: 's',
      description: 'Create users without sending notifications',
      required: false,
      default: false,
    }),
  };

  static args = [
    {
      name: 'list_of_emails',
      description: 'List of emails separated by commas email1@kyso.io,email2@kyso.io. Display name can be specified as well separated by : --> Email1Name:email1@kyso.io,Email2Name:email2@kyso.io',
      required: true,
    },
  ];

  private async createUser(api: Api, email: string, yes: boolean, silent: boolean): Promise<void> {
    const data = email.split(':');
    let displayName = '';
    let extractedEmail = '';
    let username = '';

    if (data.length === 2) {
      displayName = data[0];
      extractedEmail = data[1];
    } else {
      extractedEmail = data[0];
    }

    username = Helper.isEmail(extractedEmail) ? extractedEmail.split('@')[0] : extractedEmail;
    displayName = displayName || username;

    const wishlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const length = 30;

    const randomPassword = Array.from(crypto.randomFillSync(new Uint32Array(length)))
      .map((x) => wishlist[x % wishlist.length])
      .join('');

    const signUpDto: SignUpDto = new SignUpDto(extractedEmail, username, displayName, randomPassword, silent);

    if (!yes) {
      if (!Helper.isEmail(signUpDto.email)) {
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
        signUpDto.email = emailResponse.email;
      }
      const usernameResponse: { username: string } = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'What is the username of the user?',
          validate(username: string) {
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
          validate(display_name: string) {
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
          validate(password: string) {
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
          validate(password_confirmation: string) {
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
    }

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
    const { args, flags } = await this.parse(AddUsers);
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
      this.error("You don't have permissions to add users");
    }
    for (const email of emails) {
      await this.createUser(api, email, flags.yes, flags.silent);
    }
  }
}
