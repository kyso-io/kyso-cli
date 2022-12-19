import { NormalizedResponseDTO, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { ProfileData } from '../../types/profile-data';
import { KysoCommand } from '../kyso-command';

export default class UserProfileGet extends KysoCommand {
  static description = 'Save the user profile values on a yaml_file.\nIf the --images flag is passed the yaml_file will contain copies of the background and photo images encoded in base64.';

  static examples = [`$ kyso profile get <yaml_file>`];

  static flags = {
    images: Flags.boolean({
      char: 'i',
      description: 'Get user profile images in base64 format',
      required: false,
      default: false,
    }),
  };

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file name where the user profile data will be saved',
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UserProfileGet);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('Yaml file name must end with .yaml or .yml');
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let userDTO: UserDTO | null = null;
    let profileData: ProfileData | null = null;
    try {
      const result: NormalizedResponseDTO<UserDTO> = await api.getUserProfileByUsername(decoded.payload.username);
      userDTO = result.data;
      profileData = {
        email: userDTO.email,
        username: userDTO.username,
        name: userDTO.name,
        display_name: userDTO.display_name,
        bio: userDTO.bio,
        location: userDTO.location,
        link: userDTO.link,
      };
    } catch (e: any) {
      this.error(`Error getting user profile: ${e.response.data.message}`);
    }
    if (flags.images) {
      if (userDTO.avatar_url) {
        try {
          const imageUrl: string = userDTO.avatar_url.startsWith('http') ? userDTO.avatar_url : kysoCredentials.kysoInstallUrl + userDTO.avatar_url;
          const axiosResponse = await axios.get(imageUrl, { responseType: 'text', responseEncoding: 'base64' });
          if (axiosResponse.status === 200) {
            profileData.photo = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
          }
        } catch (e) {
          console.log(e);
        }
      }
      if (userDTO.background_image_url) {
        try {
          const backgroundImageUrl: string = userDTO.background_image_url.startsWith('http') ? userDTO.background_image_url : kysoCredentials.kysoInstallUrl + userDTO.background_image_url;
          const axiosResponse = await axios.get(backgroundImageUrl, { responseType: 'text', responseEncoding: 'base64' });
          if (axiosResponse.status === 200) {
            profileData.background = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
    const yamlString: string = jsYaml.dump(profileData);
    const path: string = resolve(args.yaml_file);
    writeFileSync(path, yamlString);
    this.log(`User profile data saved in ${path}`);
  }
}
