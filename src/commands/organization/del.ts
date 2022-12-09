import { GlobalPermissionsEnum, NormalizedResponseDTO, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class DeleteOrganization extends KysoCommand {
  static description = 'Delete organization from the system';

  static examples = [`$ kyso organization del <list_of_orgs>`];

  static args = [
    {
      name: 'list_of_orgs',
      description: 'List of organizations separated by commas',
      required: true,
    },
  ];

  private async deleteOrganization(api: Api, tokenPermissions: TokenPermissions, organizationSlug: string): Promise<void> {
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationSlug);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to delete the organization ${organizationSlug}`);
      return;
    }
    api.setOrganizationSlug(organizationSlug);
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const hasPermissionDelete: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.DELETE);
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!hasPermissionDelete && !isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to delete the organization ${organizationSlug}`);
      return;
    }
    try {
      await api.deleteOrganization(resourcePermissions.id);
      this.log(`Organization ${organizationSlug} deleted`);
    } catch (e: any) {
      this.log(`Error deleting the organization ${organizationSlug}: ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(DeleteOrganization);
    const organizationsNames: string[] = args.list_of_orgs.split(',');
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
    const tokenPermissions: TokenPermissions = resultPermissions.data;
    for (const organizationSlug of organizationsNames) {
      await this.deleteOrganization(api, tokenPermissions, organizationSlug);
    }
  }
}
