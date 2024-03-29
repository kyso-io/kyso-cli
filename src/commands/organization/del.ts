import type { Organization, NormalizedResponseDTO, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { OrganizationPermissionsEnum } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class DeleteOrganization extends KysoCommand {
  static description = 'Remove the organizations included in the list_of_orgs.';

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
    if (indexOrganization === -1 && !Helper.isGlobalAdmin(tokenPermissions)) {
      this.log(`You don't have permissions to delete the organization '${organizationSlug}'`);
      return;
    }
    api.setOrganizationSlug(organizationSlug);
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];

    const hasPermissionDelete: boolean = Helper.hasPermission(resourcePermissions, OrganizationPermissionsEnum.DELETE);
    const isOrgAdmin: boolean = Helper.isOrganizationAdmin(resourcePermissions);
    const isGlobalAdmin: boolean = Helper.isGlobalAdmin(tokenPermissions);

    if (!hasPermissionDelete && !isOrgAdmin && !isGlobalAdmin) {
      this.log(`You don't have permissions to delete the organization '${organizationSlug}'`);
      return;
    }

    let organizationId: string | null = null;
    if (!resourcePermissions) {
      try {
        const organizationResult: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationSlug);
        organizationId = organizationResult.data.id;
      } catch (e: any) {
        this.log(`Error getting the organization '${organizationSlug}': ${e.response.data.message}`);
        return;
      }
    } else {
      organizationId = resourcePermissions.id;
    }

    try {
      await api.deleteOrganization(organizationId);
      this.log(`Organization '${organizationSlug}' deleted`);
    } catch (e: any) {
      this.log(`Error deleting the organization '${organizationSlug}': ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(DeleteOrganization);

    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const organizationsSlugs: string[] = await Helper.getRealOrganizationSlugFromStringArray(args.list_of_orgs, kysoCredentials);

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
    for (const organizationSlug of organizationsSlugs) {
      await this.deleteOrganization(api, tokenPermissions, organizationSlug);
    }
  }
}
