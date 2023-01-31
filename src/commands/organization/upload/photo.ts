import { GlobalPermissionsEnum, NormalizedResponseDTO, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { createReadStream, existsSync, ReadStream } from 'fs';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { isImage } from '../../../helpers/is-image';
import slug from '../../../helpers/slugify';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class UploadPhoto extends KysoCommand {
  static description = 'Upload the image_file as the `photo` image of the given organization';

  static examples = [`$ kyso organization upload photo <organization> <image_file>`];

  static args = [
    {
      name: 'organization',
      description: 'Organization name',
      required: true,
    },
    {
      name: 'image_file',
      required: true,
      description: 'Path to the image',
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(UploadPhoto);
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedOrganization = slug(args.organization);

    // Check if file exists
    if (!existsSync(args.image_file)) {
      this.log(`File ${args.image_file} does not exist`);
      return;
    }
    // Check if file is an image
    if (!isImage(args.image_file)) {
      this.log(`File ${args.image_file} is not an image. Valid formats are: png, jpg, jpeg, gif`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token, slugifiedOrganization);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === slugifiedOrganization);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to upload the photo for the organization ${args.organization}`);
      return;
    }
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const hasPermissionDelete: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.EDIT);
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!hasPermissionDelete && !isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to upload the photo for the organization ${args.organization}`);
      return;
    }
    try {
      const readStream: ReadStream = createReadStream(args.image_file);
      await api.uploadOrganizationImage(resourcePermissions.id, readStream);
      this.log(`Photo uploaded successfully`);
    } catch (e: any) {
      this.log(`Error uploading image: ${e.response.data.message}`);
    }
  }
}
