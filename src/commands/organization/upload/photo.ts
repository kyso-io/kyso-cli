import { GlobalPermissionsEnum, NormalizedResponseDTO, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { createReadStream, existsSync, ReadStream } from 'fs';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { isImage } from '../../../helpers/is-image';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class UploadPhoto extends KysoCommand {
  static description = 'Upload organization upload photo to Kyso';

  static examples = [`$ kyso organization upload photo <org_name> <path>`];

  static args = [
    {
      name: 'org_name',
      description: 'Organization name',
      required: true,
    },
    {
      name: 'path',
      required: true,
      description: 'Path to the image',
    },
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(UploadPhoto);
    // Check if file exists
    if (!existsSync(args.path)) {
      this.log(`File ${args.path} does not exist`);
      return;
    }
    // Check if file is an image
    if (!isImage(args.path)) {
      this.log(`File ${args.path} is not an image. Valid formats are: png, jpg, jpeg, gif`);
      return;
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token, args.org_name);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
    const tokenPermissions: TokenPermissions = resultPermissions.data;
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === args.org_name);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to upload the photo for the organization ${args.org_name}`);
      return;
    }
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const hasPermissionDelete: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.EDIT);
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!hasPermissionDelete && !isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to upload the photo for the organization ${args.org_name}`);
      return;
    }
    try {
      const readStream: ReadStream = createReadStream(args.path);
      await api.uploadOrganizationImage(resourcePermissions.id, readStream);
      this.log(`Photo uploaded successfully`);
    } catch (e: any) {
      this.log(`Error uploading image: ${e.response.data.message}`);
    }
  }
}
