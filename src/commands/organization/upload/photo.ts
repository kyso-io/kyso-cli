import { GlobalPermissionsEnum, NormalizedResponseDTO, Organization, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { createReadStream, existsSync, ReadStream } from 'fs';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
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

    // Check if file exists
    if (!existsSync(args.image_file)) {
      this.log(`File ${args.image_file} does not exist`);
      return;
    }
    // Check if file is an image
    if (!Helper.isImage(args.image_file)) {
      this.log(`File ${args.image_file} is not an image. Valid formats are: png, jpg, jpeg, gif`);
      return;
    }

    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

    const organization: NormalizedResponseDTO<Organization> = await Helper.getOrganizationFromSlugSecurely(args.organization, kysoCredentials);

    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token, organization.data.sluglified_name);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const indexOrganization: number = tokenPermissions.organizations.findIndex(
      (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organization.data.sluglified_name,
    );
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to upload the photo for the organization ${args.organization}`);
      return;
    }
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];

    const hasPermissionDelete: boolean = Helper.hasPermission(resourcePermissions, OrganizationPermissionsEnum.DELETE);
    const isOrgAdmin: boolean = Helper.isOrganizationAdmin(resourcePermissions);
    const isGlobalAdmin: boolean = Helper.isGlobalAdmin(tokenPermissions);

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
