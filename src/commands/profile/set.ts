import { NormalizedResponseDTO, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import axios from 'axios';
import { createReadStream, existsSync, readFileSync, ReadStream, unlinkSync, writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { join } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { ProfileData } from '../../types/profile-data';
import { KysoCommand } from '../kyso-command';

export default class UserProfileSet extends KysoCommand {
  static description = 'Update user profile data given yaml file';

  static examples = [`$ kyso profile set <yaml_file>`];

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file with user profile data',
      required: true,
    },
  ];

  private async updatePhoto(api: Api, userId: string, photoBase64: string): Promise<void> {
    if (!photoBase64.startsWith('data:image/')) {
      this.error('Photo must be a base64 string');
    }
    try {
      // Create file from base64 string
      const formatImage: string = photoBase64.split(';')[0].split('/')[1];
      const imageFilePath: string = join(KysoCommand.DATA_DIRECTORY, `photo-${new Date().getTime()}.${formatImage}`);
      const buffer: Buffer = Buffer.from(photoBase64.split(',')[1], 'base64');
      writeFileSync(imageFilePath, buffer);
      const readStream: ReadStream = createReadStream(imageFilePath);
      await api.uploadUserProfileImage(userId, readStream);
      unlinkSync(imageFilePath);
    } catch (e: any) {
      this.log(`Error uploading profile photo: ${e.response.data.message}`);
    }
  }

  private async updateBackgroundImage(api: Api, userId: string, backgroundBase64: string): Promise<void> {
    if (!backgroundBase64.startsWith('data:image/')) {
      this.error('Background image must be a base64 string');
    }
    try {
      // Create file from base64 string
      const formatImage: string = backgroundBase64.split(';')[0].split('/')[1];
      const imageFilePath: string = join(KysoCommand.DATA_DIRECTORY, `background-${new Date().getTime()}.${formatImage}`);
      const buffer: Buffer = Buffer.from(backgroundBase64.split(',')[1], 'base64');
      writeFileSync(imageFilePath, buffer);
      const readStream: ReadStream = createReadStream(imageFilePath);
      await api.uploadUserBackgroundImage(userId, readStream);
      unlinkSync(imageFilePath);
    } catch (e: any) {
      this.log(`Error uploading background profile image: ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(UserProfileSet);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('File is not a yaml file');
    }
    if (!existsSync(args.yaml_file)) {
      this.log(`File ${args.yaml_file} does not exist`);
      return;
    }
    // Read yaml file
    const yamlFileContent: string = readFileSync(args.yaml_file, 'utf8');
    let yamlProfileData: ProfileData | null = null;
    try {
      yamlProfileData = jsYaml.load(yamlFileContent) as ProfileData;
    } catch (e) {
      this.error('File is not a valid yaml file');
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let userDto: UserDTO | null = null;
    let profileData: ProfileData | null = null;
    let photoBase64: string | null = null;
    let backgroundImageBase64: string | null = null;
    try {
      const result: NormalizedResponseDTO<UserDTO> = await api.getUserProfileByUsername(decoded.payload.username);
      userDto = result.data;
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
      this.error(`Error getting user profile: ${e.response.data.message}`);
    }
    if (userDto.avatar_url) {
      try {
        const imageUrl: string = userDto.avatar_url.startsWith('http') ? userDto.avatar_url : kysoCredentials.kysoInstallUrl + userDto.avatar_url;
        const axiosResponse = await axios.get(imageUrl, { responseType: 'text', responseEncoding: 'base64' });
        if (axiosResponse.status === 200) {
          photoBase64 = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
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
          backgroundImageBase64 = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
        }
      } catch (e) {
        console.log(e);
      }
    }
    let updatedPhoto = false;
    if ((!photoBase64 && yamlProfileData.photo) || (photoBase64 && yamlProfileData.photo && photoBase64 !== yamlProfileData.photo)) {
      await this.updatePhoto(api, userDto.id, yamlProfileData.photo);
      updatedPhoto = true;
    }
    let updatedBackgroundImage = false;
    if ((!backgroundImageBase64 && yamlProfileData.background) || (backgroundImageBase64 && yamlProfileData.background && backgroundImageBase64 !== yamlProfileData.background)) {
      await this.updateBackgroundImage(api, userDto.id, yamlProfileData.background);
      updatedBackgroundImage = true;
    }
    const updateUserRequestDto: any = {};
    if (yamlProfileData.name && yamlProfileData.name !== profileData.name) {
      updateUserRequestDto.name = yamlProfileData.name;
    }
    if (yamlProfileData.display_name && yamlProfileData.display_name !== profileData.display_name) {
      updateUserRequestDto.display_name = yamlProfileData.display_name;
    }
    if (yamlProfileData.location && yamlProfileData.location !== profileData.location) {
      updateUserRequestDto.location = yamlProfileData.location;
    }
    if (yamlProfileData.link && yamlProfileData.link !== profileData.link) {
      updateUserRequestDto.link = yamlProfileData.link;
    }
    if (yamlProfileData.bio && yamlProfileData.bio !== profileData.bio) {
      updateUserRequestDto.bio = yamlProfileData.bio;
    }
    if (Object.keys(updateUserRequestDto).length > 0) {
      try {
        await api.updateUser(userDto.id, updateUserRequestDto);
        this.log('User profile updated');
      } catch (e: any) {
        this.error(`Error updating user profile: ${e.response.data.message}`);
      }
    } else {
      if (!updatedPhoto && !updatedBackgroundImage) {
        this.log('No changes to update');
      } else {
        this.log('User profile updated');
      }
    }
  }
}
