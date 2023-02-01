import { GlobalPermissionsEnum, NormalizedResponseDTO, TokenPermissions, UserDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import axios from 'axios';
import { createReadStream, existsSync, readFileSync, ReadStream, unlinkSync, writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { join } from 'path';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { ProfileData } from '../../types/profile-data';
import { KysoCommand } from '../kyso-command';

export default class SetUsers extends KysoCommand {
  static description = 'Update users profile data given yaml file';

  static examples = [`$ kyso user set <yaml_file>`];

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file with users profile data',
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

  private async updateUserData(api: Api, profileData: ProfileData): Promise<void> {
    let userDto: UserDTO | null = null;
    let photoBase64: string | null = null;
    let backgroundImageBase64: string | null = null;
    try {
      const usersResponse: NormalizedResponseDTO<UserDTO[]> = await api.getUsers({ userIds: [], page: 1, per_page: 1000, sort: 'email', search: encodeURIComponent(profileData.email) });
      const users: UserDTO[] = usersResponse.data;
      if (users.length === 0) {
        this.log(`Error: User with email '${profileData.email}' not found`);
        return;
      }
      const index: number = users.findIndex((user: UserDTO) => user.email === profileData.email);
      if (index === -1) {
        this.log(`Error: User with email '${profileData.email}' not found`);
        return;
      }
      userDto = users[index];
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`Error getting the user '${profileData.email}': ${errorResponse.message}`);
      return;
    }
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
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
    if ((!photoBase64 && profileData.photo) || (photoBase64 && profileData.photo && photoBase64 !== profileData.photo)) {
      await this.updatePhoto(api, userDto.id, profileData.photo);
      updatedPhoto = true;
    }
    let updatedBackgroundImage = false;
    if ((!backgroundImageBase64 && profileData.background) || (backgroundImageBase64 && profileData.background && backgroundImageBase64 !== profileData.background)) {
      await this.updateBackgroundImage(api, userDto.id, profileData.background);
      updatedBackgroundImage = true;
    }
    const updateUserRequestDto: any = {};
    if (profileData.name && profileData.name !== userDto.name) {
      updateUserRequestDto.name = profileData.name;
    }
    if (profileData.display_name && profileData.display_name !== userDto.display_name) {
      updateUserRequestDto.display_name = profileData.display_name;
    }
    if (profileData.location && profileData.location !== userDto.location) {
      updateUserRequestDto.location = profileData.location;
    }
    if (profileData.link && profileData.link !== userDto.link) {
      updateUserRequestDto.link = profileData.link;
    }
    if (profileData.bio && profileData.bio !== userDto.bio) {
      updateUserRequestDto.bio = profileData.bio;
    }
    if (Object.keys(updateUserRequestDto).length > 0) {
      try {
        await api.updateUser(userDto.id, updateUserRequestDto);
        this.log(`User '${profileData.email}' updated`);
      } catch (e: any) {
        this.error(`Error updating user ${profileData.email}: ${e.response.data.message}`);
      }
    } else {
      if (!updatedPhoto && !updatedBackgroundImage) {
        this.log(`No changes for the user '${profileData.email}'`);
      } else {
        this.log(`User '${profileData.email}' updated`);
      }
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(SetUsers);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('File is not a yaml file');
    }
    if (!existsSync(args.yaml_file)) {
      this.log(`File ${args.yaml_file} does not exist`);
      return;
    }
    const yamlFileContent: string = readFileSync(args.yaml_file, 'utf8');
    let profilesData: ProfileData[] | null = null;
    try {
      profilesData = jsYaml.load(yamlFileContent) as ProfileData[];
      if (!Array.isArray(profilesData)) {
        this.error('File is not an array of users profile');
      }
    } catch (e) {
      this.error('File is not a valid yaml file');
    }
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
    let index = 0;
    for (const profileData of profilesData) {
      if (!Helper.isEmail(profileData.email)) {
        this.log(`Email of item in position ${index}' is not a valid email`);
        index++;
        continue;
      }
      await this.updateUserData(api, profileData);
      index++;
    }
  }
}
