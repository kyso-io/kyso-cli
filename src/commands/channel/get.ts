import { NormalizedResponseDTO, Organization, ResourcePermissions, Team, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import slug from '../../helpers/slugify';
import { ChannelData } from '../../types/channels-data';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class ChannelsGet extends KysoCommand {
  static description = 'Save the configuration values of the channels on the list_of_channels from the given organization on a yaml_file.';

  static examples = [`$ kyso organization get <organization> <list_of_channels> <yaml_file>`];

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
    {
      name: 'yaml_file',
      description: 'Yaml file where the channel data will be saved',
      required: true,
    },
  ];

  private async getChannelData(api: Api, tokenPermissions: TokenPermissions, organization: Organization, channelSlug: string): Promise<ChannelData> {
    let channelData: ChannelData | null = null;
    const index: number = tokenPermissions.teams.findIndex((resourcePermissionTeam: ResourcePermissions) => resourcePermissionTeam.name === channelSlug);
    if (index === -1) {
      this.log(`Error: You don't have permissions to get the information for the channel '${channelSlug}'`);
      return channelData;
    }
    let team: Team | null = null;
    try {
      const resultTeam: NormalizedResponseDTO<Team> = await api.getTeamBySlug(organization.id, channelSlug);
      team = resultTeam.data;
      channelData = {
        organization: organization.sluglified_name,
        slug: team.sluglified_name,
        visibility: team.visibility,
        display_name: team.display_name,
        description: team.bio,
      };
    } catch (e: any) {
      if (e.response.status === 404) {
        this.log(`Error: Channel '${channelSlug}' not found`);
        return channelData;
      }
      this.log(`An error occurred getting the channel '${channelSlug}': ${e.response.data.message}`);
      return channelData;
    }
    return channelData;
  }

  async run(): Promise<void> {
    const { args } = await this.parse(ChannelsGet);

    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedOrganization = slug(args.organization);

    const channelsNames: string[] = args.list_of_channels.split(',');
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('Yaml file name must end with .yaml or .yml');
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
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === slugifiedOrganization);
    if (indexOrganization === -1) {
      this.error(`You don't belong to the organization '${args.organization}'`);
    }
    let organization: Organization | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(slugifiedOrganization);
      organization = resultOrganization.data;
    } catch (e: any) {
      if (e.response.status === 404) {
        this.error(`Organization '${args.organization}' not found`);
      }
      this.error(`${e.response.data.message}`);
    }
    const result: ChannelData[] = [];
    for (const channelName of channelsNames) {
      const slugifiedChannel = slug(channelName);
      const channelData: ChannelData = await this.getChannelData(api, tokenPermissions, organization, slugifiedChannel);
      if (!channelData) {
        continue;
      }
      result.push(channelData);
    }
    if (result.length === 0) {
      this.log('No channels found');
      return;
    }
    const yamlData: string = jsYaml.dump(result);
    const yamlFilePath: string = resolve(args.yaml_file);
    writeFileSync(yamlFilePath, yamlData);
    this.log(`Channels data saved in ${yamlFilePath}`);
  }
}
