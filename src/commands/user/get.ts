import { GlobalPermissionsEnum, NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { resolve } from 'path';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { ProfileData } from '../../types/profile-data';
import { KysoCommand } from '../kyso-command';

export default class GetUsers extends KysoCommand {
  static description = 'Save in a yaml file users profile data';

  static examples = [`$ kyso user get <list_of_emails> <yaml_file>`, `$ kyso user get <list_of_emails> <yaml_file> --images`];

  static flags = {
    images: Flags.boolean({
      char: 'i',
      description: 'Get user image in base64 format',
      required: false,
      default: false,
    }),
  };

  static args = [
    {
      name: 'list_of_emails',
      description: 'List of emails separated by commas',
      required: true,
    },
    {
      name: 'yaml_file',
      description: 'Yaml file where the users data will be saved',
      required: true,
    },
  ];

  private async getProfileData(api: Api, email: string, getImages: boolean): Promise<ProfileData> {
    let userDto: UserDTO | null = null;
    let profileData: ProfileData | null = null;
    try {
      const usersResponse: NormalizedResponseDTO<UserDTO[]> = await api.getUsers({ userIds: [], page: 1, per_page: 1000, sort: 'email', search: encodeURIComponent(email) });
      const users: UserDTO[] = usersResponse.data;
      if (users.length === 0) {
        this.log(`Error: User with email '${email}' not found`);
        return;
      }
      const index: number = users.findIndex((user: UserDTO) => user.email === email);
      if (index === -1) {
        this.log(`Error: User with email '${email}' not found`);
        return;
      }
      userDto = users[index];
      profileData = {
        email: userDto.email,
        username: userDto.username,
        name: userDto.name,
        display_name: userDto.display_name,
        bio: userDto.bio,
        location: userDto.location,
        link: userDto.link,
      };
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error getting the user '${email}': ${errorResponse.message}`);
      return profileData;
    }
    if (getImages) {
      const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
      if (userDto.avatar_url) {
        try {
          const imageUrl: string = userDto.avatar_url.startsWith('http') ? userDto.avatar_url : kysoCredentials.kysoInstallUrl + userDto.avatar_url;
          const axiosResponse = await axios.get(imageUrl, { responseType: 'text', responseEncoding: 'base64' });
          if (axiosResponse.status === 200) {
            profileData.photo = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
          }
        } catch (e) {
          console.log(e);
        }
      }
      if (userDto.background_image_url) {
        try {
          const backgroundImageUrl: string = userDto.background_image_url.startsWith('http') ? userDto.background_image_url : kysoCredentials.kysoInstallUrl + userDto.background_image_url;
          const axiosResponse = await axios.get(backgroundImageUrl, { responseType: 'text', responseEncoding: 'base64' });
          if (axiosResponse.status === 200) {
            profileData.background = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
    return profileData;
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(GetUsers);
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
    if (!tokenPermissions.global || !Helper.isGlobalAdmin(tokenPermissions)) {
      this.error("You don't have permissions to delete users");
    }
    const result: ProfileData[] = [];
    for (const email of emails) {
      const userData: ProfileData | null = await this.getProfileData(api, email, flags.images);
      if (userData) {
        result.push(userData);
      }
    }
    if (result.length === 0) {
      this.log('No users found');
      return;
    }
    const yamlData: string = jsYaml.dump(result);
    const yamlFilePath: string = resolve(args.yaml_file);
    writeFileSync(yamlFilePath, yamlData);
    this.log(`Users data saved in ${yamlFilePath}`);
  }
}
