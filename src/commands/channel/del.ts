import { Organization, GlobalPermissionsEnum, NormalizedResponseDTO, OrganizationPermissionsEnum, ResourcePermissions, Team, TeamPermissionsEnum, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class DeleteChannel extends KysoCommand {
  static description = 'Remove the channels on the list_of_channels from the given organization.';

  static examples = [`$ kyso organization del <organization> <list_of_channels>`];

  static args = [
    {
      name: 'organization',
      description: 'Organization name',
      required: true,
    },
    {
      name: 'list_of_channels',
      description: 'List of channels separated by commas',
      required: true,
    },
  ];

  private async deleteChannel(api: Api, tokenPermissions: TokenPermissions, organizationSlug: string, channelSlug: string): Promise<void> {
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationSlug);
    if (indexOrganization === -1) {
      this.log(`Error: You don't belong to the organization '${organizationSlug}'`);
      return;
    }
    api.setOrganizationSlug(organizationSlug);
    const organizationResourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    let team: Team | null = null;
    try {
      const teamResponse: NormalizedResponseDTO<Team> = await api.getTeamBySlug(organizationResourcePermissions.id, channelSlug);
      team = teamResponse.data;
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 404) {
        this.log(`Error: The channel '${channelSlug}' doesn't exist`);
        return;
      }
    }
    const indexTeam: number = tokenPermissions.teams.findIndex((resourcePermissionTeam: ResourcePermissions) => resourcePermissionTeam.name === channelSlug);
    if (indexTeam === -1) {
      this.log(`Error: You don't belong to the channel '${channelSlug}'`);
      return;
    }
    api.setTeamSlug(channelSlug);
    const teamResourcePermissions: ResourcePermissions = tokenPermissions.teams[indexTeam];
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    const isOrgAdmin: boolean = organizationResourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const hasPermissionTeamAdmin: boolean = teamResourcePermissions.permissions.includes(TeamPermissionsEnum.ADMIN);
    const hasPermissionTeamDelete: boolean = teamResourcePermissions.permissions.includes(TeamPermissionsEnum.DELETE);
    if (!isGlobalAdmin && !isOrgAdmin && !hasPermissionTeamAdmin && !hasPermissionTeamDelete) {
      this.log(`Error: You don't have permissions to delete the channel ${channelSlug} from the organization ${organizationSlug}`);
      return;
    }
    try {
      await api.deleteTeam(team.id);
      this.log(`Channel '${channelSlug}' deleted`);
    } catch (e: any) {
      this.log(`Error deleting the organization '${organizationSlug}' ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(DeleteChannel);

    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

    const result: NormalizedResponseDTO<Organization> = await Helper.getOrganizationFromSlugSecurely(args.organization, kysoCredentials);
    const slugifiedOrganization = result.data.sluglified_name;

    const channelsSlugs: string[] = await Helper.getRealChannelsSlugFromStringArray(result.data, args.list_of_channels, kysoCredentials);

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
    for (const channelSlug of channelsSlugs) {
      await this.deleteChannel(api, tokenPermissions, slugifiedOrganization, channelSlug);
    }
  }
}
