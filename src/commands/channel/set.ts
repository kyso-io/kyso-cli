import { CheckPermissionDto, NormalizedResponseDTO, Organization, ResourcePermissions, Team, TeamPermissionsEnum, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { existsSync, readFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { ChannelData } from '../../types/channels-data';
import { ErrorResponse } from '../../types/error-response';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class ChannelsSet extends KysoCommand {
  static description =
    'Pass the channels configuration values from the yaml_file to the backend and merge its values with the existing ones.\nThis command does not get the organization or the channel names because we can pass multiple channels on the YAML file and each of them includes the channel name and the organization it belongs to.';

  static examples = [`$ kyso channel set <yaml_file>`];

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file with channels data',
      required: true,
    },
  ];

  private async updateChannel(api: Api, tokenPermissions: TokenPermissions, channelData: ChannelData): Promise<void> {
    if (!channelData.organization) {
      this.log(`Error: field 'organization' is required`);
      return;
    }
    if (!channelData.slug) {
      this.log(`Error: field 'slug' is required`);
      return;
    }
    let organization: Organization | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(channelData.organization);
      organization = resultOrganization.data;
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 404) {
        this.log(`Error: Organization '${channelData.organization}' does not exist`);
        return;
      }
      this.log(`An error occurred getting the organization '${channelData.organization}'`);
      return;
    }
    api.setOrganizationSlug(organization.sluglified_name);
    const indexOrganization: number = tokenPermissions.organizations.findIndex(
      (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === channelData.organization,
    );
    if (indexOrganization === -1) {
      this.log(`Error: You don't belong to the organization ${channelData.organization}`);
      return;
    }
    let channel: Team | null = null;
    try {
      const channelResponse: NormalizedResponseDTO<Team> = await api.getTeamBySlug(organization.id, channelData.slug);
      channel = channelResponse.data;
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      if (errorResponse.statusCode === 404) {
        this.log(`Error: Channel '${channelData.slug}' does not exist`);
        return;
      }
      this.log(`An error occurred getting the channel '${channelData.slug}'`);
      return;
    }
    const indexChannel: number = tokenPermissions.teams.findIndex(
      (resourcePermissionChannel: ResourcePermissions) => resourcePermissionChannel.organization_id === organization.id && resourcePermissionChannel.name === channelData.slug,
    );
    if (indexChannel === -1) {
      this.log(`Error: You don't belong to the channel ${channelData.slug} of the organization ${channelData.organization}`);
      return;
    }
    try {
      const checkPermissionDto: CheckPermissionDto = new CheckPermissionDto(channelData.organization, channelData.slug, TeamPermissionsEnum.EDIT);
      const checkPermissionsResponse: NormalizedResponseDTO<boolean> = await api.checkPermission(checkPermissionDto);
      if (!checkPermissionsResponse.data) {
        this.log(`Error: You don't have permissions to edit the information for the channel '${channelData.slug}' of the organization '${channelData.organization}'`);
        return;
      }
    } catch (e: any) {
      this.error('');
    }
    const updateChannelDto: any = {};
    if (channelData.display_name && channelData.display_name !== channel.display_name) {
      updateChannelDto.display_name = channelData.display_name;
    }
    if (channelData.visibility && channelData.visibility !== channel.visibility) {
      updateChannelDto.visibility = channelData.visibility;
    }
    if (channelData.description && channelData.description !== channel.bio) {
      updateChannelDto.bio = channelData.description;
    }
    if (Object.keys(updateChannelDto).length > 0) {
      try {
        api.setTeamSlug(channel.sluglified_name);
        await api.updateTeam(channel.id, updateChannelDto);
        this.log(`Channel '${channel.sluglified_name}' updated`);
      } catch (e: any) {
        this.log(`Error updating channel '${channelData.slug}': ${e.response.data.message}`);
      }
    } else {
      this.log(`Channel '${channelData.slug}' is already up to date`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(ChannelsSet);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('File is not a yaml file');
    }
    if (!existsSync(args.yaml_file)) {
      this.log(`File ${args.yaml_file} does not exist`);
      return;
    }
    // Read yaml file
    const yamlFileContent: string = readFileSync(args.yaml_file, 'utf8');
    let channelsData: ChannelData[] | null = null;
    try {
      channelsData = jsYaml.load(yamlFileContent) as ChannelData[];
      if (!Array.isArray(channelsData)) {
        this.error('File is not an array of channels');
      }
    } catch (e) {
      this.error('File is not a valid yaml file');
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    for (const channelData of channelsData) {
      if (!channelData.slug) {
        continue;
      }

      // Re-slug just in case
      channelData.slug = Helper.slug(channelData.slug);

      await this.updateChannel(api, tokenPermissions, channelData);
    }
  }
}
